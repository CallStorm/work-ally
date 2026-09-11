import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ImageStudioProject } from '@prisma/client';
import type {
  CreateImageStudioProjectInput,
  UpdateImageStudioProjectInput,
} from '@work-ally/shared';
import type { AuthUser } from '../../../common/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImageStudioModelsService } from './image-studio-models.service';

@Injectable()
export class ImageStudioProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ImageStudioModelsService,
  ) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.imageStudioProject.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.userId,
        deletedAt: null,
      },
      orderBy: [{ starred: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((row) => this.serialize(row));
  }

  async get(user: AuthUser, id: string) {
    return this.serialize(await this.findOwned(user, id));
  }

  async create(user: AuthUser, input: CreateImageStudioProjectInput) {
    await this.assertDefaultModel(user.tenantId, input.defaultModelId ?? null);

    const row = await this.prisma.imageStudioProject.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        name: input.name.trim(),
        description: input.description ?? '',
        defaultModelId: input.defaultModelId ?? null,
      },
    });
    return this.serialize(row);
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateImageStudioProjectInput,
  ) {
    const existing = await this.findOwned(user, id);

    if (input.defaultModelId !== undefined) {
      await this.assertDefaultModel(user.tenantId, input.defaultModelId);
    }

    let currentAssetIdToSet: string | null | undefined = undefined;
    if (input.currentAssetId !== undefined) {
      if (input.currentAssetId !== null) {
        const asset = await this.prisma.imageStudioAsset.findFirst({
          where: { id: input.currentAssetId, projectId: existing.id },
        });
        if (!asset) throw new NotFoundException('资源不存在');
      }
      currentAssetIdToSet = input.currentAssetId;
    }

    const data: Prisma.ImageStudioProjectUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.starred !== undefined) data.starred = input.starred;
    if (input.defaultModelId !== undefined) {
      data.defaultModelId = input.defaultModelId;
    }
    if (currentAssetIdToSet !== undefined) {
      data.currentAssetId = currentAssetIdToSet;
    }
    if (input.workspaceState !== undefined) {
      data.workspaceState =
        input.workspaceState === null
          ? Prisma.DbNull
          : (input.workspaceState as Prisma.InputJsonValue);
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.imageStudioProject.updateMany({
        where: {
          id: existing.id,
          tenantId: user.tenantId,
          userId: user.userId,
          deletedAt: null,
        },
        data,
      });
      if (result.count === 0) throw new NotFoundException('项目不存在');

      // Keep selected flags aligned with currentAssetId (same as select endpoint).
      if (currentAssetIdToSet !== undefined) {
        await tx.imageStudioAsset.updateMany({
          where: { projectId: existing.id, selected: true },
          data: { selected: false },
        });
        if (currentAssetIdToSet !== null) {
          await tx.imageStudioAsset.updateMany({
            where: { id: currentAssetIdToSet, projectId: existing.id },
            data: { selected: true },
          });
        }
      }
    });

    const row = await this.prisma.imageStudioProject.findFirst({
      where: {
        id: existing.id,
        tenantId: user.tenantId,
        userId: user.userId,
        deletedAt: null,
      },
    });
    if (!row) throw new NotFoundException('项目不存在');
    return this.serialize(row);
  }

  async softDelete(user: AuthUser, id: string) {
    const existing = await this.findOwned(user, id);
    const result = await this.prisma.imageStudioProject.updateMany({
      where: {
        id: existing.id,
        tenantId: user.tenantId,
        userId: user.userId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('项目不存在');
    return { ok: true };
  }

  async listPublicModels(tenantId: string) {
    const rows = await this.prisma.imageStudioModel.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.models.serializePublic(row));
  }

  async findOwned(user: AuthUser, id: string) {
    const p = await this.prisma.imageStudioProject.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        userId: user.userId,
        deletedAt: null,
      },
    });
    if (!p) throw new NotFoundException('项目不存在');
    return p;
  }

  private async assertDefaultModel(
    tenantId: string,
    defaultModelId: string | null,
  ) {
    if (defaultModelId == null) return;
    const model = await this.prisma.imageStudioModel.findFirst({
      where: { id: defaultModelId, tenantId, enabled: true },
    });
    if (!model) throw new NotFoundException('模型不存在');
  }

  private serialize(row: ImageStudioProject) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coverObjectKey: row.coverObjectKey,
      currentAssetId: row.currentAssetId,
      defaultModelId: row.defaultModelId,
      starred: row.starred,
      workspaceState: row.workspaceState,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
