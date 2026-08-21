import { Controller, Get } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'sessions', status: 'stub' };
  }
}
