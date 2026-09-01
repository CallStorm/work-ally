import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { MembershipRole } from '@work-ally/shared';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentAssemblyService } from '../attachments/attachment-assembly.service';
import { RuntimeEventsService } from './runtime-events.service';
import { MastraRunnerService } from './mastra-runner.service';
import { PiRunnerService } from './pi-runner.service';
import { CapabilityBundleService } from './capability-bundle.service';
import { ArtifactService } from '../workspace/artifact.service';

@Injectable()
export class RuntimeService implements OnModuleInit {
  private readonly logger = new Logger(RuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RuntimeEventsService,
    private readonly runner: MastraRunnerService,
    private readonly piRunner: PiRunnerService,
    private readonly capabilities: CapabilityBundleService,
    private readonly assembly: AttachmentAssemblyService,
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Runs left in queued/running die with the previous Node process — free them on boot. */
  async onModuleInit() {
    const result = await this.prisma.agentRun.updateMany({
      where: { state: { in: ['queued', 'running'] } },
      data: {
        state: 'failed',
        errorSummary: '进程重启，任务中断（请重新发送）',
      },
    });
    if (result.count > 0) {
      this.logger.warn(
        `Marked ${result.count} orphaned queued/running run(s) as failed after restart`,
      );
    }
  }
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

      const runUser = await this.resolveRunUser(
        run.session.tenantId,
        run.session.createdBy,
      );
      const assembled = await this.assembly.assemble({
        user: runUser,
        sessionId: run.sessionId,
        tenantId: run.session.tenantId,
        attachmentIds: asAttachmentIds(run.message.attachmentIds),
        userText: run.message.content,
        modelConfigId: run.session.modelConfigId,
      });

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
            userMessage: assembled.text,
            history,
            images: assembled.images,
            supportsVision: assembled.supportsVision,
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
            userMessage: assembled.text,
            history,
          });
        }
      } else {
        result = await this.runner.run({
          runId,
          sessionId: run.sessionId,
          bundle,
          userMessage: assembled.text,
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

      // Promote bash-created files BEFORE run_finished so SSE clients still see them.
      await this.promoteWorkspaceArtifacts(
        runId,
        run.sessionId,
        run.session.tenantId,
      );

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

  private async resolveRunUser(
    tenantId: string,
    userId: string,
  ): Promise<AuthUser> {
    const membership = await this.prisma.membership.findFirst({
      where: { tenantId, userId, status: 'active' },
      include: { user: true },
    });
    if (!membership) {
      return {
        userId,
        tenantId,
        role: 'member',
        phone: '',
        name: '',
      };
    }
    return {
      userId,
      tenantId,
      role: membership.role as MembershipRole,
      phone: membership.user.phone,
      name: membership.user.name,
    };
  }

  private async promoteWorkspaceArtifacts(
    runId: string,
    sessionId: string,
    tenantId: string,
  ) {
    try {
      const artifacts = this.moduleRef.get(ArtifactService, { strict: false });
      await artifacts.scanWorkspaceAndPromote({
        runId,
        sessionId,
        tenantId,
        emitEvents: true,
      });
    } catch (err) {
      this.logger.warn(
        `Workspace artifact promotion skipped: ${String(err)}`,
      );
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

function asAttachmentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}
