import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeEventsService } from './runtime-events.service';
import { RuntimePathsService } from './runtime-paths.service';
import { McpBridgeService } from './mcp-bridge.service';
import type { AgentBundle } from './mastra-runner.service';

export type PiRunnerResult = {
  text: string;
  stepsCount: number;
  provider: 'pi';
};

/**
 * Embeds @mariozechner/pi-coding-agent (ESM) via dynamic import.
 * Skills use progressive disclosure; coding tools run inside per-run cwd sandbox.
 */
@Injectable()
export class PiRunnerService {
  private readonly logger = new Logger(PiRunnerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly events: RuntimeEventsService,
    private readonly paths: RuntimePathsService,
    private readonly mcp: McpBridgeService,
  ) {}

  async run(input: {
    runId: string;
    sessionId: string;
    tenantId: string;
    bundle: AgentBundle;
    userMessage: string;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }): Promise<PiRunnerResult> {
    // Nest compiles to CJS; Pi is ESM-only — use native dynamic import.
    const importer = new Function(
      'm',
      'return import(m)',
    ) as (m: string) => Promise<typeof import('@mariozechner/pi-coding-agent')>;
    const pi = await importer('@mariozechner/pi-coding-agent');

    const llm = input.bundle.llm;
    const apiKey =
      llm?.apiKey ||
      this.config.get<string>('ANTHROPIC_API_KEY') ||
      this.config.get<string>('ANTHROPIC_AUTH_TOKEN');
    if (!apiKey) {
      throw new Error('No LLM API key (configure Admin Provider or ANTHROPIC_* env)');
    }

    const modelId = this.resolveModelId(input.bundle.modelId);
    const baseUrl = normalizeAnthropicBaseUrlForPi(
      llm?.baseUrl || this.config.get<string>('ANTHROPIC_BASE_URL'),
    );
    const piProviderId = llm?.piProviderId || 'minimax';

    const sandbox = this.paths.ensureDir(
      this.paths.runSandboxDir(input.tenantId, input.runId),
    );
    const agentDir = this.paths.ensureDir(path.join(sandbox, '.pi-agent'));
    const modelsPath = path.join(agentDir, 'models.json');
    this.paths.writeModelsJson(modelsPath, {
      baseUrl,
      modelId,
      providerId: piProviderId,
    });

    const authStorage = pi.AuthStorage.create(path.join(agentDir, 'auth.json'));
    authStorage.setRuntimeApiKey(piProviderId, apiKey);
    const modelRegistry = pi.ModelRegistry.create(authStorage, modelsPath);
    const model = modelRegistry.find(piProviderId, modelId);
    if (!model) {
      throw new Error(`Pi model not found: ${piProviderId}/${modelId}`);
    }

    const skillDefs = this.buildPiSkills(input.tenantId, input.bundle, pi);

    const mcpMount = await this.mcp.mountForRun({
      tenantId: input.tenantId,
      connectors: input.bundle.connectors ?? [],
      onToolEvent: ({ phase, toolName, payload }) => {
        if (phase === 'call') {
          this.events.emit('tool_call', input.runId, input.sessionId, {
            toolName,
            input: payload,
          });
        } else {
          this.events.emit('tool_result', input.runId, input.sessionId, {
            toolName,
            output: payload,
          });
        }
      },
    });

    this.events.emit('thinking', input.runId, input.sessionId, {
      provider: 'pi',
      message: `Pi runtime · 模型 ${modelId} · 技能 ${skillDefs.length} · MCP 工具 ${mcpMount.toolCount}`,
      skills: skillDefs.length,
      mcpTools: mcpMount.toolCount,
      mcpErrors: mcpMount.errors,
      cwd: sandbox,
    });

    const persona = [
      input.bundle.instructions,
      mcpMount.manifest,
      mcpMount.errors.length
        ? `\n\nMCP mount warnings:\n${mcpMount.errors.map((e) => `- ${e}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const loader = new pi.DefaultResourceLoader({
      cwd: sandbox,
      agentDir,
      systemPromptOverride: () =>
        [
          persona,
          '',
          'You are running inside WorkAlly cloud sandbox.',
          `Working directory: ${sandbox}`,
          'Use skills when relevant: only name/description are preloaded; read SKILL.md and relative references on demand.',
          mcpMount.toolCount
            ? 'Remote MCP tools are mounted (names start with mcp_). Use them for external systems like 简道云 — never claim you lack access when these tools exist.'
            : '',
          'bash/write/edit/read are available inside the sandbox cwd.',
        ]
          .filter(Boolean)
          .join('\n'),
      skillsOverride: () => ({
        skills: skillDefs,
        diagnostics: [],
      }),
    });
    await loader.reload();

    const settingsManager = pi.SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true, maxRetries: 2 },
    });

    // Omit default `tools` so Pi builds coding tools bound to sandbox cwd.
    const { session } = await pi.createAgentSession({
      cwd: sandbox,
      agentDir,
      model,
      thinkingLevel: 'low',
      authStorage,
      modelRegistry,
      resourceLoader: loader,
      sessionManager: pi.SessionManager.inMemory(),
      settingsManager,
      customTools: mcpMount.customTools as never,
    });

    let text = '';
    let stepsCount = 0;
    let thinkingText = '';

    const unsubscribe = session.subscribe((event) => {
      this.mapEvent(input.runId, input.sessionId, event, {
        onText: (delta) => {
          text += delta;
          this.events.emit('message_delta', input.runId, input.sessionId, {
            delta,
          });
        },
        onThinking: (delta) => {
          thinkingText += delta;
          this.events.emit('thinking', input.runId, input.sessionId, {
            message: thinkingText,
            streaming: true,
          });
        },
        onStep: () => {
          stepsCount += 1;
          if (thinkingText.trim()) {
            this.events.emit('thinking', input.runId, input.sessionId, {
              message: thinkingText.trim(),
              streaming: false,
            });
            thinkingText = '';
          }
        },
      });
    });

    try {
      const prompt = buildPrompt(input.history, input.userMessage);
      await session.prompt(prompt);
      if (!text.trim()) {
        // Fallback: last assistant message from session if deltas missed
        const messages = session.messages ?? [];
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const m = messages[i] as { role?: string; content?: unknown };
          if (m.role === 'assistant') {
            text = extractText(m.content) || text;
            break;
          }
        }
      }
      return { text: text || '（Pi 未返回文本）', stepsCount: Math.max(stepsCount, 1), provider: 'pi' };
    } finally {
      unsubscribe();
      try {
        session.dispose();
      } catch (err) {
        this.logger.warn(`Pi session dispose: ${String(err)}`);
      }
      await mcpMount.cleanup();
    }
  }

  private buildPiSkills(
    tenantId: string,
    bundle: AgentBundle,
    pi: typeof import('@mariozechner/pi-coding-agent'),
  ) {
    const skills = bundle.skills ?? [];
    return skills
      .map((s) => {
        const baseDir = this.paths.skillPackageDir(tenantId, s.slug);
        const filePath = path.join(baseDir, 'SKILL.md');
        if (!fs.existsSync(filePath)) {
          if (bundle.skillBodies?.[s.slug]) {
            this.paths.ensureDir(baseDir);
            fs.writeFileSync(
              filePath,
              [
                '---',
                `name: ${s.slug}`,
                `description: ${JSON.stringify(s.descriptionShort)}`,
                '---',
                '',
                bundle.skillBodies[s.slug],
              ].join('\n'),
              'utf8',
            );
          } else {
            return null;
          }
        }
        return {
          name: s.slug,
          description: s.descriptionShort || s.name,
          filePath,
          baseDir,
          sourceInfo: pi.createSyntheticSourceInfo(filePath, {
            source: 'workally',
            scope: 'project',
            origin: 'top-level',
            baseDir,
          }),
          disableModelInvocation: false,
        };
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }

  private resolveModelId(modelId: string) {
    if (!modelId || modelId === 'auto') {
      return (
        this.config.get<string>('MASTRA_MODEL') ||
        this.config.get<string>('ANTHROPIC_DEFAULT_FABLE_MODEL') ||
        'MiniMax-M3'
      )
        .split('/')
        .pop() as string;
    }
    return modelId.includes('/') ? (modelId.split('/').pop() as string) : modelId;
  }

  private mapEvent(
    runId: string,
    sessionId: string,
    event: { type: string; [k: string]: unknown },
    hooks: {
      onText: (d: string) => void;
      onThinking?: (d: string) => void;
      onStep: () => void;
    },
  ) {
    switch (event.type) {
      case 'message_update': {
        const ame = event.assistantMessageEvent as
          | { type?: string; delta?: string }
          | undefined;
        if (ame?.type === 'text_delta' && ame.delta) {
          hooks.onText(ame.delta);
        }
        if (ame?.type === 'thinking_delta' && ame.delta) {
          hooks.onThinking?.(ame.delta);
        }
        break;
      }
      case 'tool_execution_start': {
        hooks.onStep();
        this.events.emit('tool_call', runId, sessionId, {
          toolName: String(event.toolName ?? 'tool'),
          input: event.args ?? event.input ?? {},
        });
        break;
      }
      case 'tool_execution_end': {
        this.events.emit('tool_result', runId, sessionId, {
          toolName: String(event.toolName ?? 'tool'),
          output: event.result ?? event.output ?? {},
        });
        break;
      }
      case 'turn_start':
        this.events.emit('thinking', runId, sessionId, {
          message: 'Pi turn start',
        });
        break;
      default:
        break;
    }
  }
}

/** Pi anthropic-messages provider expects base without forced /v1 in some setups; keep /anthropic. */
function normalizeAnthropicBaseUrlForPi(raw?: string | null): string {
  if (!raw) return 'https://api.anthropic.com';
  return raw.replace(/\/$/, '').replace(/\/v1$/, '');
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
  return prior ? `${prior}\nUSER: ${userMessage}` : userMessage;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text: unknown }).text ?? '');
      }
      return '';
    })
    .join('');
}
