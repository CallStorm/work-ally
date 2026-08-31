import { Injectable, NotFoundException } from '@nestjs/common';
import type { BazaarCompany, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { serializeProduct } from './bazaar-products.service';

export type MarketSort = 'newest' | 'hottest';

const HOTTEST_ORDER: Prisma.BazaarProductOrderByWithRelationInput[] = [
  { score: 'desc' },
  { ratingCount: 'desc' },
  { updatedAt: 'desc' },
];

function serializeCompany(row: BazaarCompany) {
  return {
    id: row.id,
    name: row.name,
    slogan: row.slogan,
    stallSkin: row.stallSkin,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class BazaarMarketService {
  constructor(private readonly prisma: PrismaService) {}

  async market(tenantId: string, sort: MarketSort) {
    const rows = await this.prisma.bazaarProduct.findMany({
      where: { tenantId, status: 'published' },
      include: { company: { select: { name: true } } },
      orderBy: sort === 'hottest' ? HOTTEST_ORDER : { publishedAt: 'desc' },
    });
    const names = await this.namesByUserIds(rows.map((row) => row.userId));
    return rows.map((row) => ({
      ...serializeProduct(row),
      companyName: row.company.name,
      userName: names.get(row.userId) ?? '',
    }));
  }

  async stall(tenantId: string, userId: string) {
    const company = await this.prisma.bazaarCompany.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!company) throw new NotFoundException('公司不存在');

    const products = await this.prisma.bazaarProduct.findMany({
      where: { tenantId, userId, status: 'published' },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    return {
      company: serializeCompany(company),
      products: products.map((row) => serializeProduct(row)),
    };
  }

  async getCompany(tenantId: string, userId: string) {
    const company = await this.prisma.bazaarCompany.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!company) throw new NotFoundException('公司不存在');
    return serializeCompany(company);
  }

  async leaderboard(tenantId: string, take = 50) {
    const rows = await this.prisma.bazaarProduct.findMany({
      where: { tenantId, status: 'published' },
      include: { company: { select: { name: true } } },
      orderBy: HOTTEST_ORDER,
      take,
    });
    const names = await this.namesByUserIds(rows.map((row) => row.userId));
    return rows.map((row) => ({
      productId: row.id,
      score: row.score,
      avgStars: Number(row.avgStars),
      ratingCount: row.ratingCount,
      title: row.title,
      companyName: row.company.name,
      userId: row.userId,
      userName: names.get(row.userId) ?? '',
    }));
  }

  private async namesByUserIds(userIds: string[]) {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map<string, string>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(users.map((user) => [user.id, user.name]));
  }
}
