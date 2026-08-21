import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RuntimeEventsService } from './runtime-events.service';
import {
  MastraRunnerService,
  type AgentBundle,
} from './mastra-runner.service';

@Injectable()
export class RuntimeService {
  private readonly logger = new Logger(RuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RuntimeEventsService,
    private readonly runner: MastraRunnerService,
  ) {}

  async executeRun(runId: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        message: true,
        session: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            expert: true,
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Run not found');
    }

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: { state: 'running' },
    });
    this.events.emit('run_started', runId, run.sessionId, {
      agentMode: run.agentMode,
    });

    try {
      const bundle = await this.resolveBundle(run.session);
      const history = run.session.messages
        .filter((m) => m.id !== run.messageId)
        .map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

      const result = await this.runner.run({
        runId,
        sessionId: run.sessionId,
        bundle,
        userMessage: run.message.content,
        history,
      });

      const assistant = await this.prisma.message.create({
        data: {
          sessionId: run.sessionId,
          role: 'assistant',
          content: result.text,
          attachmentIds: [],
        },
      });

      await this.prisma.agentRun.update({
        where: { id: runId },
        data: {
          state: 'succeeded',
          stepsCount: result.stepsCount,
        },
      });

      this.events.emit('message_done', runId, run.sessionId, {
        messageId: assistant.id,
        content: result.text,
        provider: result.provider,
      });
      this.events.emit('run_finished', runId, run.sessionId, {
        state: 'succeeded',
        stepsCount: result.stepsCount,
      });

      return { runId, messageId: assistant.id, provider: result.provider };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown runtime error';
      this.logger.error(`Run ${runId} failed: ${message}`);
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { state: 'failed', errorSummary: message },
      });
      this.events.emit('error', runId, run.sessionId, { message });
      this.events.emit('run_finished', runId, run.sessionId, {
        state: 'failed',
      });
      throw error;
    }
  }

  async getRun(runId: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        toolCalls: true,
        knowledgeHits: true,
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  private async resolveBundle(session: {
    tenantId: string;
    expertId: string | null;
    modelId: string;
    expert: {
      name: string;
      personaMd: string;
    } | null;
  }): Promise<AgentBundle> {
    if (session.expertId && session.expert) {
      return {
        mode: 'expert',
        name: session.expert.name,
        instructions: session.expert.personaMd,
        modelId: session.modelId,
      };
    }
    const defaultAgent = await this.prisma.defaultAgent.findUnique({
      where: { tenantId: session.tenantId },
    });
    return {
      mode: 'default',
      name: '默认助手',
      instructions:
        defaultAgent?.personaMd ??
        '你是 WorkAlly 默认办公助手，用中文给出清晰结论。',
      modelId: session.modelId,
    };
  }
}
