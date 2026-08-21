import { Controller, Get } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';

@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly service: ConnectorsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'connectors', status: 'stub' };
  }
}
