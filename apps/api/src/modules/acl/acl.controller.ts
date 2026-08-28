import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UpdateAclSchema } from '@work-ally/shared';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { parseBody } from '../../common/zod';
import { AclService, type AssetKind } from './acl.service';
import { PrismaService } from '../../prisma/prisma.service';

const TENANT_ONLY_ASSETS: AssetKind[] = ['connectors', 'skills'];

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class AclController {
  constructor(
    private readonly acl: AclService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':type/:id/acl')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('type') type: AssetKind,
    @Param('id') id: string,
  ) {
    await this.assertExists(user, type, id);
    const visibility = await this.getVisibility(user, type, id);
    const entries = await this.acl.getAcl(user, type, id);
    return { visibility, entries };
  }

  @Put(':type/:id/acl')
  @UseGuards(AdminGuard)
  async put(
    @CurrentUser() user: AuthUser,
    @Param('type') type: AssetKind,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    await this.assertExists(user, type, id);
    const input = parseBody(UpdateAclSchema, body);
    if (TENANT_ONLY_ASSETS.includes(type) && input.visibility !== 'tenant') {
      throw new BadRequestException('MCP 与技能仅支持全公司可见');
    }
    if (type === 'experts' && input.visibility === 'restricted') {
      const groupEntries = input.entries.filter(
        (e) => e.principalType === 'group',
      );
      if (groupEntries.length === 0) {
        throw new BadRequestException('按组分享至少选择一个组');
      }
    }
    await this.setVisibility(type, id, input.visibility);
    const entries = await this.acl.setAcl(user, type, id, {
      visibility: input.visibility,
      entries: input.entries.map((e) => ({
        principalType: e.principalType,
        principalId: e.principalId,
      })),
    });
    return { visibility: input.visibility, entries };
  }

  private async assertExists(user: AuthUser, type: AssetKind, id: string) {
    const found = await this.getRaw(user.tenantId, type, id);
    if (!found) throw new NotFoundException('Resource not found');
  }

  private async getVisibility(user: AuthUser, type: AssetKind, id: string) {
    const found = await this.getRaw(user.tenantId, type, id);
    return found!.visibility;
  }

  private async setVisibility(
    type: AssetKind,
    id: string,
    visibility: 'private' | 'restricted' | 'tenant',
  ) {
    const data = { visibility };
    switch (type) {
      case 'connectors':
        await this.prisma.connector.update({ where: { id }, data });
        break;
      case 'skills':
        await this.prisma.skill.update({ where: { id }, data });
        break;
      case 'experts':
        await this.prisma.expert.update({ where: { id }, data });
        break;
      case 'knowledge':
        await this.prisma.knowledgeBinding.update({ where: { id }, data });
        break;
      case 'apps':
        await this.prisma.appRegistry.update({ where: { id }, data });
        break;
    }
  }

  private getRaw(tenantId: string, type: AssetKind, id: string) {
    switch (type) {
      case 'connectors':
        return this.prisma.connector.findFirst({ where: { id, tenantId } });
      case 'skills':
        return this.prisma.skill.findFirst({ where: { id, tenantId } });
      case 'experts':
        return this.prisma.expert.findFirst({ where: { id, tenantId } });
      case 'knowledge':
        return this.prisma.knowledgeBinding.findFirst({
          where: { id, tenantId },
        });
      case 'apps':
        return this.prisma.appRegistry.findFirst({ where: { id, tenantId } });
    }
  }
}
