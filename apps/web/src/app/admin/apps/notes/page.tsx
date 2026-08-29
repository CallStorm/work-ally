'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type AppConfig = {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  visibility: string;
  defaultModelConfigId: string | null;
  aiActionsEnabled: string[];
  entries: Array<{ principalType: string; principalId: string }>;
};

export default function AdminNotesPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && auth?.user.role !== 'admin') {
      router.replace('/workbench');
    }
  }, [ready, auth, router]);

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await apiFetch<AppConfig>('/admin/apps/notes');
        setApp(cfg);
      } catch {
        setApp(null);
      }
    })();
  }, []);

  async function save(patch: Partial<AppConfig>) {
    if (!app) return;
    setSaving(true);
    try {
      const updated = await apiFetch<AppConfig>('/admin/apps/notes', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setApp({ ...app, ...updated });
    } finally {
      setSaving(false);
    }
  }

  if (!app) {
    return (
      <main style={{ padding: 32 }}>
        <p>加载应用配置…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>应用 · 笔记</h1>
      <p style={{ color: 'var(--muted)' }}>
        个人工作笔记：分类树、Markdown 正文、库内搜索与 AI 改稿。上架后成员可在工作台使用。
      </p>

      <section
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 20,
          display: 'grid',
          gap: 16,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={app.enabled}
            onChange={(e) => void save({ enabled: e.target.checked })}
          />
          上架（成员可见）
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          可见范围
          <select
            value={app.visibility}
            onChange={(e) =>
              void save({
                visibility: e.target.value as AppConfig['visibility'],
              })
            }
          >
            <option value="tenant">全公司</option>
            <option value="private">仅管理员</option>
            <option value="restricted">指定组/人（需在 ACL API 配置）</option>
          </select>
        </label>

        {saving && <p style={{ margin: 0, color: 'var(--muted)' }}>保存中…</p>}
      </section>

      <p style={{ marginTop: 24 }}>
        <a href="/workbench/apps/notes" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          打开笔记 →
        </a>
      </p>
    </main>
  );
}
