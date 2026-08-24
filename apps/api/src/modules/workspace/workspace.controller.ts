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
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!filePath) {
      throw new NotFoundException('path query required');
    }
    const file = await this.workspace.readFile(user, sessionId, filePath);
    if (file.isBinary) {
      res.setHeader('Content-Type', file.mimeType ?? 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.filename)}"`,
      );
      return { ...file, content: undefined, downloadOnly: true };
    }
    return file;
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
}
