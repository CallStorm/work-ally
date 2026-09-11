'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
  entries: Array<{ principalType: string; principalId: string }>;
};

type Capabilities = {
  textToImage: boolean;
  imageToImage: boolean;
};

type ImageModel = {
  id: string;
  name: string;
  provider: 'openai_compatible' | 'gemini';
  baseUrl: string;
  modelName: string;
  capabilities: Capabilities;
  enabled: boolean;
  isDefault: boolean;
  apiKeySet: boolean;
};

type ModelForm = {
  name: string;
  provider: 'openai_compatible' | 'gemini';
  baseUrl: string;
  apiKey: string;
  modelName: string;
  textToImage: boolean;
  imageToImage: boolean;
  enabled: boolean;
  isDefault: boolean;
};

const emptyForm = (): ModelForm => ({
  name: '',
  provider: 'openai_compatible',
  baseUrl: '',
  apiKey: '',
  modelName: '',
  textToImage: true,
  imageToImage: true,
  enabled: true,
  isDefault: false,
});

function formFromModel(m: ImageModel): ModelForm {
  return {
    name: m.name,
    provider: m.provider,
    baseUrl: m.baseUrl,
    apiKey: '',
    modelName: m.modelName,
    textToImage: Boolean(m.capabilities?.textToImage),
    imageToImage: Boolean(m.capabilities?.imageToImage),
    enabled: m.enabled,
    isDefault: m.isDefault,
  };
}

const panelStyle = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: 20,
  display: 'grid' as const,
  gap: 16,
};

const fieldStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box' as const,
  background: '#fff',
};

const labelStyle = {
  display: 'grid' as const,
  gap: 6,
  fontSize: 13,
};

export default function AdminImageStudioPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<ImageModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ModelForm>(emptyForm);

  useEffect(() => {
    if (ready && auth?.user.role !== 'admin') {
      router.replace('/workbench');
    }
  }, [ready, auth, router]);

  async function refresh() {
    const [cfg, modelList] = await Promise.all([
      apiFetch<AppConfig>('/admin/apps/image-studio'),
      apiFetch<ImageModel[]>('/admin/apps/image-studio/models'),
    ]);
    setApp(cfg);
    setModels(modelList);
  }

  useEffect(() => {
    void refresh().catch(() => {
      setApp(null);
      setModels([]);
    });
  }, []);

  async function saveApp(patch: Partial<AppConfig>) {
    if (!app) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<AppConfig>('/admin/apps/image-studio', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setApp({ ...app, ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存应用配置失败');
    } finally {
      setSaving(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setForm(emptyForm());
    setMessage(null);
    setError(null);
  }

  function startEdit(m: ImageModel) {
    setCreating(false);
    setEditingId(m.id);
    setForm(formFromModel(m));
    setMessage(null);
    setError(null);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusyId(creating ? 'create' : editingId);
    try {
      const capabilities = {
        textToImage: form.textToImage,
        imageToImage: form.imageToImage,
      };
      if (creating) {
        if (!form.apiKey.trim()) {
          setError('请填写 API Key');
          return;
        }
        await apiFetch('/admin/apps/image-studio/models', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            provider: form.provider,
            baseUrl: form.baseUrl,
            apiKey: form.apiKey,
            modelName: form.modelName,
            capabilities,
            enabled: form.enabled,
            isDefault: form.isDefault,
          }),
        });
        setMessage('模型已创建');
      } else if (editingId) {
        const body: Record<string, unknown> = {
          name: form.name,
          provider: form.provider,
          baseUrl: form.baseUrl,
          modelName: form.modelName,
          capabilities,
          enabled: form.enabled,
          isDefault: form.isDefault,
        };
        if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
        await apiFetch(`/admin/apps/image-studio/models/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setMessage('模型已更新');
      }
      cancelForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存模型失败');
    } finally {
      setBusyId(null);
    }
  }

  async function removeModel(id: string) {
    if (!confirm('确定删除该图像模型？')) return;
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/admin/apps/image-studio/models/${id}`, {
        method: 'DELETE',
      });
      if (editingId === id) cancelForm();
      setMessage('模型已删除');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  async function setDefault(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/admin/apps/image-studio/models/${id}/default`, {
        method: 'POST',
      });
      setMessage('已设为默认模型');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '设默认失败');
    } finally {
      setBusyId(null);
    }
  }

  async function testModel(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/admin/apps/image-studio/models/${id}/test`,
        { method: 'POST' },
      );
      setMessage(res.message || '连接成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接测试失败');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnabled(m: ImageModel) {
    setBusyId(m.id);
    setError(null);
    try {
      await apiFetch(`/admin/apps/image-studio/models/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !m.enabled }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新启用状态失败');
    } finally {
      setBusyId(null);
    }
  }

  if (!app) {
    return (
      <main style={{ padding: 32 }}>
        <p>加载应用配置…</p>
      </main>
    );
  }

  const showForm = creating || editingId !== null;

  return (
    <main style={{ padding: 32, maxWidth: 820, display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>应用 · 图工作室</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          个人图像创作：项目库、文生图/图生图与版本回合。上架后成员可在工作台使用；图像模型独立于聊天模型配置。
        </p>
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
      {message && (
        <div
          style={{
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      <section style={panelStyle}>
        <h2 style={{ margin: 0, fontSize: 16 }}>上架与可见性</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            checked={app.enabled}
            onChange={(e) => void saveApp({ enabled: e.target.checked })}
          />
          上架（成员可见）
        </label>

        <label style={labelStyle}>
          可见范围
          <select
            value={app.visibility}
            onChange={(e) =>
              void saveApp({
                visibility: e.target.value,
              })
            }
            style={fieldStyle}
          >
            <option value="tenant">全公司</option>
            <option value="private">仅管理员</option>
            <option value="restricted">指定组/人（需在 ACL API 配置）</option>
          </select>
        </label>

        {saving && <p style={{ margin: 0, color: 'var(--muted)' }}>保存中…</p>}
      </section>

      <section style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>图像模型</h2>
          <button
            type="button"
            onClick={startCreate}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            添加模型
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          默认模型用于未指定模型时的生成。API Key 仅服务端保存，列表不回显明文。
        </p>

        {models.length === 0 && !showForm && (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            尚未配置图像模型，请添加一个 OpenAI 兼容端点。
          </p>
        )}

        {models.map((m) => (
          <div
            key={m.id}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 14,
              display: 'grid',
              gap: 10,
              opacity: m.enabled ? 1 : 0.7,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {m.name}
                  {m.isDefault && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--accent)',
                      }}
                    >
                      默认
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {m.provider} · {m.modelName}
                  <br />
                  {m.baseUrl}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {m.capabilities?.textToImage ? '文生图' : null}
                  {m.capabilities?.textToImage && m.capabilities?.imageToImage
                    ? ' · '
                    : null}
                  {m.capabilities?.imageToImage ? '图生图' : null}
                  {' · '}
                  API Key {m.apiKeySet ? '已配置' : '未配置'}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    disabled={busyId === m.id}
                    onChange={() => void toggleEnabled(m)}
                  />
                  启用
                </label>
                <button
                  type="button"
                  disabled={busyId === m.id || m.isDefault}
                  onClick={() => void setDefault(m.id)}
                  style={actionBtn}
                >
                  设默认
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => void testModel(m.id)}
                  style={actionBtn}
                >
                  测试
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => startEdit(m)}
                  style={actionBtn}
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => void removeModel(m.id)}
                  style={{ ...actionBtn, color: '#b91c1c' }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}

        {showForm && (
          <form onSubmit={submitForm} style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              {creating ? '新建模型' : '编辑模型'}
            </h3>
            <label style={labelStyle}>
              名称
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={fieldStyle}
                placeholder="例如 Flux / DALL·E"
              />
            </label>
            <label style={labelStyle}>
              Provider
              <select
                value={form.provider}
                onChange={(e) =>
                  setForm({
                    ...form,
                    provider: e.target.value as ModelForm['provider'],
                  })
                }
                style={fieldStyle}
              >
                <option value="openai_compatible">OpenAI Compatible</option>
                <option value="gemini">Gemini（暂未实现生成）</option>
              </select>
            </label>
            <label style={labelStyle}>
              Base URL
              <input
                required
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                style={fieldStyle}
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label style={labelStyle}>
              API Key{creating ? '' : '（留空则不修改）'}
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                style={fieldStyle}
                placeholder="sk-..."
                autoComplete="off"
                required={creating}
              />
            </label>
            <label style={labelStyle}>
              模型名
              <input
                required
                value={form.modelName}
                onChange={(e) =>
                  setForm({ ...form, modelName: e.target.value })
                }
                style={fieldStyle}
                placeholder="dall-e-3"
              />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={form.textToImage}
                  onChange={(e) =>
                    setForm({ ...form, textToImage: e.target.checked })
                  }
                />
                文生图
              </label>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={form.imageToImage}
                  onChange={(e) =>
                    setForm({ ...form, imageToImage: e.target.checked })
                  }
                />
                图生图
              </label>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                />
                启用
              </label>
              <label
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                />
                设为默认
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={busyId === 'create' || busyId === editingId}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {busyId === 'create' || busyId === editingId
                  ? '保存中…'
                  : '保存'}
              </button>
              <button type="button" onClick={cancelForm} style={actionBtn}>
                取消
              </button>
            </div>
          </form>
        )}
      </section>

      <p style={{ margin: 0 }}>
        <a
          href="/workbench/apps/image-studio"
          style={{ color: 'var(--accent)', fontWeight: 600 }}
        >
          打开图工作室 →
        </a>
      </p>
    </main>
  );
}

const actionBtn = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: '#fff',
  cursor: 'pointer' as const,
  fontSize: 13,
};
