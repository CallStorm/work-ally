'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ExpertAvatar, ExpertFormDialog } from './expert-form-dialog';

type Expert = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  personaMd: string;
  visibility: string;
  status: string;
  ownerUserId: string;
  suggestedPrompts: string[];
  skillIds: string[];
  connectorIds: string[];
  knowledgeIds: string[];
};

type Named = { id: string; name: string; displayName?: string };

type Tab = 'enabled' | 'all';

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

export default function AdminExpertsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Expert[]>([]);
  const [skills, setSkills] = useState<Named[]>([]);
  const [connectors, setConnectors] = useState<Named[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('enabled');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expert | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const [expertList, skillList, connectorList] = await Promise.all([
      apiFetch<Expert[]>('/experts?all=1'),
      apiFetch<Named[]>('/skills'),
      apiFetch<Named[]>('/connectors'),
    ]);
    setItems(expertList);
    setSkills(skillList);
    setConnectors(connectorList);
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
      list = list.filter((e) => e.status === 'active');
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q) ||
        e.personaMd.toLowerCase().includes(q),
    );
  }, [items, tab, search]);

  const enabledCount = items.filter((e) => e.status === 'active').length;

  async function toggleStatus(expert: Expert) {
    setBusyId(expert.id);
    setError(null);
    try {
      await apiFetch(`/experts/${expert.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: expert.status === 'active' ? 'disabled' : 'active',
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setBusyId(null);
    }
  }

  async function shareTenant(id: string) {
    setMenuId(null);
    try {
      await apiFetch(`/resources/experts/${id}/acl`, {
        method: 'PUT',
        body: JSON.stringify({ visibility: 'tenant', entries: [] }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分享失败');
    }
  }

  async function removeExpert(expert: Expert) {
    if (
      !confirm(
        `确定删除专家「${expert.name}」？删除后不可恢复，已有会话将保留但不再关联该专家。`,
      )
    ) {
      return;
    }
    setMenuId(null);
    setBusyId(expert.id);
    try {
      await apiFetch(`/experts/${expert.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(expert: Expert) {
    setMenuId(null);
    setEditing(expert);
    setDialogOpen(true);
  }

  if (!ready || !auth) {
    return <main style={{ padding: 32, color: '#64748b' }}>加载中…</main>;
  }

  return (
    <main
      style={{
        padding: '28px 32px 48px',
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gap: 20,
      }}
      onClick={() => setMenuId(null)}
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
        <div style={{ maxWidth: 560 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#0f172a',
            }}
          >
            专家
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#64748b',
            }}
          >
            配置技能与 MCP，打造可复用的 AI 专家。启用后可在首页、工作台会话中使用。
          </p>
        </div>
        <button type="button" style={primaryBtn} onClick={openCreate}>
          创建专家
        </button>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          placeholder="按名称或描述搜索专家"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            fontSize: 14,
            maxWidth: 320,
            flex: '1 1 240px',
            background: '#fff',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 20,
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 0,
        }}
      >
        <TabButton
          active={tab === 'enabled'}
          label="已启用"
          count={enabledCount}
          onClick={() => setTab('enabled')}
        />
        <TabButton
          active={tab === 'all'}
          label="全部专家"
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
          {items.length === 0
            ? '还没有专家，点击「创建专家」开始配置。'
            : '没有匹配的专家。'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map((expert) => (
            <ExpertCard
              key={expert.id}
              expert={expert}
              busy={busyId === expert.id}
              menuOpen={menuId === expert.id}
              onToggleMenu={() =>
                setMenuId((id) => (id === expert.id ? null : expert.id))
              }
              onToggle={() => void toggleStatus(expert)}
              onEdit={() => openEdit(expert)}
              onShare={() => void shareTenant(expert.id)}
              onDelete={() => void removeExpert(expert)}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <ExpertFormDialog
          editing={editing}
          skills={skills}
          connectors={connectors}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setDialogOpen(false);
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </main>
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

function ExpertCard({
  expert,
  busy,
  menuOpen,
  onToggleMenu,
  onToggle,
  onEdit,
  onShare,
  onDelete,
}: {
  expert: Expert;
  busy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const active = expert.status === 'active';
  const skillCount = expert.skillIds?.length ?? 0;
  const mcpCount = expert.connectorIds?.length ?? 0;

  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: 16,
        display: 'grid',
        gap: 12,
        boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
        opacity: active ? 1 : 0.72,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <ExpertAvatar name={expert.name} avatarUrl={expert.avatarUrl} />
        <Toggle checked={active} disabled={busy} onChange={onToggle} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 650,
              color: '#0f172a',
            }}
          >
            {expert.name}
          </h3>
          <span
            style={{
              fontSize: 11,
              background: '#f1f5f9',
              color: '#64748b',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            {expert.visibility === 'tenant' ? '全公司' : '自定义'}
          </span>
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 13,
            lineHeight: 1.55,
            color: '#64748b',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {expert.description ||
            expert.personaMd.slice(0, 120) ||
            '暂无描述'}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid #f1f5f9',
          fontSize: 12,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Agent:</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 999,
              padding: '2px 8px',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            π Pi
          </span>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <span>
            技能 {skillCount} · MCP {mcpCount}
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="更多操作"
            onClick={onToggleMenu}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 4,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                minWidth: 120,
                zIndex: 10,
                overflow: 'hidden',
              }}
            >
              <MenuItem onClick={onEdit}>编辑</MenuItem>
              <MenuItem onClick={onShare}>分享到全公司</MenuItem>
              <MenuItem onClick={onDelete} danger>
                删除
              </MenuItem>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: '#fff',
        padding: '10px 14px',
        fontSize: 13,
        cursor: 'pointer',
        color: danger ? '#b91c1c' : '#0f172a',
      }}
    >
      {children}
    </button>
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
