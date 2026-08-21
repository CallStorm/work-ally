import { Injectable } from '@nestjs/common';
import type { PrincipalType, ResourceType, Visibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';

const prismaResourceType: Record<
  'connectors' | 'skills' | 'experts' | 'knowledge',
  ResourceType
> = {
  connectors: 'connector',
  skills: 'skill',
  experts: 'expert',
  knowledge: 'knowledge',
};

export type AssetKind = keyof typeof prismaResourceType;

@Injectable()
export class AclService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthUser) {
    return user.role === 'owner' || user.role === 'admin';
  }

  async canUse(
    user: AuthUser,
    kind: AssetKind,
    resource: { ownerUserId: string; visibility: Visibility; id: string },
  ) {
    if (this.isAdmin(user)) return true;
    if (user.userId === resource.ownerUserId) return true;
    if (resource.visibility === 'tenant') return true;
    if (resource.visibility !== 'restricted') return false;

    const groupIds = (
      await this.prisma.groupMember.findMany({
        where: { userId: user.userId, group: { tenantId: user.tenantId } },
        select: { groupId: true },
      })
    ).map((g) => g.groupId);

    const hit = await this.prisma.aclEntry.findFirst({
      where: {
        tenantId: user.tenantId,
        resourceType: prismaResourceType[kind],
        resourceId: resource.id,
        OR: [
          { principalType: 'user', principalId: user.userId },
          ...(groupIds.length
            ? [{ principalType: 'group' as const, principalId: { in: groupIds } }]
            : []),
        ],
      },
    });
    return Boolean(hit);
  }

  async getAcl(user: AuthUser, kind: AssetKind, resourceId: string) {
    const resourceType = prismaResourceType[kind];
    const entries = await this.prisma.aclEntry.findMany({
      where: { tenantId: user.tenantId, resourceType, resourceId },
      orderBy: { createdAt: 'asc' },
    });
    return entries.map((e) => ({
      principalType: e.principalType,
      principalId: e.principalId,
    }));
  }

  async setAcl(
    user: AuthUser,
    kind: AssetKind,
    resourceId: string,
    input: {
      visibility: Visibility;
      entries: Array<{ principalType: PrincipalType; principalId: string }>;
    },
  ) {
    const resourceType = prismaResourceType[kind];
    await this.prisma.$transaction(async (tx) => {
      await tx.aclEntry.deleteMany({
        where: { tenantId: user.tenantId, resourceType, resourceId },
      });
      if (input.visibility === 'restricted' && input.entries.length > 0) {
        await tx.aclEntry.createMany({
          data: input.entries.map((e) => ({
            tenantId: user.tenantId,
            resourceType,
            resourceId,
            principalType: e.principalType,
            principalId: e.principalId,
          })),
        });
      }
    });
    return this.getAcl(user, kind, resourceId);
  }

  async filterUsable<T extends { id: string; ownerUserId: string; visibility: Visibility }>(
    user: AuthUser,
    kind: AssetKind,
    items: T[],
  ) {
    if (this.isAdmin(user)) return items;
    const out: T[] = [];
    for (const item of items) {
      if (await this.canUse(user, kind, item)) out.push(item);
    }
    return out;
  }
}
