import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    tenantName: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
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
          role: 'owner',
          status: 'active',
        },
      });
      const group = await tx.group.create({
        data: {
          tenantId: tenant.id,
          name: '默认组',
          description: '系统自动创建',
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
      return { user, tenant, group };
    });

    return this.issueToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      role: 'owner',
      email: result.user.email,
      name: result.user.name,
    }, {
      groupId: result.group.id,
      tenantId: result.tenant.id,
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { memberships: { where: { status: 'active' }, take: 1 } },
    });
    if (!user || user.memberships.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const membership = user.memberships[0];
    const group = await this.prisma.groupMember.findFirst({
      where: { userId: user.id, group: { tenantId: membership.tenantId } },
      include: { group: true },
    });
    return this.issueToken(
      {
        userId: user.id,
        tenantId: membership.tenantId,
        role: membership.role,
        email: user.email,
        name: user.name,
      },
      { groupId: group?.groupId ?? null, tenantId: membership.tenantId },
    );
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
      email: user.email,
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
