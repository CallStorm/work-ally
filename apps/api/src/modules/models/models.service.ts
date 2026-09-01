import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../../common/crypto';

export type LlmPreset = 'minimax' | 'anthropic';

export const LLM_PRESETS: Record<
  LlmPreset,
  { name: string; baseUrl: string; fallbackModels: Array<{ modelId: string; displayName: string }> }
> = {
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    fallbackModels: [
      { modelId: 'MiniMax-M3', displayName: 'MiniMax M3' },
      { modelId: 'MiniMax-Text-01', displayName: 'MiniMax Text 01' },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    fallbackModels: [
      { modelId: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
      { modelId: 'claude-opus-4-20250514', displayName: 'Claude Opus 4' },
      { modelId: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
    ],
  },
};

export type ResolvedLlmCredentials = {
  modelConfigId: string;
  modelId: string;
  displayName: string;
  preset: LlmPreset;
  baseUrl: string;
  apiKey: string;
  piProviderId: string;
};

@Injectable()
export class ModelsService implements OnModuleInit {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.bootstrapFromEnv();
    } catch (err) {
      this.logger.warn(`LLM provider bootstrap skipped: ${String(err)}`);
    }
  }

  listPresets() {
    return (Object.keys(LLM_PRESETS) as LlmPreset[]).map((id) => ({
      id,
      ...LLM_PRESETS[id],
      fallbackModels: LLM_PRESETS[id].fallbackModels,
    }));
  }

  async listProviders(tenantId: string) {
    await this.dedupeProviders(tenantId);
    const rows = await this.prisma.llmProvider.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { models: true } } },
    });
    return rows.map((r) => this.serializeProvider(r));
  }

  async createProvider(
    tenantId: string,
    body: {
      preset: LlmPreset;
      name?: string;
      baseUrl?: string;
      apiKey: string;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    if (body.preset !== 'minimax' && body.preset !== 'anthropic') {
      throw new BadRequestException('preset must be minimax or anthropic');
    }
    if (!body.apiKey?.trim()) {
      throw new BadRequestException('apiKey is required');
    }
    const preset = LLM_PRESETS[body.preset];
    const encKey = this.encryptionKey();
    const baseUrl = (body.baseUrl?.trim() || preset.baseUrl).replace(/\/$/, '');
    const name = body.name?.trim() || preset.name;

    // One provider per preset per tenant — reuse instead of creating duplicates.
    const existing = await this.prisma.llmProvider.findFirst({
      where: { tenantId, preset: body.preset },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return this.serializeProvider(
        await this.prisma.llmProvider.update({
          where: { id: existing.id },
          data: {
            name,
            baseUrl,
            apiKeyEnc: encryptSecret(body.apiKey.trim(), encKey),
            enabled: body.enabled ?? existing.enabled,
          },
          include: { _count: { select: { models: true } } },
        }),
      );
    }

    const count = await this.prisma.llmProvider.count({ where: { tenantId } });
    return this.serializeProvider(
      await this.prisma.llmProvider.create({
        data: {
          tenantId,
          preset: body.preset,
          name,
          baseUrl,
          apiKeyEnc: encryptSecret(body.apiKey.trim(), encKey),
          enabled: body.enabled ?? true,
          sortOrder: body.sortOrder ?? count,
        },
        include: { _count: { select: { models: true } } },
      }),
    );
  }

  /** Preview models with unsaved credentials (dialog refresh). */
  async previewModels(body: {
    preset: LlmPreset;
    baseUrl?: string;
    apiKey: string;
    protocol?: string;
  }) {
    if (body.preset !== 'minimax' && body.preset !== 'anthropic') {
      throw new BadRequestException('preset must be minimax or anthropic');
    }
    if (body.protocol && body.protocol !== 'anthropic') {
      throw new BadRequestException('protocol currently only supports anthropic');
    }
    if (!body.apiKey?.trim()) {
      throw new BadRequestException('apiKey is required');
    }
    const preset = LLM_PRESETS[body.preset];
    const baseUrl = (body.baseUrl?.trim() || preset.baseUrl).replace(/\/$/, '');
    try {
      const models = await this.fetchRemoteModels(baseUrl, body.apiKey.trim());
      return { source: 'remote' as const, models, error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        source: 'fallback' as const,
        models: preset.fallbackModels,
        error: message,
      };
    }
  }

  /** Create provider and attach selected models in one step. */
  async createProviderWithModels(
    tenantId: string,
    body: {
      preset: LlmPreset;
      name?: string;
      baseUrl?: string;
      apiKey: string;
      protocol?: string;
      models: Array<{ modelId: string; displayName?: string }>;
    },
  ) {
    if (body.protocol && body.protocol !== 'anthropic') {
      throw new BadRequestException('protocol currently only supports anthropic');
    }
    if (!body.models?.length) {
      throw new BadRequestException('请至少选择一个模型');
    }
    const provider = await this.createProvider(tenantId, {
      preset: body.preset,
      name: body.name,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    const models = await this.addModels(tenantId, provider.id, body.models);
    return { provider, models };
  }

  async updateProvider(
    tenantId: string,
    id: string,
    body: Partial<{
      name: string;
      baseUrl: string;
      apiKey: string;
      enabled: boolean;
      sortOrder: number;
    }>,
  ) {
    const existing = await this.requireProvider(tenantId, id);
    const data: {
      name?: string;
      baseUrl?: string;
      apiKeyEnc?: string;
      enabled?: boolean;
      sortOrder?: number;
    } = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.baseUrl !== undefined) {
      data.baseUrl = body.baseUrl.trim().replace(/\/$/, '');
    }
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.apiKey !== undefined && body.apiKey.trim()) {
      data.apiKeyEnc = encryptSecret(body.apiKey.trim(), this.encryptionKey());
    }
    return this.serializeProvider(
      await this.prisma.llmProvider.update({
        where: { id: existing.id },
        data,
        include: { _count: { select: { models: true } } },
      }),
    );
  }

  async deleteProvider(tenantId: string, id: string) {
    await this.requireProvider(tenantId, id);
    await this.prisma.llmProvider.delete({ where: { id } });
    return { ok: true };
  }

  async syncModels(tenantId: string, providerId: string) {
    const provider = await this.requireProvider(tenantId, providerId);
    const apiKey = decryptSecret(provider.apiKeyEnc, this.encryptionKey());
    const preset = provider.preset as LlmPreset;
    const fallback = LLM_PRESETS[preset]?.fallbackModels ?? [];

    try {
      const remote = await this.fetchRemoteModels(provider.baseUrl, apiKey);
      return {
        source: 'remote' as const,
        models: remote,
        error: null as string | null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`sync-models fallback for ${providerId}: ${message}`);
      return {
        source: 'fallback' as const,
        models: fallback,
        error: message,
      };
    }
  }

  async addModels(
    tenantId: string,
    providerId: string,
    models: Array<{ modelId: string; displayName?: string }>,
  ) {
    await this.requireProvider(tenantId, providerId);
    if (!models?.length) throw new BadRequestException('models required');
    const existingCount = await this.prisma.modelConfig.count({
      where: { tenantId, providerId },
    });
    const results = [];
    for (let i = 0; i < models.length; i += 1) {
      const m = models[i];
      const modelId = m.modelId.trim();
      if (!modelId) continue;
      const displayName = (m.displayName?.trim() || modelId).slice(0, 120);
      const row = await this.prisma.modelConfig.upsert({
        where: {
          tenantId_providerId_modelId: {
            tenantId,
            providerId,
            modelId,
          },
        },
        create: {
          tenantId,
          providerId,
          modelId,
          displayName,
          enabled: true,
          sortOrder: existingCount + i,
          isAutoCandidate: false,
        },
        update: {
          displayName,
          enabled: true,
        },
      });
      results.push(row);
    }
    return results;
  }

  async listEnabledModels(tenantId: string) {
    await this.ensureLegacyCleanup(tenantId);
    return this.prisma.modelConfig.findMany({
      where: { tenantId, enabled: true, providerId: { not: null } },
      orderBy: { sortOrder: 'asc' },
      include: {
        provider: { select: { id: true, name: true, preset: true } },
      },
    });
  }

  async listAllModels(tenantId: string) {
    await this.ensureLegacyCleanup(tenantId);
    return this.prisma.modelConfig.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        provider: { select: { id: true, name: true, preset: true } },
      },
    });
  }

  async updateModel(
    tenantId: string,
    id: string,
    body: Partial<{
      displayName: string;
      enabled: boolean;
      sortOrder: number;
      supportsVision: boolean;
    }>,
  ) {
    const existing = await this.prisma.modelConfig.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Model not found');
    return this.prisma.modelConfig.update({
      where: { id },
      data: body,
      include: {
        provider: { select: { id: true, name: true, preset: true } },
      },
    });
  }

  async deleteModel(tenantId: string, id: string) {
    const existing = await this.prisma.modelConfig.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Model not found');
    await this.prisma.modelConfig.delete({ where: { id } });
    return { ok: true };
  }

  async resolveCredentials(input: {
    tenantId: string;
    modelConfigId?: string | null;
    modelId?: string | null;
  }): Promise<ResolvedLlmCredentials | null> {
    let config =
      input.modelConfigId
        ? await this.prisma.modelConfig.findFirst({
            where: {
              id: input.modelConfigId,
              tenantId: input.tenantId,
              enabled: true,
            },
            include: { provider: true },
          })
        : null;

    if (!config && input.modelId) {
      const matches = await this.prisma.modelConfig.findMany({
        where: {
          tenantId: input.tenantId,
          modelId: input.modelId,
          enabled: true,
          providerId: { not: null },
        },
        include: { provider: true },
        take: 2,
      });
      if (matches.length === 1) config = matches[0];
    }

    if (!config?.provider || !config.provider.enabled) {
      return this.envFallbackCredentials(input.modelId);
    }

    const preset = (config.provider.preset as LlmPreset) || 'anthropic';
    return {
      modelConfigId: config.id,
      modelId: config.modelId,
      displayName: config.displayName,
      preset,
      baseUrl: config.provider.baseUrl,
      apiKey: decryptSecret(config.provider.apiKeyEnc, this.encryptionKey()),
      piProviderId: preset === 'minimax' ? 'minimax' : 'anthropic',
    };
  }

  async resolveFirstAvailableCredentials(
    tenantId: string,
  ): Promise<ResolvedLlmCredentials | null> {
    const config = await this.prisma.modelConfig.findFirst({
      where: {
        tenantId,
        enabled: true,
        providerId: { not: null },
        provider: { enabled: true },
      },
      include: { provider: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (config?.provider) {
      const preset = (config.provider.preset as LlmPreset) || 'anthropic';
      return {
        modelConfigId: config.id,
        modelId: config.modelId,
        displayName: config.displayName,
        preset,
        baseUrl: config.provider.baseUrl,
        apiKey: decryptSecret(config.provider.apiKeyEnc, this.encryptionKey()),
        piProviderId: preset === 'minimax' ? 'minimax' : 'anthropic',
      };
    }
    return this.envFallbackCredentials(null);
  }

  async completeChat(input: {
    tenantId: string;
    system: string;
    user: string;
    maxTokens?: number;
  }): Promise<string> {
    const creds = await this.resolveFirstAvailableCredentials(input.tenantId);
    if (!creds) {
      throw new BadRequestException('请先配置模型 API Key');
    }
    const root = creds.baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
    const url = `${root}/v1/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': creds.apiKey,
        Authorization: `Bearer ${creds.apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: creds.modelId,
        max_tokens: input.maxTokens ?? 2048,
        system: input.system,
        messages: [{ role: 'user', content: input.user }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `模型调用失败 (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    if (!text) throw new BadRequestException('模型返回为空');
    return text;
  }

  async completeChatMessages(input: {
    tenantId: string;
    modelConfigId?: string | null;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
  }): Promise<string> {
    let creds = await this.resolveCredentials({
      tenantId: input.tenantId,
      modelConfigId: input.modelConfigId,
    });
    if (!creds) {
      creds = await this.resolveFirstAvailableCredentials(input.tenantId);
    }
    if (!creds) {
      throw new BadRequestException(
        '请先在管理端为笔记配置模型或添加可用模型',
      );
    }
    const root = creds.baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
    const url = `${root}/v1/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': creds.apiKey,
        Authorization: `Bearer ${creds.apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: creds.modelId,
        max_tokens: input.maxTokens ?? 2048,
        system: input.system,
        messages: input.messages,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `模型调用失败 (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    if (!text) throw new BadRequestException('模型返回为空');
    return text;
  }

  private envFallbackCredentials(
    modelId?: string | null,
  ): ResolvedLlmCredentials | null {
    const apiKey =
      this.config.get<string>('ANTHROPIC_API_KEY') ||
      this.config.get<string>('ANTHROPIC_AUTH_TOKEN');
    if (!apiKey) return null;
    const baseUrl = (
      this.config.get<string>('ANTHROPIC_BASE_URL') ||
      'https://api.anthropic.com'
    ).replace(/\/$/, '');
    const resolvedModel =
      !modelId || modelId === 'auto'
        ? (
            this.config.get<string>('MASTRA_MODEL') ||
            this.config.get<string>('ANTHROPIC_DEFAULT_FABLE_MODEL') ||
            'MiniMax-M3'
          )
            .split('/')
            .pop()!
        : modelId.includes('/')
          ? modelId.split('/').pop()!
          : modelId;
    const looksMinimax = /minimax/i.test(baseUrl) || /minimax/i.test(resolvedModel);
    const preset: LlmPreset = looksMinimax ? 'minimax' : 'anthropic';
    return {
      modelConfigId: '',
      modelId: resolvedModel,
      displayName: resolvedModel,
      preset,
      baseUrl,
      apiKey,
      piProviderId: preset === 'minimax' ? 'minimax' : 'anthropic',
    };
  }

  private async fetchRemoteModels(baseUrl: string, apiKey: string) {
    const root = baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
    const url = `${root}/v1/models`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string; display_name?: string; name?: string }>;
    };
    const list = (json.data ?? [])
      .map((m) => ({
        modelId: String(m.id ?? '').trim(),
        displayName: String(m.display_name || m.name || m.id || '').trim(),
      }))
      .filter((m) => m.modelId);
    if (!list.length) throw new Error('empty model list');
    return list;
  }

  private async requireProvider(tenantId: string, id: string) {
    const row = await this.prisma.llmProvider.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Provider not found');
    return row;
  }

  private serializeProvider(
    row: {
      id: string;
      tenantId: string;
      preset: string;
      name: string;
      baseUrl: string;
      enabled: boolean;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      _count?: { models: number };
    },
  ) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      preset: row.preset,
      name: row.name,
      baseUrl: row.baseUrl,
      enabled: row.enabled,
      sortOrder: row.sortOrder,
      apiKeySet: true,
      modelCount: row._count?.models ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private encryptionKey() {
    const key = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY');
    if (!key) throw new BadRequestException('CREDENTIALS_ENCRYPTION_KEY missing');
    return key;
  }

  private async ensureLegacyCleanup(tenantId: string) {
    await this.prisma.modelConfig.deleteMany({
      where: { tenantId, modelId: 'auto' },
    });
  }

  /** Merge duplicate providers of the same preset into the oldest one. */
  private async dedupeProviders(tenantId: string) {
    const rows = await this.prisma.llmProvider.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { models: true } } },
    });
    const byPreset = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byPreset.get(row.preset) ?? [];
      list.push(row);
      byPreset.set(row.preset, list);
    }
    for (const [, list] of byPreset) {
      if (list.length < 2) continue;
      // Prefer the provider that already has models; else keep oldest.
      const keeper =
        list.find((p) => p._count.models > 0) ?? list[0];
      for (const dup of list) {
        if (dup.id === keeper.id) continue;
        await this.prisma.modelConfig.updateMany({
          where: { tenantId, providerId: dup.id },
          data: { providerId: keeper.id },
        });
        await this.prisma.llmProvider.delete({ where: { id: dup.id } });
      }
    }
  }

  /** One-time-ish: if env has Anthropic key and tenant has orphan models, attach MiniMax provider. */
  private async bootstrapFromEnv() {
    const apiKey =
      this.config.get<string>('ANTHROPIC_API_KEY') ||
      this.config.get<string>('ANTHROPIC_AUTH_TOKEN');
    if (!apiKey) {
      await this.prisma.modelConfig.deleteMany({ where: { modelId: 'auto' } });
      return;
    }
    const baseUrl = (
      this.config.get<string>('ANTHROPIC_BASE_URL') ||
      LLM_PRESETS.minimax.baseUrl
    ).replace(/\/$/, '');
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.prisma.modelConfig.deleteMany({
        where: { tenantId: t.id, modelId: 'auto' },
      });
      const orphanCount = await this.prisma.modelConfig.count({
        where: { tenantId: t.id, providerId: null },
      });
      const providerCount = await this.prisma.llmProvider.count({
        where: { tenantId: t.id },
      });
      if (orphanCount === 0 && providerCount > 0) continue;
      if (providerCount === 0 && orphanCount === 0) continue;

      let provider = await this.prisma.llmProvider.findFirst({
        where: { tenantId: t.id, preset: 'minimax' },
      });
      if (!provider) {
        provider = await this.prisma.llmProvider.create({
          data: {
            tenantId: t.id,
            preset: 'minimax',
            name: LLM_PRESETS.minimax.name,
            baseUrl,
            apiKeyEnc: encryptSecret(apiKey, this.encryptionKey()),
            enabled: true,
            sortOrder: 0,
          },
        });
      }
      await this.prisma.modelConfig.updateMany({
        where: { tenantId: t.id, providerId: null },
        data: { providerId: provider.id },
      });
    }
  }
}
