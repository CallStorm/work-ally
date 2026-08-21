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
      const off = this.events.onRun(id, (event: RuntimeEvent) => {
        subscriber.next({ data: event });
        if (event.type === 'run_finished' || event.type === 'error') {
          // keep streaming until finished; error also ends
          if (event.type === 'run_finished') {
            subscriber.complete();
          }
        }
      });
      return () => off();
    });
  }
}
