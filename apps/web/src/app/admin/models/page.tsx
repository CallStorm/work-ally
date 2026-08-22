'use client';

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Preset = {
  id: 'minimax' | 'anthropic';
  name: string;
  baseUrl: string;
};

type ProviderRow = {
  id: string;
  preset: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  apiKeySet: boolean;
  modelCount: number;
};

type ModelRow = {
  id: string;
  modelId: string;
  displayName: string;
  enabled: boolean;
  providerId: string | null;
  provider?: { id: string; name: string; preset: string } | null;
};

type Candidate = { modelId: string; displayName: string };

const VENDORS: Array<{ id: Preset['id']; label: string }> = [
  { id: 'minimax', label: 'MiniMax' },
  { id: 'anthropic', label: 'Anthropic' },
];

const iconBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
  display: 'inline-grid',
  placeItems: 'center',
  fontSize: 15,
};

const field: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#64748b',
};

export default function AdminModelsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProviderId, setDialogProviderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const [presetList, providerList, modelList] = await Promise.all([
      apiFetch<Preset[]>('/admin/llm-presets'),
      apiFetch<ProviderRow[]>('/admin/llm-providers'),
      apiFetch<ModelRow[]>('/admin/models'),
    ]);
    setPresets(presetList);
    setProviders(providerList);
    setModels(modelList);
    setExpanded((prev) => {
      const next = { ...prev };
      for (const row of providerList) {
        if (next[row.id] === undefined) next[row.id] = true;
      }
      return next;
    });
  }

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    if (auth.user.role !== 'owner' && auth.user.role !== 'admin') {
      router.replace('/workbench');
      return;
    }
    void refresh().catch((e) => setError(e.message));
  }, [auth, router]);

  const groups = useMemo(
    () =>
      providers.map((provider) => ({
        provider,
        models: models.filter((m) => m.providerId === provider.id),
      })),
    [providers, models],
  );

  function clearStatus() {
    setError(null);
    setBusyId(null);
    setExpanded(Object.fromEntries(providers.map((p) => [p.id, true])));
  }

  async function toggleProvider(row: ProviderRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`/admin/llm-providers/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新供应商失败');
    } finally {
      setBusyId(null);
    }
  }

  async function removeProvider(id: string) {
    if (!confirm('删除该供应商会同时删除其下所有模型，确认？')) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/admin/llm-providers/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除供应商失败');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleModel(row: ModelRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`/admin/models/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !row.enabled }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新模型失败');
    } finally {
      setBusyId(null);
    }
  }

  async function removeModel(id: string) {
    if (!confirm('确定删除该模型？')) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/admin/models/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  function openAddDialog(providerId: string | null = null) {
    setDialogProviderId(providerId);
    setDialogOpen(true);
  }

  if (!ready || !auth) {
    return <main style={{ padding: 32, color: '#64748b' }}>加载中…</main>;
  }

  return (
    <main
      style={{
        padding: '28px 32px 48px',
        maxWidth: 980,
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
        <div style={{ maxWidth: 640 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#0f172a',
            }}
          >
            模型
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#64748b',
            }}
          >
            配置大模型服务商与 API Key，供工作台与助手使用。协议暂仅支持
            Anthropic Messages（含 MiniMax 兼容端点）。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={clearStatus}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 14,
              padding: '8px 10px',
            }}
          >
            清除状态
          </button>
          <button
            type="button"
            onClick={() => openAddDialog(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#334155',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15,23,42,0.12)',
            }}
          >
            添加模型
            <span style={{ opacity: 0.8, fontSize: 12 }}>▾</span>
          </button>
        </div>
      </header>

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

      {groups.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 40,
            textAlign: 'center',
            color: '#64748b',
            fontSize: 14,
          }}
        >
          还没有模型。点击右上角「添加模型」开始配置。
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {groups.map(({ provider, models: groupModels }) => {
            const open = expanded[provider.id] !== false;
            return (
              <section
                key={provider.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderBottom: open ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [provider.id]: !open }))
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 15,
                      fontWeight: 650,
                      color: '#0f172a',
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>
                      {open ? '▾' : '▸'}
                    </span>
                    {provider.name}
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: '#64748b',
                      fontSize: 13,
                    }}
                  >
                    <span>模型 ({groupModels.length})</span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span>API Key ({provider.apiKeySet ? 1 : 0})</span>
                    <Toggle
                      checked={provider.enabled}
                      disabled={busyId === provider.id}
                      onChange={() => void toggleProvider(provider)}
                    />
                    <button
                      type="button"
                      title="添加模型到此供应商"
                      style={iconBtn}
                      onClick={() => openAddDialog(provider.id)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      title="删除供应商"
                      aria-label="删除供应商"
                      style={{ ...iconBtn, color: '#b91c1c' }}
                      disabled={busyId === provider.id}
                      onClick={() => void removeProvider(provider.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {open && (
                  <div>
                    {groupModels.length === 0 ? (
                      <div
                        style={{
                          padding: '18px 16px',
                          color: '#94a3b8',
                          fontSize: 13,
                        }}
                      >
                        暂无模型，点击 + 添加
                      </div>
                    ) : (
                      groupModels.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '12px 16px 12px 28px',
                            borderTop: '1px solid #f8fafc',
                            opacity: provider.enabled ? 1 : 0.55,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: item.enabled ? '#22c55e' : '#cbd5e1',
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 560,
                                  color: '#0f172a',
                                }}
                              >
                                {item.displayName}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#94a3b8',
                                  marginTop: 2,
                                  wordBreak: 'break-all',
                                }}
                              >
                                {item.modelId}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: '#64748b',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 999,
                                padding: '3px 8px',
                              }}
                            >
                              API · {provider.preset}
                            </span>
                            <Toggle
                              checked={item.enabled}
                              disabled={
                                busyId === item.id || !provider.enabled
                              }
                              onChange={() => void toggleModel(item)}
                            />
                            <button
                              type="button"
                              title="删除模型"
                              style={iconBtn}
                              onClick={() => void removeModel(item.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <AddModelDialog
          presets={presets}
          providers={providers}
          existingProviderId={dialogProviderId}
          onClose={() => {
            setDialogOpen(false);
            setDialogProviderId(null);
          }}
          onSaved={async () => {
            setDialogOpen(false);
            setDialogProviderId(null);
            await refresh();
          }}
        />
      )}
    </main>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#3b82f6' : '#cbd5e1',
        transition: 'background 120ms ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          display: 'block',
          width: 18,
          height: 18,
          borderRadius: 999,
          background: '#fff',
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 120ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

function AddModelDialog({
  presets,
  providers,
  existingProviderId,
  onClose,
  onSaved,
}: {
  presets: Preset[];
  providers: ProviderRow[];
  existingProviderId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const existing =
    providers.find((p) => p.id === existingProviderId) ?? null;
  const [vendor, setVendor] = useState<'minimax' | 'anthropic'>(
    (existing?.preset as 'minimax' | 'anthropic') || 'minimax',
  );
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl || '');
  const [apiKey, setApiKey] = useState('');
  const [protocol] = useState<'anthropic'>('anthropic');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [listSource, setListSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = useMemo(
    () => presets.find((p) => p.id === vendor),
    [presets, vendor],
  );

  useEffect(() => {
    if (existing) {
      setVendor(existing.preset as 'minimax' | 'anthropic');
      setBaseUrl(existing.baseUrl);
      return;
    }
    const p = presets.find((x) => x.id === vendor);
    if (p) setBaseUrl(p.baseUrl);
  }, [vendor, presets, existing]);

  async function refreshModels() {
    setError(null);
    setBusy(true);
    try {
      if (existing) {
        const res = await apiFetch<{
          source: string;
          models: Candidate[];
          error: string | null;
        }>(`/admin/llm-providers/${existing.id}/sync-models`, {
          method: 'POST',
        });
        setCandidates(res.models);
        setListSource(res.source);
        setSelected(
          Object.fromEntries(res.models.map((m) => [m.modelId, true])),
        );
        if (res.error) setError(`拉取失败，已用预制列表：${res.error}`);
      } else {
        if (!apiKey.trim()) {
          setError('请先填写 API Key');
          setBusy(false);
          return;
        }
        const res = await apiFetch<{
          source: string;
          models: Candidate[];
          error: string | null;
        }>('/admin/llm-providers/preview-models', {
          method: 'POST',
          body: JSON.stringify({
            preset: vendor,
            baseUrl: baseUrl || preset?.baseUrl,
            apiKey,
            protocol,
          }),
        });
        setCandidates(res.models);
        setListSource(res.source);
        setSelected(
          Object.fromEntries(res.models.map((m) => [m.modelId, true])),
        );
        if (res.error) setError(`拉取失败，已用预制列表：${res.error}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新模型失败');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const picked = candidates.filter((c) => selected[c.modelId]);
    if (!picked.length) {
      setError('请先刷新并勾选至少一个模型');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await apiFetch(`/admin/llm-providers/${existing.id}/models`, {
          method: 'POST',
          body: JSON.stringify({ models: picked }),
        });
      } else {
        await apiFetch('/admin/llm-providers/with-models', {
          method: 'POST',
          body: JSON.stringify({
            preset: vendor,
            name: preset?.name || vendor,
            baseUrl: baseUrl || preset?.baseUrl,
            apiKey,
            protocol,
            models: picked,
          }),
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 16,
          padding: 22,
          boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
          display: 'grid',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            {existing ? `向 ${existing.name} 添加模型` : '添加模型'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              cursor: 'pointer',
              color: '#94a3b8',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {!existing && (
          <>
            <label style={labelStyle}>
              供应商
              <select
                value={vendor}
                onChange={(e) =>
                  setVendor(e.target.value as 'minimax' | 'anthropic')
                }
                style={field}
              >
                {VENDORS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              API
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://..."
                style={field}
                required
              />
            </label>

            <label style={labelStyle}>
              API Key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={field}
                required
                autoComplete="off"
              />
            </label>
          </>
        )}

        <label style={labelStyle}>
          请求协议
          <select value={protocol} disabled style={{ ...field, opacity: 0.85 }}>
            <option value="anthropic">Anthropic Messages</option>
          </select>
        </label>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <strong style={{ fontSize: 14, color: '#0f172a' }}>模型列表</strong>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshModels()}
            style={{
              ...field,
              width: 'auto',
              cursor: 'pointer',
              background: '#f8fafc',
            }}
          >
            {busy ? '刷新中…' : '刷新模型列表'}
          </button>
        </div>

        {listSource && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            来源：{listSource === 'remote' ? '远端' : '预制兜底'}
          </div>
        )}

        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            maxHeight: 220,
            overflow: 'auto',
            padding: candidates.length ? 8 : 16,
            background: '#fcfcfd',
          }}
        >
          {candidates.length === 0 ? (
            <div
              style={{
                color: '#94a3b8',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              {existing
                ? '点击「刷新模型列表」拉取可选模型'
                : '填写密钥后点击「刷新模型列表」'}
            </div>
          ) : (
            candidates.map((c) => (
              <label
                key={c.modelId}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '8px 6px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(selected[c.modelId])}
                  onChange={(e) =>
                    setSelected((s) => ({
                      ...s,
                      [c.modelId]: e.target.checked,
                    }))
                  }
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 14 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>
                    {c.displayName}
                  </div>
                  <code style={{ fontSize: 12, color: '#94a3b8' }}>
                    {c.modelId}
                  </code>
                </span>
              </label>
            ))
          )}
        </div>

        {error && (
          <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#334155',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
