'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { SessionListItem } from '@/lib/types';

const nav = [
  { href: '/workbench', label: '首页' },
  { href: '/workbench/experts', label: '专家' },
  { href: '/workbench/skills', label: '技能' },
  { href: '/workbench/connectors', label: '连接器' },
  { href: '/workbench/knowledge', label: '知识库' },
];

export default function WorkbenchShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { auth, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth?.defaultGroupId) return;
    void apiFetch<SessionListItem[]>(
      `/sessions?group_id=${auth.defaultGroupId}`,
    )
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [auth, pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          background: 'var(--sidebar)',
          color: 'var(--sidebar-ink)',
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ padding: '4px 10px', fontWeight: 700 }}>WorkAlly</div>
        <nav style={{ display: 'grid', gap: 6 }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background:
                  pathname === item.href
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(255,255,255,0.04)',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 8, padding: '0 6px' }}>
          <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
            最近会话
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {sessions.slice(0, 8).map((s) => (
              <Link
                key={s.id}
                href={`/workbench/sessions/${s.id}`}
                style={{
                  fontSize: 13,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.title || '未命名会话'}
              </Link>
            ))}
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.6, padding: '0 10px' }}>
                暂无会话
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 'auto', padding: 10, fontSize: 13 }}>
          <div style={{ opacity: 0.8, marginBottom: 8 }}>
            {auth?.user.name ?? '未登录'}
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'inherit',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            退出
          </button>
        </div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--line)',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>
            当前组：默认组
          </span>
          <Link href="/admin" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            管理后台
          </Link>
        </header>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
