'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const expertPresets = [
  '深度研究',
  '文档处理',
  '数据分析',
  '可视化',
  '产品助手',
];

export default function WorkbenchComposer() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [modelId, setModelId] = useState('auto');
  const [selectedExpertName, setSelectedExpertName] = useState<string | null>(
    null,
  );
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  const suggested = useMemo(() => {
    if (!selectedExpertName) return [] as string[];
    return [
      `用「${selectedExpertName}」视角帮我拆解这个问题`,
      `输出一页可执行结论`,
      `列出风险与下一步`,
    ];
  }, [selectedExpertName]);

  async function send() {
    if (!auth?.defaultGroupId) {
      setError('缺少默认组，请重新登录/注册');
      return;
    }
    const text = (prompt ? `${prompt}\n\n` : '') + content.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<{
        sessionId: string;
        runId: string;
      }>('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          groupId: auth.defaultGroupId,
          modelId,
          content: text,
          wait: false,
        }),
      });
      router.push(
        `/workbench/sessions/${created.sessionId}?runId=${created.runId}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
      setSending(false);
    }
  }

  if (!ready || !auth) {
    return (
      <main style={{ padding: 40, color: 'var(--muted)' }}>加载中…</main>
    );
  }

  return (
    <main
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(860px, 100%)' }}>
        <h1
          style={{
            textAlign: 'center',
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            marginBottom: 8,
          }}
        >
          WorkAlly，我帮你
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            marginBottom: 24,
          }}
        >
          你好，{auth.user.name}。未选专家时走默认 Agent；发送后进入对话页看流式过程。
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 12,
            marginBottom: 12,
          }}
        >
          {expertPresets.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() =>
                setSelectedExpertName((cur) => (cur === name ? null : name))
              }
              style={{
                whiteSpace: 'nowrap',
                border: '1px solid var(--line)',
                background:
                  selectedExpertName === name ? 'var(--accent-soft)' : '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {selectedExpertName && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {suggested.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPrompt(item)}
                style={{
                  border: '1px solid var(--line)',
                  background: prompt === item ? 'var(--accent-soft)' : '#fff',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 18,
            padding: 16,
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="今天帮你做些什么？"
            style={{
              flex: 1,
              border: 'none',
              resize: 'none',
              outline: 'none',
              font: 'inherit',
              minHeight: 88,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                title="+ 面板稍后对接"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                +
              </button>
              {selectedExpertName ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {selectedExpertName}
                  <button
                    type="button"
                    onClick={() => setSelectedExpertName(null)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  默认 Agent
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  background: '#fff',
                }}
              >
                <option value="auto">Auto</option>
              </select>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || !content.trim()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--ink)',
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: sending || !content.trim() ? 0.5 : 1,
                }}
                aria-label="发送"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
        {error && (
          <p style={{ color: '#b42318', marginTop: 12 }}>{error}</p>
        )}
      </div>
    </main>
  );
}
