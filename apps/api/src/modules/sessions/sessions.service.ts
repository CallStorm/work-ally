import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSessionSchema, type CreateSessionInput } from '@work-ally/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';
import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: RuntimeService,
  ) {}

  async list(user: AuthUser, groupId?: string) {
    return this.prisma.session.findMany({
      where: {
        tenantId: user.tenantId,
        createdBy: user.userId,
        ...(groupId ? { groupId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        expert: { select: { id: true, name: true } },
      },
    });
  }

  async get(user: AuthUser, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId: user.tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        expert: true,
        runs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (
      session.createdBy !== user.userId &&
      user.role !== 'owner' &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException();
    }
    return session;
  }

  async create(user: AuthUser, raw: CreateSessionInput) {
    const input = CreateSessionSchema.parse(raw);
    await this.assertGroupAccess(user, input.groupId);

    if (input.expertId) {
      const expert = await this.prisma.expert.findFirst({
        where: {
          id: input.expertId,
          tenantId: user.tenantId,
          status: 'active',
        },
      });
      if (!expert) throw new NotFoundException('Expert not found');
      await this.prisma.expertUsage.create({
        data: { expertId: expert.id, userId: user.userId },
      });
    }

    const title =
      input.content.length > 40
        ? `${input.content.slice(0, 40)}…`
        : input.content;

    const session = await this.prisma.session.create({
      data: {
        tenantId: user.tenantId,
        groupId: input.groupId,
        createdBy: user.userId,
        title,
        expertId: input.expertId ?? null,
        modelId: input.modelId,
        context: input.context,
        messages: {
          create: {
            role: 'user',
            content: input.content,
            attachmentIds: input.attachmentIds,
          },
        },
      },
      include: { messages: true },
    });

    const userMessage = session.messages[0];
    const run = await this.prisma.agentRun.create({
      data: {
        sessionId: session.id,
        messageId: userMessage.id,
        agentMode: input.expertId ? 'expert' : 'default',
        expertId: input.expertId ?? null,
        state: 'queued',
      },
    });

    // Fire-and-forget for SSE clients; also await for simpler clients via wait flag later
    const execution = this.runtime.executeRun(run.id);

    return {
      sessionId: session.id,
      runId: run.id,
      messageId: userMessage.id,
      execution,
    };
  }

  async addMessage(
    user: AuthUser,
    sessionId: string,
    body: { content: string; attachmentIds?: string[] },
  ) {
    const session = await this.get(user, sessionId);
    const message = await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: body.content,
        attachmentIds: body.attachmentIds ?? [],
      },
    });
    const run = await this.prisma.agentRun.create({
      data: {
        sessionId: session.id,
        messageId: message.id,
        agentMode: session.expertId ? 'expert' : 'default',
        expertId: session.expertId,
        state: 'queued',
      },
    });
    const execution = this.runtime.executeRun(run.id);
    return { sessionId, runId: run.id, messageId: message.id, execution };
  }

  private async assertGroupAccess(user: AuthUser, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId: user.tenantId },
      include: { members: { where: { userId: user.userId } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (
      group.members.length === 0 &&
      user.role !== 'owner' &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException('Not a member of this group');
    }
  }
}
