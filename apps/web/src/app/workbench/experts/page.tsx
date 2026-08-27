'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ExpertAvatar } from '@/app/admin/experts/expert-form-dialog';
import WorkbenchAssetTabs from '@/components/workbench-asset-tabs';

type Expert = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  personaMd: string;
  visibility: string;
  status: string;
  suggestedPrompts: string[];
  skillIds: string[];
  connectorIds: string[];
};

export default function WorkbenchExpertsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Expert[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    void apiFetch<Expert[]>('/experts?sort=recent_used')
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [auth]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = items.filter((e) => e.status === 'active');
    if (!q) return active;
    return active.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  if (!ready || !auth) {
    return <main style={{ padding: 24, color: '#64748b' }}>加载中…</main>;
  }

  return (
    <main
      style={{
        padding: '24px 32px 48px',
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gap: 24,
      }}
    >
      <WorkbenchAssetTabs />

      <div>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
          选择专家后回到首页对话，将自动加载其技能与 MCP 配置。
        </p>
      </div>

      <input
        placeholder="搜索专家"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          maxWidth: 320,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          fontSize: 14,
        }}
      />

      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}

      {filtered.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #e2e8f0',
            borderRadius: 14,
            padding: 36,
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          暂无可用专家。
          {auth.user.role === 'admin' && (
            <>
              {' '}
              <Link href="/admin/experts" style={{ color: '#3b82f6' }}>
                去创建专家
              </Link>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map((item) => (
            <article
              key={item.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: 16,
                display: 'grid',
                gap: 12,
              }}
            >
              <ExpertAvatar
                name={item.name}
                avatarUrl={item.avatarUrl}
              />
              <div>
                <div style={{ fontWeight: 650, fontSize: 16 }}>{item.name}</div>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 13,
                    color: '#64748b',
                    lineHeight: 1.5,
                  }}
                >
                  {item.description ||
                    item.personaMd.slice(0, 100) ||
                    '暂无描述'}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: 10,
                  fontSize: 12,
                  color: '#64748b',
                }}
              >
                <span>
                  Agent: π Pi · 技能 {item.skillIds?.length ?? 0} · MCP{' '}
                  {item.connectorIds?.length ?? 0}
                </span>
                <Link
                  href={`/workbench?expertId=${item.id}`}
                  style={{
                    borderRadius: 999,
                    padding: '6px 12px',
                    background: '#334155',
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  使用
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
