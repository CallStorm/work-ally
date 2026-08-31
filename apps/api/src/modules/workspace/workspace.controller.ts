import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { ArtifactService } from './artifact.service';
import { WorkspaceService } from './workspace.service';

@Controller('sessions/:sessionId')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly artifacts: ArtifactService,
  ) {}

  @Get('workspace/tree')
  listTree(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.workspace.listTree(user, sessionId);
  }

  @Get('workspace/files')
  async readFile(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Query('path') filePath: string,
  ) {
    if (!filePath) {
      throw new NotFoundException('path query required');
    }
    return this.workspace.readFile(user, sessionId, filePath);
  }

  @Get('workspace/download')
  async downloadWorkspaceFile(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Query('path') filePath: string,
    @Res() res: Response,
  ) {
    if (!filePath) {
      throw new NotFoundException('path query required');
    }
    const file = await this.workspace.resolveFile(user, sessionId, filePath);
    this.sendFileDownload(res, file.abs, file.filename, file.mimeType);
  }

  @Get('artifacts')
  listArtifacts(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.artifacts.list(user, sessionId);
  }

  @Get('artifacts/:artifactId/content')
  async readArtifact(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('artifactId') artifactId: string,
  ) {
    const file = await this.artifacts.readContent(user, sessionId, artifactId);
    if (!file) throw new NotFoundException('Artifact not found');
    return file;
  }

  @Get('artifacts/:artifactId/download')
  async downloadArtifact(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Param('artifactId') artifactId: string,
    @Res() res: Response,
  ) {
    const meta = await this.artifacts.resolveForDownload(
      user,
      sessionId,
      artifactId,
    );
    if (!meta) throw new NotFoundException('Artifact not found');
    this.sendFileDownload(res, meta.abs, meta.filename, meta.mimeType);
  }

  private sendFileDownload(
    res: Response,
    abs: string,
    filename: string,
    mimeType: string | null,
  ) {
    res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    fs.createReadStream(abs).pipe(res);
  }
}
