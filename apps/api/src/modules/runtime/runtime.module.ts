import { Module, forwardRef } from '@nestjs/common';
import { RuntimeController } from './runtime.controller';
import { RuntimeService } from './runtime.service';
import { RuntimeEventsService } from './runtime-events.service';
import { MastraRunnerService } from './mastra-runner.service';
import { PiRunnerService } from './pi-runner.service';
import { CapabilityBundleService } from './capability-bundle.service';
import { RuntimePathsService } from './runtime-paths.service';
import { McpBridgeService } from './mcp-bridge.service';
import { AclModule } from '../acl/acl.module';
import { ModelsModule } from '../models/models.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [AclModule, ModelsModule, forwardRef(() => AttachmentsModule)],
  controllers: [RuntimeController],
  providers: [
    RuntimeService,
    RuntimeEventsService,
    MastraRunnerService,
    PiRunnerService,
    CapabilityBundleService,
    RuntimePathsService,
    McpBridgeService,
  ],
  exports: [
    RuntimeService,
    RuntimeEventsService,
    RuntimePathsService,
    McpBridgeService,
  ],
})
export class RuntimeModule {}
