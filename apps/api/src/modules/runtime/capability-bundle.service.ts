import { Injectable } from '@nestjs/common';
import type { MembershipRole } from '@work-ally/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/current-user.decorator';
import { AclService } from '../acl/acl.service';
import { ModelsService } from '../models/models.service';
import type { AgentBundle } from './mastra-runner.service';

export type SessionContextShape = {
  skillIds?: string[];
  connectorIds?: string[];
  knowledgeEnabled?: boolean;
  knowledgeIds?: string[];
  attachmentIds?: string[];
};

@Injectable()
export class CapabilityBundleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AclService,
    private readonly models: ModelsService,
  ) {}

  async resolveForSession(session: {
    id: string;
    tenantId: string;
    groupId: string;
    createdBy: string;
    expertId: string | null;
    modelId: string;
    modelConfigId?: string | null;
    context: unknown;
    expert: {
      name: string;
      personaMd: string;
      skillIds: unknown;
      connectorIds: unknown;
      knowledgeIds: unknown;
    } | null;
  }): Promise<AgentBundle> {
    const user = await this.resolveAuthUser(session.tenantId, session.createdBy);
    const [tenant, group] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: session.tenantId },
        select: { name: true },
      }),
      this.prisma.group.findFirst({
        where: { id: session.groupId, tenantId: session.tenantId },
        select: { name: true },
      }),
    ]);
    const ctx = normalizeContext(session.context);

    let mode: 'expert' | 'default' = 'default';
    let name = '默认助手';
    let persona =
      '你是 WorkAlly 默认办公助手，用中文给出清晰结论。';
    let skillIds: string[] = [];
    let connectorIds: string[] = [];
    let knowledgeIds: string[] = [];

    if (session.expertId && session.expert) {
      mode = 'expert';
      name = session.expert.name;
      persona = session.expert.personaMd;
      skillIds = asIds(session.expert.skillIds);
      connectorIds = asIds(session.expert.connectorIds);
      knowledgeIds = asIds(session.expert.knowledgeIds);
    } else {
      const defaultAgent = await this.prisma.defaultAgent.findUnique({
        where: { tenantId: session.tenantId },
      });
      if (defaultAgent?.personaMd) persona = defaultAgent.personaMd;
    }

    // SessionContext overlays (union), then can_use filter.
    skillIds = unique([...skillIds, ...(ctx.skillIds ?? [])]);
    connectorIds = unique([...connectorIds, ...(ctx.connectorIds ?? [])]);
    knowledgeIds = unique([...knowledgeIds, ...(ctx.knowledgeIds ?? [])]);
    if (ctx.knowledgeEnabled === false) {
      knowledgeIds = [];
    }

    const [skills, connectors, knowledge] = await Promise.all([
      this.loadSkills(user, skillIds),
      this.loadConnectors(user, connectorIds),
      this.loadKnowledge(user, knowledgeIds),
    ]);

    const skillCatalog = skills
      .map((s) => `- ${s.slug}: ${s.descriptionShort}`)
      .join('\n');

    const connectorSummary = connectors
      .map((c) => `- ${c.name} [${c.transport}] ${c.endpointUrl}`)
      .join('\n');
    const knowledgeSummary = knowledge
      .map((k) => `- ${k.displayName} (${k.provider}) ${k.baseUrl}`)
      .join('\n');

    const userContext = buildUserContextBlock({
      name: user.name,
      phone: user.phone,
      role: user.role,
      tenantName: tenant?.name ?? '',
      groupName: group?.name ?? '',
    });

    const instructions = [
      persona,
      userContext,
      skillCatalog
        ? `\n\n## Available skills (load on demand via skill tools / read SKILL.md)\n${skillCatalog}`
        : '',
      connectorSummary
        ? `\n\n## Configured MCP connectors\n${connectorSummary}\nAt runtime, remote MCP tools are mounted automatically (tool names prefixed with \`mcp_\`). Use those tools — do not claim missing access if connectors are listed.`
        : '',
      knowledgeSummary
        ? `\n\n## Available knowledge bindings\n${knowledgeSummary}`
        : '',
    ]
      .filter(Boolean)
      .join('');

    const creds = await this.models.resolveCredentials({
      tenantId: session.tenantId,
      modelConfigId: session.modelConfigId,
      modelId: session.modelId,
    });

    return {
      mode,
      name,
      instructions,
      modelId: creds?.modelId || session.modelId,
      llm: creds
        ? {
            apiKey: creds.apiKey,
            baseUrl: creds.baseUrl,
            piProviderId: creds.piProviderId,
            preset: creds.preset,
          }
        : undefined,
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        descriptionShort: s.descriptionShort,
      })),
      skillBodies: Object.fromEntries(skills.map((s) => [s.slug, s.bodyMd])),
      connectors: connectors.map((c) => ({
        id: c.id,
        name: c.name,
        transport: c.transport,
        endpointUrl: c.endpointUrl,
      })),
      knowledge: knowledge.map((k) => ({
        id: k.id,
        name: k.name,
        displayName: k.displayName,
        provider: k.provider,
        baseUrl: k.baseUrl,
      })),
    };
  }

  private async resolveAuthUser(
    tenantId: string,
    userId: string,
  ): Promise<AuthUser> {
    const membership = await this.prisma.membership.findFirst({
      where: { tenantId, userId, status: 'active' },
      include: { user: true },
    });
    if (!membership) {
      return {
        userId,
        tenantId,
        role: 'member',
        phone: '',
        name: '',
      };
    }
    return {
      userId,
      tenantId,
      role: membership.role as MembershipRole,
      phone: membership.user.phone,
      name: membership.user.name,
    };
  }

  private async loadSkills(user: AuthUser, ids: string[]) {
    if (ids.length === 0) return [];
    const items = await this.prisma.skill.findMany({
      where: { tenantId: user.tenantId, status: 'active', id: { in: ids } },
    });
    return this.acl.filterUsable(user, 'skills', items);
  }

  private async loadConnectors(user: AuthUser, ids: string[]) {
    if (ids.length === 0) return [];
    const items = await this.prisma.connector.findMany({
      where: { tenantId: user.tenantId, status: 'active', id: { in: ids } },
    });
    return this.acl.filterUsable(user, 'connectors', items);
  }

  private async loadKnowledge(user: AuthUser, ids: string[]) {
    if (ids.length === 0) return [];
    const items = await this.prisma.knowledgeBinding.findMany({
      where: { tenantId: user.tenantId, status: 'active', id: { in: ids } },
    });
    return this.acl.filterUsable(user, 'knowledge', items);
  }
}

function asIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function unique(ids: string[]) {
  return [...new Set(ids)];
}

function normalizeContext(raw: unknown): SessionContextShape {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    skillIds: asIds(obj.skillIds),
    connectorIds: asIds(obj.connectorIds),
    knowledgeIds: asIds(obj.knowledgeIds),
    knowledgeEnabled:
      typeof obj.knowledgeEnabled === 'boolean'
        ? obj.knowledgeEnabled
        : undefined,
    attachmentIds: asIds(obj.attachmentIds),
  };
}

function buildUserContextBlock(input: {
  name: string;
  phone: string;
  role: MembershipRole;
  tenantName: string;
  groupName: string;
}): string {
  const roleLabel = input.role === 'admin' ? '管理员' : '成员';
  const lines = [
    '## 当前用户（工作台会话）',
    '以下是正在与你对话的用户信息，请用于个性化称呼与办公场景理解：',
    `- 姓名：${input.name || '（未设置）'}`,
    `- 手机号：${input.phone || '（未设置）'}`,
    `- 角色：${roleLabel}`,
  ];
  if (input.tenantName) {
    lines.push(`- 公司/租户：${input.tenantName}`);
  }
  if (input.groupName) {
    lines.push(`- 当前工作组：${input.groupName}`);
  }
  lines.push(
    '',
    '注意：除非用户明确要求，不要将手机号等敏感信息复述给第三方或写入外部系统。',
  );
  return lines.join('\n');
}
