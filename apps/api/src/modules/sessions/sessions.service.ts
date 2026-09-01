import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MAX_TOTAL_BYTES,
  CreateSessionSchema,
  type CreateSessionInput,
} from '@work-ally/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';
import { RuntimeService } from '../runtime/runtime.service';
import { AclService } from '../acl/acl.service';
import { AttachmentsService } from '../attachments/attachments.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: RuntimeService,
    private readonly acl: AclService,
    private readonly attachments: AttachmentsService,
  ) {}

  async list(user: AuthUser, groupId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        tenantId: user.tenantId,
        createdBy: user.userId,
        ...(groupId ? { groupId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        expert: { select: { id: true, name: true } },
        runs: {
          where: { state: { in: ['queued', 'running'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, state: true, createdAt: true },
        },
      },
    });
    const staleBefore = Date.now() - 2 * 60 * 60 * 1000;
    return sessions.map(({ runs, ...session }) => {
      const run = runs[0];
      const fresh =
        run && new Date(run.createdAt).getTime() >= staleBefore ? run : null;
      return {
        ...session,
        activeRun: fresh
          ? { id: fresh.id, state: fresh.state, createdAt: fresh.createdAt }
          : null,
      };
    });
  }

  async get(user: AuthUser, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId: user.tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        expert: true,
        runs: {
          orderBy: { createdAt: 'asc' },
          include: {
            events: {
              orderBy: { seq: 'asc' },
              select: {
                id: true,
                seq: true,
                type: true,
                ts: true,
                data: true,
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (
      session.createdBy !== user.userId &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException();
    }
    return {
      ...session,
      messages: session.messages.map((m) => ({
        ...m,
        attachmentIds: asAttachmentIds(m.attachmentIds),
      })),
      runs: session.runs.map((run) => ({
        id: run.id,
        state: run.state,
        stepsCount: run.stepsCount,
        messageId: run.messageId,
        assistantMessageId: run.assistantMessageId,
        createdAt: run.createdAt,
        events: run.events.map((ev) => ({
          type: ev.type,
          runId: run.id,
          sessionId: session.id,
          ts: ev.ts.toISOString(),
          data:
            ev.data && typeof ev.data === 'object'
              ? (ev.data as Record<string, unknown>)
              : {},
        })),
      })),
    };
  }

  async create(user: AuthUser, raw: CreateSessionInput) {
    const input = CreateSessionSchema.parse(raw);
    await this.assertGroupAccess(user, input.groupId);

    const modelConfig = await this.prisma.modelConfig.findFirst({
      where: {
        id: input.modelConfigId,
        tenantId: user.tenantId,
        enabled: true,
        providerId: { not: null },
      },
    });
    if (!modelConfig) {
      throw new BadRequestException(
        '请选择已启用的模型（Admin → 模型配置中添加 Provider 并同步模型）',
      );
    }

    if (input.expertId) {
      const expert = await this.prisma.expert.findFirst({
        where: {
          id: input.expertId,
          tenantId: user.tenantId,
          status: 'active',
        },
      });
      if (!expert || !(await this.acl.canUse(user, 'experts', expert))) {
        throw new NotFoundException('Expert not found');
      }
      await this.prisma.expertUsage.create({
        data: { expertId: expert.id, userId: user.userId },
      });
    }

    const attachmentIds = input.attachmentIds ?? [];
    await this.validateAttachments(user, attachmentIds);
    const content =
      input.content.trim() ||
      (attachmentIds.length ? '请结合附件回答' : input.content);

    const title =
      content.length > 40 ? `${content.slice(0, 40)}…` : content;

    const session = await this.prisma.session.create({
      data: {
        tenantId: user.tenantId,
        groupId: input.groupId,
        createdBy: user.userId,
        title,
        expertId: input.expertId ?? null,
        modelId: modelConfig.modelId,
        modelConfigId: modelConfig.id,
        context: input.context,
        messages: {
          create: {
            role: 'user',
            content,
            attachmentIds,
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
    const attachmentIds = body.attachmentIds ?? [];
    await this.validateAttachments(user, attachmentIds);
    const content =
      body.content.trim() ||
      (attachmentIds.length ? '请结合附件回答' : '');
    if (!content) {
      throw new BadRequestException('请输入内容或添加附件');
    }
    const message = await this.prisma.message.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content,
        attachmentIds,
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

  private async validateAttachments(user: AuthUser, ids: string[]) {
    if (ids.length > ATTACHMENT_MAX_COUNT) {
      throw new BadRequestException(`最多 ${ATTACHMENT_MAX_COUNT} 个附件`);
    }
    const rows = await this.attachments.assertOwned(ids, user);
    const total = rows.reduce((s, r) => s + r.size, 0);
    if (total > ATTACHMENT_MAX_TOTAL_BYTES) {
      throw new BadRequestException('附件合计不能超过 50MB');
    }
    return rows;
  }

  private async assertGroupAccess(user: AuthUser, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId: user.tenantId },
      include: { members: { where: { userId: user.userId } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (
      group.members.length === 0 &&
      user.role !== 'admin'
    ) {
      throw new ForbiddenException('Not a member of this group');
    }
  }
}

function asAttachmentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}
