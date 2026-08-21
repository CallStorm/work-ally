import { Controller, Get } from '@nestjs/common';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'groups', status: 'stub' };
  }
}
