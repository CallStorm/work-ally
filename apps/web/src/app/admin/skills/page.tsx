'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Skill = {
  id: string;
  name: string;
  slug: string;
  descriptionShort: string;
  visibility: string;
};

export default function AdminSkillsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Skill[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [descriptionShort, setDescriptionShort] = useState('');
  const [bodyMd, setBodyMd] = useState('# Skill\n');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const data = await apiFetch<Skill[]>('/skills');
    setItems(data);
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
    setError(null);
    try {
      await apiFetch('/skills', {
        method: 'POST',
        body: JSON.stringify({
          name,
          slug,
          descriptionShort,
          bodyMd,
          visibility: 'private',
        }),
      });
      setName('');
      setSlug('');
      setDescriptionShort('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function shareTenant(id: string) {
    await apiFetch(`/resources/skills/${id}/acl`, {
      method: 'PUT',
      body: JSON.stringify({ visibility: 'tenant', entries: [] }),
    });
    await refresh();
  }

  if (!ready || !auth) return <main style={{ padding: 24 }}>加载中…</main>;

  return (
    <main style={{ padding: 28, display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0, fontFamily: 'Fraunces, Georgia, serif' }}>技能</h1>
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
        <strong>新建技能</strong>
        <input
          required
          placeholder="名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          required
          placeholder="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={inputStyle}
        />
        <input
          required
          placeholder="短描述（触发用）"
          value={descriptionShort}
          onChange={(e) => setDescriptionShort(e.target.value)}
          style={inputStyle}
        />
        <textarea
          required
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          style={{ ...inputStyle, minHeight: 100 }}
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
                {item.slug} · {item.visibility} · {item.descriptionShort}
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

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 12px',
  font: 'inherit',
};

const btnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};
