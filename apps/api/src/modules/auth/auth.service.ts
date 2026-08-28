import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { normalizePhone, STICKIES_SLUG } from '@work-ally/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    phone: string;
    password: string;
    name: string;
    tenantName: string;
  }) {
    const phone = normalizePhone(input.phone);
    if (!/^1\d{10}$/.test(phone)) {
      throw new BadRequestException('请输入有效的11位手机号');
    }

    const existing = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existing) {
      throw new BadRequestException('该手机号已注册');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          name: input.name,
          passwordHash,
        },
      });
      const tenant = await tx.tenant.create({
        data: { name: input.tenantName },
      });
      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: 'admin',
          status: 'active',
        },
      });
      const group = await tx.group.create({
        data: {
          tenantId: tenant.id,
          name: '默认组',
          description: '系统自动创建',
          isDefault: true,
        },
      });
      await tx.groupMember.create({
        data: { groupId: group.id, userId: user.id },
      });
      await tx.defaultAgent.create({
        data: {
          tenantId: tenant.id,
          personaMd:
            '你是 WorkAlly 默认办公助手。用简洁中文回答，给出可执行的结论与下一步建议。',
          suggestedPrompts: [
            '帮我梳理今天的工作重点',
            '把这段会议记录总结成待办',
          ],
          skillIds: [],
          connectorIds: [],
          knowledgeIds: [],
        },
      });
      await tx.appRegistry.create({
        data: {
          tenantId: tenant.id,
          slug: STICKIES_SLUG,
          name: '闪签',
          description: '日历任务：日/周/月视图、优先级、提醒与拖拽改期',
          ownerUserId: user.id,
          visibility: 'tenant',
          enabled: true,
        },
      });
      return { user, tenant, group };
    });

    return this.issueToken(
      {
        userId: result.user.id,
        tenantId: result.tenant.id,
        role: 'admin',
        phone: result.user.phone,
        name: result.user.name,
      },
      {
        groupId: result.group.id,
        tenantId: result.tenant.id,
      },
    );
  }

  async login(phoneInput: string, password: string) {
    const phone = normalizePhone(phoneInput);
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { memberships: { where: { status: 'active' }, take: 1 } },
    });
    if (!user || user.memberships.length === 0) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    const membership = user.memberships[0];
    const group = await this.prisma.groupMember.findFirst({
      where: { userId: user.id, group: { tenantId: membership.tenantId } },
      include: { group: true },
      orderBy: { joinedAt: 'asc' },
    });
    return this.issueToken(
      {
        userId: user.id,
        tenantId: membership.tenantId,
        role: membership.role,
        phone: user.phone,
        name: user.name,
      },
      { groupId: group?.groupId ?? null, tenantId: membership.tenantId },
    );
  }

  async myGroups(user: AuthUser) {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId: user.userId,
        group: { tenantId: user.tenantId },
      },
      include: { group: true },
      orderBy: [{ group: { isDefault: 'desc' } }, { joinedAt: 'asc' }],
    });
    return {
      groups: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        isDefault: m.group.isDefault,
      })),
    };
  }

  me(user: AuthUser) {
    return user;
  }

  private issueToken(
    user: AuthUser,
    extras: { groupId: string | null; tenantId: string },
  ) {
    const accessToken = this.jwt.sign({
      sub: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      phone: user.phone,
      name: user.name,
    });
    return {
      accessToken,
      user,
      defaultGroupId: extras.groupId,
      tenantId: extras.tenantId,
    };
  }
}
