'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatMarkdown from '@/components/chat-markdown';
import {
  AttachmentChips,
  HistoryAttachmentChips,
} from '@/components/attachment-chips';
import RunTracePanel from '@/components/run-trace-panel';
import SessionResourcePanel, {
  useResourcePanelState,
} from '@/components/session-resource-panel';
import { apiFetch } from '@/lib/api';
import { ATTACHMENT_ACCEPT, useAttachmentUpload } from '@/lib/attachments';
import { useAuth } from '@/lib/auth';
import { subscribeRunEvents } from '@/lib/sse';
import type {
  ChatMessage,
  RuntimeEvent,
  SessionDetail,
  WorkspaceEntry,
  WorkspaceTree,
} from '@/lib/types';

function countWorkspaceFiles(entries: WorkspaceEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.type === 'file') n += 1;
    else if (e.children?.length) n += countWorkspaceFiles(e.children);
  }
  return n;
}

function findAssistantAfterUser(
  messages: ChatMessage[],
  userMessageId?: string,
): string | null {
  if (!userMessageId) return null;
  const idx = messages.findIndex((m) => m.id === userMessageId);
  if (idx < 0) return null;
  for (let i = idx + 1; i < messages.length; i += 1) {
    if (messages[i].role === 'assistant') return messages[i].id;
  }
  return null;
}

function AgentAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'W';
  return (
    <div
      aria-hidden
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        background: '#101820',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export default function SessionChat({ sessionId }: { sessionId: string }) {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const initialRunId = search.get('runId');

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveText, setLiveText] = useState('');
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [messageTraces, setMessageTraces] = useState<
    Record<string, RuntimeEvent[]>
  >({});
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifactCount, setArtifactCount] = useState(0);
  const { open: panelOpen, setOpen: setPanelOpen, toggle: togglePanel } =
    useResourcePanelState();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<RuntimeEvent[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const upload = useAttachmentUpload();

  const hasUploading = upload.items.some((item) => item.status === 'uploading');
  const canSend =
    (draft.trim().length > 0 || upload.attachmentIds.length > 0) &&
    !hasUploading;

  const agentName = session?.expert?.name ?? 'WorkAlly';

  const refreshSession = useCallback(async () => {
    const data = await apiFetch<SessionDetail>(`/sessions/${sessionId}`);
    setSession(data);
    setMessages(data.messages);

    const traces: Record<string, RuntimeEvent[]> = {};
    for (const run of data.runs ?? []) {
      if (!run.events?.length) continue;
      const key =
        run.assistantMessageId ||
        findAssistantAfterUser(data.messages, run.messageId);
      if (key) traces[key] = run.events;
    }
    setMessageTraces((prev) => ({ ...prev, ...traces }));

    try {
      // Keep artifact index reconciled (bash-created pptx etc.).
      void apiFetch(`/sessions/${sessionId}/artifacts`).catch(() => undefined);
      const tree = await apiFetch<WorkspaceTree>(
        `/sessions/${sessionId}/workspace/tree`,
      );
      setArtifactCount(countWorkspaceFiles(tree.entries ?? []));
    } catch {
      // ignore workspace count errors
    }
    return data;
  }, [sessionId]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    void (async () => {
      try {
        const data = await refreshSession();
        // Resume in-flight runs after navigating away (sidebar links omit ?runId=).
        if (!initialRunId) {
          const staleBefore = Date.now() - 2 * 60 * 60 * 1000;
          const active = [...(data.runs ?? [])]
            .reverse()
            .find((r) => {
              if (r.state !== 'running' && r.state !== 'queued') return false;
              if (!r.createdAt) return true;
              return new Date(r.createdAt).getTime() >= staleBefore;
            });
          if (active) {
            router.replace(
              `/workbench/sessions/${sessionId}?runId=${active.id}`,
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载会话失败');
      }
    })();
  }, [auth, refreshSession, initialRunId, router, sessionId]);

  useEffect(() => {
    // Scroll only within the chat pane — never the page / sidebar
    const pane = messagesRef.current;
    if (!pane) return;
    pane.scrollTop = pane.scrollHeight;
  }, [messages, liveText]);

  useEffect(() => {
    if (!auth || !initialRunId) return;
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      setBusy(true);
      setLiveText('');
      setEvents([]);
      try {
        await subscribeRunEvents(
          initialRunId,
          (event) => {
            if (cancelled) return;
            setEvents((prev) => {
              const next = [...prev, event];
              eventsRef.current = next;
              return next;
            });
            if (event.type === 'message_delta') {
              const delta = String(event.data?.delta ?? '');
              setLiveText((t) => t + delta);
            }
            if (event.type === 'message_done') {
              const content = String(event.data?.content ?? '');
              const messageId = String(
                event.data?.messageId ?? `live-${Date.now()}`,
              );
              setMessageTraces((prev) => ({
                ...prev,
                [messageId]: eventsRef.current,
              }));
              setMessages((prev) => {
                if (prev.some((m) => m.id === messageId)) return prev;
                return [
                  ...prev,
                  { id: messageId, role: 'assistant', content },
                ];
              });
              setLiveText('');
            }
            if (event.type === 'artifact_created') {
              setArtifactCount((n) => n + 1);
            }
            if (event.type === 'error') {
              setError(String(event.data?.message ?? '运行失败'));
            }
          },
          ac.signal,
        );
      } catch (err) {
        if (!cancelled && (err as Error).name !== 'AbortError') {
          setError(
            err instanceof Error
              ? err.message.includes('SSE') || err.message.includes('fetch')
                ? '任务连接中断（API 可能刚重启）。请刷新页面后重新发送。'
                : err.message
              : '运行失败',
          );
          try {
            await refreshSession();
          } catch (refreshErr) {
            setError(
              refreshErr instanceof Error
                ? refreshErr.message
                : '刷新会话失败',
            );
          }
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          try {
            const data = await refreshSession();
            const run = data.runs?.find((r) => r.id === initialRunId);
            if (run?.state === 'running' || run?.state === 'queued') {
              setError(
                '任务仍显示执行中但连接已断开，请刷新后重新发送。',
              );
            }
          } catch (err) {
            setError(
              err instanceof Error ? err.message : '刷新会话失败',
            );
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
      setBusy(false);
    };
  }, [auth, initialRunId, refreshSession]);

  async function sendFollowUp() {
    const text = draft.trim();
    const ids = upload.attachmentIds;
    if ((!text && ids.length === 0) || busy || hasUploading) return;
    const content = text || '请结合附件回答';
    const savedDraft = draft;
    const savedUploadItems = upload.items;
    setBusy(true);
    setError(null);
    setDraft('');
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content,
        attachmentIds: ids,
      },
    ]);
    try {
      const created = await apiFetch<{ runId: string }>(
        `/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            attachmentIds: ids,
            wait: false,
          }),
        },
      );
      upload.clear();
      router.replace(
        `/workbench/sessions/${sessionId}?runId=${created.runId}`,
      );
    } catch (err) {
      setDraft(savedDraft);
      upload.restore(savedUploadItems);
      setMessages((prev) => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : '发送失败');
      setBusy(false);
    }
  }

  const statusLabel = useMemo(() => {
    if (busy) return '执行中…';
    return '就绪';
  }, [busy]);

  const showLiveAssistant =
    liveText.length > 0 || (busy && messages.at(-1)?.role === 'user');

  if (!ready || !auth) {
    return <main style={{ padding: 24 }}>加载中…</main>;
  }

  return (
    <div className="session-chat">
      <section className="session-chat__main">
        <header className="session-chat__header">
          <div className="session-chat__title-wrap">
            <h1 className="session-chat__title">
              {session?.title ?? '对话'}
            </h1>
            <p className="session-chat__meta">
              {agentName} · {statusLabel}
            </p>
          </div>
          <button
            type="button"
            className={`session-chat__panel-btn${panelOpen ? ' is-open' : ''}`}
            aria-label={panelOpen ? '收起资源侧栏' : '打开资源侧栏'}
            title="会话文件"
            onClick={togglePanel}
          >
            <PanelToggleIcon />
            {artifactCount > 0 && !panelOpen && (
              <span className="session-chat__badge">
                {artifactCount > 9 ? '9+' : artifactCount}
              </span>
            )}
          </button>
        </header>

        <div ref={messagesRef} className="session-chat__messages">
          <div className="session-chat__thread">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="session-chat__user-bubble">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {m.attachmentIds && m.attachmentIds.length > 0 && (
                    <HistoryAttachmentChips ids={m.attachmentIds} />
                  )}
                </div>
              ) : (
                <AssistantTurn
                  key={m.id}
                  name={agentName}
                  content={m.content}
                  trace={messageTraces[m.id]}
                />
              ),
            )}

            {showLiveAssistant && (
              <AssistantTurn
                name={agentName}
                content={liveText}
                trace={events}
                running={busy}
                streaming={liveText.length > 0}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="session-chat__composer-wrap">
          {error && (
            <div className="session-chat__error">{error}</div>
          )}
          {upload.error && (
            <div className="session-chat__error">{upload.error}</div>
          )}
          <div className="session-chat__composer">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.length) {
                  upload.addFiles(e.target.files);
                }
                e.target.value = '';
              }}
            />
            {upload.items.length > 0 && (
              <AttachmentChips items={upload.items} onRemove={upload.remove} />
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="继续追问…  Ctrl/⌘ + Enter 发送"
              rows={1}
              className="session-chat__input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void sendFollowUp();
                }
              }}
            />
            <div className="session-chat__composer-bar">
              <button
                type="button"
                className="session-chat__attach"
                title="添加文件"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                aria-label="添加文件"
              >
                +
              </button>
              <span className="session-chat__composer-hint">
                {session?.modelId ?? 'auto'}
              </span>
              <button
                type="button"
                className="session-chat__send"
                disabled={busy || !canSend}
                onClick={() => void sendFollowUp()}
                aria-label="发送"
              >
                ↑
              </button>
            </div>
          </div>
          <p className="session-chat__disclaimer">
            内容由 AI 生成，请核实重要信息
          </p>
        </div>
      </section>
      <SessionResourcePanel
        sessionId={sessionId}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        liveEvents={events}
        fileBadge={artifactCount}
        refreshKey={busy ? 'running' : `idle-${artifactCount}`}
      />
    </div>
  );
}

function PanelToggleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
    >
      <rect
        x="2.5"
        y="3.5"
        width="13"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M11.5 3.5v11"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function AssistantTurn({
  name,
  content,
  trace,
  running,
  streaming,
}: {
  name: string;
  content: string;
  trace?: RuntimeEvent[];
  running?: boolean;
  streaming?: boolean;
}) {
  return (
    <div className="session-chat__assistant">
      <AgentAvatar name={name} />
      <div className="session-chat__assistant-body">
        <div className="session-chat__assistant-name">{name}</div>
        {trace && trace.length > 0 ? (
          <RunTracePanel events={trace} running={running} />
        ) : running ? (
          <RunTracePanel events={[]} running />
        ) : null}
        {content ? (
          <div className={streaming ? 'session-chat__streaming' : undefined}>
            <ChatMarkdown content={content} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
