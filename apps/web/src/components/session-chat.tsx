'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { subscribeRunEvents } from '@/lib/sse';
import type { ChatMessage, RuntimeEvent, SessionDetail } from '@/lib/types';

export default function SessionChat({ sessionId }: { sessionId: string }) {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const initialRunId = search.get('runId');

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveText, setLiveText] = useState('');
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshSession = useCallback(async () => {
    const data = await apiFetch<SessionDetail>(`/sessions/${sessionId}`);
    setSession(data);
    setMessages(data.messages);
    return data;
  }, [sessionId]);

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
            setEvents((prev) => [...prev, event]);
            if (event.type === 'message_delta') {
              const delta = String(event.data?.delta ?? '');
              setLiveText((t) => t + delta);
            }
            if (event.type === 'message_done') {
              const content = String(event.data?.content ?? '');
              const messageId = String(
                event.data?.messageId ?? `live-${Date.now()}`,
              );
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
          await refreshSession();
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
          await refreshSession();
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
    if (busy) return 'Agent 执行中…';
    const last = events[events.length - 1];
    if (!last) return '就绪';
    return last.type;
  }, [busy, events]);

  if (!ready || !auth) {
    return <main style={{ padding: 24 }}>加载中…</main>;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
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
              {session?.expert?.name ?? '默认 Agent'} · {statusLabel}
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
            padding: 20,
            display: 'grid',
            gap: 14,
            alignContent: 'start',
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                justifySelf: m.role === 'user' ? 'end' : 'start',
                maxWidth: 'min(720px, 92%)',
                background: m.role === 'user' ? 'var(--accent-soft)' : '#fff',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '12px 14px',
                whiteSpace: 'pre-wrap',
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
                {m.role === 'user' ? '我' : '助手'}
              </div>
              {m.content}
            </div>
          ))}
          {liveText && (
            <div
              style={{
                justifySelf: 'start',
                maxWidth: 'min(720px, 92%)',
                background: '#fff',
                border: '1px dashed var(--accent)',
                borderRadius: 16,
                padding: '12px 14px',
                whiteSpace: 'pre-wrap',
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
                助手（流式）
              </div>
              {liveText}
            </div>
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

      <aside
        style={{
          width: 280,
          borderLeft: '1px solid var(--line)',
          background: '#fff',
          padding: 14,
          overflow: 'auto',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>运行过程</div>
        {events.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>暂无事件</div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {events.map((ev, idx) => (
            <div
              key={`${ev.ts}-${idx}`}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 8,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>{ev.type}</div>
              <div style={{ color: 'var(--muted)' }}>
                {ev.data ? JSON.stringify(ev.data).slice(0, 140) : ev.ts}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
