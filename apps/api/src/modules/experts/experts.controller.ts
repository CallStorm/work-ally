import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../acl/acl.service';

@Controller('experts')
@UseGuards(JwtAuthGuard)
export class ExpertsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('sort') sort?: string,
  ) {
    const items = await this.prisma.expert.findMany({
      where: { tenantId: user.tenantId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    let usable = await this.acl.filterUsable(user, 'experts', items);
    if (sort === 'recent_used') {
      const usages = await this.prisma.expertUsage.findMany({
        where: { userId: user.userId },
        orderBy: { usedAt: 'desc' },
        take: 100,
      });
      const order = new Map(usages.map((u, i) => [u.expertId, i]));
      usable = [...usable].sort(
        (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999),
      );
    }
    return usable;
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.expert.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item || !(await this.acl.canUse(user, 'experts', item))) {
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
      description?: string;
      avatarUrl?: string;
      personaMd: string;
      suggestedPrompts?: string[];
      skillIds?: string[];
      connectorIds?: string[];
      knowledgeIds?: string[];
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    return this.prisma.expert.create({
      data: {
        tenantId: user.tenantId,
        ownerUserId: user.userId,
        name: body.name,
        description: body.description,
        avatarUrl: body.avatarUrl,
        personaMd: body.personaMd,
        suggestedPrompts: body.suggestedPrompts ?? [],
        skillIds: body.skillIds ?? [],
        connectorIds: body.connectorIds ?? [],
        knowledgeIds: body.knowledgeIds ?? [],
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
      description: string;
      avatarUrl: string;
      personaMd: string;
      suggestedPrompts: string[];
      skillIds: string[];
      connectorIds: string[];
      knowledgeIds: string[];
      status: string;
      visibility: 'private' | 'restricted' | 'tenant';
    }>,
  ) {
    const existing = await this.prisma.expert.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.expert.update({ where: { id }, data: body });
  }

  @Post(':id/touch')
  async touch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.expert.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item || !(await this.acl.canUse(user, 'experts', item))) {
      throw new NotFoundException();
    }
    await this.prisma.expertUsage.create({
      data: { expertId: id, userId: user.userId },
    });
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.expert.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.expert.update({
      where: { id },
      data: { status: 'disabled' },
    });
    return { ok: true };
  }
}
