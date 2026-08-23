import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  CreateMemberSchema,
  normalizePhone,
  ResetMemberPasswordSchema,
  UpdateMemberSchema,
  type MembershipRole,
} from '@work-ally/shared';
import { parseBody } from '../../common/zod';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const userIds = memberships.map((m) => m.userId);
    const groupMembers = await this.prisma.groupMember.findMany({
      where: {
        userId: { in: userIds },
        group: { tenantId },
      },
      include: { group: { select: { id: true, name: true } } },
    });

    const groupsByUser = new Map<string, { id: string; name: string }[]>();
    for (const gm of groupMembers) {
      const list = groupsByUser.get(gm.userId) ?? [];
      list.push({ id: gm.group.id, name: gm.group.name });
      groupsByUser.set(gm.userId, list);
    }

    return {
      items: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        phone: m.user.phone,
        name: m.user.name,
        role: m.role,
        status: m.status,
        groups: groupsByUser.get(m.userId) ?? [],
        createdAt: m.createdAt,
      })),
      total: memberships.length,
    };
  }

  async create(actor: AuthUser, raw: unknown) {
    const input = parseBody(CreateMemberSchema, raw);
    const phone = normalizePhone(input.phone);

    const existingUser = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existingUser) {
      throw new ConflictException('该手机号已被使用');
    }

    const groupIds = input.groupIds ?? [];
    await this.assertGroupIds(actor.tenantId, groupIds);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const memberRole = input.role ?? 'member';

    const membership = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          name: input.name,
          passwordHash,
        },
      });
      const created = await tx.membership.create({
        data: {
          tenantId: actor.tenantId,
          userId: user.id,
          role: memberRole,
          status: 'active',
        },
      });
      if (groupIds.length > 0) {
        await tx.groupMember.createMany({
          data: groupIds.map((groupId) => ({
            groupId,
            userId: user.id,
          })),
        });
      }
      return { membership: created, user };
    });

    const groups = await this.groupsForUser(
      actor.tenantId,
      membership.membership.userId,
    );
    return {
      id: membership.membership.id,
      userId: membership.membership.userId,
      phone: membership.user.phone,
      name: membership.user.name,
      role: membership.membership.role,
      status: membership.membership.status,
      groups,
      createdAt: membership.membership.createdAt,
    };
  }

  async update(actor: AuthUser, membershipId: string, raw: unknown) {
    const input = parseBody(UpdateMemberSchema, raw);
    const membership = await this.findMembership(actor.tenantId, membershipId);

    if (membership.userId === actor.userId) {
      if (input.role && input.role !== membership.role) {
        throw new ForbiddenException('不能修改自己的角色');
      }
      if (input.status === 'disabled') {
        throw new ForbiddenException('不能禁用自己');
      }
    }

    if (input.role && input.role !== membership.role) {
      await this.assertRoleChangeAllowed(actor, membership, input.role);
    }

    if (input.status === 'disabled') {
      await this.assertCanDisable(actor, membership);
    }

    if (input.groupIds) {
      await this.assertGroupIds(actor.tenantId, input.groupIds);
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.role || input.status) {
        await tx.membership.update({
          where: { id: membership.id },
          data: {
            ...(input.role ? { role: input.role } : {}),
            ...(input.status ? { status: input.status } : {}),
          },
        });
      }

      if (input.status === 'disabled') {
        await tx.groupMember.deleteMany({
          where: {
            userId: membership.userId,
            group: { tenantId: actor.tenantId },
          },
        });
      }

      if (input.groupIds) {
        await tx.groupMember.deleteMany({
          where: {
            userId: membership.userId,
            group: { tenantId: actor.tenantId },
          },
        });
        if (input.groupIds.length > 0) {
          await tx.groupMember.createMany({
            data: input.groupIds.map((groupId) => ({
              groupId,
              userId: membership.userId,
            })),
          });
        }
      }
    });

    return this.getOne(actor.tenantId, membershipId);
  }

  async resetPassword(actor: AuthUser, membershipId: string, raw: unknown) {
    const input = parseBody(ResetMemberPasswordSchema, raw);
    const membership = await this.findMembership(actor.tenantId, membershipId);
    const passwordHash = await bcrypt.hash(input.password, 10);
    await this.prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    });
    return { ok: true };
  }

  private async getOne(tenantId: string, membershipId: string) {
    const membership = await this.findMembership(tenantId, membershipId);
    const groups = await this.groupsForUser(tenantId, membership.userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: membership.userId },
      select: { phone: true, name: true },
    });
    return {
      id: membership.id,
      userId: membership.userId,
      phone: user.phone,
      name: user.name,
      role: membership.role,
      status: membership.status,
      groups,
      createdAt: membership.createdAt,
    };
  }

  private async findMembership(tenantId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
    });
    if (!membership) throw new NotFoundException('成员不存在');
    return membership;
  }

  private async groupsForUser(tenantId: string, userId: string) {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId, group: { tenantId } },
      include: { group: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ id: r.group.id, name: r.group.name }));
  }

  private async assertGroupIds(tenantId: string, groupIds: string[]) {
    if (groupIds.length === 0) return;
    const count = await this.prisma.group.count({
      where: { tenantId, id: { in: groupIds } },
    });
    if (count !== groupIds.length) {
      throw new BadRequestException('包含无效的组 ID');
    }
  }

  private async assertCanDisable(
    actor: AuthUser,
    target: { id: string; userId: string; role: MembershipRole },
  ) {
    if (target.role !== 'admin') return;

    const adminCount = await this.prisma.membership.count({
      where: {
        tenantId: actor.tenantId,
        role: 'admin',
        status: 'active',
        NOT: { id: target.id },
      },
    });
    if (adminCount === 0) {
      throw new BadRequestException('至少保留一名管理员');
    }
  }

  private async assertRoleChangeAllowed(
    actor: AuthUser,
    target: { id: string; role: MembershipRole },
    nextRole: MembershipRole,
  ) {
    if (target.role === 'admin' && nextRole === 'member') {
      const adminCount = await this.prisma.membership.count({
        where: {
          tenantId: actor.tenantId,
          role: 'admin',
          status: 'active',
          NOT: { id: target.id },
        },
      });
      if (adminCount === 0) {
        throw new BadRequestException('至少保留一名管理员');
      }
    }
  }
}
