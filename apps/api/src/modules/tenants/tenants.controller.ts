import { Controller, Get } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'tenants', status: 'stub' };
  }
}
