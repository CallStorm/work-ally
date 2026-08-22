import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { RuntimeEventsService } from './runtime-events.service';

export type AgentBundle = {
  mode: 'expert' | 'default';
  name: string;
  instructions: string;
  modelId: string;
  /** Resolved from tenant LlmProvider; env fallback when absent */
  llm?: {
    apiKey: string;
    baseUrl: string;
    piProviderId: string;
    preset: string;
  };
  skills?: Array<{
    id: string;
    name: string;
    slug: string;
    descriptionShort: string;
  }>;
  /** Optional full bodies for materializing packages when zip extract missing */
  skillBodies?: Record<string, string>;
  connectors?: Array<{
    id: string;
    name: string;
    transport: string;
    endpointUrl: string;
  }>;
  knowledge?: Array<{
    id: string;
    name: string;
    displayName: string;
    provider: string;
    baseUrl: string;
  }>;
};

export type RunnerResult = {
  text: string;
  stepsCount: number;
  provider: 'mastra' | 'mock';
};

@Injectable()
export class MastraRunnerService {
  private readonly logger = new Logger(MastraRunnerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly events: RuntimeEventsService,
    private readonly prisma: PrismaService,
  ) {}

  resolveProvider(): 'mastra' | 'mock' {
    const forced = this.config.get<string>('RUNTIME_PROVIDER');
    if (forced === 'mock' || forced === 'mastra') {
      return forced;
    }
    const hasKey = Boolean(
      this.config.get('OPENAI_API_KEY') ||
        this.config.get('ANTHROPIC_API_KEY') ||
        this.config.get('ANTHROPIC_AUTH_TOKEN') ||
        this.config.get('GOOGLE_GENERATIVE_AI_API_KEY'),
    );
    return hasKey ? 'mastra' : 'mock';
  }

  async run(input: {
    runId: string;
    sessionId: string;
    bundle: AgentBundle;
    userMessage: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }): Promise<RunnerResult> {
    const provider = this.resolveProvider();
    this.events.emit('thinking', input.runId, input.sessionId, {
      provider,
      message: 'Agent 开始规划…',
      skills: input.bundle.skills?.length ?? 0,
      connectors: input.bundle.connectors?.length ?? 0,
      knowledge: input.bundle.knowledge?.length ?? 0,
    });

    if (provider === 'mock') {
      return this.runMock(input, '未配置模型 API Key，使用 mock runtime。');
    }
    return this.runMastra(input);
  }

  private async runMock(
    input: {
      runId: string;
      sessionId: string;
      bundle: AgentBundle;
      userMessage: string;
    },
    reason: string,
  ): Promise<RunnerResult> {
    this.events.emit('tool_call', input.runId, input.sessionId, {
      toolName: 'workspace_clock',
      input: { timezone: 'Asia/Shanghai' },
    });
    await delay(80);
    const now = new Date().toISOString();
    this.events.emit('tool_result', input.runId, input.sessionId, {
      toolName: 'workspace_clock',
      output: { now },
    });

    const text = [
      `【${input.bundle.name} · mock runtime】`,
      '',
      `已理解你的请求：${input.userMessage}`,
      '',
      '结论：',
      `1. ${reason}`,
      `2. 已注入技能 ${input.bundle.skills?.length ?? 0} / 连接器 ${input.bundle.connectors?.length ?? 0} / 知识库 ${input.bundle.knowledge?.length ?? 0}（配置 ∩ can_use）。`,
      '3. 配置 ANTHROPIC_API_KEY 后即可走真模型。',
      '',
      `（工具时间戳：${now}）`,
    ].join('\n');

    for (const chunk of chunkText(text, 48)) {
      this.events.emit('message_delta', input.runId, input.sessionId, {
        delta: chunk,
      });
      await delay(15);
    }

    return { text, stepsCount: 2, provider: 'mock' };
  }

  private async runMastra(input: {
    runId: string;
    sessionId: string;
    bundle: AgentBundle;
    userMessage: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }): Promise<RunnerResult> {
    const model = this.resolveLanguageModel(
      input.bundle.modelId,
      input.bundle.llm,
    );
    this.events.emit('thinking', input.runId, input.sessionId, {
      message: `使用模型 ${this.resolveBareModelId(input.bundle.modelId)}；技能 ${input.bundle.skills?.length ?? 0}，连接器 ${input.bundle.connectors?.length ?? 0}，知识库 ${input.bundle.knowledge?.length ?? 0}`,
    });

    const tools = this.buildTools(input);

    const agent = new Agent({
      id: `workally-${input.bundle.mode}`,
      name: input.bundle.name,
      instructions: input.bundle.instructions,
      model,
      tools,
    });

    const prompt = buildPrompt(input.history, input.userMessage);
    try {
      const response = await agent.generate(prompt, {
        maxSteps: 6,
      });
      const text =
        typeof response === 'string'
          ? response
          : ((response as { text?: string }).text ?? String(response));

      for (const chunk of chunkText(text, 64)) {
        this.events.emit('message_delta', input.runId, input.sessionId, {
          delta: chunk,
        });
      }

      const stepsCount =
        (response as { steps?: unknown[] }).steps?.length ?? 1;
      return { text, stepsCount, provider: 'mastra' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Mastra error';
      this.logger.error(`Mastra generate failed: ${message}`, error);
      this.events.emit('thinking', input.runId, input.sessionId, {
        message: `真模型调用失败，回退 mock：${message}`,
      });
      return this.runMock(input, `真模型调用失败：${message}`);
    }
  }

  private buildTools(input: {
    runId: string;
    sessionId: string;
    bundle: AgentBundle;
  }) {
    const clockTool = createTool({
      id: 'workspace_clock',
      description: 'Get the current time in ISO format for planning.',
      inputSchema: z.object({
        timezone: z.string().optional(),
      }),
      outputSchema: z.object({
        now: z.string(),
        timezone: z.string().optional(),
      }),
      execute: async ({ timezone }) => {
        this.events.emit('tool_call', input.runId, input.sessionId, {
          toolName: 'workspace_clock',
          input: { timezone },
        });
        const result = {
          now: new Date().toISOString(),
          timezone,
        };
        this.events.emit('tool_result', input.runId, input.sessionId, {
          toolName: 'workspace_clock',
          output: result,
        });
        return result;
      },
    });

    const listConnectors = createTool({
      id: 'list_available_connectors',
      description:
        'List MCP connectors available in this session (ACL-filtered). Remote MCP invocation is not fully mounted yet.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        connectors: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            transport: z.string(),
            endpointUrl: z.string(),
          }),
        ),
      }),
      execute: async () => {
        const connectors = input.bundle.connectors ?? [];
        this.events.emit('tool_call', input.runId, input.sessionId, {
          toolName: 'list_available_connectors',
          input: {},
        });
        this.events.emit('tool_result', input.runId, input.sessionId, {
          toolName: 'list_available_connectors',
          output: { connectors },
        });
        return { connectors };
      },
    });

    const knowledgeRetrieve = createTool({
      id: 'knowledge_retrieve',
      description:
        'Retrieve from an allowed knowledge binding. Provider HTTP adapters are stubbed; records a KnowledgeHit for the sidebar.',
      inputSchema: z.object({
        knowledgeId: z.string().optional(),
        query: z.string().min(1),
      }),
      outputSchema: z.object({
        knowledgeId: z.string(),
        query: z.string(),
        citations: z.array(
          z.object({
            title: z.string(),
            snippet: z.string(),
          }),
        ),
        note: z.string(),
      }),
      execute: async ({ knowledgeId, query }) => {
        const allowed = input.bundle.knowledge ?? [];
        const selected =
          (knowledgeId
            ? allowed.find((k) => k.id === knowledgeId)
            : allowed[0]) ?? null;

        this.events.emit('tool_call', input.runId, input.sessionId, {
          toolName: 'knowledge_retrieve',
          input: { knowledgeId, query },
        });

        if (!selected) {
          const empty = {
            knowledgeId: knowledgeId ?? '',
            query,
            citations: [] as Array<{ title: string; snippet: string }>,
            note: '当前会话没有可用的知识库绑定（配置 ∩ can_use 为空）。',
          };
          this.events.emit('tool_result', input.runId, input.sessionId, {
            toolName: 'knowledge_retrieve',
            output: empty,
          });
          return empty;
        }

        const citations = [
          {
            title: `${selected.displayName} · ${selected.provider}`,
            snippet: `（检索桩）已对「${query}」命中绑定 ${selected.displayName}（${selected.baseUrl}）。真实 Dify/RAGFlow 调用后续接入。`,
          },
        ];

        await this.prisma.knowledgeHit.create({
          data: {
            runId: input.runId,
            knowledgeId: selected.id,
            query,
            citations,
          },
        });

        this.events.emit('knowledge_hit', input.runId, input.sessionId, {
          knowledgeId: selected.id,
          query,
          citations,
        });

        const result = {
          knowledgeId: selected.id,
          query,
          citations,
          note: 'knowledge_retrieve stub — provider HTTP not called yet',
        };
        this.events.emit('tool_result', input.runId, input.sessionId, {
          toolName: 'knowledge_retrieve',
          output: result,
        });
        return result;
      },
    });

    return {
      workspace_clock: clockTool,
      list_available_connectors: listConnectors,
      knowledge_retrieve: knowledgeRetrieve,
    };
  }

  private resolveLanguageModel(
    modelId: string,
    llm?: AgentBundle['llm'],
  ) {
    const apiKey =
      llm?.apiKey ||
      this.config.get<string>('ANTHROPIC_API_KEY') ||
      this.config.get<string>('ANTHROPIC_AUTH_TOKEN');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN is not set');
    }

    const baseURL = normalizeAnthropicBaseUrl(
      llm?.baseUrl || this.config.get<string>('ANTHROPIC_BASE_URL'),
    );
    process.env.ANTHROPIC_API_KEY = apiKey;
    process.env.ANTHROPIC_BASE_URL = baseURL;

    const anthropic = createAnthropic({ apiKey, baseURL });
    return anthropic(this.resolveBareModelId(modelId));
  }

  private resolveBareModelId(modelId: string): string {
    const raw =
      !modelId || modelId === 'auto'
        ? (this.config.get<string>('MASTRA_MODEL') ??
          this.config.get<string>('ANTHROPIC_DEFAULT_FABLE_MODEL') ??
          'MiniMax-M3')
        : modelId;
    return raw.includes('/') ? (raw.split('/').pop() as string) : raw;
  }
}

function normalizeAnthropicBaseUrl(raw?: string | null): string {
  const fallback = 'https://api.anthropic.com/v1';
  if (!raw) return fallback;
  let url = raw.replace(/\/$/, '');
  if (url.endsWith('/anthropic')) {
    url = `${url}/v1`;
  }
  return url;
}

function buildPrompt(
  history: Array<{ role: string; content: string }>,
  userMessage: string,
) {
  const prior = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');
  return prior
    ? `${prior}\nUSER: ${userMessage}`
    : userMessage;
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
