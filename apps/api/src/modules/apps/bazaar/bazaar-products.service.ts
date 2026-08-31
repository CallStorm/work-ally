import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BazaarProduct, Prisma } from '@prisma/client';
import type {
  PatchBazaarProductInput,
  PolishBazaarProductInput,
  UpsertBazaarProductInput,
} from '@work-ally/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';
import { ModelsService } from '../../models/models.service';
import { AppRegistryService } from '../app-registry.service';
import { BAZAAR_BASE_SCORE, scoreFromStars } from './bazaar-score';

const POLISH_SYSTEM =
  '你是创司集市的产品文案润色助手。根据用户提供的名称、卖点和功能点润色文案，不要编造未出现的事实。' +
  '必须只输出严格 JSON，不要 Markdown、不要解释：{"title":"...","pitch":"...","features":["..."]}' +
  '约束：title 不超过 80 字，pitch 不超过 2000 字，features 最多 8 条、每条不超过 40 字。';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AppRegistryService,
    private readonly models: ModelsService,
  ) {}

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
    const row = await this.prisma.bazaarProduct.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!row) throw new NotFoundException('产品不存在');
    if (row.status !== 'published' && row.userId !== user.userId) {
      throw new NotFoundException('产品不存在');
    }
    return serializeProduct(row);
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

  async polish(
    user: AuthUser,
    productId: string,
    override?: PolishBazaarProductInput,
  ) {
    const product = await this.getOwned(user, productId);
    const current = serializeProduct(product);
    const title = override?.title ?? current.title;
    const pitch = override?.pitch ?? current.pitch;
    const features = override?.features ?? current.features;

    const app = await this.registry.getBazaarForUser(user);
    const modelConfigId = app?.defaultModelConfigId ?? null;
    if (!modelConfigId) {
      throw new BadRequestException('请管理员为创司集市绑定默认模型');
    }

    const assistantText = await this.models.completeChatMessages({
      tenantId: user.tenantId,
      modelConfigId,
      system: POLISH_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            `名称：${title}`,
            `卖点：${pitch}`,
            `功能点：${JSON.stringify(features)}`,
          ].join('\n'),
        },
      ],
    });

    return parsePolishResult(assistantText);
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

function parsePolishResult(raw: string): {
  title: string;
  pitch: string;
  features: string[];
} {
  let parsed: unknown;
  const trimmed = raw.trim();
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new BadRequestException('润色结果无法解析');
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new BadRequestException('润色结果无法解析');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new BadRequestException('润色结果无法解析');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.title !== 'string' || typeof obj.pitch !== 'string') {
    throw new BadRequestException('润色结果无法解析');
  }
  if (!Array.isArray(obj.features) || obj.features.some((item) => typeof item !== 'string')) {
    throw new BadRequestException('润色结果无法解析');
  }

  return {
    title: obj.title,
    pitch: obj.pitch,
    features: obj.features,
  };
}
