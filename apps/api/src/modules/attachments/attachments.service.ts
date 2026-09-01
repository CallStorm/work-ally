import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Attachment } from '@prisma/client';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import {
  assertAllowedUpload,
  safeStorageFilename,
} from './attachment-types';

export type AttachmentMetaDto = {
  id: string;
  filename: string;
  mime: string;
  size: number;
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async upload(
    user: AuthUser,
    file: Express.Multer.File,
  ): Promise<AttachmentMetaDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请上传文件');
    }

    const filename = safeStorageFilename(file.originalname || 'file');
    const mime = file.mimetype || 'application/octet-stream';
    assertAllowedUpload(filename, mime, file.size);

    const row = await this.prisma.attachment.create({
      data: {
        tenantId: user.tenantId,
        uploaderId: user.userId,
        filename,
        mime,
        size: file.size,
        storageKey: 'pending',
      },
    });

    const storageKey = this.buildStorageKey(user.tenantId, row.id, filename);

    try {
      await this.prisma.attachment.update({
        where: { id: row.id },
        data: { storageKey },
      });
      await this.storage.putObject(storageKey, file.buffer, mime);
    } catch {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      await this.prisma.attachment
        .delete({ where: { id: row.id } })
        .catch(() => undefined);
      throw new BadGatewayException('存储服务不可用');
    }

    return { id: row.id, filename, mime, size: file.size };
  }

  async getForUser(user: AuthUser, id: string): Promise<AttachmentMetaDto> {
    const row = await this.findOwnedRow(user, id);
    return this.toMetaDto(row);
  }

  async getContentBuffer(
    user: AuthUser,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const row = await this.findOwnedRow(user, id);
    try {
      const buffer = await this.storage.getObject(row.storageKey);
      return { buffer, filename: row.filename, mime: row.mime };
    } catch {
      throw new BadGatewayException('存储服务不可用');
    }
  }

  async deleteIfUnused(user: AuthUser, id: string): Promise<{ ok: true }> {
    const row = await this.findOwnedRow(user, id);

    const inUse = await this.isAttachmentReferenced(id);
    if (inUse) {
      throw new ForbiddenException('附件已被消息引用，无法删除');
    }

    try {
      await this.storage.deleteObject(row.storageKey);
    } catch {
      throw new BadGatewayException('存储服务不可用');
    }

    await this.prisma.attachment.delete({ where: { id: row.id } });
    return { ok: true };
  }

  async assertOwned(ids: string[], user: AuthUser): Promise<Attachment[]> {
    if (ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)];
    const rows = await this.prisma.attachment.findMany({
      where: {
        id: { in: uniqueIds },
        tenantId: user.tenantId,
        uploaderId: user.userId,
      },
    });

    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('附件不存在或无权访问');
    }

    return uniqueIds.map(
      (id) => rows.find((row) => row.id === id)!,
    );
  }

  private buildStorageKey(
    tenantId: string,
    attachmentId: string,
    filename: string,
  ): string {
    return `tenants/${tenantId}/attachments/${attachmentId}/${filename}`;
  }

  private toMetaDto(row: Attachment): AttachmentMetaDto {
    return {
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      size: row.size,
    };
  }

  private async findOwnedRow(user: AuthUser, id: string): Promise<Attachment> {
    const row = await this.prisma.attachment.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        uploaderId: user.userId,
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async isAttachmentReferenced(id: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM messages
        WHERE JSON_CONTAINS(attachment_ids, ${JSON.stringify(id)}, '$')
        LIMIT 1
      `,
    );
    return rows.length > 0;
  }
}
