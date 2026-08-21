'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Expert = {
  id: string;
  name: string;
  personaMd: string;
  visibility: string;
  suggestedPrompts: string[];
};

export default function AdminExpertsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Expert[]>([]);
  const [name, setName] = useState('');
  const [personaMd, setPersonaMd] = useState('你是专业办公助手。');
  const [prompts, setPrompts] = useState('帮我写周报,输出风险清单');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setItems(await apiFetch<Expert[]>('/experts'));
  }

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    void refresh().catch((e) => setError(e.message));
  }, [auth]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/experts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          personaMd,
          suggestedPrompts: prompts
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          visibility: 'private',
        }),
      });
      setName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function shareTenant(id: string) {
    await apiFetch(`/resources/experts/${id}/acl`, {
      method: 'PUT',
      body: JSON.stringify({ visibility: 'tenant', entries: [] }),
    });
    await refresh();
  }

  if (!ready || !auth) return <main style={{ padding: 24 }}>加载中…</main>;

  return (
    <main style={{ padding: 28, display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0, fontFamily: 'Fraunces, Georgia, serif' }}>专家</h1>
      {error && <div style={{ color: '#b42318' }}>{error}</div>}
      <form
        onSubmit={onCreate}
        style={{
          display: 'grid',
          gap: 8,
          maxWidth: 560,
          background: '#fff',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <strong>新建专家</strong>
        <input
          required
          placeholder="名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <textarea
          required
          value={personaMd}
          onChange={(e) => setPersonaMd(e.target.value)}
          style={{ ...inputStyle, minHeight: 90 }}
        />
        <input
          placeholder="推荐提示词，逗号分隔"
          value={prompts}
          onChange={(e) => setPrompts(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>
          创建
        </button>
      </form>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                {item.visibility} · 提示词 {item.suggestedPrompts?.length ?? 0} 条
              </div>
            </div>
            <button type="button" style={btnStyle} onClick={() => void shareTenant(item.id)}>
              分享到全公司
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 12px',
  font: 'inherit',
};

const btnStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};
