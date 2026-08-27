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
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../acl/acl.service';
import { encryptSecret } from '../../common/crypto';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.prisma.knowledgeBinding.findMany({
      where: { tenantId: user.tenantId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    const usable = await this.acl.filterUsable(user, 'knowledge', items);
    return usable.map(sanitizeKnowledge);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.knowledgeBinding.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item || !(await this.acl.canUse(user, 'knowledge', item))) {
      throw new NotFoundException();
    }
    return sanitizeKnowledge(item);
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name: string;
      displayName: string;
      description?: string;
      provider: 'dify' | 'ragflow';
      baseUrl: string;
      credentials?: string;
      externalDatasetIds?: string[];
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    const secret = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY')!;
    const item = await this.prisma.knowledgeBinding.create({
      data: {
        tenantId: user.tenantId,
        ownerUserId: user.userId,
        name: body.name,
        displayName: body.displayName,
        description: body.description,
        provider: body.provider,
        baseUrl: body.baseUrl,
        credentialsEnc: body.credentials
          ? encryptSecret(body.credentials, secret)
          : null,
        externalDatasetIds: body.externalDatasetIds ?? [],
        visibility: body.visibility ?? 'private',
      },
    });
    return sanitizeKnowledge(item);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      displayName: string;
      description: string;
      provider: 'dify' | 'ragflow';
      baseUrl: string;
      credentials: string;
      externalDatasetIds: string[];
      status: string;
      visibility: 'private' | 'restricted' | 'tenant';
    }>,
  ) {
    const existing = await this.prisma.knowledgeBinding.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    const secret = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY')!;
    const { credentials, ...rest } = body;
    const item = await this.prisma.knowledgeBinding.update({
      where: { id },
      data: {
        ...rest,
        ...(credentials !== undefined
          ? {
              credentialsEnc: credentials
                ? encryptSecret(credentials, secret)
                : null,
            }
          : {}),
      },
    });
    return sanitizeKnowledge(item);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.knowledgeBinding.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.knowledgeBinding.update({
      where: { id },
      data: { status: 'disabled' },
    });
    return { ok: true };
  }
}

function sanitizeKnowledge(item: {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  provider: string;
  baseUrl: string;
  externalDatasetIds: unknown;
  visibility: string;
  status: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
  credentialsEnc: string | null;
}) {
  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    description: item.description,
    provider: item.provider,
    baseUrl: item.baseUrl,
    externalDatasetIds: item.externalDatasetIds,
    visibility: item.visibility,
    status: item.status,
    ownerUserId: item.ownerUserId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    hasCredentials: Boolean(item.credentialsEnc),
  };
}
