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
import {
  CreateImageStudioProjectSchema,
  UpdateImageStudioProjectSchema,
} from '@work-ally/shared';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { parseBody } from '../../../common/zod';
import { ImageStudioAppGuard } from '../image-studio-app.guard';
import { ImageStudioProjectsService } from './image-studio-projects.service';

@Controller('apps/image-studio')
@UseGuards(JwtAuthGuard, ImageStudioAppGuard)
export class ImageStudioController {
  constructor(private readonly projects: ImageStudioProjectsService) {}

  @Get('projects')
  listProjects(@CurrentUser() user: AuthUser) {
    return this.projects.list(user);
  }

  @Post('projects')
  createProject(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.projects.create(
      user,
      parseBody(CreateImageStudioProjectSchema, body),
    );
  }

  @Get('projects/:id')
  getProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.get(user, id);
  }

  @Patch('projects/:id')
  updateProject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.projects.update(
      user,
      id,
      parseBody(UpdateImageStudioProjectSchema, body),
    );
  }

  @Delete('projects/:id')
  deleteProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.softDelete(user, id);
  }

  @Get('models')
  listModels(@CurrentUser() user: AuthUser) {
    return this.projects.listPublicModels(user.tenantId);
  }
}
