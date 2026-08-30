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

const DRAFT_HINT =
  '必须输出从标题开始的完整文档，禁止从文章中部或代码块中部起笔。' +
  '先用一两句话说明改动，然后在回复末尾用下列标记包裹完整 Markdown 正文（标记内可含普通代码块，勿再用三反引号 md 包裹全文）：\n' +
  '<<<DRAFT_MD\n（完整正文）\nDRAFT_MD>>>';

const SYSTEM_FORMAT =
  `你是笔记排版助手。只根据用户提供的标题与正文整理结构（标题层级、列表、分段），不要编造未出现的事实。${DRAFT_HINT}`;

const SYSTEM_ENRICH =
  `你是 SOP/工作流程写作助手。在不编造具体环境细节的前提下，补全步骤、注意项与验收项；不确定处标注「待确认」。${DRAFT_HINT}`;

const SYSTEM_CUSTOM =
  `你是笔记写作助手。根据用户提供的标题、正文与要求修改内容，不要编造未出现的事实。${DRAFT_HINT}`;

/**
 * Text starts *inside* an already-opened ``` fence. Return body up to the
 * matching close. Nested fences (```sql … ```) use depth so they do not end
 * the outer block early. If never closed, return the full remainder.
 */
export function extractBalancedFenceInner(inner: string): string | null {
  const lines = inner.split(/\r?\n/);
  let depth = 1;
  const out: string[] = [];

  for (const line of lines) {
    const fence = /^(`{3,})([\w+-]*)\s*$/.exec(line);
    if (!fence) {
      out.push(line);
      continue;
    }
    const lang = fence[2] ?? '';
    if (lang) {
      depth += 1;
      out.push(line);
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return out.join('\n');
    }
    out.push(line);
  }

  return out.join('\n');
}

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

    if (input.resetSession) {
      await this.prisma.notesAiMessage.deleteMany({
        where: { threadId: thread.id },
      });
    }

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
      take: input.resetSession ? 1 : HISTORY_LIMIT,
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
    // Preferred marker — nested ```sql cannot break this
    const marker = [
      ...text.matchAll(/<<<DRAFT_MD\s*\r?\n([\s\S]*?)\r?\n\s*DRAFT_MD>>>/gi),
    ];
    if (marker.length > 0) {
      return marker[marker.length - 1][1].trim();
    }

    // Legacy ```md: balance fences so inner ```sql does not truncate early
    const openRe = /```md[^\n]*\r?\n/gi;
    let openMatch: RegExpExecArray | null = null;
    let lastOpen: RegExpExecArray | null = null;
    while ((openMatch = openRe.exec(text)) !== null) {
      lastOpen = openMatch;
    }
    if (lastOpen) {
      const inner = text.slice(lastOpen.index + lastOpen[0].length);
      const extracted = extractBalancedFenceInner(inner);
      if (extracted != null && extracted.trim()) {
        return extracted.trim();
      }
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
