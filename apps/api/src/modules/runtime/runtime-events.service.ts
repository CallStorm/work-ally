import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RUNTIME_EVENT,
  type RuntimeEvent,
  type RuntimeEventType,
} from './runtime.types';

/** Events worth persisting for historical run traces (skip high-volume deltas). */
const PERSIST_TYPES = new Set<RuntimeEventType>([
  'run_started',
  'thinking',
  'tool_call',
  'tool_result',
  'knowledge_hit',
  'error',
  'run_finished',
  'artifact_created',
  'artifact_updated',
]);

@Injectable()
export class RuntimeEventsService {
  private readonly logger = new Logger(RuntimeEventsService.name);
  private readonly buffers = new Map<string, RuntimeEvent[]>();
  private readonly seqCounters = new Map<string, number>();

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  emit(
    type: RuntimeEventType,
    runId: string,
    sessionId: string,
    data?: Record<string, unknown>,
  ) {
    const event: RuntimeEvent = {
      type,
      runId,
      sessionId,
      ts: new Date().toISOString(),
      data,
    };
    const buf = this.buffers.get(runId) ?? [];
    buf.push(event);
    this.buffers.set(runId, buf.slice(-200));
    this.emitter.emit(RUNTIME_EVENT, event);
    this.emitter.emit(`${RUNTIME_EVENT}.${runId}`, event);

    if (this.shouldPersist(type, data)) {
      void this.persist(event);
    }

    if (type === 'run_finished') {
      setTimeout(() => {
        this.buffers.delete(runId);
        this.seqCounters.delete(runId);
      }, 60_000);
    }
    return event;
  }

  getBuffered(runId: string) {
    return this.buffers.get(runId) ?? [];
  }

  onRun(runId: string, listener: (event: RuntimeEvent) => void) {
    for (const event of this.getBuffered(runId)) {
      listener(event);
    }
    const key = `${RUNTIME_EVENT}.${runId}`;
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }

  private shouldPersist(
    type: RuntimeEventType,
    data?: Record<string, unknown>,
  ) {
    if (!PERSIST_TYPES.has(type)) return false;
    // Skip streaming thinking chunks; keep final (streaming=false or absent)
    if (type === 'thinking' && data?.streaming === true) return false;
    return true;
  }

  private async persist(event: RuntimeEvent) {
    try {
      const seq = (this.seqCounters.get(event.runId) ?? 0) + 1;
      this.seqCounters.set(event.runId, seq);
      const data = sanitizeEventData(event.type, event.data);
      await this.prisma.agentRunEvent.create({
        data: {
          runId: event.runId,
          seq,
          type: event.type,
          ts: new Date(event.ts),
          data: data as object,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to persist run event ${event.type}: ${String(err)}`,
      );
    }
  }
}

function sanitizeEventData(
  type: RuntimeEventType,
  data?: Record<string, unknown>,
): Record<string, unknown> {
  if (!data) return {};
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

  if (type === 'tool_call' || type === 'tool_result') {
    truncateDeep(clone, 8_000);
  }
  if (type === 'thinking') {
    const msg = String(clone.message ?? '');
    if (msg.length > 20_000) {
      clone.message = `${msg.slice(0, 20_000)}…`;
    }
  }
  return clone;
}

function truncateDeep(value: unknown, maxLen: number): unknown {
  if (typeof value === 'string') {
    return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => truncateDeep(v, maxLen));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      // Drop huge write contents from persisted input
      if (key === 'content' && typeof obj[key] === 'string') {
        const s = obj[key] as string;
        if (s.length > 500) {
          obj[key] = `${s.slice(0, 500)}…`;
          continue;
        }
      }
      obj[key] = truncateDeep(obj[key], maxLen);
    }
  }
  return value;
}
