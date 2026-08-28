import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { AppRegistryService } from './app-registry.service';

@Controller('apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(private readonly registry: AppRegistryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.registry.listForUser(user);
  }
}
