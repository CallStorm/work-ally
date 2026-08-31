import { Injectable } from '@nestjs/common';

import { BAZAAR_SLUG, NOTES_SLUG, STICKIES_SLUG } from '@work-ally/shared';

import { PrismaService } from '../../prisma/prisma.service';

import { AclService } from '../acl/acl.service';

import type { AuthUser } from '../../common/current-user.decorator';



export const STICKIES_DEFAULT = {

  slug: STICKIES_SLUG,

  name: '闪签',

  description: '日历任务：日/周/月视图、优先级、提醒与拖拽改期',

};



export const NOTES_DEFAULT = {

  slug: NOTES_SLUG,

  name: '笔记',

  description: '个人工作笔记：分类、富文本、搜索与 AI 改稿',

};



export const BAZAAR_DEFAULT = {

  slug: BAZAAR_SLUG,

  name: '创司集市',

  description: '一人一司的虚拟 AI 产品展会：摆摊、逛展、打星冲榜',

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



  async ensureNotes(tenantId: string, ownerUserId: string) {
    const asNotes = await this.prisma.appRegistry.findUnique({
      where: { tenantId_slug: { tenantId, slug: NOTES_SLUG } },
    });
    if (asNotes) {
      await this.deleteOrphanHandbookRegistry(tenantId);
      if (
        asNotes.name !== NOTES_DEFAULT.name ||
        !asNotes.description.includes('AI')
      ) {
        return this.prisma.appRegistry.update({
          where: { id: asNotes.id },
          data: {
            name: NOTES_DEFAULT.name,
            description: NOTES_DEFAULT.description,
          },
        });
      }
      return asNotes;
    }
    const legacy = await this.prisma.appRegistry.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'handbook' } },
    });
    if (legacy) {
      return this.prisma.appRegistry.update({
        where: { id: legacy.id },
        data: {
          slug: NOTES_SLUG,
          name: NOTES_DEFAULT.name,
          description: NOTES_DEFAULT.description,
        },
      });
    }
    return this.prisma.appRegistry.create({
      data: {
        tenantId,
        slug: NOTES_SLUG,
        name: NOTES_DEFAULT.name,
        description: NOTES_DEFAULT.description,
        ownerUserId,
        visibility: 'tenant',
        enabled: true,
      },
    });
  }

  private async deleteOrphanHandbookRegistry(tenantId: string) {
    const legacy = await this.prisma.appRegistry.findUnique({
      where: { tenantId_slug: { tenantId, slug: 'handbook' } },
    });
    if (!legacy) return;
    await this.prisma.aclEntry.deleteMany({
      where: {
        tenantId,
        resourceType: 'app',
        resourceId: legacy.id,
      },
    });
    await this.prisma.appRegistry.delete({ where: { id: legacy.id } });
  }

  async ensureBazaar(tenantId: string, ownerUserId: string) {
    const existing = await this.prisma.appRegistry.findUnique({
      where: { tenantId_slug: { tenantId, slug: BAZAAR_SLUG } },
    });
    if (existing) return existing;
    return this.prisma.appRegistry.create({
      data: {
        tenantId,
        slug: BAZAAR_SLUG,
        name: BAZAAR_DEFAULT.name,
        description: BAZAAR_DEFAULT.description,
        ownerUserId,
        visibility: 'tenant',
        enabled: true,
      },
    });
  }

  async listForAdmin(tenantId: string, ownerUserId: string) {

    await this.ensureStickies(tenantId, ownerUserId);

    await this.ensureNotes(tenantId, ownerUserId);

    await this.ensureBazaar(tenantId, ownerUserId);

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

    await this.ensureNotes(user.tenantId, ownerId);

    await this.ensureBazaar(user.tenantId, ownerId);



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



  async getNotesForUser(user: AuthUser) {

    const admin = await this.prisma.membership.findFirst({

      where: { tenantId: user.tenantId, role: 'admin', status: 'active' },

      select: { userId: true },

    });

    await this.ensureNotes(user.tenantId, admin?.userId ?? user.userId);

    const app = await this.getBySlug(user.tenantId, NOTES_SLUG);

    if (!app || !app.enabled) return null;

    const ok = await this.acl.canUse(user, 'apps', app);

    return ok ? app : null;

  }

  async getBazaarForUser(user: AuthUser) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId: user.tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    await this.ensureBazaar(user.tenantId, admin?.userId ?? user.userId);
    const app = await this.getBySlug(user.tenantId, BAZAAR_SLUG);
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



  async getNotesAdmin(tenantId: string) {

    const admin = await this.prisma.membership.findFirst({

      where: { tenantId, role: 'admin', status: 'active' },

      select: { userId: true },

    });

    if (!admin) return null;

    return this.ensureNotes(tenantId, admin.userId);

  }

  async getBazaarAdmin(tenantId: string) {
    const admin = await this.prisma.membership.findFirst({
      where: { tenantId, role: 'admin', status: 'active' },
      select: { userId: true },
    });
    if (!admin) return null;
    return this.ensureBazaar(tenantId, admin.userId);
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



  async updateNotes(

    tenantId: string,

    body: {

      enabled?: boolean;

      defaultModelConfigId?: string | null;

      aiActionsEnabled?: string[];

      visibility?: 'private' | 'restricted' | 'tenant';

    },

  ) {

    const app = await this.getNotesAdmin(tenantId);

    if (!app) return null;

    return this.prisma.appRegistry.update({

      where: { id: app.id },

      data: body,

    });

  }

  async updateBazaar(
    tenantId: string,
    body: {
      enabled?: boolean;
      defaultModelConfigId?: string | null;
      aiActionsEnabled?: string[];
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    const app = await this.getBazaarAdmin(tenantId);
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

