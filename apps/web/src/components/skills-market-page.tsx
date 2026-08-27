'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import SkillUploadModal from '@/components/skill-upload-modal';
import WorkbenchAssetTabs from '@/components/workbench-asset-tabs';

type Skill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  descriptionShort: string;
  visibility: string;
  status: string;
  version: number;
};

type View = 'market' | 'installed';

export default function SkillsMarketPage({
  adminMode = false,
}: {
  adminMode?: boolean;
}) {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Skill[]>([]);
  const [view, setView] = useState<View>('market');
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setItems(await apiFetch<Skill[]>('/skills'));
  }

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    void refresh().catch((e) =>
      setError(e instanceof Error ? e.message : '加载失败'),
    );
  }, [auth]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (view === 'installed') {
      list = items.filter((s) => s.status === 'active' || s.status === 'disabled');
    } else {
      list = items.filter((s) => s.status === 'active');
    }
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.descriptionShort ?? '').toLowerCase().includes(q),
    );
  }, [items, query, view]);

  const installedCount = items.filter(
    (s) => s.status === 'active' || s.status === 'disabled',
  ).length;

  async function toggle(skill: Skill) {
    await apiFetch(`/skills/${skill.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: skill.status !== 'active' }),
    });
    await refresh();
  }

  if (!ready || !auth) return <main style={{ padding: 24 }}>加载中…</main>;

  return (
    <main style={{ padding: '24px 32px 40px', display: 'grid', gap: 20 }}>
      {!adminMode && <WorkbenchAssetTabs />}
      {view === 'installed' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => setView('market')}
            style={ghostBtn}
          >
            ← 全部技能
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {view === 'installed' ? (
            <>
              <h1 style={titleStyle}>我安装的</h1>
              <span style={badge}>{installedCount}</span>
            </>
          ) : (
            <h1 style={titleStyle}>{adminMode ? '技能管理' : '技能'}</h1>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              view === 'installed' ? '搜索已安装的技能' : '搜索技能'
            }
            style={searchStyle}
          />
          {view === 'market' && (
            <button
              type="button"
              onClick={() => setView('installed')}
              style={ghostBtn}
            >
              ✓ 我安装的 {installedCount}
            </button>
          )}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            style={primaryBtn}
          >
            + 添加技能
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#b42318' }}>{error}</div>}

      {view === 'market' && (
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>已上传技能</h2>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              Claude Code 规范 · zip 含 SKILL.md
            </span>
          </div>
          {filtered.length === 0 ? (
            <EmptyHint onUpload={() => setUploadOpen(true)} />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 14,
              }}
            >
              {filtered.map((skill) => (
                <SkillCard key={skill.id} skill={skill} adminMode={adminMode} />
              ))}
            </div>
          )}
        </section>
      )}

      {view === 'installed' && (
        <section style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
          {filtered.length === 0 ? (
            <EmptyHint onUpload={() => setUploadOpen(true)} />
          ) : (
            filtered.map((skill) => (
              <div
                key={skill.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <SkillIcon slug={skill.slug} />
                <div>
                  <div style={{ fontWeight: 700 }}>{skill.name}</div>
                  <div
                    style={{
                      color: 'var(--muted)',
                      fontSize: 13,
                      marginTop: 4,
                      lineHeight: 1.45,
                    }}
                  >
                    {skill.descriptionShort}
                  </div>
                </div>
                <Toggle
                  on={skill.status === 'active'}
                  onChange={() => void toggle(skill)}
                />
              </div>
            ))
          )}
        </section>
      )}

      <SkillUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          void refresh();
          setView('installed');
        }}
      />
    </main>
  );
}

function SkillCard({
  skill,
  adminMode: _adminMode,
}: {
  skill: Skill;
  adminMode: boolean;
}) {
  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: 16,
        display: 'grid',
        gap: 10,
        minHeight: 140,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <SkillIcon slug={skill.slug} />
          <div>
            <div style={{ fontWeight: 700 }}>{skill.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              {skill.slug} · v{skill.version} · 全公司
            </div>
          </div>
        </div>
      </div>
      <p
        style={{
          margin: 0,
          color: 'var(--muted)',
          fontSize: 13,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {skill.descriptionShort}
      </p>
    </article>
  );
}

function SkillIcon({ slug }: { slug: string }) {
  const hue =
    Math.abs(
      [...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    ) % 360;
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: `hsl(${hue} 55% 92%)`,
        color: `hsl(${hue} 45% 32%)`,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 14,
        flexShrink: 0,
      }}
    >
      {(slug[0] ?? 'S').toUpperCase()}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: 'none',
        background: on ? '#22c55e' : '#d1d5db',
        position: 'relative',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: '#fff',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}

function EmptyHint({ onUpload }: { onUpload: () => void }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px dashed var(--line)',
        borderRadius: 14,
        padding: 28,
        color: 'var(--muted)',
        textAlign: 'center',
      }}
    >
      暂无技能。上传符合 Claude Code 规范的 zip（内含 SKILL.md）。
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={onUpload} style={primaryBtn}>
          + 添加技能
        </button>
      </div>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Fraunces, Georgia, serif',
  fontSize: 28,
};

const badge: React.CSSProperties = {
  minWidth: 22,
  height: 22,
  borderRadius: 999,
  background: '#e8eef3',
  color: 'var(--muted)',
  fontSize: 12,
  display: 'grid',
  placeItems: 'center',
  padding: '0 6px',
};

const searchStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 999,
  padding: '8px 14px',
  minWidth: 200,
  background: '#fff',
  font: 'inherit',
};

const primaryBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '8px 14px',
  background: 'var(--ink)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 999,
  padding: '8px 12px',
  background: '#fff',
  cursor: 'pointer',
};
