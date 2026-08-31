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

type ModelRow = {
  id: string;
  modelId: string;
  displayName: string;
  enabled: boolean;
};

export default function AdminBazaarPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && auth?.user.role !== 'admin') {
      router.replace('/workbench');
    }
  }, [ready, auth, router]);

  useEffect(() => {
    void (async () => {
      try {
        const [cfg, modelList] = await Promise.all([
          apiFetch<AppConfig>('/admin/apps/bazaar'),
          apiFetch<ModelRow[]>('/admin/models'),
        ]);
        setApp(cfg);
        setModels(modelList);
      } catch {
        setApp(null);
        setModels([]);
      }
    })();
  }, []);

  async function save(patch: Partial<AppConfig>) {
    if (!app) return;
    setSaving(true);
    try {
      const updated = await apiFetch<AppConfig>('/admin/apps/bazaar', {
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
      <h1 style={{ marginTop: 0 }}>应用 · 创司集市</h1>
      <p style={{ color: 'var(--muted)' }}>
        一人一司的虚拟 AI 产品展会：摆摊、逛展、打星冲榜。上架后成员可在工作台使用。
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

        <label style={{ display: 'grid', gap: 6 }}>
          AI 润色模型
          <select
            value={app.defaultModelConfigId ?? ''}
            onChange={(e) =>
              void save({
                defaultModelConfigId: e.target.value || null,
              })
            }
          >
            <option value="">未绑定（产品润色将提示先配置模型）</option>
            {models
              .filter((m) => m.enabled)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          AI 润色使用此模型；未选择时产品润色会提示先绑定模型。
          {models.length === 0 && (
            <>
              {' '}
              <a href="/admin/models" style={{ color: 'var(--accent)' }}>
                前往配置模型 →
              </a>
            </>
          )}
        </p>

        {saving && <p style={{ margin: 0, color: 'var(--muted)' }}>保存中…</p>}
      </section>

      <p style={{ marginTop: 24 }}>
        <a href="/workbench/apps/bazaar" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          打开创司集市 →
        </a>
      </p>
    </main>
  );
}
