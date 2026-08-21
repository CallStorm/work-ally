import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { RuntimeEventsService } from './runtime-events.service';

export type AgentBundle = {
  mode: 'expert' | 'default';
  name: string;
  instructions: string;
  modelId: string;
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
  ) {}

  resolveProvider(): 'mastra' | 'mock' {
    const forced = this.config.get<string>('RUNTIME_PROVIDER');
    if (forced === 'mock' || forced === 'mastra') {
      return forced;
    }
    const hasKey = Boolean(
      this.config.get('OPENAI_API_KEY') ||
        this.config.get('ANTHROPIC_API_KEY') ||
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
    });

    if (provider === 'mock') {
      return this.runMock(input);
    }
    return this.runMastra(input);
  }

  private async runMock(input: {
    runId: string;
    sessionId: string;
    bundle: AgentBundle;
    userMessage: string;
  }): Promise<RunnerResult> {
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
      '1. 当前为本地 mock 模式（未配置模型 API Key）。',
      '2. 多步循环骨架已跑通：thinking → tool_call → tool_result → message。',
      '3. 配置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 后即可切换 Mastra 真模型。',
      '',
      `建议下一步：把任务拆成可执行待办，并指定需要的知识库/连接器。`,
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
    const model = this.resolveModel(input.bundle.modelId);
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

    const agent = new Agent({
      id: `workally-${input.bundle.mode}`,
      name: input.bundle.name,
      instructions: input.bundle.instructions,
      model,
      tools: { workspace_clock: clockTool },
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
      this.logger.error('Mastra generate failed, falling back to mock', error);
      this.events.emit('thinking', input.runId, input.sessionId, {
        message: '真模型调用失败，回退 mock',
      });
      return this.runMock(input);
    }
  }

  private resolveModel(modelId: string): string {
    if (modelId && modelId !== 'auto') {
      if (modelId.includes('/')) return modelId;
      if (this.config.get('ANTHROPIC_API_KEY')) {
        return `anthropic/${modelId}`;
      }
      return `openai/${modelId}`;
    }
    if (this.config.get('ANTHROPIC_API_KEY')) {
      return this.config.get('MASTRA_MODEL') ?? 'anthropic/claude-sonnet-4-5';
    }
    if (this.config.get('GOOGLE_GENERATIVE_AI_API_KEY')) {
      return this.config.get('MASTRA_MODEL') ?? 'google/gemini-2.5-flash';
    }
    return this.config.get('MASTRA_MODEL') ?? 'openai/gpt-4o-mini';
  }
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
