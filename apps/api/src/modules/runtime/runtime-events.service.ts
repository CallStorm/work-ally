import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RUNTIME_EVENT,
  type RuntimeEvent,
  type RuntimeEventType,
} from './runtime.types';

@Injectable()
export class RuntimeEventsService {
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
    this.emitter.emit(RUNTIME_EVENT, event);
    this.emitter.emit(`${RUNTIME_EVENT}.${runId}`, event);
    return event;
  }

  onRun(runId: string, listener: (event: RuntimeEvent) => void) {
    const key = `${RUNTIME_EVENT}.${runId}`;
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }
}
