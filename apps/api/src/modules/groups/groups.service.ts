import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    const where =
      user.role === 'admin'
        ? { tenantId: user.tenantId }
        : {
            tenantId: user.tenantId,
            members: { some: { userId: user.userId } },
          };

    return this.prisma.group.findMany({
      where,
      include: {
        _count: { select: { members: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async get(user: AuthUser, id: string) {
    const group = await this.findAccessibleGroup(user, id);
    const members = await this.prisma.groupMember.findMany({
      where: { groupId: group.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            memberships: {
              where: { tenantId: user.tenantId },
              select: { role: true, status: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      isDefault: group.isDefault,
      memberCount: members.length,
      members: members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        phone: m.user.phone,
        role: m.user.memberships[0]?.role ?? 'member',
        status: m.user.memberships[0]?.status ?? 'active',
      })),
      createdAt: group.createdAt,
    };
  }

  create(user: AuthUser, body: { name: string; description?: string }) {
    return this.prisma.group.create({
      data: {
        tenantId: user.tenantId,
        name: body.name.trim(),
        description: body.description,
      },
    });
  }

  async update(
    user: AuthUser,
    id: string,
    body: Partial<{ name: string; description: string }>,
  ) {
    await this.findAdminGroup(user, id);
    return this.prisma.group.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    const group = await this.findAdminGroup(user, id);
    if (group.isDefault) {
      throw new ForbiddenException('默认组不可删除');
    }
    const memberCount = await this.prisma.groupMember.count({
      where: { groupId: id },
    });
    if (memberCount > 0) {
      throw new BadRequestException('请先移除组内全部成员');
    }
    await this.prisma.group.delete({ where: { id } });
    return { ok: true };
  }

  async setMembers(user: AuthUser, id: string, userIds: string[]) {
    const group = await this.findAdminGroup(user, id);
    const uniqueIds = [...new Set(userIds)];

    if (uniqueIds.length > 0) {
      const activeMembers = await this.prisma.membership.count({
        where: {
          tenantId: user.tenantId,
          userId: { in: uniqueIds },
          status: 'active',
        },
      });
      if (activeMembers !== uniqueIds.length) {
        throw new BadRequestException('只能添加本租户的活跃成员');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.deleteMany({ where: { groupId: group.id } });
      if (uniqueIds.length > 0) {
        await tx.groupMember.createMany({
          data: uniqueIds.map((userId) => ({ groupId: group.id, userId })),
        });
      }
    });
    return { ok: true };
  }

  async addMembers(user: AuthUser, id: string, userIds: string[]) {
    const group = await this.findAdminGroup(user, id);
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return { ok: true };

    const activeMembers = await this.prisma.membership.count({
      where: {
        tenantId: user.tenantId,
        userId: { in: uniqueIds },
        status: 'active',
      },
    });
    if (activeMembers !== uniqueIds.length) {
      throw new BadRequestException('只能添加本租户的活跃成员');
    }

    await this.prisma.groupMember.createMany({
      data: uniqueIds.map((userId) => ({ groupId: group.id, userId })),
      skipDuplicates: true,
    });
    return { ok: true };
  }

  async removeMember(user: AuthUser, groupId: string, userId: string) {
    const group = await this.findAdminGroup(user, groupId);
    await this.prisma.groupMember.deleteMany({
      where: { groupId: group.id, userId },
    });
    return { ok: true };
  }

  private async findAdminGroup(user: AuthUser, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!group) throw new NotFoundException('组不存在');
    return group;
  }

  private async findAccessibleGroup(user: AuthUser, id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!group) throw new NotFoundException('组不存在');

    if (user.role !== 'admin') {
      const member = await this.prisma.groupMember.findFirst({
        where: { groupId: id, userId: user.userId },
      });
      if (!member) throw new ForbiddenException();
    }
    return group;
  }
}
