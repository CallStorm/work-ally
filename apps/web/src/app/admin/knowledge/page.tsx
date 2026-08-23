'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Knowledge = {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  baseUrl: string;
  visibility: string;
  hasCredentials: boolean;
};

export default function AdminKnowledgePage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Knowledge[]>([]);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [provider, setProvider] = useState<'dify' | 'ragflow'>('dify');
  const [baseUrl, setBaseUrl] = useState('https://api.dify.ai/v1');
  const [credentials, setCredentials] = useState('');
  const [datasetIds, setDatasetIds] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setItems(await apiFetch<Knowledge[]>('/knowledge'));
  }

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    if (auth.user.role !== 'admin') {
      router.replace('/workbench');
      return;
    }
    void refresh().catch((e) => setError(e.message));
  }, [auth, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/knowledge', {
        method: 'POST',
        body: JSON.stringify({
          name,
          displayName: displayName || name,
          provider,
          baseUrl,
          credentials: credentials || undefined,
          externalDatasetIds: datasetIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          visibility: 'tenant',
        }),
      });
      setName('');
      setDisplayName('');
      setCredentials('');
      setDatasetIds('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function shareTenant(id: string) {
    await apiFetch(`/resources/knowledge/${id}/acl`, {
      method: 'PUT',
      body: JSON.stringify({ visibility: 'tenant', entries: [] }),
    });
    await refresh();
  }

  if (!ready || !auth) return <main style={{ padding: 24 }}>加载中…</main>;

  return (
    <main style={{ padding: 28, display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: 'Fraunces, Georgia, serif' }}>
          知识库
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>
          接入 Dify / RAGFlow，不自建重 RAG。凭据加密存储。
        </p>
      </div>
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
        <strong>新建知识库绑定</strong>
        <input
          required
          placeholder="内部名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="显示名"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={inputStyle}
        />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as 'dify' | 'ragflow')}
          style={inputStyle}
        >
          <option value="dify">dify</option>
          <option value="ragflow">ragflow</option>
        </select>
        <input
          required
          placeholder="baseUrl"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="API Key / 凭据"
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="外部 dataset id，逗号分隔"
          value={datasetIds}
          onChange={(e) => setDatasetIds(e.target.value)}
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
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{item.displayName}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                {item.provider} · {item.visibility}
                {item.hasCredentials ? ' · 已配置凭据' : ' · 无凭据'}
                <br />
                {item.baseUrl}
              </div>
            </div>
            <button
              type="button"
              style={btnStyle}
              onClick={() => void shareTenant(item.id)}
            >
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
