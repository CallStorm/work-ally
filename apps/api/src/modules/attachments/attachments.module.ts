import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { TextExtractService } from './text-extract.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, TextExtractService],
  exports: [AttachmentsService, TextExtractService],
})
export class AttachmentsModule {}
