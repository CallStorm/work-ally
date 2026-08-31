import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BazaarProduct, Prisma } from '@prisma/client';
import type {
  PatchBazaarProductInput,
  UpsertBazaarProductInput,
} from '@work-ally/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';
import { BAZAAR_BASE_SCORE, scoreFromStars } from './bazaar-score';

export const PUBLISHED_SHELF_LIMIT = 8;

export function serializeProduct(row: BazaarProduct) {
  let features: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.featuresJson);
    if (Array.isArray(parsed)) {
      features = parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    features = [];
  }

  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    title: row.title,
    pitch: row.pitch,
    features,
    coverHue: row.coverHue,
    status: row.status,
    score: row.score,
    ratingCount: row.ratingCount,
    avgStars: Number(row.avgStars),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class BazaarProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(user: AuthUser) {
    const rows = await this.prisma.bazaarProduct.findMany({
      where: { tenantId: user.tenantId, userId: user.userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => serializeProduct(row));
  }

  async getOwned(user: AuthUser, id: string) {
    const row = await this.prisma.bazaarProduct.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.userId },
    });
    if (!row) throw new NotFoundException('产品不存在');
    return row;
  }

  async get(user: AuthUser, id: string) {
    return serializeProduct(await this.getOwned(user, id));
  }

  async create(user: AuthUser, input: UpsertBazaarProductInput) {
    const company = await this.prisma.bazaarCompany.findUnique({
      where: {
        tenantId_userId: { tenantId: user.tenantId, userId: user.userId },
      },
    });
    if (!company) {
      throw new ConflictException('请先开设公司');
    }

    const row = await this.prisma.bazaarProduct.create({
      data: {
        tenantId: user.tenantId,
        companyId: company.id,
        userId: user.userId,
        title: input.title,
        pitch: input.pitch,
        featuresJson: JSON.stringify(input.features),
        coverHue: input.coverHue,
        status: 'draft',
        score: BAZAAR_BASE_SCORE,
      },
    });
    return serializeProduct(row);
  }

  async update(user: AuthUser, id: string, input: PatchBazaarProductInput) {
    await this.getOwned(user, id);

    const data: Prisma.BazaarProductUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.pitch !== undefined) data.pitch = input.pitch;
    if (input.features !== undefined) {
      data.featuresJson = JSON.stringify(input.features);
    }
    if (input.coverHue !== undefined) data.coverHue = input.coverHue;

    const row = await this.prisma.bazaarProduct.update({
      where: { id },
      data,
    });
    return serializeProduct(row);
  }

  async remove(user: AuthUser, id: string) {
    await this.getOwned(user, id);
    await this.prisma.bazaarProduct.delete({ where: { id } });
    return { ok: true };
  }

  async publish(user: AuthUser, id: string) {
    const product = await this.getOwned(user, id);
    if (!product.title.trim() || !product.pitch.trim()) {
      throw new BadRequestException('上架需要填写名称和卖点');
    }

    if (product.status !== 'published') {
      const publishedCount = await this.prisma.bazaarProduct.count({
        where: {
          tenantId: user.tenantId,
          companyId: product.companyId,
          status: 'published',
        },
      });
      if (publishedCount >= PUBLISHED_SHELF_LIMIT) {
        throw new BadRequestException('货架最多 8 件，请先下架');
      }
    }

    await this.prisma.bazaarProduct.update({
      where: { id: product.id },
      data: {
        status: 'published',
        publishedAt: product.publishedAt ?? new Date(),
      },
    });
    return this.recomputeFromDb(product.id);
  }

  async unpublish(user: AuthUser, id: string) {
    const product = await this.getOwned(user, id);
    const row = await this.prisma.bazaarProduct.update({
      where: { id: product.id },
      data: { status: 'draft' },
    });
    return serializeProduct(row);
  }

  async recomputeFromDb(productId: string) {
    const ratings = await this.prisma.bazaarRating.findMany({
      where: { productId },
      select: { stars: true },
    });
    const computed = scoreFromStars(ratings.map((r) => r.stars));
    const row = await this.prisma.bazaarProduct.update({
      where: { id: productId },
      data: {
        score: computed.score,
        ratingCount: computed.ratingCount,
        avgStars: computed.avgStars,
      },
    });
    return serializeProduct(row);
  }
}
