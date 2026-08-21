import { Controller, Get } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'knowledge', status: 'stub' };
  }
}
