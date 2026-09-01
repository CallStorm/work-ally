import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthUser } from '../../common/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { RuntimePathsService } from '../runtime/runtime-paths.service';
import { AttachmentsService } from './attachments.service';
import {
  classifyAttachment,
  safeStorageFilename,
} from './attachment-types';
import { TextExtractService } from './text-extract.service';

export type AssembledUserMessage = {
  text: string;
  images: Array<{ mime: string; base64: string; filename: string }>;
  workspacePaths: string[];
  supportsVision: boolean;
};

@Injectable()
export class AttachmentAssemblyService {
  private readonly logger = new Logger(AttachmentAssemblyService.name);

  constructor(
    private readonly attachments: AttachmentsService,
    private readonly textExtract: TextExtractService,
    private readonly storage: ObjectStorageService,
    private readonly paths: RuntimePathsService,
    private readonly prisma: PrismaService,
  ) {}

  async assemble(input: {
    user: AuthUser;
    sessionId: string;
    tenantId: string;
    attachmentIds: string[];
    userText: string;
    modelConfigId: string | null;
  }): Promise<AssembledUserMessage> {
    const supportsVision = await this.resolveSupportsVision(input.modelConfigId);

    if (input.attachmentIds.length === 0) {
      return {
        text: input.userText,
        images: [],
        workspacePaths: [],
        supportsVision,
      };
    }

    const rows = await this.attachments.assertOwned(
      input.attachmentIds,
      input.user,
    );
    const blocks: string[] = [];
    const images: AssembledUserMessage['images'] = [];
    const workspacePaths: string[] = [];

    for (const row of rows) {
      let buffer: Buffer;
      try {
        buffer = await this.storage.getObject(row.storageKey);
      } catch (err) {
        this.logger.warn(
          `Failed to read attachment ${row.id} from storage: ${String(err)}`,
        );
        blocks.push(
          `[附件: ${row.filename}]\n（无法读取存储，附件可能已损坏）`,
        );
        continue;
      }

      const kind = classifyAttachment(row.filename, row.mime);

      if (kind === 'text') {
        const block = await this.assembleTextAttachment(row, buffer);
        blocks.push(block);
        continue;
      }

      if (kind === 'office') {
        const relPath = this.copyToUploads(
          input.tenantId,
          input.sessionId,
          row.filename,
          buffer,
          row.id,
        );
        workspacePaths.push(relPath);
        const block = await this.assembleOfficeAttachment(row, buffer, relPath);
        blocks.push(block);
        continue;
      }

      if (kind === 'image') {
        const relPath = this.copyToUploads(
          input.tenantId,
          input.sessionId,
          row.filename,
          buffer,
          row.id,
        );
        workspacePaths.push(relPath);
        blocks.push(`[附件: ${row.filename}] → ${relPath}`);
        if (supportsVision) {
          images.push({
            mime: row.mime,
            base64: buffer.toString('base64'),
            filename: row.filename,
          });
        }
        continue;
      }

      blocks.push(`[附件: ${row.filename}]\n（不支持的附件类型）`);
    }

    const text =
      blocks.length > 0
        ? `${input.userText}\n\n${blocks.join('\n---\n')}`
        : input.userText;

    return { text, images, workspacePaths, supportsVision };
  }

  private async resolveSupportsVision(
    modelConfigId: string | null,
  ): Promise<boolean> {
    if (!modelConfigId) return false;
    const config = await this.prisma.modelConfig.findUnique({
      where: { id: modelConfigId },
      select: { supportsVision: true },
    });
    return config?.supportsVision ?? false;
  }

  private async assembleTextAttachment(
    row: { id: string; filename: string; mime: string },
    buffer: Buffer,
  ): Promise<string> {
    try {
      const raw = await this.textExtract.extractText('text', buffer, row.filename);
      const extracted = this.textExtract.truncateExtracted(raw);
      await this.prisma.attachment.update({
        where: { id: row.id },
        data: { extractedText: extracted },
      });
      return `[附件: ${row.filename}]\n${extracted || '（空文件）'}`;
    } catch (err) {
      this.logger.warn(
        `Text extract failed for ${row.id}: ${String(err)}`,
      );
      return `[附件: ${row.filename}]\n（文本读取失败）`;
    }
  }

  private async assembleOfficeAttachment(
    row: { id: string; filename: string; mime: string },
    buffer: Buffer,
    relPath: string,
  ): Promise<string> {
    try {
      const raw = await this.textExtract.extractText(
        'office',
        buffer,
        row.filename,
      );
      const extracted = this.textExtract.truncateExtracted(raw);
      await this.prisma.attachment.update({
        where: { id: row.id },
        data: { extractedText: extracted },
      });
      return `[附件: ${row.filename}]\n${extracted || `已保存到 ${relPath}`}`;
    } catch (err) {
      this.logger.warn(
        `Office extract failed for ${row.id}: ${String(err)}`,
      );
      return `[附件: ${row.filename}]\n（抽取失败，原件已保存到 ${relPath}）`;
    }
  }

  private copyToUploads(
    tenantId: string,
    sessionId: string,
    filename: string,
    buffer: Buffer,
    attachmentId: string,
  ): string {
    const workspace = this.paths.sessionWorkspaceDir(tenantId, sessionId);
    const uploadsDir = this.paths.ensureDir(path.join(workspace, 'uploads'));
    const safeName = this.resolveUploadFilename(
      uploadsDir,
      filename,
      attachmentId,
    );
    fs.writeFileSync(path.join(uploadsDir, safeName), buffer);
    return `uploads/${safeName}`;
  }

  private resolveUploadFilename(
    uploadsDir: string,
    filename: string,
    attachmentId: string,
  ): string {
    const base = safeStorageFilename(filename);
    const candidate = path.join(uploadsDir, base);
    if (!fs.existsSync(candidate)) return base;

    const ext = path.extname(base);
    const stem = path.basename(base, ext);
    const suffix = attachmentId.slice(-8);
    const alt = `${stem}-${suffix}${ext}`;
    if (!fs.existsSync(path.join(uploadsDir, alt))) return alt;

    return `${stem}-${attachmentId.slice(0, 8)}${ext}`;
  }
}
