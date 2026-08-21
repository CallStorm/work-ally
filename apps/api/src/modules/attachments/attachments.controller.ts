import { Controller, Get } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'attachments', status: 'stub' };
  }
}
