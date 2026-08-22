'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Expert = {
  id: string;
  name: string;
  suggestedPrompts: string[];
};

type ModelOption = {
  id: string;
  modelId: string;
  displayName: string;
};

type DefaultAgent = {
  suggestedPrompts: string[];
};

export default function WorkbenchComposer() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const preselectExpertId = search.get('expertId');

  const [experts, setExperts] = useState<Expert[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [defaultPrompts, setDefaultPrompts] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [modelConfigId, setModelConfigId] = useState('');
  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(
    null,
  );
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const selectedExpert = useMemo(
    () => experts.find((e) => e.id === selectedExpertId) ?? null,
    [experts, selectedExpertId],
  );

  const suggested = useMemo(() => {
    if (selectedExpert) {
      return selectedExpert.suggestedPrompts?.length
        ? selectedExpert.suggestedPrompts
        : [
            `用「${selectedExpert.name}」视角帮我拆解这个问题`,
            '输出一页可执行结论',
            '列出风险与下一步',
          ];
    }
    return defaultPrompts;
  }, [selectedExpert, defaultPrompts]);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    (async () => {
      setLoadingAssets(true);
      try {
        const [expertList, modelList, defaultAgent] = await Promise.all([
          apiFetch<Expert[]>('/experts?sort=recent_used'),
          apiFetch<ModelOption[]>('/models'),
          apiFetch<DefaultAgent>('/default-agent').catch(() => null),
        ]);
        if (cancelled) return;
        setExperts(expertList);
        setModels(modelList);
        setDefaultPrompts(defaultAgent?.suggestedPrompts ?? []);
        if (modelList.length > 0) {
          setModelConfigId(modelList[0].id);
        } else {
          setModelConfigId('');
        }
        if (
          preselectExpertId &&
          expertList.some((e) => e.id === preselectExpertId)
        ) {
          setSelectedExpertId(preselectExpertId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载专家/模型失败');
        }
      } finally {
        if (!cancelled) setLoadingAssets(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, preselectExpertId]);

  async function send() {
    if (!auth?.defaultGroupId) {
      setError('缺少默认组，请重新登录/注册');
      return;
    }
    const text = (prompt ? `${prompt}\n\n` : '') + content.trim();
    if (!text) return;
    if (!modelConfigId) {
      setError('请先在管理后台配置并启用模型');
      return;
    }
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
          expertId: selectedExpertId,
          modelConfigId,
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
            alignItems: 'center',
          }}
        >
          {loadingAssets && (
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              加载专家…
            </span>
          )}
          {!loadingAssets && experts.length === 0 && (
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              暂无可用专家。
              {(auth.user.role === 'owner' || auth.user.role === 'admin') && (
                <>
                  {' '}
                  去{' '}
                  <Link href="/admin/experts" style={{ color: 'var(--accent)' }}>
                    管理后台创建
                  </Link>
                </>
              )}
            </span>
          )}
          {experts.map((expert) => (
            <button
              key={expert.id}
              type="button"
              onClick={() => {
                setSelectedExpertId((cur) =>
                  cur === expert.id ? null : expert.id,
                );
                setPrompt(null);
              }}
              style={{
                whiteSpace: 'nowrap',
                border: '1px solid var(--line)',
                background:
                  selectedExpertId === expert.id
                    ? 'var(--accent-soft)'
                    : '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              {expert.name}
            </button>
          ))}
        </div>

        {suggested.length > 0 && (
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
                onClick={() => setPrompt((cur) => (cur === item ? null : item))}
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
              {selectedExpert && (
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
                  {selectedExpert.name}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExpertId(null);
                      setPrompt(null);
                    }}
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
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={modelConfigId}
                onChange={(e) => setModelConfigId(e.target.value)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  padding: '8px 12px',
                  background: '#fff',
                }}
              >
                {models.length === 0 && (
                  <option value="">请先配置模型</option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
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
