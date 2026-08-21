import { Controller, Get } from '@nestjs/common';
import { RuntimeService } from './runtime.service';

@Controller('runtime')
export class RuntimeController {
  constructor(private readonly service: RuntimeService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'runtime', status: 'stub' };
  }
}
