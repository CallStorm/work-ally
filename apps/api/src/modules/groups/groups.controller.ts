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

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.group.findMany({
      where: { tenantId: user.tenantId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; description?: string },
  ) {
    return this.prisma.group.create({
      data: {
        tenantId: user.tenantId,
        name: body.name,
        description: body.description,
      },
    });
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; description: string }>,
  ) {
    const existing = await this.prisma.group.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.group.update({ where: { id }, data: body });
  }

  @Post(':id/members')
  @UseGuards(AdminGuard)
  async addMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!group) throw new NotFoundException();
    await this.prisma.groupMember.createMany({
      data: body.userIds.map((userId) => ({ groupId: id, userId })),
      skipDuplicates: true,
    });
    return { ok: true };
  }

  @Delete(':id/members/:uid')
  @UseGuards(AdminGuard)
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('uid') uid: string,
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!group) throw new NotFoundException();
    await this.prisma.groupMember.deleteMany({
      where: { groupId: id, userId: uid },
    });
    return { ok: true };
  }
}
