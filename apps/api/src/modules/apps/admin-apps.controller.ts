import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { STICKIES_SLUG, UpdateAppRegistrySchema } from '@work-ally/shared';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { parseBody } from '../../common/zod';
import { AclService } from '../acl/acl.service';
import { AppRegistryService } from './app-registry.service';

@Controller('admin/apps')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAppsController {
  constructor(
    private readonly registry: AppRegistryService,
    private readonly acl: AclService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    await this.registry.ensureStickies(user.tenantId, user.userId);
    const app = await this.registry.getBySlug(user.tenantId, STICKIES_SLUG);
    return app ? [this.registry.serialize(app)] : [];
  }

  @Get(':slug')
  async get(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    const app = await this.registry.getBySlug(user.tenantId, slug);
    if (!app) throw new NotFoundException('应用不存在');
    const entries = await this.acl.getAcl(user, 'apps', app.id);
    return {
      ...this.registry.serialize(app),
      visibility: app.visibility,
      entries,
    };
  }

  @Patch(':slug')
  async patch(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() body: unknown,
  ) {
    if (slug !== STICKIES_SLUG) throw new NotFoundException('应用不存在');
    const input = parseBody(UpdateAppRegistrySchema, body);
    const app = await this.registry.updateStickies(user.tenantId, input);
    if (!app) throw new NotFoundException('应用不存在');
    return this.registry.serialize(app);
  }
}
