'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ChatMarkdown from '@/components/chat-markdown';
import { apiFetch } from '@/lib/api';
import type {
  RuntimeEvent,
  SessionArtifact,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceTree,
} from '@/lib/types';

type PanelView = 'workspace' | 'artifacts';

const PANEL_WIDTH_KEY = 'workally.resourcePanel.open';
const PANEL_VIEW_KEY = 'workally.resourcePanel.view';

function formatSize(bytes?: number) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return '◇';
  if (lower.endsWith('.md')) return 'M';
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return '🖼';
  return '·';
}

function FileTreeNode({
  entry,
  depth,
  selectedPath,
  onSelect,
}: {
  entry: WorkspaceEntry;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isDir = entry.type === 'directory';
  const selected = !isDir && selectedPath === entry.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDir) setOpen((v) => !v);
          else onSelect(entry.path);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '4px 8px',
          paddingLeft: 8 + depth * 14,
          border: 'none',
          background: selected ? 'var(--accent-soft)' : 'transparent',
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          fontSize: 13,
        }}
      >
        <span style={{ width: 14, color: 'var(--muted)', fontSize: 11 }}>
          {isDir ? (open ? '▾' : '▸') : fileIcon(entry.name)}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}
        </span>
        {!isDir && entry.size != null && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {formatSize(entry.size)}
          </span>
        )}
      </button>
      {isDir && open && entry.children?.map((child) => (
        <FileTreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function FilePreview({ file }: { file: WorkspaceFileContent }) {
  const mime = file.mimeType ?? '';
  if (file.downloadOnly || file.isBinary) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)' }}>
        二进制文件 · {formatSize(file.sizeBytes)} · 请下载查看
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
  artifactBadge,
}: {
  sessionId: string;
  open: boolean;
  onClose: () => void;
  liveEvents: RuntimeEvent[];
  artifactBadge: number;
}) {
  const [view, setView] = useState<PanelView>(() => {
    if (typeof window === 'undefined') return 'workspace';
    return (localStorage.getItem(PANEL_VIEW_KEY) as PanelView) || 'workspace';
  });
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [artifacts, setArtifacts] = useState<SessionArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkspaceFileContent | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeData, artifactData] = await Promise.all([
        apiFetch<WorkspaceTree>(`/sessions/${sessionId}/workspace/tree`),
        apiFetch<SessionArtifact[]>(`/sessions/${sessionId}/artifacts`),
      ]);
      setTree(treeData);
      setArtifacts(artifactData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    localStorage.setItem(PANEL_VIEW_KEY, view);
  }, [view]);

  const hasWorkspaceEvent = useMemo(
    () =>
      liveEvents.some((e) =>
        ['artifact_created', 'artifact_updated', 'workspace_file_changed'].includes(e.type),
      ),
    [liveEvents],
  );

  useEffect(() => {
    if (!open || !hasWorkspaceEvent) return;
    void refresh();
  }, [open, hasWorkspaceEvent, liveEvents.length, refresh]);

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

  async function loadArtifactPreview(artifact: SessionArtifact) {
    setSelectedPath(artifact.path);
    try {
      const file = await apiFetch<WorkspaceFileContent>(
        `/sessions/${sessionId}/artifacts/${artifact.id}/content`,
      );
      setPreview(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
    }
  }

  if (!open) return null;

  const panelWidth = expanded ? 'min(50vw, 520px)' : 300;

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
          justifyContent: 'flex-end',
          padding: '8px 10px',
          borderBottom: '1px solid var(--line)',
          gap: 4,
        }}
      >
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

      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
        <select
          value={view}
          onChange={(e) => {
            setView(e.target.value as PanelView);
            setPreview(null);
            setSelectedPath(null);
          }}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: '#f8fafc',
            font: 'inherit',
            fontSize: 13,
          }}
        >
          <option value="workspace">工作空间文件</option>
          <option value="artifacts">
            会话产物{artifactBadge > 0 ? ` (${artifactBadge})` : ''}
          </option>
        </select>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
        {loading && (
          <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)' }}>加载中…</div>
        )}
        {error && (
          <div style={{ padding: 12, fontSize: 13, color: '#b42318' }}>{error}</div>
        )}

        {!loading && view === 'workspace' && (
          tree && tree.entries.length > 0 ? (
            tree.entries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                selectedPath={selectedPath}
                onSelect={(path) => void loadPreview(path)}
              />
            ))
          ) : (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Agent 执行后将在此显示工作空间文件
            </div>
          )
        )}

        {!loading && view === 'artifacts' && (
          artifacts.length > 0 ? (
            <div style={{ display: 'grid', gap: 2 }}>
              {artifacts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void loadArtifactPreview(a)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    width: '100%',
                    padding: '8px 10px',
                    border: 'none',
                    background:
                      selectedPath === a.path ? 'var(--accent-soft)' : 'transparent',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.filename}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {a.path} · {formatSize(a.sizeBytes)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              暂无产物，Agent 生成文件后将自动出现
            </div>
          )
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
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {formatSize(preview.sizeBytes)}
            </span>
          </div>
          <FilePreview file={preview} />
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
