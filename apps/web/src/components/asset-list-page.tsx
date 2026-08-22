'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export type AssetListItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  title: string;
  description: string;
  endpoint: string;
  adminHref: string;
  mapItem: (raw: Record<string, unknown>) => AssetListItem;
  actionHref?: (item: AssetListItem) => string | null;
  actionLabel?: string;
};

export default function AssetListPage({
  title,
  description,
  endpoint,
  adminHref,
  mapItem,
  actionHref,
  actionLabel = '使用',
}: Props) {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AssetListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    void apiFetch<Record<string, unknown>[]>(endpoint)
      .then((rows) => setItems(rows.map(mapItem)))
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [auth, endpoint, mapItem]);

  if (!ready || !auth) {
    return <main style={{ padding: 24 }}>加载中…</main>;
  }

  const isAdmin =
    auth.user.role === 'owner' || auth.user.role === 'admin';

  return (
    <main style={{ padding: 28, display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: 'Fraunces, Georgia, serif' }}>
          {title}
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>{description}</p>
      </div>
      {error && <div style={{ color: '#b42318' }}>{error}</div>}
      {items.length === 0 && (
        <div style={{ color: 'var(--muted)' }}>
          暂无可用{title}。
          {isAdmin && (
            <>
              {' '}
              <Link href={adminHref} style={{ color: 'var(--accent)' }}>
                去管理后台创建
              </Link>
            </>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => {
          const href = actionHref?.(item) ?? null;
          return (
            <div
              key={item.id}
              style={{
                background: '#fff',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{item.title}</div>
                {item.subtitle && (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {item.subtitle}
                  </div>
                )}
              </div>
              {href ? (
                <Link
                  href={href}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '8px 14px',
                    background: 'var(--accent)',
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {actionLabel}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
