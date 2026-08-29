import { Injectable } from '@nestjs/common';
import { HANDBOOK_SLUG, STICKIES_SLUG } from '@work-ally/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../acl/acl.service';
import type { AuthUser } from '../../common/current-user.decorator';

export const STICKIES_DEFAULT = {
  slug: STICKIES_SLUG,
  name: '闪签',
  description: '日历任务：日/周/月视图、优先级、提醒与拖拽改期',
};

export const HANDBOOK_DEFAULT = {
  slug: HANDBOOK_SLUG,
  name: '手册',
  description: '个人工作手册：分类、Markdown 流程笔记与快速搜索',
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

  async ensureHandbook(tenantId: string, ownerUserId: string) {
    const existing = await this.prisma.appRegistry.findUnique({
      where: { tenantId_slug: { tenantId, slug: HANDBOOK_SLUG } },
    });
    if (existing) return existing;
    return this.prisma.appRegistry.create({
      data: {
        tenantId,
        slug: HANDBOOK_SLUG,
        name: HANDBOOK_DEFAULT.name,
        description: HANDBOOK_DEFAULT.description,
        ownerUserId,
        visibility: 'tenant',
        enabled: true,
      },
    });
  }

  async listForAdmin(tenantId: string, ownerUserId: string) {
    await this.ensureStickies(tenantId, ownerUserId);
    await this.ensureHandbook(tenantId, ownerUserId);
    const rows = await this.prisma.appRegistry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
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
    await this.ensureHandbook(user.tenantId, ownerId);

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

  async getHandbookForUser(user: AuthUser) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId: user.tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    await this.ensureHandbook(user.tenantId, admin?.userId ?? user.userId);
    const app = await this.getBySlug(user.tenantId, HANDBOOK_SLUG);
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

  async getHandbookAdmin(tenantId: string) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    if (!admin) return null;
    return this.ensureHandbook(tenantId, admin.userId);
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

  async updateHandbook(
    tenantId: string,
    body: {
      enabled?: boolean;
      defaultModelConfigId?: string | null;
      aiActionsEnabled?: string[];
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    const app = await this.getHandbookAdmin(tenantId);
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
