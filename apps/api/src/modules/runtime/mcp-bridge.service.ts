import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Type, type TSchema } from 'typebox';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret } from '../../common/crypto';

export type McpConnectorRef = {
  id: string;
  name: string;
  transport: string;
  endpointUrl: string;
};

export type McpToolDefinition = {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<{ content: Array<{ type: 'text'; text: string }>; details?: undefined }>;
};

export type McpMountResult = {
  customTools: McpToolDefinition[];
  manifest: string;
  connectorCount: number;
  toolCount: number;
  errors: string[];
  cleanup: () => Promise<void>;
};

type McpSession = {
  client: import('@modelcontextprotocol/sdk/client/index.js').Client;
  transport: { close: () => Promise<void> };
};

export type McpToolInfo = {
  name: string;
  description: string;
  runtimeName: string;
};

export type McpToolsResult = {
  ok: boolean;
  message: string;
  tools: McpToolInfo[];
  toolCount: number;
  instructions?: string;
  serverName?: string;
  serverVersion?: string;
};

type McpServerMeta = {
  instructions: string;
  serverName: string;
  serverVersion: string;
};

type McpInspectResult =
  | {
      ok: true;
      tools: McpToolInfo[];
      serverMeta: McpServerMeta;
    }
  | {
      ok: false;
      message: string;
    };

@Injectable()
export class McpBridgeService {
  private readonly logger = new Logger(McpBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listConnectorTools(
    tenantId: string,
    connectorId: string,
  ): Promise<McpToolsResult> {
    const row = await this.prisma.connector.findFirst({
      where: { id: connectorId, tenantId },
    });
    if (!row) {
      return {
        ok: false,
        message: '连接器不存在',
        tools: [],
        toolCount: 0,
      };
    }
    const credentials = this.decryptCredentials(row.credentialsEnc);
    const inspected = await this.inspectConnector(row, credentials);
    if (!inspected.ok) {
      return {
        ok: false,
        message: inspected.message,
        tools: [],
        toolCount: 0,
      };
    }

    await this.syncConnectorMetadata(row.id, inspected.serverMeta);

    return {
      ok: true,
      message: `已连接，共 ${inspected.tools.length} 个工具`,
      tools: inspected.tools,
      toolCount: inspected.tools.length,
      instructions: inspected.serverMeta.instructions,
      serverName: inspected.serverMeta.serverName,
      serverVersion: inspected.serverMeta.serverVersion,
    };
  }

  async testConnector(tenantId: string, connectorId: string) {
    const result = await this.listConnectorTools(tenantId, connectorId);
    if (!result.ok) return result;
    return {
      ok: true,
      message: result.message,
      toolCount: result.toolCount,
      tools: result.tools,
      instructions: result.instructions,
      serverName: result.serverName,
      serverVersion: result.serverVersion,
    };
  }

  private async inspectConnector(
    row: {
      id: string;
      name: string;
      transport: string;
      endpointUrl: string;
      authType: string;
    },
    credentials: string | null,
  ): Promise<McpInspectResult> {
    try {
      const session = await this.connectOne({
        name: row.name,
        transport: row.transport,
        endpointUrl: row.endpointUrl,
        authType: row.authType,
        credentials,
      });
      const serverMeta = this.readServerMeta(session);
      const listed = await session.client.listTools();
      await this.closeSession(session);
      const tools = (listed.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description?.trim() || '',
        runtimeName: buildMcpToolName(row.name, tool.name),
      }));
      return { ok: true, tools, serverMeta };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `连接失败: ${message}` };
    }
  }

  private readServerMeta(session: McpSession): McpServerMeta {
    const version = session.client.getServerVersion();
    return {
      instructions: session.client.getInstructions()?.trim() ?? '',
      serverName: version?.name?.trim() ?? '',
      serverVersion: version?.version?.trim() ?? '',
    };
  }

  private async syncConnectorMetadata(
    connectorId: string,
    meta: McpServerMeta,
  ) {
    await this.prisma.connector.update({
      where: { id: connectorId },
      data: {
        mcpInstructions: meta.instructions || null,
        mcpServerName: meta.serverName || null,
        mcpServerVersion: meta.serverVersion || null,
        mcpSyncedAt: new Date(),
      },
    });
  }

  async mountForRun(input: {
    tenantId: string;
    connectors: McpConnectorRef[];
    onToolEvent?: (event: {
      phase: 'call' | 'result';
      toolName: string;
      payload: unknown;
    }) => void;
  }): Promise<McpMountResult> {
    if (input.connectors.length === 0) {
      return {
        customTools: [],
        manifest: '',
        connectorCount: 0,
        toolCount: 0,
        errors: [],
        cleanup: async () => {},
      };
    }

    const rows = await this.prisma.connector.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'active',
        id: { in: input.connectors.map((c) => c.id) },
      },
    });

    const sessions: McpSession[] = [];
    const customTools: McpToolDefinition[] = [];
    const manifestLines: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      const credentials = this.decryptCredentials(row.credentialsEnc);
      try {
        const session = await this.connectOne({
          name: row.name,
          transport: row.transport,
          endpointUrl: row.endpointUrl,
          authType: row.authType,
          credentials,
        });
        sessions.push(session);

        const serverMeta = this.readServerMeta(session);
        const listed = await session.client.listTools();
        const remoteTools = listed.tools ?? [];
        manifestLines.push(
          `- **${row.name}** (${row.transport}) · ${remoteTools.length} tools`,
        );
        if (serverMeta.serverName || serverMeta.serverVersion) {
          manifestLines.push(
            `  - server: ${serverMeta.serverName || row.name}${serverMeta.serverVersion ? ` v${serverMeta.serverVersion}` : ''}`,
          );
        }
        if (serverMeta.instructions) {
          manifestLines.push(`  - instructions: ${serverMeta.instructions}`);
        }

        for (const remote of remoteTools) {
          const toolName = buildMcpToolName(row.name, remote.name);
          manifestLines.push(
            `  - \`${toolName}\`: ${remote.description?.trim() || remote.name}`,
          );

          customTools.push({
            name: toolName,
            label: toolName,
            description:
              `[MCP · ${row.name}] ${remote.description?.trim() || remote.name}`.slice(
                0,
                4000,
              ),
            parameters: jsonSchemaToTypebox(remote.inputSchema),
            execute: async (_toolCallId, params, signal) => {
              input.onToolEvent?.({
                phase: 'call',
                toolName,
                payload: { connector: row.name, args: params },
              });
              if (signal.aborted) {
                throw new Error('MCP tool call aborted');
              }
              const result = await session.client.callTool({
                name: remote.name,
                arguments: params,
              });
              const text = formatMcpToolResult(result);
              input.onToolEvent?.({
                phase: 'result',
                toolName,
                payload: { connector: row.name, text: text.slice(0, 2000) },
              });
              return {
                content: [{ type: 'text', text }],
                details: undefined,
              };
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${row.name}: ${message}`);
        this.logger.warn(`MCP mount failed for ${row.name}: ${message}`);
      }
    }

    const manifest =
      manifestLines.length > 0
        ? [
            '## MCP tools (remote — call these directly; do NOT claim lack of access)',
            ...manifestLines,
          ].join('\n')
        : errors.length > 0
          ? `## MCP connectors\nMount errors:\n${errors.map((e) => `- ${e}`).join('\n')}`
          : '';

    return {
      customTools,
      manifest,
      connectorCount: rows.length,
      toolCount: customTools.length,
      errors,
      cleanup: async () => {
        await Promise.all(sessions.map((s) => this.closeSession(s)));
      },
    };
  }

  private decryptCredentials(credentialsEnc: string | null): string | null {
    if (!credentialsEnc) return null;
    const key = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY');
    if (!key) return null;
    try {
      return decryptSecret(credentialsEnc, key);
    } catch {
      return null;
    }
  }

  private async connectOne(input: {
    name: string;
    transport: string;
    endpointUrl: string;
    authType: string;
    credentials: string | null;
  }): Promise<McpSession> {
    const sdk = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    );
    const { SSEClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/sse.js'
    );

    const client = new sdk.Client({
      name: 'workally',
      version: '1.0.0',
    });
    client.onerror = (error) => {
      this.logger.warn(`MCP client error (${input.name}): ${String(error)}`);
    };

    const url = new URL(input.endpointUrl);
    const requestInit = buildRequestInit(input.authType, input.credentials);

    if (input.transport === 'sse') {
      const transport = new SSEClientTransport(url, { requestInit });
      await client.connect(transport);
      return { client, transport };
    }

    try {
      const transport = new StreamableHTTPClientTransport(url, { requestInit });
      await client.connect(transport);
      return { client, transport };
    } catch (err) {
      const transport = new SSEClientTransport(url, { requestInit });
      await client.connect(transport);
      this.logger.warn(
        `MCP ${input.name}: streamable_http failed, fell back to SSE (${String(err)})`,
      );
      return { client, transport };
    }
  }

  private async closeSession(session: McpSession) {
    try {
      await session.client.close();
    } catch {
      // ignore
    }
    try {
      await session.transport.close();
    } catch {
      // ignore
    }
  }
}

function buildRequestInit(
  authType: string,
  credentials: string | null,
): RequestInit | undefined {
  if (!credentials?.trim()) return undefined;
  const trimmed = credentials.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') headers[k] = v;
      }
      if (Object.keys(headers).length > 0) {
        return { headers };
      }
    }
  } catch {
    // plain text credential
  }
  if (authType === 'api_key' || authType === 'x-api-key') {
    return { headers: { 'X-API-Key': trimmed } };
  }
  if (authType === 'token' || trimmed.startsWith('Bearer ')) {
    return {
      headers: {
        Authorization: trimmed.startsWith('Bearer ')
          ? trimmed
          : `Bearer ${trimmed}`,
      },
    };
  }
  return { headers: { Authorization: `Bearer ${trimmed}` } };
}

function buildMcpToolName(connectorName: string, remoteToolName: string) {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'mcp';
  return `mcp_${slug(connectorName)}__${slug(remoteToolName)}`.slice(0, 64);
}

function jsonSchemaToTypebox(schema: unknown): TSchema {
  if (!schema || typeof schema !== 'object') {
    return Type.Record(Type.String(), Type.Unknown());
  }
  const s = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  if (s.type === 'object' && s.properties) {
    const props: Record<string, TSchema> = {};
    for (const [key, val] of Object.entries(s.properties)) {
      props[key] = jsonSchemaPropToTypebox(val);
    }
    return Type.Object(props, {
      additionalProperties: true,
      ...(Array.isArray(s.required) && s.required.length
        ? { required: s.required.filter((k) => k in props) }
        : {}),
    });
  }
  return Type.Record(Type.String(), Type.Unknown());
}

function jsonSchemaPropToTypebox(schema: unknown): TSchema {
  if (!schema || typeof schema !== 'object') return Type.Unknown();
  const s = schema as { type?: string | string[] };
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type) {
    case 'string':
      return Type.String();
    case 'number':
    case 'integer':
      return Type.Number();
    case 'boolean':
      return Type.Boolean();
    case 'array':
      return Type.Array(Type.Unknown());
    case 'object':
      return Type.Record(Type.String(), Type.Unknown());
    default:
      return Type.Unknown();
  }
}

function formatMcpToolResult(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return stringifyUnknown(result);
  }
  const r = result as {
    content?: unknown;
    structuredContent?: unknown;
    isError?: boolean;
  };
  if (r.isError) {
    return `MCP error:\n${stringifyUnknown(r.content ?? r.structuredContent)}`;
  }
  if (Array.isArray(r.content)) {
    const parts = r.content
      .map((part) => {
        if (!part || typeof part !== 'object') return String(part);
        const p = part as { type?: string; text?: string };
        if (p.type === 'text') return p.text ?? '';
        return JSON.stringify(part);
      })
      .filter(Boolean);
    if (parts.length) return parts.join('\n');
  }
  if (r.structuredContent !== undefined) {
    return stringifyUnknown(r.structuredContent);
  }
  return stringifyUnknown(r.content ?? { ok: true });
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
