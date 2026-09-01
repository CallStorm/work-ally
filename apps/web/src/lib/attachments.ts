'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MAX_FILE_BYTES,
  ATTACHMENT_MAX_TOTAL_BYTES,
  AttachmentAllowedExtensions,
} from '@work-ally/shared';
import { ApiError, apiFetch } from './api';

export type AttachmentMeta = {
  id: string;
  filename: string;
  mime: string;
  size: number;
};

export type AttachmentUploadItem = {
  key: string;
  filename: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
  meta?: AttachmentMeta;
  error?: string;
};

export const ATTACHMENT_ACCEPT = AttachmentAllowedExtensions.join(',');

const ALLOWED_EXTENSIONS = new Set<string>(AttachmentAllowedExtensions);

let nextKey = 0;
function newItemKey() {
  nextKey += 1;
  return `att-${nextKey}-${Date.now()}`;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export function validateAttachmentFile(file: File): string | null {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return '不支持的文件类型';
  }
  if (file.size <= 0) {
    return '文件为空';
  }
  if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
    return `单文件不能超过 ${ATTACHMENT_MAX_FILE_BYTES / (1024 * 1024)}MB`;
  }
  return null;
}

export async function uploadAttachment(file: File): Promise<AttachmentMeta> {
  const clientError = validateAttachmentFile(file);
  if (clientError) {
    throw new Error(clientError);
  }
  const form = new FormData();
  form.append('file', file);
  return apiFetch<AttachmentMeta>('/attachments', { method: 'POST', body: form });
}

export function useAttachmentUpload(maxCount = ATTACHMENT_MAX_COUNT) {
  const [items, setItems] = useState<AttachmentUploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const uploadOne = useCallback(async (key: string, file: File) => {
    try {
      const meta = await uploadAttachment(file);
      setItems((prev) =>
        prev.map((item) =>
          item.key === key
            ? {
                ...item,
                status: 'ready',
                meta,
                filename: meta.filename,
                size: meta.size,
              }
            : item,
        ),
      );
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : '上传失败';
      setItems((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, status: 'error', error: message } : item,
        ),
      );
      setError(message);
    }
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setError(null);

      for (const file of list) {
        const validationError = validateAttachmentFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      const prev = itemsRef.current;
      if (prev.length + list.length > maxCount) {
        setError(`最多 ${maxCount} 个附件`);
        return;
      }

      const currentBytes = prev.reduce((sum, item) => sum + item.size, 0);
      const newBytes = list.reduce((sum, file) => sum + file.size, 0);
      if (currentBytes + newBytes > ATTACHMENT_MAX_TOTAL_BYTES) {
        setError(
          `附件合计不能超过 ${ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)}MB`,
        );
        return;
      }

      const batch = list.map((file) => {
        const key = newItemKey();
        return {
          key,
          file,
          item: {
            key,
            filename: file.name,
            size: file.size,
            status: 'uploading' as const,
          },
        };
      });

      setItems((current) => [...current, ...batch.map((entry) => entry.item)]);

      for (const entry of batch) {
        void uploadOne(entry.key, entry.file);
      }
    },
    [maxCount, uploadOne],
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const restore = useCallback((snapshot: AttachmentUploadItem[]) => {
    setItems(snapshot);
    setError(null);
  }, []);

  const totalBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.size, 0),
    [items],
  );

  const attachmentIds = useMemo(
    () =>
      items
        .filter((item) => item.status === 'ready' && item.meta?.id)
        .map((item) => item.meta!.id),
    [items],
  );

  return {
    items,
    addFiles,
    remove,
    clear,
    restore,
    attachmentIds,
    totalBytes,
    error,
  };
}
