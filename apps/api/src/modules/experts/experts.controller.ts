import { Controller, Get } from '@nestjs/common';
import { ExpertsService } from './experts.service';

@Controller('experts')
export class ExpertsController {
  constructor(private readonly service: ExpertsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'experts', status: 'stub' };
  }
}
