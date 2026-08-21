import { Controller, Get } from '@nestjs/common';
import { AclService } from './acl.service';

@Controller('acl')
export class AclController {
  constructor(private readonly service: AclService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'acl', status: 'stub' };
  }
}
