'use client';

import Link from 'next/link';
import {
  FormEvent,
  useEffect,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type DefaultAgent = {
  personaMd: string | null;
  suggestedPrompts: string[];
};

type AgentStatus = {
  ok: boolean;
  runtime: string;
  message: string;
  modelReady: boolean;
};

type Expert = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

const field: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#64748b',
};

const primaryBtn: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#334155',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

export default function AdminPiAgentPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [personaMd, setPersonaMd] = useState('');
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    if (auth.user.role !== 'owner' && auth.user.role !== 'admin') {
      router.replace('/workbench');
      return;
    }
    void load();
  }, [auth, router]);

  async function load() {
    try {
      const [agent, expertList, testResult] = await Promise.all([
        apiFetch<DefaultAgent>('/default-agent'),
        apiFetch<Expert[]>('/experts?all=1'),
        apiFetch<AgentStatus>('/default-agent/test', { method: 'POST' }),
      ]);
      setPersonaMd(
        agent.personaMd ??
          '你是 WorkAlly 默认办公助手。用简洁中文回答，给出可执行的结论与下一步建议。',
      );
      setPrompts(
        agent.suggestedPrompts?.length
          ? agent.suggestedPrompts
          : ['帮我梳理今天的工作重点'],
      );
      setExperts(expertList.filter((e) => e.status === 'active'));
      setStatus(testResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }

  async function testConnection() {
    setTesting(true);
    setError(null);
    try {
      const result = await apiFetch<AgentStatus>('/default-agent/test', {
        method: 'POST',
      });
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTesting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch('/default-agent', {
        method: 'PUT',
        body: JSON.stringify({
          personaMd: personaMd.trim(),
          suggestedPrompts: prompts.map((p) => p.trim()).filter(Boolean),
          skillIds: [],
          connectorIds: [],
          knowledgeIds: [],
        }),
      });
      setSaved(true);
      await testConnection();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !auth) {
    return <main style={{ padding: 32, color: '#64748b' }}>加载中…</main>;
  }

  return (
    <main
      style={{
        padding: '28px 32px 48px',
        maxWidth: 720,
        margin: '0 auto',
        display: 'grid',
        gap: 20,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/admin/default-agent"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            ← 返回
          </Link>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Pi</h1>
        </div>
        <button
          type="button"
          onClick={() => void testConnection()}
          disabled={testing}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            background: '#fff',
            cursor: testing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {testing ? '测试中…' : '测试连接'}
        </button>
      </header>

      <div
        style={{
          background: status?.ok ? '#ecfdf5' : '#fff7ed',
          border: `1px solid ${status?.ok ? '#bbf7d0' : '#fed7aa'}`,
          borderRadius: 12,
          padding: '14px 16px',
          display: 'grid',
          gap: 6,
        }}
      >
        <strong
          style={{
            color: status?.ok ? '#047857' : '#c2410c',
            fontSize: 14,
          }}
        >
          {status?.ok ? '✓ 已连接' : '⚠ 未就绪'}
        </strong>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: status?.ok ? '#065f46' : '#9a3412',
          }}
        >
          {status?.message ??
            '正在检测 Pi Runtime 与模型配置…'}
          {!status?.modelReady && (
            <>
              {' '}
              请前往
              <Link href="/admin/models" style={{ color: '#3b82f6' }}>
                模型配置
              </Link>
              添加 API Key。
            </>
          )}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          padding: 18,
          display: 'grid',
          gap: 16,
        }}
      >
        <section style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 650, fontSize: 15 }}>默认人设与规则</div>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            未选择专家时，工作台会话将使用以下系统提示。默认 Agent 不绑定技能或
            MCP，如需工具请在「专家」中单独配置。
          </p>
          <label style={labelStyle}>
            Markdown 规则
            <textarea
              required
              value={personaMd}
              onChange={(e) => setPersonaMd(e.target.value)}
              placeholder="请输入 Markdown 格式的规则…"
              style={{ ...field, minHeight: 140, resize: 'vertical' }}
            />
          </label>
        </section>

        <section style={{ display: 'grid', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 650, fontSize: 15 }}>推荐提示词</div>
            <button
              type="button"
              onClick={() => setPrompts((p) => [...p, ''])}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#334155',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              + 添加
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {prompts.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={p}
                  onChange={(e) =>
                    setPrompts((prev) =>
                      prev.map((x, idx) => (idx === i ? e.target.value : x)),
                    )
                  }
                  placeholder="输入推荐提示词"
                  style={field}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPrompts((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    borderRadius: 10,
                    padding: '0 12px',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  删
                </button>
              </div>
            ))}
          </div>
        </section>

        {error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>}
        {saved && (
          <div style={{ color: '#047857', fontSize: 13 }}>已保存</div>
        )}

        <button type="submit" disabled={saving} style={primaryBtn}>
          {saving ? '保存中…' : '保存并测试'}
        </button>
      </form>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>
          绑定此 Agent 的专家（{experts.length}）
        </h2>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {experts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
              暂无专家。
              <Link href="/admin/experts" style={{ color: '#3b82f6' }}>
                去创建
              </Link>
            </div>
          ) : (
            experts.map((expert, index) => (
              <Link
                key={expert.id}
                href="/admin/experts"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      color: '#334155',
                    }}
                  >
                    {(expert.name[0] ?? '?').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {expert.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {expert.description || '暂无描述'}
                    </div>
                  </div>
                </div>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>查看详情 ›</span>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
