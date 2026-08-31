import { Injectable } from '@nestjs/common';
import type { BazaarCompany } from '@prisma/client';
import type { UpsertBazaarCompanyInput } from '@work-ally/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';

@Injectable()
export class BazaarCompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(user: AuthUser) {
    const row = await this.prisma.bazaarCompany.findUnique({
      where: {
        tenantId_userId: { tenantId: user.tenantId, userId: user.userId },
      },
    });
    return row ? this.serialize(row) : null;
  }

  async upsert(user: AuthUser, input: UpsertBazaarCompanyInput) {
    const row = await this.prisma.bazaarCompany.upsert({
      where: {
        tenantId_userId: { tenantId: user.tenantId, userId: user.userId },
      },
      create: {
        tenantId: user.tenantId,
        userId: user.userId,
        name: input.name,
        slogan: input.slogan,
        stallSkin: input.stallSkin,
      },
      update: {
        name: input.name,
        slogan: input.slogan,
        stallSkin: input.stallSkin,
      },
    });
    return this.serialize(row);
  }

  private serialize(row: BazaarCompany) {
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
}
