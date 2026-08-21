import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RUNTIME_EVENT,
  type RuntimeEvent,
  type RuntimeEventType,
} from './runtime.types';

@Injectable()
export class RuntimeEventsService {
  private readonly buffers = new Map<string, RuntimeEvent[]>();

  constructor(private readonly emitter: EventEmitter2) {}

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

    if (type === 'run_finished') {
      setTimeout(() => this.buffers.delete(runId), 60_000);
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
}
