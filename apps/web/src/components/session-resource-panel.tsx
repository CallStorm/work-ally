'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ChatMarkdown from '@/components/chat-markdown';
import { apiDownload, apiFetch } from '@/lib/api';
import type {
  RuntimeEvent,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceTree,
} from '@/lib/types';

const PANEL_WIDTH_KEY = 'workally.resourcePanel.open';

const DELIVERABLE_RE =
  /\.(pptx?|xlsx?|docx?|pdf|html?|md|png|jpe?g|gif|webp|svg)$/i;

function formatSize(bytes?: number) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (/\.(pptx?|ppt)$/.test(lower)) return 'P';
  if (/\.(xlsx?|xls)$/.test(lower)) return 'X';
  if (/\.(docx?|doc)$/.test(lower)) return 'W';
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return '◇';
  if (lower.endsWith('.md')) return 'M';
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return '🖼';
  if (lower.endsWith('.py') || lower.endsWith('.js') || lower.endsWith('.ts')) return '{ }';
  if (lower.endsWith('.json')) return '{}';
  return '·';
}

function isDeliverable(name: string) {
  return DELIVERABLE_RE.test(name);
}

function flattenFiles(entries: WorkspaceEntry[], out: WorkspaceEntry[] = []) {
  for (const entry of entries) {
    if (entry.type === 'file') out.push(entry);
    else if (entry.children?.length) flattenFiles(entry.children, out);
  }
  return out;
}

function FilePreview({
  file,
  onDownload,
  downloading,
}: {
  file: WorkspaceFileContent;
  onDownload: () => void;
  downloading: boolean;
}) {
  const mime = file.mimeType ?? '';
  if (file.encoding === 'base64' && mime.startsWith('image/') && file.content) {
    return (
      <img
        src={`data:${mime};base64,${file.content}`}
        alt={file.filename}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: 240,
          margin: '0 auto',
          borderRadius: 8,
        }}
      />
    );
  }
  if (file.downloadOnly || file.isBinary) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        <div>二进制文件 · {formatSize(file.sizeBytes)}</div>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          style={downloadBtnStyle}
        >
          {downloading ? '下载中…' : '下载文件'}
        </button>
      </div>
    );
  }
  const content = file.content ?? '';
  if (mime === 'text/html') {
    return (
      <iframe
        title={file.filename}
        sandbox=""
        srcDoc={content}
        style={{ width: '100%', height: 240, border: '1px solid var(--line)', borderRadius: 8 }}
      />
    );
  }
  if (mime === 'text/markdown' || file.filename.endsWith('.md')) {
    return (
      <div style={{ padding: 8, fontSize: 14, maxHeight: 280, overflow: 'auto' }}>
        <ChatMarkdown content={content} />
      </div>
    );
  }
  return (
    <pre
      style={{
        margin: 0,
        padding: 10,
        fontSize: 12,
        lineHeight: 1.5,
        maxHeight: 280,
        overflow: 'auto',
        background: '#f8fafc',
        borderRadius: 8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </pre>
  );
}

export default function SessionResourcePanel({
  sessionId,
  open,
  onClose,
  liveEvents,
  fileBadge,
  refreshKey,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
  liveEvents: RuntimeEvent[];
  fileBadge: number;
  /** Bumps when a run ends so the list reloads after late file promotion. */
  refreshKey?: string | number;
}) {
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkspaceFileContent | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const treeData = await apiFetch<WorkspaceTree>(
        `/sessions/${sessionId}/workspace/tree`,
      );
      setTree(treeData);
      // Keep artifacts index in sync (pptx from bash etc.) for downloads/API.
      void apiFetch(`/sessions/${sessionId}/artifacts`).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh, refreshKey]);

  const hasWorkspaceEvent = useMemo(
    () =>
      liveEvents.some((e) =>
        ['artifact_created', 'artifact_updated', 'workspace_file_changed', 'run_finished'].includes(
          e.type,
        ),
      ),
    [liveEvents],
  );

  useEffect(() => {
    if (!open || !hasWorkspaceEvent) return;
    void refresh({ silent: true });
  }, [open, hasWorkspaceEvent, liveEvents.length, refresh]);

  const files = useMemo(() => {
    const flat = flattenFiles(tree?.entries ?? []);
    return flat.sort((a, b) => {
      const ad = isDeliverable(a.name) ? 0 : 1;
      const bd = isDeliverable(b.name) ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name, 'zh');
    });
  }, [tree]);

  const deliverables = files.filter((f) => isDeliverable(f.name));
  const others = files.filter((f) => !isDeliverable(f.name));

  async function loadPreview(path: string) {
    setSelectedPath(path);
    try {
      const file = await apiFetch<WorkspaceFileContent>(
        `/sessions/${sessionId}/workspace/files?path=${encodeURIComponent(path)}`,
      );
      setPreview(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
    }
  }

  async function downloadCurrent() {
    if (!preview || !selectedPath) return;
    setDownloading(true);
    setError(null);
    try {
      await apiDownload(
        `/sessions/${sessionId}/workspace/download?path=${encodeURIComponent(selectedPath)}`,
        preview.filename,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  const panelWidth = expanded ? 'min(50vw, 520px)' : 300;
  const showInitialLoading = loading && !tree;

  function renderFileRow(entry: WorkspaceEntry) {
    const deliverable = isDeliverable(entry.name);
    return (
      <button
        key={entry.path}
        type="button"
        onClick={() => void loadPreview(entry.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 10px',
          border: 'none',
          background: selectedPath === entry.path ? 'var(--accent-soft)' : 'transparent',
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span
          style={{
            width: 28,
            height: 22,
            borderRadius: 6,
            background: deliverable ? '#e8f0fe' : '#f1f5f9',
            color: deliverable ? '#1a73e8' : 'var(--muted)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {fileIcon(entry.name)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: deliverable ? 650 : 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {entry.path}
            {entry.size != null ? ` · ${formatSize(entry.size)}` : ''}
          </span>
        </span>
      </button>
    );
  }

  return (
    <aside
      style={{
        width: panelWidth,
        borderLeft: '1px solid transparent',
        boxShadow: '-8px 0 24px rgba(60,64,67,0.06)',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--line)',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            会话文件{fileBadge > 0 ? ` (${fileBadge})` : ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            交付物优先 · 可预览或下载
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            aria-label={expanded ? '缩小侧栏' : '放大侧栏'}
            title={expanded ? '缩小' : '放大'}
            style={iconBtnStyle}
            onClick={() => setExpanded((v) => !v)}
          >
            <ExpandIcon expanded={expanded} />
          </button>
          <button
            type="button"
            aria-label="关闭侧栏"
            title="关闭"
            style={iconBtnStyle}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
        {showInitialLoading && (
          <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)' }}>加载中…</div>
        )}
        {error && (
          <div style={{ padding: 12, fontSize: 13, color: '#b42318' }}>{error}</div>
        )}

        {!showInitialLoading && files.length === 0 && (
          <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Agent 生成文件后将显示在这里
          </div>
        )}

        {!showInitialLoading && deliverables.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={sectionLabelStyle}>交付物</div>
            {deliverables.map(renderFileRow)}
          </div>
        )}

        {!showInitialLoading && others.length > 0 && (
          <div>
            <div style={sectionLabelStyle}>
              {deliverables.length > 0 ? '其他文件' : '文件'}
            </div>
            {others.map(renderFileRow)}
          </div>
        )}
      </div>

      {preview && (
        <div
          style={{
            borderTop: '1px solid var(--line)',
            padding: 10,
            maxHeight: 320,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {preview.filename}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {formatSize(preview.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => void downloadCurrent()}
                disabled={downloading}
                style={{ ...downloadBtnStyle, padding: '4px 8px', fontSize: 11, marginTop: 0 }}
              >
                {downloading ? '…' : '下载'}
              </button>
            </div>
          </div>
          <FilePreview
            file={preview}
            onDownload={() => void downloadCurrent()}
            downloading={downloading}
          />
        </div>
      )}
    </aside>
  );
}

export function useResourcePanelState() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PANEL_WIDTH_KEY) === '1';
  });

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTH_KEY, open ? '1' : '0');
  }, [open]);

  return { open, setOpen, toggle: () => setOpen((v) => !v) };
}

const iconBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  color: 'var(--muted)',
};

const downloadBtnStyle: CSSProperties = {
  marginTop: 8,
  padding: '6px 12px',
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#f8fafc',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 600,
};

const sectionLabelStyle: CSSProperties = {
  padding: '4px 10px 6px',
  fontSize: 11,
  fontWeight: 650,
  color: 'var(--muted)',
  letterSpacing: '0.02em',
};

function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      {expanded ? (
        <>
          <path d="M9.5 2.5H12.5V5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 12.5H2.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 2.5L8.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M2.5 12.5L6.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M8.5 2.5H12.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 12.5H2.5V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 2.5L8 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M2.5 12.5L7 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M3.5 3.5l8 8M11.5 3.5l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
