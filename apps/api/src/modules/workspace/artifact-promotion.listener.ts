import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RUNTIME_EVENT, type RuntimeEvent } from '../runtime/runtime.types';
import { ArtifactService } from './artifact.service';

@Injectable()
export class ArtifactPromotionListener implements OnModuleInit {
  private readonly logger = new Logger(ArtifactPromotionListener.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly artifacts: ArtifactService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.emitter.on(RUNTIME_EVENT, (event: RuntimeEvent) => {
      void this.handle(event);
    });
  }

  private async handle(event: RuntimeEvent) {
    try {
      if (event.type === 'tool_result') {
        const toolName = String(event.data?.toolName ?? '');
        if (!['write', 'edit'].includes(toolName.toLowerCase())) return;
        const session = await this.prisma.session.findUnique({
          where: { id: event.sessionId },
          select: { tenantId: true },
        });
        if (!session) return;
        await this.artifacts.handleToolResult({
          runId: event.runId,
          sessionId: event.sessionId,
          tenantId: session.tenantId,
          toolName,
          payload: event.data,
        });
        return;
      }

      if (event.type === 'run_finished' && event.data?.state === 'succeeded') {
        // RuntimeService already promotes before emitting run_finished.
        // Keep a quiet reconcile for older callers / missed paths.
        const session = await this.prisma.session.findUnique({
          where: { id: event.sessionId },
          select: { tenantId: true },
        });
        if (!session) return;
        await this.artifacts.scanWorkspaceAndPromote({
          runId: event.runId,
          sessionId: event.sessionId,
          tenantId: session.tenantId,
          emitEvents: false,
        });
      }
    } catch (err) {
      this.logger.warn(`Artifact promotion failed: ${String(err)}`);
    }
  }
}
