import { Module } from '@nestjs/common';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';
import { RuntimeEventsService } from './runtime-events.service';
import { MastraRunnerService } from './mastra-runner.service';

@Module({
  controllers: [RuntimeController],
  providers: [RuntimeService, RuntimeEventsService, MastraRunnerService],
  exports: [RuntimeService, RuntimeEventsService],
})
export class RuntimeModule {}
