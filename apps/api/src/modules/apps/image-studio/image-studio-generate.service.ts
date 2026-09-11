import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ImageStudioAsset, ImageStudioTurn } from '@prisma/client';
import type { GenerateImageStudioInput } from '@work-ally/shared';
import type { AuthUser } from '../../../common/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ObjectStorageService } from '../../storage/object-storage.service';
import { ImageStudioModelsService } from './image-studio-models.service';
import { ImageStudioProjectsService } from './image-studio-projects.service';
import {
  openaiCompatibleImages,
  OpenAiCompatibleImagesError,
  formatProviderError,
} from './providers/openai-compatible-images';

@Injectable()
export class ImageStudioGenerateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly projects: ImageStudioProjectsService,
    private readonly models: ImageStudioModelsService,
  ) {}

  async generate(
    user: AuthUser,
    projectId: string,
    input: GenerateImageStudioInput,
  ) {
    const project = await this.projects.findOwned(user, projectId);
    const model = await this.models.resolveEnabledWithApiKey(
      user.tenantId,
      input.modelId ?? project.defaultModelId,
    );

    if (model.provider !== 'openai_compatible') {
      throw new BadRequestException('该 provider 暂未实现');
    }

    const capabilities = parseModelCapabilities(model.capabilities);
    const sourceAssetId = input.sourceAssetId ?? null;
    if (sourceAssetId) {
      if (!capabilities.imageToImage) {
        throw new BadRequestException('当前模型不支持图生图');
      }
    } else if (!capabilities.textToImage) {
      throw new BadRequestException('当前模型不支持文生图');
    }

    let sourceImage: Buffer | undefined;
    let sourceMime: string | undefined;
    if (sourceAssetId) {
      const source = await this.prisma.imageStudioAsset.findFirst({
        where: { id: sourceAssetId, projectId: project.id },
      });
      if (!source) throw new NotFoundException('资源不存在');
      try {
        sourceImage = await this.storage.getObject(source.objectKey);
      } catch (err) {
        if (isStorageObjectMissing(err)) {
          throw new NotFoundException('资源不存在');
        }
        throw err;
      }
      sourceMime = source.mimeType;
    }

    if (input.parentTurnId) {
      const parent = await this.prisma.imageStudioTurn.findFirst({
        where: { id: input.parentTurnId, projectId: project.id },
      });
      if (!parent) throw new NotFoundException('回合不存在');
    }

    const turn = await this.prisma.imageStudioTurn.create({
      data: {
        projectId: project.id,
        parentTurnId: input.parentTurnId ?? null,
        prompt: input.prompt,
        modelId: model.id,
        sourceAssetId,
        status: 'running',
      },
    });

    const createdAssets: ImageStudioAsset[] = [];
    try {
      const images = await openaiCompatibleImages({
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        modelName: model.modelName,
        prompt: input.prompt,
        n: input.n,
        sourceImage,
        sourceMime,
        defaultParams: model.defaultParams,
      });

      for (const image of images) {
        const pending = await this.prisma.imageStudioAsset.create({
          data: {
            projectId: project.id,
            turnId: turn.id,
            objectKey: 'pending',
            mimeType: image.mimeType,
          },
        });
        createdAssets.push(pending);
        const ext = extensionForMime(image.mimeType);
        const objectKey = `image-studio/${user.tenantId}/${user.userId}/${project.id}/${pending.id}.${ext}`;
        await this.storage.putObject(objectKey, image.buffer, image.mimeType);
        const asset = await this.prisma.imageStudioAsset.update({
          where: { id: pending.id },
          data: { objectKey },
        });
        const idx = createdAssets.findIndex((a) => a.id === pending.id);
        if (idx >= 0) createdAssets[idx] = asset;
      }

      const done = await this.prisma.imageStudioTurn.update({
        where: { id: turn.id },
        data: { status: 'done' },
      });

      if (!project.currentAssetId && createdAssets[0]) {
        const first = createdAssets[0];
        await this.prisma.$transaction(async (tx) => {
          await tx.imageStudioAsset.updateMany({
            where: { projectId: project.id, selected: true },
            data: { selected: false },
          });
          await tx.imageStudioAsset.update({
            where: { id: first.id },
            data: { selected: true },
          });
          await tx.imageStudioProject.updateMany({
            where: {
              id: project.id,
              tenantId: user.tenantId,
              userId: user.userId,
              deletedAt: null,
            },
            data: {
              currentAssetId: first.id,
              ...(project.coverObjectKey
                ? {}
                : { coverObjectKey: first.objectKey }),
            },
          });
        });
      }

      return this.serializeTurn(done, createdAssets);
    } catch (err) {
      await this.cleanupFailedTurnAssets(turn.id);

      const errorMessage =
        err instanceof OpenAiCompatibleImagesError
          ? err.sanitizedMessage.slice(0, 2000)
          : formatProviderError(
              err instanceof Error ? err.message : String(err),
            ).slice(0, 2000);

      const failed = await this.prisma.imageStudioTurn.update({
        where: { id: turn.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      });
      return this.serializeTurn(failed, []);
    }
  }

  private async cleanupFailedTurnAssets(turnId: string) {
    const assets = await this.prisma.imageStudioAsset.findMany({
      where: { turnId },
    });
    if (!assets.length) return;
    for (const asset of assets) {
      if (asset.objectKey && asset.objectKey !== 'pending') {
        await this.storage.deleteObject(asset.objectKey).catch(() => undefined);
      }
    }
    await this.prisma.imageStudioAsset
      .deleteMany({ where: { turnId } })
      .catch(() => undefined);
  }

  async getTurn(user: AuthUser, turnId: string) {
    const turn = await this.prisma.imageStudioTurn.findFirst({
      where: {
        id: turnId,
        project: {
          tenantId: user.tenantId,
          userId: user.userId,
          deletedAt: null,
        },
      },
      include: {
        assets: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!turn) throw new NotFoundException('回合不存在');
    return this.serializeTurn(turn, turn.assets);
  }

  async listTurns(user: AuthUser, projectId: string) {
    const project = await this.projects.findOwned(user, projectId);
    const turns = await this.prisma.imageStudioTurn.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
      include: {
        assets: { orderBy: { createdAt: 'asc' } },
      },
    });
    return turns.map((turn) => this.serializeTurn(turn, turn.assets));
  }

  private serializeTurn(turn: ImageStudioTurn, assets: ImageStudioAsset[]) {
    return {
      id: turn.id,
      projectId: turn.projectId,
      parentTurnId: turn.parentTurnId,
      prompt: turn.prompt,
      modelId: turn.modelId,
      sourceAssetId: turn.sourceAssetId,
      status: turn.status,
      errorMessage: turn.errorMessage,
      createdAt: turn.createdAt.toISOString(),
      updatedAt: turn.updatedAt.toISOString(),
      assets: assets.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        turnId: row.turnId,
        mimeType: row.mimeType,
        width: row.width,
        height: row.height,
        selected: row.selected,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}

function parseModelCapabilities(raw: unknown): {
  textToImage: boolean;
  imageToImage: boolean;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { textToImage: false, imageToImage: false };
  }
  const caps = raw as Record<string, unknown>;
  return {
    textToImage: caps.textToImage === true,
    imageToImage: caps.imageToImage === true,
  };
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

function isStorageObjectMissing(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.startsWith('Object not found:')) return true;
  const name = (err as { name?: string }).name;
  if (name === 'NoSuchKey' || name === 'NotFound') return true;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  return status === 404;
}
