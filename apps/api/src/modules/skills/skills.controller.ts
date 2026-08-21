import { Controller, Get } from '@nestjs/common';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'skills', status: 'stub' };
  }
}
