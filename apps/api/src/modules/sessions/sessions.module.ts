import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { RuntimeModule } from '../runtime/runtime.module';
import { AclModule } from '../acl/acl.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [RuntimeModule, AclModule, AttachmentsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
