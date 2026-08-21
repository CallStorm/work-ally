import { Controller, Get } from '@nestjs/common';
import { DefaultAgentService } from './default-agent.service';

@Controller('default-agent')
export class DefaultAgentController {
  constructor(private readonly service: DefaultAgentService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'default-agent', status: 'stub' };
  }
}
