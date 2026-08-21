import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../acl/acl.service';

@Controller('skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.prisma.skill.findMany({
      where: { tenantId: user.tenantId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    return this.acl.filterUsable(user, 'skills', items);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item || !(await this.acl.canUse(user, 'skills', item))) {
      throw new NotFoundException();
    }
    return item;
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name: string;
      slug: string;
      description?: string;
      descriptionShort: string;
      bodyMd: string;
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    return this.prisma.skill.create({
      data: {
        tenantId: user.tenantId,
        ownerUserId: user.userId,
        name: body.name,
        slug: body.slug,
        description: body.description,
        descriptionShort: body.descriptionShort,
        bodyMd: body.bodyMd,
        visibility: body.visibility ?? 'private',
      },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      slug: string;
      description: string;
      descriptionShort: string;
      bodyMd: string;
      status: string;
      visibility: 'private' | 'restricted' | 'tenant';
    }>,
  ) {
    const existing = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.skill.update({ where: { id }, data: body });
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.skill.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.skill.update({
      where: { id },
      data: { status: 'disabled' },
    });
    return { ok: true };
  }
}
