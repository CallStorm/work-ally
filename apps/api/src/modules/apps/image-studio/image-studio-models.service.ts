import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ImageStudioModel, Prisma } from '@prisma/client';
import type {
  CreateImageStudioModelInput,
  UpdateImageStudioModelInput,
} from '@work-ally/shared';
import { decryptSecret, encryptSecret } from '../../../common/crypto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ImageStudioModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listForAdmin(tenantId: string) {
    const rows = await this.prisma.imageStudioModel.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.serializeAdmin(row));
  }

  async create(tenantId: string, input: CreateImageStudioModelInput) {
    const encKey = this.encryptionKey();
    const baseUrl = input.baseUrl.trim().replace(/\/$/, '');
    const isDefault = input.isDefault ?? false;

    if (isDefault) {
      await this.clearDefaults(tenantId);
    }

    const row = await this.prisma.imageStudioModel.create({
      data: {
        tenantId,
        name: input.name.trim(),
        provider: input.provider,
        baseUrl,
        apiKeyEnc: encryptSecret(input.apiKey.trim(), encKey),
        modelName: input.modelName.trim(),
        capabilities: input.capabilities as Prisma.InputJsonValue,
        defaultParams: (input.defaultParams ?? {}) as Prisma.InputJsonValue,
        enabled: input.enabled ?? true,
        isDefault,
      },
    });
    return this.serializeAdmin(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateImageStudioModelInput,
  ) {
    const existing = await this.requireModel(tenantId, id);
    const data: Prisma.ImageStudioModelUpdateInput = {};

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.baseUrl !== undefined) {
      data.baseUrl = input.baseUrl.trim().replace(/\/$/, '');
    }
    if (input.modelName !== undefined) data.modelName = input.modelName.trim();
    if (input.capabilities !== undefined) {
      data.capabilities = input.capabilities as Prisma.InputJsonValue;
    }
    if (input.defaultParams !== undefined) {
      data.defaultParams = input.defaultParams as Prisma.InputJsonValue;
    }
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.apiKey !== undefined && input.apiKey.trim()) {
      data.apiKeyEnc = encryptSecret(input.apiKey.trim(), this.encryptionKey());
    }
    if (input.isDefault === true) {
      await this.clearDefaults(tenantId);
      data.isDefault = true;
    } else if (input.isDefault === false) {
      data.isDefault = false;
    }

    const row = await this.prisma.imageStudioModel.update({
      where: { id: existing.id },
      data,
    });
    return this.serializeAdmin(row);
  }

  async remove(tenantId: string, id: string) {
    await this.requireModel(tenantId, id);
    await this.prisma.imageStudioModel.delete({ where: { id } });
    return { ok: true };
  }

  async setDefault(tenantId: string, id: string) {
    const existing = await this.requireModel(tenantId, id);
    await this.clearDefaults(tenantId);
    const row = await this.prisma.imageStudioModel.update({
      where: { id: existing.id },
      data: { isDefault: true },
    });
    return this.serializeAdmin(row);
  }

  async test(
    tenantId: string,
    id: string,
  ): Promise<{ ok: boolean; message: string }> {
    const row = await this.requireModel(tenantId, id);
    if (row.provider !== 'openai_compatible') {
      throw new BadRequestException('该 provider 暂未实现');
    }

    let apiKey: string;
    try {
      apiKey = decryptSecret(row.apiKeyEnc, this.encryptionKey());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`解密 API Key 失败: ${message}`);
    }

    const root = row.baseUrl.replace(/\/$/, '');
    const url = `${root}/images/generations`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: row.modelName,
          prompt: 'connection test',
          n: 1,
          size: '256x256',
          response_format: 'b64_json',
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new BadRequestException(
          `连接测试失败 (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      return { ok: true, message: '连接成功' };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`连接测试失败: ${message}`);
    }
  }

  serializeAdmin(row: ImageStudioModel) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      provider: row.provider,
      baseUrl: row.baseUrl,
      modelName: row.modelName,
      capabilities: row.capabilities,
      defaultParams: row.defaultParams,
      enabled: row.enabled,
      isDefault: row.isDefault,
      apiKeySet: Boolean(row.apiKeyEnc),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  serializePublic(row: ImageStudioModel) {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      modelName: row.modelName,
      capabilities: row.capabilities,
      isDefault: row.isDefault,
      enabled: row.enabled,
    };
  }

  private async requireModel(tenantId: string, id: string) {
    const row = await this.prisma.imageStudioModel.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('模型不存在');
    return row;
  }

  private async clearDefaults(tenantId: string) {
    await this.prisma.imageStudioModel.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private encryptionKey() {
    const key = this.config.get<string>('CREDENTIALS_ENCRYPTION_KEY');
    if (!key) {
      throw new BadRequestException('CREDENTIALS_ENCRYPTION_KEY missing');
    }
    return key;
  }
}
