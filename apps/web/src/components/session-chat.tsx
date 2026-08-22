'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatMarkdown from '@/components/chat-markdown';
import RunTracePanel from '@/components/run-trace-panel';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { subscribeRunEvents } from '@/lib/sse';
import type { ChatMessage, RuntimeEvent, SessionDetail } from '@/lib/types';

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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useRef<RuntimeEvent[]>([]);

  const agentName = session?.expert?.name ?? 'WorkAlly';

  const refreshSession = useCallback(async () => {
    const data = await apiFetch<SessionDetail>(`/sessions/${sessionId}`);
    setSession(data);
    setMessages(data.messages);
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
    void refreshSession().catch((err) =>
      setError(err instanceof Error ? err.message : '加载会话失败'),
    );
  }, [auth, refreshSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveText, events]);

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
            if (event.type === 'error') {
              setError(String(event.data?.message ?? '运行失败'));
            }
          },
          ac.signal,
        );
      } catch (err) {
        if (!cancelled && (err as Error).name !== 'AbortError') {
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
            await refreshSession();
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
    };
  }, [auth, initialRunId, refreshSession]);

  async function sendFollowUp() {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setDraft('');
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content },
    ]);
    try {
      const created = await apiFetch<{ runId: string }>(
        `/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content, wait: false }),
        },
      );
      router.replace(
        `/workbench/sessions/${sessionId}?runId=${created.runId}`,
      );
    } catch (err) {
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
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh' }}>
      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>
              {session?.title ?? '对话'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {agentName} · 模型 {session?.modelId ?? 'auto'} · {statusLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/workbench')}
            style={{
              border: '1px solid var(--line)',
              background: '#fff',
              borderRadius: 999,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            新对话
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px 24px',
            display: 'grid',
            gap: 20,
            alignContent: 'start',
          }}
        >
          {messages.map((m) =>
            m.role === 'user' ? (
              <div
                key={m.id}
                style={{
                  justifySelf: 'end',
                  maxWidth: 'min(720px, 92%)',
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  lineHeight: 1.55,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginBottom: 6,
                  }}
                >
                  我
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
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

        <div
          style={{
            borderTop: '1px solid var(--line)',
            padding: 16,
            background: 'rgba(255,255,255,0.85)',
          }}
        >
          {error && (
            <div style={{ color: '#b42318', marginBottom: 8 }}>{error}</div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 10,
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: 10,
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="继续追问…"
              style={{
                flex: 1,
                border: 'none',
                resize: 'none',
                outline: 'none',
                minHeight: 44,
                font: 'inherit',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void sendFollowUp();
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void sendFollowUp()}
              style={{
                alignSelf: 'flex-end',
                width: 40,
                height: 40,
                borderRadius: 999,
                border: 'none',
                background: 'var(--ink)',
                color: '#fff',
                cursor: 'pointer',
                opacity: busy || !draft.trim() ? 0.5 : 1,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </section>
    </div>
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
    <div
      style={{
        justifySelf: 'start',
        width: 'min(860px, 100%)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <AgentAvatar name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#334155',
            marginBottom: 8,
          }}
        >
          {name}
        </div>
        {trace && trace.length > 0 ? (
          <RunTracePanel events={trace} running={running} />
        ) : running ? (
          <RunTracePanel events={[]} running />
        ) : null}
        {content && (
          <div
            style={
              streaming
                ? {
                    borderLeft: '2px solid var(--accent)',
                    paddingLeft: 12,
                  }
                : undefined
            }
          >
            <ChatMarkdown content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
