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
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AclService } from '../acl/acl.service';
import { encryptSecret } from '../../common/crypto';
import { McpBridgeService } from '../runtime/mcp-bridge.service';
import { connectorDisplayDescription } from './connector-display';

@Controller('connectors')
@UseGuards(JwtAuthGuard)
export class ConnectorsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
    private readonly config: ConfigService,
    private readonly mcp: McpBridgeService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('all') all?: string,
  ) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    const items = await this.prisma.connector.findMany({
      where: {
        tenantId: user.tenantId,
        ...(all === '1' && isAdmin ? {} : { status: 'active' }),
      },
      orderBy: { updatedAt: 'desc' },
    });
    const usable = await this.acl.filterUsable(user, 'connectors', items);
    return usable.map(sanitizeConnector);
  }

  @Get(':id/tools')
  @UseGuards(AdminGuard)
  async listTools(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    return this.mcp.listConnectorTools(user.tenantId, id);
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
      enabled: boolean;
      status: string;
      visibility: 'private' | 'restricted' | 'tenant';
    }>,
  ) {
    const existing = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    const secret = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY')!;
    const status =
      typeof body.enabled === 'boolean'
        ? body.enabled
          ? 'active'
          : 'disabled'
        : body.status;
    const item = await this.prisma.connector.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        transport: body.transport,
        endpointUrl: body.endpointUrl,
        authType: body.authType,
        status,
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
    const existing = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    const result = await this.mcp.testConnector(user.tenantId, id);
    await this.prisma.connector.update({
      where: { id },
      data: { healthStatus: result.ok ? 'ok' : 'error' },
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const existing = await this.prisma.connector.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException();
    await this.prisma.connector.delete({ where: { id } });
    return { ok: true };
  }
}

function sanitizeConnector(item: {
  id: string;
  name: string;
  description: string | null;
  mcpInstructions: string | null;
  mcpServerName: string | null;
  mcpServerVersion: string | null;
  mcpSyncedAt: Date | null;
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
    mcpInstructions: item.mcpInstructions,
    mcpServerName: item.mcpServerName,
    mcpServerVersion: item.mcpServerVersion,
    mcpSyncedAt: item.mcpSyncedAt,
    displayDescription: connectorDisplayDescription(item),
    descriptionSource: item.description?.trim()
      ? 'manual'
      : item.mcpInstructions?.trim()
        ? 'mcp'
        : 'none',
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
