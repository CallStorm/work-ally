import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { SkillsService } from './skills.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.skills.list(user);
  }

  /** Must be registered before :id routes. */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { visibility?: 'private' | 'restricted' | 'tenant' },
  ) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    const visibility =
      body.visibility ?? (isAdmin ? 'tenant' : 'private');
    return this.skills.uploadZip(user, file, visibility);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.skills.get(user, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      enabled: boolean;
      visibility: 'private' | 'restricted' | 'tenant';
      status: string;
    }>,
  ) {
    const existing = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    if (!isAdmin && existing.ownerUserId !== user.userId) {
      throw new NotFoundException();
    }

    if (typeof body.enabled === 'boolean') {
      return this.skills.setEnabled(user, id, body.enabled);
    }

    return this.prisma.skill.update({
      where: { id },
      data: {
        ...(body.visibility ? { visibility: body.visibility } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.skills.remove(user, id);
  }
}
