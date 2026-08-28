import { Injectable } from '@nestjs/common';
import { STICKIES_SLUG } from '@work-ally/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../acl/acl.service';
import type { AuthUser } from '../../common/current-user.decorator';

export const STICKIES_DEFAULT = {
  slug: STICKIES_SLUG,
  name: '闪签',
  description: '日历任务：日/周/月视图、优先级、提醒与拖拽改期',
};

@Injectable()
export class AppRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
  ) {}

  async ensureStickies(tenantId: string, ownerUserId: string) {
    const existing = await this.prisma.appRegistry.findUnique({
      where: { tenantId_slug: { tenantId, slug: STICKIES_SLUG } },
    });
    if (existing) {
      if (existing.description.includes('便签')) {
        return this.prisma.appRegistry.update({
          where: { id: existing.id },
          data: { description: STICKIES_DEFAULT.description },
        });
      }
      return existing;
    }
    return this.prisma.appRegistry.create({
      data: {
        tenantId,
        slug: STICKIES_SLUG,
        name: STICKIES_DEFAULT.name,
        description: STICKIES_DEFAULT.description,
        ownerUserId,
        visibility: 'tenant',
        enabled: true,
      },
    });
  }

  async getBySlug(tenantId: string, slug: string) {
    return this.prisma.appRegistry.findFirst({ where: { tenantId, slug } });
  }

  async listForUser(user: AuthUser) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId: user.tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    const ownerId = admin?.userId ?? user.userId;
    await this.ensureStickies(user.tenantId, ownerId);

    const rows = await this.prisma.appRegistry.findMany({
      where: { tenantId: user.tenantId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    const usable = await this.acl.filterUsable(user, 'apps', rows);
    return usable.map((r) => this.serialize(r));
  }

  async getStickiesForUser(user: AuthUser) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId: user.tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    await this.ensureStickies(user.tenantId, admin?.userId ?? user.userId);
    const app = await this.getBySlug(user.tenantId, STICKIES_SLUG);
    if (!app || !app.enabled) return null;
    const ok = await this.acl.canUse(user, 'apps', app);
    return ok ? app : null;
  }

  async getStickiesAdmin(tenantId: string) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    if (!admin) return null;
    return this.ensureStickies(tenantId, admin.userId);
  }

  async updateStickies(
    tenantId: string,
    body: {
      enabled?: boolean;
      defaultModelConfigId?: string | null;
      aiActionsEnabled?: string[];
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    const app = await this.getStickiesAdmin(tenantId);
    if (!app) return null;
    return this.prisma.appRegistry.update({
      where: { id: app.id },
      data: body,
    });
  }

  serialize(row: {
    id: string;
    slug: string;
    name: string;
    description: string;
    enabled: boolean;
    visibility: string;
    defaultModelConfigId: string | null;
    aiActionsEnabled: unknown;
  }) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      visibility: row.visibility,
      defaultModelConfigId: row.defaultModelConfigId,
      aiActionsEnabled: row.aiActionsEnabled,
    };
  }
}
