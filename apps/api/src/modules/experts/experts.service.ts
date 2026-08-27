import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelsService } from '../models/models.service';

export type ExpertAssistTask =
  | 'draft'
  | 'optimize_name'
  | 'optimize_description'
  | 'generate_prompts'
  | 'optimize_rules'
  | 'suggest_avatar';

export type ExpertAssistInput = {
  task: ExpertAssistTask;
  brief?: string;
  name?: string;
  description?: string;
  personaMd?: string;
  suggestedPrompts?: string[];
};

export type ExpertAssistResult = {
  name?: string;
  description?: string;
  personaMd?: string;
  suggestedPrompts?: string[];
  avatarPreset?: string;
};

const AVATAR_PRESET_IDS = [
  'robot-blue',
  'chart-green',
  'doc-orange',
  'code-purple',
  'mail-cyan',
  'idea-yellow',
  'search-slate',
  'team-pink',
] as const;

const SYSTEM = `你是 WorkAlly 专家配置助手。根据用户输入生成或优化 AI 专家（助手）配置。
要求：
- 使用简洁、专业的中文
- 名称 2-8 个字，易记、体现职能
- 描述 1-2 句话，说明帮用户解决什么问题
- 推荐提示词 3-5 条，每条 8-30 字，可直接点击使用
- 规则（personaMd）用 Markdown，包含角色定位、工作方式、输出格式，150-400 字
- avatarPreset 必须从以下 ID 中选一个最贴切的：${AVATAR_PRESET_IDS.join(', ')}
- 只输出 JSON，不要 markdown 代码块`;

@Injectable()
export class ExpertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelsService,
  ) {}

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.expert.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException();

    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { expertId: id },
        data: { expertId: null },
      });
      await tx.aclEntry.deleteMany({
        where: {
          tenantId,
          resourceType: 'expert',
          resourceId: id,
        },
      });
      await tx.expert.delete({ where: { id } });
    });

    return { ok: true };
  }

  async assist(
    tenantId: string,
    input: ExpertAssistInput,
  ): Promise<ExpertAssistResult> {
    const user = this.buildUserPrompt(input);
    const raw = await this.models.completeChat({
      tenantId,
      system: SYSTEM,
      user,
      maxTokens: 2048,
    });
    const parsed = parseJsonObject(raw);
    return normalizeResult(parsed, input.task);
  }

  private buildUserPrompt(input: ExpertAssistInput): string {
    const ctx = JSON.stringify(
      {
        name: input.name ?? '',
        description: input.description ?? '',
        personaMd: input.personaMd ?? '',
        suggestedPrompts: input.suggestedPrompts ?? [],
      },
      null,
      0,
    );

    switch (input.task) {
      case 'draft':
        if (!input.brief?.trim()) {
          throw new BadRequestException('请先描述你想创建的专家');
        }
        return `任务：根据一句话需求，生成完整专家配置。
用户需求：${input.brief.trim()}
返回 JSON：{"name":"","description":"","suggestedPrompts":[],"personaMd":"","avatarPreset":""}`;

      case 'optimize_name':
        return `任务：优化专家名称，更专业易记。
当前上下文：${ctx}
返回 JSON：{"name":""}`;

      case 'optimize_description':
        return `任务：优化专家描述，更清晰有吸引力。
当前上下文：${ctx}
返回 JSON：{"description":""}`;

      case 'generate_prompts':
        return `任务：根据名称和描述，生成 3-5 条推荐提示词。
当前上下文：${ctx}
返回 JSON：{"suggestedPrompts":[]}`;

      case 'optimize_rules':
        return `任务：优化专家规则（personaMd），Markdown 格式，专业可执行。
当前上下文：${ctx}
返回 JSON：{"personaMd":""}`;

      case 'suggest_avatar':
        return `任务：根据名称和描述，选择最贴切的 avatarPreset。
当前上下文：${ctx}
返回 JSON：{"avatarPreset":""}`;

      default:
        throw new BadRequestException('未知任务');
    }
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as Record<string, unknown>;
    }
    throw new BadRequestException('AI 返回格式无效，请重试');
  }
}

function normalizeResult(
  parsed: Record<string, unknown>,
  task: ExpertAssistTask,
): ExpertAssistResult {
  const out: ExpertAssistResult = {};
  if (typeof parsed.name === 'string' && parsed.name.trim()) {
    out.name = parsed.name.trim().slice(0, 40);
  }
  if (typeof parsed.description === 'string' && parsed.description.trim()) {
    out.description = parsed.description.trim().slice(0, 280);
  }
  if (typeof parsed.personaMd === 'string' && parsed.personaMd.trim()) {
    out.personaMd = parsed.personaMd.trim().slice(0, 8000);
  }
  if (Array.isArray(parsed.suggestedPrompts)) {
    out.suggestedPrompts = parsed.suggestedPrompts
      .map((p) => String(p).trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  if (typeof parsed.avatarPreset === 'string') {
    const id = parsed.avatarPreset.trim();
    if ((AVATAR_PRESET_IDS as readonly string[]).includes(id)) {
      out.avatarPreset = id;
    }
  }

  if (task === 'draft' && !out.name) {
    throw new BadRequestException('AI 未能生成有效配置，请补充描述后重试');
  }
  return out;
}

export { AVATAR_PRESET_IDS };
