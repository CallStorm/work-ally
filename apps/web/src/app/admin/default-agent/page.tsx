'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type AgentStatus = {
  ok: boolean;
  runtime: string;
  message: string;
  modelReady: boolean;
};

type AgentRow = {
  id: 'pi';
  name: string;
  description: string;
  builtin: boolean;
};

const AGENTS: AgentRow[] = [
  {
    id: 'pi',
    name: 'Pi',
    description: 'WorkAlly 内置 Agent Runtime，云端运行，无需本地 CLI。',
    builtin: true,
  },
];

type Tab = 'all' | 'available' | 'unavailable';

export default function AdminAgentsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    if (auth.user.role !== 'admin') {
      router.replace('/workbench');
      return;
    }
    void refreshStatus();
  }, [auth, router]);

  async function refreshStatus() {
    try {
      const result = await apiFetch<AgentStatus>('/default-agent/test', {
        method: 'POST',
      });
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '检测失败');
    }
  }

  async function testAgent(id: string) {
    setTestingId(id);
    setError(null);
    try {
      const result = await apiFetch<AgentStatus>('/default-agent/test', {
        method: 'POST',
      });
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTestingId(null);
    }
  }

  const filtered = useMemo(() => {
    let list = AGENTS;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q),
      );
    }
    if (tab === 'available') {
      list = list.filter(() => status?.ok === true);
    } else if (tab === 'unavailable') {
      list = list.filter(() => status?.ok === false);
    }
    return list;
  }, [search, tab, status?.ok]);

  const availableCount = status?.ok ? AGENTS.length : 0;
  const unavailableCount = status?.ok ? 0 : AGENTS.length;

  if (!ready || !auth) {
    return <main style={{ padding: 32, color: '#64748b' }}>加载中…</main>;
  }

  return (
    <main
      style={{
        padding: '28px 32px 48px',
        maxWidth: 960,
        margin: '0 auto',
        display: 'grid',
        gap: 20,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#0f172a',
            }}
          >
            Agent
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#64748b',
            }}
          >
            管理租户可用的 Agent Runtime。Pi 为内置引擎，App 自带、无需安装；模型
            API Key 请在
            <Link
              href="/admin/models"
              style={{ color: '#3b82f6', textDecoration: 'none' }}
            >
              {' '}
              模型配置
            </Link>
            中设置。
          </p>
        </div>
        <input
          placeholder="搜索 Agent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            fontSize: 14,
            minWidth: 220,
            background: '#fff',
          }}
        />
      </header>

      <div
        style={{
          display: 'flex',
          gap: 20,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <TabButton
          active={tab === 'all'}
          label="全部"
          count={AGENTS.length}
          onClick={() => setTab('all')}
        />
        <TabButton
          active={tab === 'available'}
          label="可用"
          count={availableCount}
          onClick={() => setTab('available')}
        />
        <TabButton
          active={tab === 'unavailable'}
          label="不可用"
          count={unavailableCount}
          onClick={() => setTab('unavailable')}
        />
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
            没有匹配的 Agent。
          </div>
        ) : (
          filtered.map((agent, index) => (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '16px 18px',
                borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  minWidth: 0,
                }}
              >
                <PiIcon />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ fontSize: 15, color: '#0f172a' }}>
                      {agent.name}
                    </strong>
                    {agent.builtin && (
                      <span
                        style={{
                          fontSize: 11,
                          background: '#f1f5f9',
                          color: '#64748b',
                          borderRadius: 999,
                          padding: '2px 8px',
                        }}
                      >
                        内置
                      </span>
                    )}
                    <StatusBadge ok={status?.ok ?? false} />
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 13,
                      color: '#64748b',
                    }}
                  >
                    {status?.message ?? '检测中…'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <OutlineButton
                  disabled={testingId === agent.id}
                  onClick={() => void testAgent(agent.id)}
                >
                  {testingId === agent.id ? '测试中…' : '测试连接'}
                </OutlineButton>
                <Link href="/admin/default-agent/pi" style={{ textDecoration: 'none' }}>
                  <OutlineButton>编辑</OutlineButton>
                </Link>
              </div>
            </div>
          ))
        )}
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>
            自定义 Agent
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
            暂不支持添加自定义 Agent Runtime。
          </p>
        </div>
        <div
          style={{
            background: '#fff',
            border: '1px dashed #e2e8f0',
            borderRadius: 14,
            padding: 36,
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          暂无自定义 Agent
        </div>
      </section>
    </main>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        padding: '10px 2px 12px',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 650 : 500,
        color: active ? '#0f172a' : '#64748b',
        borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 12,
          background: active ? '#e2e8f0' : '#f1f5f9',
          color: '#64748b',
          borderRadius: 999,
          padding: '1px 8px',
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        padding: '2px 8px',
        background: ok ? '#ecfdf5' : '#fef2f2',
        color: ok ? '#047857' : '#b91c1c',
      }}
    >
      {ok ? '可用' : '不可用'}
    </span>
  );
}

function PiIcon() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#0f172a',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 18,
        fontFamily: 'Georgia, serif',
      }}
    >
      π
    </div>
  );
}

function OutlineButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        background: '#fff',
        color: '#334155',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
