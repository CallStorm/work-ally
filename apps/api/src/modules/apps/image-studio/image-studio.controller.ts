import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  CreateImageStudioProjectSchema,
  GenerateImageStudioSchema,
  UpdateImageStudioProjectSchema,
} from '@work-ally/shared';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { parseBody } from '../../../common/zod';
import { ImageStudioAppGuard } from '../image-studio-app.guard';
import { ImageStudioAssetsService } from './image-studio-assets.service';
import { ImageStudioGenerateService } from './image-studio-generate.service';
import { ImageStudioProjectsService } from './image-studio-projects.service';

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Controller('apps/image-studio')
@UseGuards(JwtAuthGuard, ImageStudioAppGuard)
export class ImageStudioController {
  constructor(
    private readonly projects: ImageStudioProjectsService,
    private readonly assets: ImageStudioAssetsService,
    private readonly generateService: ImageStudioGenerateService,
  ) {}

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

  @Post('projects/:id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: UPLOAD_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!UPLOAD_MIME.has(file.mimetype)) {
          cb(new BadRequestException('仅支持 png/jpeg/webp') as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.assets.upload(user, id, file);
  }

  @Post('projects/:id/assets/:assetId/select')
  selectAsset(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.assets.select(user, id, assetId);
  }

  @Post('projects/:id/generate')
  generate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.generateService.generate(
      user,
      id,
      parseBody(GenerateImageStudioSchema, body),
    );
  }

  @Get('projects/:id/turns')
  listTurns(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.generateService.listTurns(user, id);
  }

  @Get('turns/:id')
  getTurn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.generateService.getTurn(user, id);
  }

  /** Supports Authorization bearer or ?access_token= (JwtStrategy extractors). */
  @Get('assets/:id/content')
  async assetContent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.assets.getContent(user, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(file.buffer);
  }

  @Get('models')
  listModels(@CurrentUser() user: AuthUser) {
    return this.projects.listPublicModels(user.tenantId);
  }
}
