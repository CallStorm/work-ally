import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
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

  @Post('test')
  @UseGuards(AdminGuard)
  async test(@CurrentUser() user: AuthUser) {
    const runtime = process.env.RUNTIME_PROVIDER ?? 'pi';
    const provider = await this.prisma.llmProvider.findFirst({
      where: { tenantId: user.tenantId, enabled: true },
    });
    const modelReady = !!provider;
    const piEnabled = runtime === 'pi';

    let message = 'Pi Agent 已就绪，可正常使用。';
    if (!piEnabled) {
      message = `当前 Runtime 为 ${runtime}，Pi 未启用。`;
    } else if (!modelReady) {
      message = 'Pi Runtime 已启用，但尚未配置模型供应商 API Key。';
    }

    return {
      ok: piEnabled && modelReady,
      runtime,
      modelReady,
      message,
    };
  }

  @Put()
  @UseGuards(AdminGuard)
  upsert(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      personaMd?: string;
      suggestedPrompts?: string[];
    },
  ) {
    return this.prisma.defaultAgent.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        personaMd: body.personaMd,
        suggestedPrompts: body.suggestedPrompts ?? [],
        skillIds: [],
        connectorIds: [],
        knowledgeIds: [],
      },
      update: {
        personaMd: body.personaMd,
        suggestedPrompts: body.suggestedPrompts,
        skillIds: [],
        connectorIds: [],
        knowledgeIds: [],
      },
    });
  }
}
