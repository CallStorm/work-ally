import { BadRequestException } from '@nestjs/common';
import {
  ATTACHMENT_MAX_FILE_BYTES,
  AttachmentAllowedExtensions,
} from '@work-ally/shared';
import * as path from 'path';

export type AttachmentKind = 'text' | 'image' | 'office' | 'unknown';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const OFFICE_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx']);

const ALLOWED_EXTENSIONS = new Set<string>(AttachmentAllowedExtensions);

function extensionOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function classifyAttachment(
  filename: string,
  _mime: string,
): AttachmentKind {
  const ext = extensionOf(filename);
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (OFFICE_EXTENSIONS.has(ext)) return 'office';
  return 'unknown';
}

export function assertAllowedUpload(
  filename: string,
  mime: string,
  size: number,
): void {
  if (!filename?.trim()) {
    throw new BadRequestException('文件名无效');
  }
  if (size <= 0) {
    throw new BadRequestException('文件为空');
  }
  if (size > ATTACHMENT_MAX_FILE_BYTES) {
    throw new BadRequestException(
      `单文件不能超过 ${ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024)}MB`,
    );
  }

  const ext = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException('不支持的文件类型');
  }
  if (classifyAttachment(filename, mime) === 'unknown') {
    throw new BadRequestException('不支持的文件类型');
  }
}

export function safeStorageFilename(name: string): string {
  const normalized = name.replace(/\\/g, '/');
  const base = path.basename(normalized);
  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 200);
  return sanitized || 'file';
}
