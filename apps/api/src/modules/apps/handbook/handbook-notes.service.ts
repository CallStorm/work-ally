import { Injectable, NotFoundException } from '@nestjs/common';
import type { HandbookNote, Prisma } from '@prisma/client';
import type {
  CreateHandbookNoteInput,
  UpdateHandbookNoteInput,
} from '@work-ally/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';

@Injectable()
export class HandbookNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthUser,
    filters: { categoryId?: string; q?: string },
  ) {
    const where: Prisma.HandbookNoteWhereInput = {
      tenantId: user.tenantId,
      userId: user.userId,
    };
    if (filters.categoryId === 'uncategorized') {
      where.categoryId = null;
    } else if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    const q = filters.q?.trim();
    if (q) {
      where.OR = [{ title: { contains: q } }, { bodyMd: { contains: q } }];
    }
    const rows = await this.prisma.handbookNote.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(user: AuthUser, id: string) {
    return this.serialize(await this.findOwned(user, id));
  }

  async create(user: AuthUser, input: CreateHandbookNoteInput) {
    await this.assertCategory(user, input.categoryId ?? null);
    const note = await this.prisma.handbookNote.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        title: (input.title ?? '无标题').trim() || '无标题',
        bodyMd: input.bodyMd ?? '',
        categoryId: input.categoryId ?? null,
        pinned: input.pinned ?? false,
      },
    });
    return this.serialize(note);
  }

  async update(user: AuthUser, id: string, input: UpdateHandbookNoteInput) {
    const existing = await this.findOwned(user, id);

    const nextCategoryId =
      input.categoryId !== undefined ? input.categoryId : existing.categoryId;
    await this.assertCategory(user, nextCategoryId);

    const note = await this.prisma.handbookNote.update({
      where: { id },
      data: {
        title: input.title?.trim() ?? existing.title,
        bodyMd: input.bodyMd ?? existing.bodyMd,
        categoryId: nextCategoryId,
        pinned: input.pinned ?? existing.pinned,
      },
    });
    return this.serialize(note);
  }

  async remove(user: AuthUser, id: string) {
    await this.findOwned(user, id);
    await this.prisma.handbookNote.delete({ where: { id } });
    return { ok: true };
  }

  private async assertCategory(user: AuthUser, categoryId: string | null) {
    if (categoryId == null) return;

    const category = await this.prisma.handbookCategory.findFirst({
      where: { id: categoryId, tenantId: user.tenantId, userId: user.userId },
    });
    if (!category) throw new NotFoundException('分类不存在');
  }

  private async findOwned(user: AuthUser, id: string) {
    const note = await this.prisma.handbookNote.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.userId },
    });
    if (!note) throw new NotFoundException('笔记不存在');
    return note;
  }

  private serialize(row: HandbookNote) {
    return {
      id: row.id,
      title: row.title,
      bodyMd: row.bodyMd,
      categoryId: row.categoryId,
      pinned: row.pinned,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
