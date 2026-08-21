import { Controller, Get } from '@nestjs/common';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly service: MembersService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'members', status: 'stub' };
  }
}
