import { Controller, Get } from '@nestjs/common';
import { ModelsService } from './models.service';

@Controller('models')
export class ModelsController {
  constructor(private readonly service: ModelsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'models', status: 'stub' };
  }
}
