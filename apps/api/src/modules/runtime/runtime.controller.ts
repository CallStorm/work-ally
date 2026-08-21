import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RuntimeService } from './runtime.service';
import { RuntimeEventsService } from './runtime-events.service';
import type { RuntimeEvent } from './runtime.types';

@Controller()
@UseGuards(JwtAuthGuard)
export class RuntimeController {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly events: RuntimeEventsService,
  ) {}

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.runtime.getRun(id);
  }

  @Sse('runs/:id/events')
  eventsStream(@Param('id') id: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      const push = (event: RuntimeEvent) => {
        if (closed) return;
        subscriber.next({ data: event });
        if (event.type === 'run_finished') {
          closed = true;
          subscriber.complete();
        }
      };

      const off = this.events.onRun(id, push);

      // If the run already finished and buffer was cleared (e.g. process restart),
      // close the stream after a DB check so clients don't hang.
      void this.runtime.getRun(id).then((run) => {
        if (closed) return;
        if (
          run.state === 'succeeded' ||
          run.state === 'failed' ||
          run.state === 'cancelled'
        ) {
          const buffered = this.events.getBuffered(id);
          if (!buffered.some((e) => e.type === 'run_finished')) {
            push({
              type: 'run_finished',
              runId: id,
              sessionId: run.sessionId,
              ts: new Date().toISOString(),
              data: { state: run.state, replay: true },
            });
          }
        }
      });

      return () => {
        closed = true;
        off();
      };
    });
  }
}
