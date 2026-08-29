import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateNotesAiMessageInput,
  NotesAiAction,
} from '@work-ally/shared';
import type { AuthUser } from '../../../common/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { ModelsService } from '../../models/models.service';
import { AppRegistryService } from '../app-registry.service';

const BODY_MAX = 12000;
const HISTORY_LIMIT = 8;

const SYSTEM_FORMAT =
  '你是笔记排版助手。只根据用户提供的标题与正文整理结构（标题层级、列表、分段），不要编造未出现的事实。必须在回复末尾给出完整 Markdown 正文，放在唯一的 md 围栏中：以三反引号 md 开始、三反引号结束。';

const SYSTEM_ENRICH =
  '你是 SOP/工作流程写作助手。在不编造具体环境细节的前提下，补全步骤、注意项与验收项；不确定处标注「待确认」。必须在回复末尾给出完整 Markdown 正文，放在唯一的 md 围栏中。';

const SYSTEM_CUSTOM =
  '你是笔记写作助手。根据用户提供的标题、正文与要求修改内容，不要编造未出现的事实。必须在回复末尾给出完整 Markdown 正文，放在唯一的 md 围栏中：以三反引号 md 开始、三反引号结束。';

@Injectable()
export class NotesAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelsService,
    private readonly registry: AppRegistryService,
  ) {}

  async listMessages(user: AuthUser, noteId: string) {
    await this.findOwnedNote(user, noteId);

    const thread = await this.prisma.notesAiThread.findUnique({
      where: {
        tenantId_userId_noteId: {
          tenantId: user.tenantId,
          userId: user.userId,
          noteId,
        },
      },
      include: {
        messages: {
          where: { role: { in: ['user', 'assistant'] } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      return { messages: [] };
    }

    return {
      messages: thread.messages.map((m) => this.serializeMessage(m)),
    };
  }

  async postMessage(
    user: AuthUser,
    noteId: string,
    input: CreateNotesAiMessageInput,
  ) {
    await this.findOwnedNote(user, noteId);

    const app = await this.registry.getNotesForUser(user);
    const modelConfigId = app?.defaultModelConfigId ?? null;

    const thread = await this.ensureThread(user, noteId);
    const userContent = this.buildUserMessage(input);

    await this.prisma.notesAiMessage.create({
      data: {
        threadId: thread.id,
        role: 'user',
        content: userContent,
      },
    });

    const recent = await this.prisma.notesAiMessage.findMany({
      where: {
        threadId: thread.id,
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });

    const chatMessages = recent.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const assistantText = await this.models.completeChatMessages({
      tenantId: user.tenantId,
      modelConfigId,
      system: this.buildSystem(input.action),
      messages: chatMessages,
    });

    const draftMd = this.parseDraftMd(assistantText);

    const assistantRow = await this.prisma.notesAiMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        content: assistantText,
        draftMd,
      },
    });

    await this.prisma.notesAiThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    const allMessages = await this.prisma.notesAiMessage.findMany({
      where: {
        threadId: thread.id,
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      messages: allMessages.map((m) => this.serializeMessage(m)),
      assistant: {
        content: assistantRow.content,
        draftMd: assistantRow.draftMd,
      },
    };
  }

  truncateBody(bodyMd: string): string {
    if (bodyMd.length > BODY_MAX) {
      return `${bodyMd.slice(0, BODY_MAX)}\n\n…(已截断)`;
    }
    return bodyMd;
  }

  parseDraftMd(text: string): string | null {
    const mdMatches = [...text.matchAll(/```md\s*\n([\s\S]*?)```/gi)];
    if (mdMatches.length > 0) {
      return mdMatches[mdMatches.length - 1][1].trim();
    }

    const anyMatches = [...text.matchAll(/```(?:\w+)?\s*\n?([\s\S]*?)```/g)];
    if (anyMatches.length > 0) {
      return anyMatches[anyMatches.length - 1][1].trim();
    }

    return null;
  }

  buildSystem(action: NotesAiAction): string {
    switch (action) {
      case 'format':
        return SYSTEM_FORMAT;
      case 'enrich':
        return SYSTEM_ENRICH;
      case 'custom':
      default:
        return SYSTEM_CUSTOM;
    }
  }

  async ensureThread(user: AuthUser, noteId: string) {
    return this.prisma.notesAiThread.upsert({
      where: {
        tenantId_userId_noteId: {
          tenantId: user.tenantId,
          userId: user.userId,
          noteId,
        },
      },
      create: {
        tenantId: user.tenantId,
        userId: user.userId,
        noteId,
      },
      update: {},
    });
  }

  private buildUserMessage(input: CreateNotesAiMessageInput): string {
    const title = (input.title ?? '').trim();
    const body = this.truncateBody(input.bodyMd);
    const parts: string[] = [];

    if (title) {
      parts.push(`标题：${title}`);
    }
    parts.push(`正文：\n${body}`);
    parts.push(`要求：${input.prompt}`);

    return parts.join('\n\n');
  }

  private async findOwnedNote(user: AuthUser, noteId: string) {
    const note = await this.prisma.handbookNote.findFirst({
      where: { id: noteId, tenantId: user.tenantId, userId: user.userId },
    });
    if (!note) {
      throw new NotFoundException('笔记不存在');
    }
    return note;
  }

  private serializeMessage(row: {
    id: string;
    role: string;
    content: string;
    draftMd: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      draftMd: row.draftMd,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
