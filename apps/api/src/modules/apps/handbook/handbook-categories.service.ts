import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HandbookCategory } from '@prisma/client';
import type {
  CreateHandbookCategoryInput,
  UpdateHandbookCategoryInput,
} from '@work-ally/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';

@Injectable()
export class HandbookCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.handbookCategory.findMany({
      where: { tenantId: user.tenantId, userId: user.userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  async create(user: AuthUser, input: CreateHandbookCategoryInput) {
    await this.assertParentAllowed(user, input.parentId ?? null);

    const row = await this.prisma.handbookCategory.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        name: input.name.trim(),
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return this.serialize(row);
  }

  async update(user: AuthUser, id: string, input: UpdateHandbookCategoryInput) {
    const existing = await this.findOwned(user, id);

    const nextParent =
      input.parentId !== undefined ? input.parentId : existing.parentId;
    if (nextParent === existing.id) {
      throw new BadRequestException('分类不能成为自己的父级');
    }
    await this.assertParentAllowed(user, nextParent);

    if (nextParent != null) {
      const childCount = await this.prisma.handbookCategory.count({
        where: {
          tenantId: user.tenantId,
          userId: user.userId,
          parentId: existing.id,
        },
      });
      if (childCount > 0) {
        throw new BadRequestException('含有子分类的节点不能移到第二级');
      }
    }

    const row = await this.prisma.handbookCategory.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? existing.name,
        parentId: nextParent,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
    });
    return this.serialize(row);
  }

  async remove(user: AuthUser, id: string) {
    await this.findOwned(user, id);

    const childCount = await this.prisma.handbookCategory.count({
      where: { tenantId: user.tenantId, userId: user.userId, parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException('请先删除或移走子分类');
    }

    await this.prisma.handbookNote.updateMany({
      where: { tenantId: user.tenantId, userId: user.userId, categoryId: id },
      data: { categoryId: null },
    });
    await this.prisma.handbookCategory.delete({ where: { id } });
    return { ok: true };
  }

  private async assertParentAllowed(user: AuthUser, parentId: string | null) {
    if (parentId == null) return;

    const parent = await this.prisma.handbookCategory.findFirst({
      where: { id: parentId, tenantId: user.tenantId, userId: user.userId },
    });
    if (!parent) throw new NotFoundException('父分类不存在');
    if (parent.parentId != null) {
      throw new BadRequestException('分类最多两层');
    }
  }

  private async findOwned(user: AuthUser, id: string) {
    const row = await this.prisma.handbookCategory.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.userId },
    });
    if (!row) throw new NotFoundException('分类不存在');
    return row;
  }

  private serialize(row: HandbookCategory) {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
