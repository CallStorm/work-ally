import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { ModelsService, type LlmPreset } from './models.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get('models')
  listEnabled(@CurrentUser() user: AuthUser) {
    return this.models.listEnabledModels(user.tenantId);
  }

  @Get('admin/llm-presets')
  @UseGuards(AdminGuard)
  presets() {
    return this.models.listPresets();
  }

  @Get('admin/llm-providers')
  @UseGuards(AdminGuard)
  listProviders(@CurrentUser() user: AuthUser) {
    return this.models.listProviders(user.tenantId);
  }

  @Post('admin/llm-providers')
  @UseGuards(AdminGuard)
  createProvider(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      preset: LlmPreset;
      name?: string;
      baseUrl?: string;
      apiKey: string;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.models.createProvider(user.tenantId, body);
  }

  @Post('admin/llm-providers/preview-models')
  @UseGuards(AdminGuard)
  previewModels(
    @Body()
    body: {
      preset: LlmPreset;
      baseUrl?: string;
      apiKey: string;
      protocol?: string;
    },
  ) {
    return this.models.previewModels(body);
  }

  @Post('admin/llm-providers/with-models')
  @UseGuards(AdminGuard)
  createWithModels(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      preset: LlmPreset;
      name?: string;
      baseUrl?: string;
      apiKey: string;
      protocol?: string;
      models: Array<{ modelId: string; displayName?: string }>;
    },
  ) {
    return this.models.createProviderWithModels(user.tenantId, body);
  }

  @Patch('admin/llm-providers/:id')
  @UseGuards(AdminGuard)
  updateProvider(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      baseUrl: string;
      apiKey: string;
      enabled: boolean;
      sortOrder: number;
    }>,
  ) {
    return this.models.updateProvider(user.tenantId, id, body);
  }

  @Delete('admin/llm-providers/:id')
  @UseGuards(AdminGuard)
  deleteProvider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.models.deleteProvider(user.tenantId, id);
  }

  @Post('admin/llm-providers/:id/sync-models')
  @UseGuards(AdminGuard)
  syncModels(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.models.syncModels(user.tenantId, id);
  }

  @Post('admin/llm-providers/:id/models')
  @UseGuards(AdminGuard)
  addModels(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { models: Array<{ modelId: string; displayName?: string }> },
  ) {
    return this.models.addModels(user.tenantId, id, body.models ?? []);
  }

  @Get('admin/models')
  @UseGuards(AdminGuard)
  listAll(@CurrentUser() user: AuthUser) {
    return this.models.listAllModels(user.tenantId);
  }

  @Patch('admin/models/:id')
  @UseGuards(AdminGuard)
  updateModel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      displayName: string;
      enabled: boolean;
      sortOrder: number;
      supportsVision: boolean;
    }>,
  ) {
    return this.models.updateModel(user.tenantId, id, body);
  }

  @Delete('admin/models/:id')
  @UseGuards(AdminGuard)
  removeModel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.models.deleteModel(user.tenantId, id);
  }
}
