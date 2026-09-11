import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ImageStudioAsset } from '@prisma/client';
import type { AuthUser } from '../../../common/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ObjectStorageService } from '../../storage/object-storage.service';
import { ImageStudioProjectsService } from './image-studio-projects.service';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class ImageStudioAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly projects: ImageStudioProjectsService,
  ) {}

  async upload(
    user: AuthUser,
    projectId: string,
    file: Express.Multer.File,
  ) {
    const project = await this.projects.findOwned(user, projectId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传文件');
    }
    this.assertAllowedFile(file);

    const mimeType = file.mimetype;
    const ext = extensionForMime(mimeType);

    const pending = await this.prisma.imageStudioAsset.create({
      data: {
        projectId: project.id,
        turnId: null,
        objectKey: 'pending',
        mimeType,
      },
    });

    const objectKey = `image-studio/${user.tenantId}/${user.userId}/${project.id}/${pending.id}.${ext}`;

    try {
      await this.storage.putObject(objectKey, file.buffer, mimeType);
      const row = await this.prisma.imageStudioAsset.update({
        where: { id: pending.id },
        data: { objectKey },
      });
      return this.serialize(row);
    } catch {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      await this.prisma.imageStudioAsset
        .delete({ where: { id: pending.id } })
        .catch(() => undefined);
      throw new BadGatewayException('存储服务不可用');
    }
  }

  async select(user: AuthUser, projectId: string, assetId: string) {
    const project = await this.projects.findOwned(user, projectId);
    const asset = await this.prisma.imageStudioAsset.findFirst({
      where: { id: assetId, projectId: project.id },
    });
    if (!asset) throw new NotFoundException('资源不存在');

    await this.prisma.$transaction(async (tx) => {
      await tx.imageStudioAsset.updateMany({
        where: { projectId: project.id, selected: true },
        data: { selected: false },
      });
      await tx.imageStudioAsset.update({
        where: { id: asset.id },
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
          currentAssetId: asset.id,
          ...(project.coverObjectKey
            ? {}
            : { coverObjectKey: asset.objectKey }),
        },
      });
    });

    return this.projects.get(user, project.id);
  }

  async getContent(
    user: AuthUser,
    assetId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const asset = await this.findOwnedAsset(user, assetId);
    try {
      const buffer = await this.storage.getObject(asset.objectKey);
      return { buffer, mimeType: asset.mimeType };
    } catch (err) {
      if (isStorageObjectMissing(err)) {
        throw new NotFoundException('资源不存在');
      }
      throw new BadGatewayException('存储服务不可用');
    }
  }

  async findOwnedAsset(user: AuthUser, assetId: string) {
    const asset = await this.prisma.imageStudioAsset.findFirst({
      where: {
        id: assetId,
        project: {
          tenantId: user.tenantId,
          userId: user.userId,
          deletedAt: null,
        },
      },
    });
    if (!asset) throw new NotFoundException('资源不存在');
    return asset;
  }

  private assertAllowedFile(file: Express.Multer.File) {
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('单文件不能超过 10MB');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('仅支持 png/jpeg/webp');
    }
  }

  private serialize(row: ImageStudioAsset) {
    return {
      id: row.id,
      projectId: row.projectId,
      turnId: row.turnId,
      mimeType: row.mimeType,
      width: row.width,
      height: row.height,
      selected: row.selected,
      createdAt: row.createdAt.toISOString(),
    };
  }
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
