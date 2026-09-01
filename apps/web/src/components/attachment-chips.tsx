'use client';

import type { CSSProperties } from 'react';
import type { AttachmentUploadItem } from '@/lib/attachments';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        height: 14,
        border: '2px solid #cbd5e1',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'attachment-chip-spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

export function AttachmentChips({
  items,
  onRemove,
}: {
  items: AttachmentUploadItem[];
  onRemove: (key: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <style>{`@keyframes attachment-chip-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
        }}
      >
        {items.map((item) => (
          <AttachmentChip
            key={item.key}
            item={item}
            onRemove={() => onRemove(item.key)}
          />
        ))}
      </div>
    </>
  );
}

function AttachmentChip({
  item,
  onRemove,
}: {
  item: AttachmentUploadItem;
  onRemove: () => void;
}) {
  const isError = item.status === 'error';
  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: isError ? '#fef2f2' : '#f1f5f9',
    border: isError ? '1px solid #fecaca' : '1px solid transparent',
    borderRadius: 999,
    padding: '5px 8px 5px 10px',
    fontSize: 13,
    color: isError ? '#b42318' : '#334155',
    maxWidth: 320,
  };

  return (
    <span style={chipStyle} title={item.error}>
      {item.status === 'uploading' && <Spinner />}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.filename}
      </span>
      <span style={{ color: '#94a3b8', fontSize: 12, flexShrink: 0 }}>
        {formatBytes(item.size)}
      </span>
      {isError && item.error && (
        <span
          style={{
            fontSize: 12,
            flexShrink: 0,
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.error}
        </span>
      )}
      <button
        type="button"
        aria-label={`移除 ${item.filename}`}
        onClick={onRemove}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: '#64748b',
          padding: 0,
          lineHeight: 1,
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </span>
  );
}
