import { Module, forwardRef } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentAssemblyService } from './attachment-assembly.service';
import { AttachmentsService } from './attachments.service';
import { TextExtractService } from './text-extract.service';
import { StorageModule } from '../storage/storage.module';
import { RuntimeModule } from '../runtime/runtime.module';

@Module({
  imports: [StorageModule, forwardRef(() => RuntimeModule)],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, TextExtractService, AttachmentAssemblyService],
  exports: [AttachmentsService, TextExtractService, AttachmentAssemblyService],
})
export class AttachmentsModule {}
