import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RuntimeEventsService } from './runtime-events.service';
import { MastraRunnerService } from './mastra-runner.service';
import { PiRunnerService } from './pi-runner.service';
import { CapabilityBundleService } from './capability-bundle.service';

@Injectable()
export class RuntimeService {
  private readonly logger = new Logger(RuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RuntimeEventsService,
    private readonly runner: MastraRunnerService,
    private readonly piRunner: PiRunnerService,
    private readonly capabilities: CapabilityBundleService,
    private readonly config: ConfigService,
  ) {}

  resolveEngine(): 'pi' | 'mastra' | 'mock' {
    const forced = this.config.get<string>('RUNTIME_PROVIDER');
    if (forced === 'mock' || forced === 'mastra' || forced === 'pi') {
      return forced;
    }
    return 'pi';
  }

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
      engine: this.resolveEngine(),
    });

    try {
      const bundle = await this.capabilities.resolveForSession(run.session);
      const history = run.session.messages
        .filter((m) => m.id !== run.messageId)
        .map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

      const engine = this.resolveEngine();
      let result: {
        text: string;
        stepsCount: number;
        provider: string;
      };

      if (engine === 'pi') {
        try {
          result = await this.piRunner.run({
            runId,
            sessionId: run.sessionId,
            tenantId: run.session.tenantId,
            bundle,
            userMessage: run.message.content,
            history,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Pi runtime error';
          this.logger.error(`Pi failed, falling back to mastra/mock: ${message}`);
          this.events.emit('thinking', runId, run.sessionId, {
            message: `Pi 失败，回退 Mastra：${message}`,
          });
          result = await this.runner.run({
            runId,
            sessionId: run.sessionId,
            bundle,
            userMessage: run.message.content,
            history,
          });
        }
      } else {
        result = await this.runner.run({
          runId,
          sessionId: run.sessionId,
          bundle,
          userMessage: run.message.content,
          history,
        });
      }

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
          assistantMessageId: assistant.id,
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
        events: { orderBy: { seq: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }
}
