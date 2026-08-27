'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { apiFetch } from '@/lib/api';

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
};

export default function SkillUploadModal({ open, onClose, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('file', file);
        await apiFetch('/skills/upload', { method: 'POST', body: form });
        onUploaded();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : '上传失败');
      } finally {
        setBusy(false);
      }
    },
    [onClose, onUploaded],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 33, 43, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          background: '#fff',
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            上传技能至个人技能库
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={iconBtn}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--line)'}`,
            borderRadius: 14,
            padding: '36px 20px',
            textAlign: 'center',
            cursor: busy ? 'wait' : 'pointer',
            background: dragging ? 'var(--accent-soft)' : '#fafbfc',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>⬆</div>
          <div style={{ fontWeight: 600 }}>
            {busy ? '正在解析 SKILL.md…' : '拖拽文件或点击上传'}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </div>

        <div style={{ marginTop: 14, color: 'var(--muted)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>文件要求</div>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>文件夹打成的 .zip 需包含 SKILL.md 文件</li>
            <li>
              .md 须含 YAML frontmatter：name（kebab-case）与 description（Claude
              Code 规范）
            </li>
          </ol>
        </div>

        {error && (
          <div style={{ color: '#b42318', marginTop: 12, fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: 22,
  cursor: 'pointer',
  lineHeight: 1,
  color: 'var(--muted)',
};
