import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  HANDBOOK_SLUG,
  STICKIES_SLUG,
  UpdateAppRegistrySchema,
} from '@work-ally/shared';
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
    return this.registry.listForAdmin(user.tenantId, user.userId);
  }

  @Get(':slug')
  async get(@CurrentUser() user: AuthUser, @Param('slug') slug: string) {
    if (slug === HANDBOOK_SLUG) {
      await this.registry.ensureHandbook(user.tenantId, user.userId);
    }
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
    if (slug !== STICKIES_SLUG && slug !== HANDBOOK_SLUG) {
      throw new NotFoundException('应用不存在');
    }
    const input = parseBody(UpdateAppRegistrySchema, body);
    const app =
      slug === STICKIES_SLUG
        ? await this.registry.updateStickies(user.tenantId, input)
        : await this.registry.updateHandbook(user.tenantId, input);
    if (!app) throw new NotFoundException('应用不存在');
    return this.registry.serialize(app);
  }
}
