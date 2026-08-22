'use client';

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Connector = {
  id: string;
  name: string;
  description: string | null;
  mcpInstructions: string | null;
  mcpServerName: string | null;
  mcpServerVersion: string | null;
  mcpSyncedAt: string | null;
  displayDescription: string;
  descriptionSource: 'manual' | 'mcp' | 'none';
  transport: string;
  endpointUrl: string;
  visibility: string;
  healthStatus: string;
  status: string;
};

type McpToolInfo = {
  name: string;
  description: string;
  runtimeName: string;
};

type ToolsDialogState = {
  connector: Connector;
  loading: boolean;
  ok: boolean;
  message: string;
  tools: McpToolInfo[];
  instructions?: string;
  serverName?: string;
  serverVersion?: string;
};

type Tab = 'enabled' | 'all';

export default function AdminConnectorsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Connector[]>([]);
  const [tab, setTab] = useState<Tab>('enabled');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('https://example.com/mcp');
  const [transport, setTransport] = useState<'sse' | 'streamable_http'>(
    'streamable_http',
  );
  const [credentials, setCredentials] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Connector | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolsDialog, setToolsDialog] = useState<ToolsDialogState | null>(null);

  async function refresh() {
    setItems(await apiFetch<Connector[]>('/connectors?all=1'));
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

  const filtered = useMemo(() => {
    let list = items;
    if (tab === 'enabled') {
      list = list.filter((c) => c.status === 'active');
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.displayDescription.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q) ||
        (c.mcpInstructions ?? '').toLowerCase().includes(q) ||
        c.endpointUrl.toLowerCase().includes(q) ||
        c.transport.toLowerCase().includes(q),
    );
  }, [items, tab, search]);

  const enabledCount = items.filter((c) => c.status === 'active').length;

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/connectors', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
          transport,
          endpointUrl,
          credentials: credentials || undefined,
          visibility: 'tenant',
        }),
      });
      setName('');
      setDescription('');
      setCredentials('');
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusyId(editing.id);
    try {
      await apiFetch(`/connectors/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editing.name,
          description: editing.description?.trim() || '',
          transport: editing.transport,
          endpointUrl: editing.endpointUrl,
        }),
      });
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(connector: Connector) {
    setBusyId(connector.id);
    setError(null);
    try {
      await apiFetch(`/connectors/${connector.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: connector.status !== 'active' }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setBusyId(null);
    }
  }

  async function removeConnector(id: string) {
    if (!confirm('确定删除该 MCP 连接器？删除后不可恢复。')) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/connectors/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  async function openTools(connector: Connector) {
    setToolsDialog({
      connector,
      loading: true,
      ok: false,
      message: '正在连接 MCP…',
      tools: [],
    });
    setError(null);
    try {
      const result = await apiFetch<{
        ok: boolean;
        message: string;
        tools: McpToolInfo[];
        instructions?: string;
        serverName?: string;
        serverVersion?: string;
      }>(`/connectors/${connector.id}/tools`);
      await refresh();
      setToolsDialog({
        connector,
        loading: false,
        ok: result.ok,
        message: result.message,
        tools: result.tools ?? [],
        instructions: result.instructions,
        serverName: result.serverName,
        serverVersion: result.serverVersion,
      });
    } catch (err) {
      setToolsDialog({
        connector,
        loading: false,
        ok: false,
        message: err instanceof Error ? err.message : '加载失败',
        tools: [],
      });
    }
  }

  async function test(connector: Connector) {
    setBusyId(connector.id);
    setError(null);
    try {
      const result = await apiFetch<{
        ok: boolean;
        message: string;
        tools?: McpToolInfo[];
        instructions?: string;
        serverName?: string;
        serverVersion?: string;
      }>(`/connectors/${connector.id}/test`, { method: 'POST' });
      await refresh();
      setToolsDialog({
        connector,
        loading: false,
        ok: result.ok,
        message: result.message,
        tools: result.tools ?? [],
        instructions: result.instructions,
        serverName: result.serverName,
        serverVersion: result.serverVersion,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试失败');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready || !auth) return <main style={{ padding: 24 }}>加载中…</main>;

  return (
    <main
      style={{
        padding: '28px 32px 48px',
        maxWidth: 960,
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
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#0f172a' }}>
            MCP
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: '#64748b' }}>
            组织统一授权的远程 MCP 连接器。凭据加密存储，禁用后不会在运行时加载。
          </p>
        </div>
        <button type="button" style={primaryBtn} onClick={() => setShowCreate(true)}>
          添加 MCP
        </button>
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="搜索 MCP 名称、描述或地址"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...field, maxWidth: 320, flex: '1 1 240px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid #e2e8f0' }}>
        <TabButton
          active={tab === 'enabled'}
          label="已启用"
          count={enabledCount}
          onClick={() => setTab('enabled')}
        />
        <TabButton
          active={tab === 'all'}
          label="全部"
          count={items.length}
          onClick={() => setTab('all')}
        />
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

      {filtered.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #e2e8f0',
            borderRadius: 14,
            padding: 40,
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          {items.length === 0 ? '还没有 MCP 连接器' : '没有匹配的连接器'}
        </div>
      ) : (
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          {filtered.map((item, index) => {
            const active = item.status === 'active';
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '16px 18px',
                  borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
                  opacity: active ? 1 : 0.65,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong style={{ fontSize: 15 }}>{item.name}</strong>
                    <span style={chipStyle}>{item.transport}</span>
                    <span style={chipStyle}>{item.visibility}</span>
                    <HealthBadge status={item.healthStatus} />
                    {!active && (
                      <span
                        style={{
                          ...chipStyle,
                          background: '#fef2f2',
                          color: '#b91c1c',
                        }}
                      >
                        已禁用
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: '#475569',
                      lineHeight: 1.55,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.displayDescription || '暂无描述（请测试连接以同步 MCP instructions）'}
                  </div>
                  {item.descriptionSource !== 'none' && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
                      来源：
                      {item.descriptionSource === 'manual'
                        ? '管理员覆盖'
                        : 'MCP initialize.instructions'}
                      {item.mcpServerName
                        ? ` · ${item.mcpServerName}${item.mcpServerVersion ? ` v${item.mcpServerVersion}` : ''}`
                        : ''}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: '#94a3b8',
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.endpointUrl}
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
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setEditing(item)}
                    style={outlineBtn}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void openTools(item)}
                    style={outlineBtn}
                  >
                    工具
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void test(item)}
                    style={outlineBtn}
                  >
                    {busyId === item.id ? '测试中…' : '测试连接'}
                  </button>
                  <Toggle
                    checked={active}
                    disabled={busyId === item.id}
                    onChange={() => void toggleStatus(item)}
                  />
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void removeConnector(item.id)}
                    style={dangerBtn}
                    aria-label="删除"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {toolsDialog && (
        <ToolsDialog
          state={toolsDialog}
          onClose={() => setToolsDialog(null)}
          onRefresh={() => void openTools(toolsDialog.connector)}
        />
      )}

      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={onCreate}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: 22,
              display: 'grid',
              gap: 12,
              boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>添加 MCP</h2>
            <input
              required
              placeholder="名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={field}
            />
            <textarea
              placeholder="展示说明（可选，覆盖 MCP initialize.instructions）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <select
              value={transport}
              onChange={(e) =>
                setTransport(e.target.value as 'sse' | 'streamable_http')
              }
              style={field}
            >
              <option value="streamable_http">streamable_http</option>
              <option value="sse">sse</option>
            </select>
            <input
              required
              placeholder="Endpoint URL"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              style={field}
            />
            <input
              placeholder="凭据（可选，明文仅提交一次）"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              style={field}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} style={outlineBtn}>
                取消
              </button>
              <button type="submit" style={primaryBtn}>
                创建
              </button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={onSaveEdit}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: 22,
              display: 'grid',
              gap: 12,
              boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>编辑 MCP</h2>
            <input
              required
              placeholder="名称"
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
              style={field}
            />
            <textarea
              placeholder="展示说明（可选，覆盖 MCP initialize.instructions）"
              value={editing.description ?? ''}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
              rows={4}
              style={{ ...field, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <select
              value={editing.transport}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  transport: e.target.value,
                })
              }
              style={field}
            >
              <option value="streamable_http">streamable_http</option>
              <option value="sse">sse</option>
            </select>
            <input
              required
              placeholder="Endpoint URL"
              value={editing.endpointUrl}
              onChange={(e) =>
                setEditing({ ...editing, endpointUrl: e.target.value })
              }
              style={field}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setEditing(null)}
                style={outlineBtn}
              >
                取消
              </button>
              <button type="submit" style={primaryBtn}>
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function ToolsDialog({
  state,
  onClose,
  onRefresh,
}: {
  state: ToolsDialogState;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { connector, loading, ok, message, tools, instructions, serverName, serverVersion } =
    state;
  const mcpInstructions =
    instructions?.trim() ||
    connector.mcpInstructions?.trim() ||
    connector.displayDescription;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.4)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '80vh',
          background: '#fff',
          borderRadius: 16,
          padding: 22,
          display: 'grid',
          gap: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {connector.name} · MCP 工具
            </h2>
            {connector.description?.trim() &&
              connector.descriptionSource === 'manual' && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    color: '#94a3b8',
                  }}
                >
                  当前列表展示的是管理员覆盖说明；下方为 MCP 原文。
                </p>
              )}
            {(serverName || connector.mcpServerName) && (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  color: '#94a3b8',
                }}
              >
                MCP 服务：{serverName || connector.mcpServerName}
                {(serverVersion || connector.mcpServerVersion)
                  ? ` v${serverVersion || connector.mcpServerVersion}`
                  : ''}
              </p>
            )}
            {mcpInstructions && (
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 13,
                  color: '#475569',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {mcpInstructions}
              </p>
            )}
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
                color: '#94a3b8',
                wordBreak: 'break-all',
              }}
            >
              {connector.endpointUrl}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 13,
            background: loading ? '#f8fafc' : ok ? '#ecfdf5' : '#fef2f2',
            color: loading ? '#64748b' : ok ? '#047857' : '#b91c1c',
            border: `1px solid ${loading ? '#e2e8f0' : ok ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {loading ? '正在连接并拉取工具列表…' : message}
        </div>

        {!loading && ok && tools.length === 0 && (
          <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: 20 }}>
            已连接，但该 MCP 未暴露任何工具。
          </div>
        )}

        {!loading && tools.length > 0 && (
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              overflow: 'auto',
              maxHeight: '50vh',
            }}
          >
            {tools.map((tool, index) => (
              <div
                key={`${tool.name}-${index}`}
                style={{
                  padding: '12px 14px',
                  borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
                }}
              >
                <div style={{ fontWeight: 650, fontSize: 14, color: '#0f172a' }}>
                  {tool.name}
                </div>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 13,
                    color: tool.description?.trim() ? '#475569' : '#94a3b8',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {tool.description?.trim() || '该工具暂无描述'}
                </p>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: '#94a3b8',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  运行时: {tool.runtimeName}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onRefresh} disabled={loading} style={outlineBtn}>
            刷新
          </button>
          <button type="button" onClick={onClose} style={primaryBtn}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        padding: '10px 2px 12px',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 650 : 500,
        color: active ? '#0f172a' : '#64748b',
        borderBottom: active ? '2px solid #0f172a' : '2px solid transparent',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 12,
          background: active ? '#e2e8f0' : '#f1f5f9',
          color: '#64748b',
          borderRadius: 999,
          padding: '1px 8px',
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function HealthBadge({ status }: { status: string }) {
  const ok = status === 'ok';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        padding: '2px 8px',
        background: ok ? '#ecfdf5' : '#f1f5f9',
        color: ok ? '#047857' : '#64748b',
      }}
    >
      {ok ? '健康' : status === 'error' ? '异常' : '未检测'}
    </span>
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
      title={checked ? '点击禁用' : '点击启用'}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        padding: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#3b82f6' : '#cbd5e1',
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
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

const field: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
};

const primaryBtn: CSSProperties = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#334155',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

const outlineBtn: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#334155',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const dangerBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid #fecaca',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 16,
};

const chipStyle: CSSProperties = {
  fontSize: 11,
  background: '#f1f5f9',
  color: '#64748b',
  borderRadius: 999,
  padding: '2px 8px',
};
