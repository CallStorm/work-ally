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

@Controller('connectors')
@UseGuards(JwtAuthGuard)
export class ConnectorsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.prisma.connector.findMany({
      where: { tenantId: user.tenantId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    const usable = await this.acl.filterUsable(user, 'connectors', items);
    return usable.map(sanitizeConnector);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item || !(await this.acl.canUse(user, 'connectors', item))) {
      throw new NotFoundException();
    }
    return sanitizeConnector(item);
  }

  @Post()
  @UseGuards(AdminGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name: string;
      description?: string;
      transport: 'sse' | 'streamable_http';
      endpointUrl: string;
      authType?: string;
      credentials?: string;
      visibility?: 'private' | 'restricted' | 'tenant';
    },
  ) {
    const secret = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY')!;
    const item = await this.prisma.connector.create({
      data: {
        tenantId: user.tenantId,
        name: body.name,
        description: body.description,
        transport: body.transport,
        endpointUrl: body.endpointUrl,
        authType: body.authType ?? 'none',
        credentialsEnc: body.credentials
          ? encryptSecret(body.credentials, secret)
          : null,
        ownerUserId: user.userId,
        visibility: body.visibility ?? 'private',
      },
    });
    return sanitizeConnector(item);
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
      transport: 'sse' | 'streamable_http';
      endpointUrl: string;
      authType: string;
      credentials: string;
      status: string;
      visibility: 'private' | 'restricted' | 'tenant';
    }>,
  ) {
    const existing = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    const secret = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY')!;
    const item = await this.prisma.connector.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        transport: body.transport,
        endpointUrl: body.endpointUrl,
        authType: body.authType,
        status: body.status,
        visibility: body.visibility,
        ...(body.credentials !== undefined
          ? {
              credentialsEnc: body.credentials
                ? encryptSecret(body.credentials, secret)
                : null,
            }
          : {}),
      },
    });
    return sanitizeConnector(item);
  }

  @Post(':id/test')
  @UseGuards(AdminGuard)
  async test(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const item = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!item) throw new NotFoundException();
    // Minimal health: endpoint non-empty
    const ok = Boolean(item.endpointUrl);
    const updated = await this.prisma.connector.update({
      where: { id },
      data: { healthStatus: ok ? 'ok' : 'error' },
    });
    return { ok, healthStatus: updated.healthStatus };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.connector.update({
      where: { id },
      data: { status: 'disabled' },
    });
    return { ok: true };
  }
}

function sanitizeConnector(item: {
  id: string;
  name: string;
  description: string | null;
  transport: string;
  endpointUrl: string;
  authType: string;
  visibility: string;
  status: string;
  healthStatus: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    transport: item.transport,
    endpointUrl: item.endpointUrl,
    authType: item.authType,
    visibility: item.visibility,
    status: item.status,
    healthStatus: item.healthStatus,
    ownerUserId: item.ownerUserId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
