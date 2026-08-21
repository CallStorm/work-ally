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

@Controller()
@UseGuards(JwtAuthGuard)
export class ModelsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('models')
  listEnabled(@CurrentUser() user: AuthUser) {
    return this.prisma.modelConfig.findMany({
      where: { tenantId: user.tenantId, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get('admin/models')
  @UseGuards(AdminGuard)
  listAll(@CurrentUser() user: AuthUser) {
    return this.prisma.modelConfig.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Post('admin/models')
  @UseGuards(AdminGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      modelId: string;
      displayName: string;
      isAutoCandidate?: boolean;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.modelConfig.create({
      data: {
        tenantId: user.tenantId,
        modelId: body.modelId,
        displayName: body.displayName,
        isAutoCandidate: body.isAutoCandidate ?? true,
        enabled: body.enabled ?? true,
        sortOrder: body.sortOrder ?? 0,
      },
    });
  }

  @Patch('admin/models/:id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      modelId: string;
      displayName: string;
      isAutoCandidate: boolean;
      enabled: boolean;
      sortOrder: number;
    }>,
  ) {
    const existing = await this.prisma.modelConfig.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    return this.prisma.modelConfig.update({ where: { id }, data: body });
  }

  @Delete('admin/models/:id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.modelConfig.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.modelConfig.delete({ where: { id } });
    return { ok: true };
  }
}
