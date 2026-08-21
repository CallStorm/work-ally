import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('default-agent')
@UseGuards(JwtAuthGuard)
export class DefaultAgentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const item = await this.prisma.defaultAgent.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (!item) throw new NotFoundException('Default agent not configured');
    return item;
  }

  @Put()
  @UseGuards(AdminGuard)
  upsert(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      personaMd?: string;
      suggestedPrompts?: string[];
      skillIds?: string[];
      connectorIds?: string[];
      knowledgeIds?: string[];
    },
  ) {
    return this.prisma.defaultAgent.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        personaMd: body.personaMd,
        suggestedPrompts: body.suggestedPrompts ?? [],
        skillIds: body.skillIds ?? [],
        connectorIds: body.connectorIds ?? [],
        knowledgeIds: body.knowledgeIds ?? [],
      },
      update: {
        personaMd: body.personaMd,
        suggestedPrompts: body.suggestedPrompts,
        skillIds: body.skillIds,
        connectorIds: body.connectorIds,
        knowledgeIds: body.knowledgeIds,
      },
    });
  }
}
