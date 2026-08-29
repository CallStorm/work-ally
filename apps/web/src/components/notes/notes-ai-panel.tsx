'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import type { NotesAiAction } from '@work-ally/shared';

type NotesAiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  draftMd: string | null;
  createdAt: string;
};

type MessagesResponse = {
  messages: NotesAiMessage[];
};

type PostMessageResponse = MessagesResponse & {
  assistant: { content: string; draftMd: string | null };
};

export type NotesAiPanelProps = {
  noteId: string;
  title: string;
  bodyMd: string;
  open: boolean;
  onClose: () => void;
  onApply: (draftMd: string) => void;
  canRestore: boolean;
  onRestore: () => void;
};

const FORMAT_PROMPT = '请优化这篇笔记的排版与结构';
const ENRICH_PROMPT = '请完善这篇笔记的步骤、注意项与验收项';

function displayUserContent(content: string): string {
  const reqIdx = content.lastIndexOf('要求：');
  if (reqIdx >= 0) return content.slice(reqIdx + 3).trim();
  return content;
}

function latestDraftMd(messages: NotesAiMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.draftMd) return m.draftMd;
  }
  return null;
}

function AssistantMessage({ message }: { message: NotesAiMessage }) {
  const [draftOpen, setDraftOpen] = useState(false);
  const hasDraft = Boolean(message.draftMd);

  return (
    <div className="notes-ai__msg notes-ai__msg--assistant">
      <div className="notes-ai__msg-role">助手</div>
      <div className="notes-ai__msg-body">{message.content}</div>
      {hasDraft ? (
        <div className="notes-ai__draft">
          <button
            type="button"
            className="notes-ai__draft-toggle"
            aria-expanded={draftOpen}
            onClick={() => setDraftOpen((v) => !v)}
          >
            {draftOpen ? '收起草稿预览' : '展开草稿预览'}
          </button>
          {draftOpen ? (
            <pre className="notes-ai__draft-preview">{message.draftMd}</pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function NotesAiPanel({
  noteId,
  title,
  bodyMd,
  open,
  onClose,
  onApply,
  canRestore,
  onRestore,
}: NotesAiPanelProps) {
  const [messages, setMessages] = useState<NotesAiMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);

  const loadHistory = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoadingHistory(true);
    setError(null);
    try {
      const data = await apiFetch<MessagesResponse>(
        `/apps/notes/notes/${noteId}/ai/messages`,
      );
      if (requestId !== fetchIdRef.current) return;
      setMessages(data.messages);
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : '加载对话失败');
      setMessages([]);
    } finally {
      if (requestId === fetchIdRef.current) {
        setLoadingHistory(false);
      }
    }
  }, [noteId]);

  useEffect(() => {
    if (!open) return;
    void loadHistory();
  }, [open, noteId, loadHistory]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, sending]);

  async function sendMessage(prompt: string, action: NotesAiAction) {
    const trimmed = prompt.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    setInput('');

    try {
      const data = await apiFetch<PostMessageResponse>(
        `/apps/notes/notes/${noteId}/ai/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: trimmed,
            action,
            bodyMd,
            title,
          }),
        },
      );
      setMessages(data.messages);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '发送失败';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input, 'custom');
  }

  const draftMd = latestDraftMd(messages);
  const canApply = Boolean(draftMd) && !sending && !loadingHistory;
  const busy = sending || loadingHistory;

  if (!open) return null;

  return (
    <aside className="notes-ai" aria-label="笔记 AI 改稿">
      <header className="notes-ai__header">
        <h2 className="notes-ai__title">AI 改稿</h2>
        <button
          type="button"
          className="notes-ai__close"
          onClick={onClose}
          aria-label="关闭 AI 面板"
        >
          ×
        </button>
      </header>

      <div className="notes-ai__actions">
        <button
          type="button"
          className="notes-ai__quick"
          disabled={busy}
          onClick={() => void sendMessage(FORMAT_PROMPT, 'format')}
        >
          优化排版
        </button>
        <button
          type="button"
          className="notes-ai__quick"
          disabled={busy}
          onClick={() => void sendMessage(ENRICH_PROMPT, 'enrich')}
        >
          完善内容
        </button>
      </div>

      {error ? (
        <div className="notes-ai__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="notes-ai__messages" ref={listRef}>
        {loadingHistory && messages.length === 0 ? (
          <div className="notes-ai__empty">加载对话中…</div>
        ) : null}
        {!loadingHistory && messages.length === 0 ? (
          <div className="notes-ai__empty">
            使用快捷指令或输入要求，AI 将围绕当前笔记给出改稿建议。
          </div>
        ) : null}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="notes-ai__msg notes-ai__msg--user">
              <div className="notes-ai__msg-role">我</div>
              <div className="notes-ai__msg-body">
                {displayUserContent(m.content)}
              </div>
            </div>
          ) : m.role === 'assistant' ? (
            <AssistantMessage key={m.id} message={m} />
          ) : null,
        )}
        {sending ? (
          <div className="notes-ai__msg notes-ai__msg--assistant notes-ai__msg--pending">
            <div className="notes-ai__msg-role">助手</div>
            <div className="notes-ai__msg-body">生成中…</div>
          </div>
        ) : null}
      </div>

      <form className="notes-ai__composer" onSubmit={handleSubmit}>
        <textarea
          className="notes-ai__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入改稿要求…"
          rows={2}
          disabled={busy}
          maxLength={4000}
          aria-label="改稿要求"
        />
        <button
          type="submit"
          className="notes-ai__send"
          disabled={busy || !input.trim()}
        >
          发送
        </button>
      </form>

      <footer className="notes-ai__footer">
        <button
          type="button"
          className="notes-ai__apply"
          disabled={!canApply}
          title={
            !draftMd ? '未解析到完整正文，请重试或继续对话' : undefined
          }
          onClick={() => {
            if (draftMd) onApply(draftMd);
          }}
        >
          应用到笔记
        </button>
        <button
          type="button"
          className="notes-ai__restore"
          disabled={!canRestore || busy}
          onClick={onRestore}
        >
          还原
        </button>
      </footer>
      {!draftMd && messages.some((m) => m.role === 'assistant') ? (
        <p className="notes-ai__hint">未解析到完整正文，请重试或继续对话</p>
      ) : null}
    </aside>
  );
}
