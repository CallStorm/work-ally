'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ExpertAvatar } from '@/app/admin/experts/expert-form-dialog';
import ConnectorIcon from '@/components/connector-icon';

type ExpertItem = {
  id: string;
  name: string;
  avatarUrl: string | null;
  skillIds?: string[];
  connectorIds?: string[];
};

type SkillItem = {
  id: string;
  name: string;
  slug: string;
  descriptionShort?: string;
  status: string;
};

type ConnectorItem = {
  id: string;
  name: string;
  status: string;
};

type MenuKey = 'file' | 'expert' | 'skill' | 'connector';

function HammerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5L20 7"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function skillLetterColor(name: string) {
  const hue =
    Math.abs([...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 360;
  return `hsl(${hue} 62% 88%)`;
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 36,
        height: 22,
        borderRadius: 999,
        border: 'none',
        background: on ? 'var(--accent)' : '#cbd5e1',
        padding: 2,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

const MENU_ITEMS: { key: MenuKey; label: string; icon: ReactNode }[] = [
  {
    key: 'file',
    label: '添加文件',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: 'expert',
    label: '专家',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: 'skill',
    label: '技能',
    icon: <HammerIcon size={18} />,
  },
  {
    key: 'connector',
    label: '连接器',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function ComposerAddons({
  experts,
  skills,
  connectors,
  expertId,
  skillIds,
  connectorIds,
  onExpertChange,
  onSkillIdsChange,
  onConnectorIdsChange,
  loading,
  children,
  footer,
}: {
  experts: ExpertItem[];
  skills: SkillItem[];
  connectors: ConnectorItem[];
  expertId: string | null;
  skillIds: string[];
  connectorIds: string[];
  onExpertChange: (id: string | null) => void;
  onSkillIdsChange: (ids: string[]) => void;
  onConnectorIdsChange: (ids: string[]) => void;
  loading?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedExpert = useMemo(
    () => experts.find((e) => e.id === expertId) ?? null,
    [experts, expertId],
  );

  const activeSkills = useMemo(
    () => skills.filter((s) => s.status === 'active'),
    [skills],
  );

  const activeConnectors = useMemo(
    () => connectors.filter((c) => c.status === 'active'),
    [connectors],
  );

  const selectedSkills = useMemo(
    () => activeSkills.filter((s) => skillIds.includes(s.id)),
    [activeSkills, skillIds],
  );

  const selectedConnectors = useMemo(
    () => activeConnectors.filter((c) => connectorIds.includes(c.id)),
    [activeConnectors, connectorIds],
  );

  const filteredExperts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return experts;
    return experts.filter((e) => e.name.toLowerCase().includes(q));
  }, [experts, search]);

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSkills;
    return activeSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.descriptionShort ?? '').toLowerCase().includes(q),
    );
  }, [activeSkills, search]);

  const filteredConnectors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeConnectors;
    return activeConnectors.filter((c) =>
      c.name.toLowerCase().includes(q),
    );
  }, [activeConnectors, search]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setActiveMenu(null);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  function openMenu(key: MenuKey) {
    setMenuOpen(true);
    setActiveMenu(key);
    setSearch('');
  }

  function pickExpert(id: string) {
    const expert = experts.find((e) => e.id === id);
    onExpertChange(id);
    if (expert) {
      onSkillIdsChange(expert.skillIds ?? []);
      onConnectorIdsChange(expert.connectorIds ?? []);
    }
    setMenuOpen(false);
    setActiveMenu(null);
  }

  function toggleSkill(id: string) {
    onSkillIdsChange(
      skillIds.includes(id)
        ? skillIds.filter((x) => x !== id)
        : [...skillIds, id],
    );
    setMenuOpen(false);
    setActiveMenu(null);
  }

  function toggleConnector(id: string) {
    onConnectorIdsChange(
      connectorIds.includes(id)
        ? connectorIds.filter((x) => x !== id)
        : [...connectorIds, id],
    );
  }

  function removeSkill(id: string) {
    onSkillIdsChange(skillIds.filter((x) => x !== id));
  }

  function removeExpert() {
    onExpertChange(null);
  }

  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#f1f5f9',
    borderRadius: 999,
    padding: '5px 10px 5px 8px',
    fontSize: 13,
    color: '#334155',
    maxWidth: 220,
  };

  return (
    <div ref={rootRef} style={{ width: '100%', minWidth: 0 }}>
      {selectedSkills.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 10,
          }}
        >
          {selectedSkills.map((skill) => (
            <span key={skill.id} style={chipStyle}>
              <HammerIcon size={14} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {skill.name}
              </span>
              <button
                type="button"
                aria-label={`移除技能 ${skill.name}`}
                onClick={() => removeSkill(skill.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 0,
                  lineHeight: 1,
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {children}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 8,
          minHeight: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              title={menuOpen ? '关闭' : '添加'}
              onClick={() => {
                if (menuOpen) {
                  setMenuOpen(false);
                  setActiveMenu(null);
                  setSearch('');
                } else {
                  setMenuOpen(true);
                  setActiveMenu(null);
                }
              }}
              disabled={loading}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: '1px solid var(--line)',
                background: menuOpen ? '#f1f5f9' : '#fff',
                cursor: loading ? 'default' : 'pointer',
                fontSize: menuOpen ? 16 : 18,
                color: '#334155',
                display: 'grid',
                placeItems: 'center',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {menuOpen ? '×' : '+'}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 'calc(100% + 8px)',
                  display: 'flex',
                  gap: 0,
                  zIndex: 40,
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: 6,
                    minWidth: 200,
                    boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
                  }}
                >
                  {MENU_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.key === 'file') return;
                        openMenu(item.key);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        border: 'none',
                        borderRadius: 10,
                        background:
                          activeMenu === item.key ? '#f1f5f9' : 'transparent',
                        cursor: item.key === 'file' ? 'default' : 'pointer',
                        fontSize: 14,
                        color: item.key === 'file' ? '#94a3b8' : '#0f172a',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'grid', placeItems: 'center' }}>
                        {item.icon}
                      </span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.key !== 'file' && (
                        <span style={{ color: '#94a3b8' }}>
                          <ChevronRight />
                        </span>
                      )}
                      {item.key === 'file' && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          即将推出
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {activeMenu === 'expert' && (
                  <SubPanel title="专家" width={280}>
                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                      {filteredExperts.length === 0 && (
                        <div
                          style={{
                            padding: 16,
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          暂无可用专家
                        </div>
                      )}
                      {filteredExperts.map((expert) => {
                        const selected = expertId === expert.id;
                        return (
                          <button
                            key={expert.id}
                            type="button"
                            onClick={() => pickExpert(expert.id)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 12px',
                              border: 'none',
                              background: selected ? '#f1f5f9' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <ExpertAvatar
                              name={expert.name}
                              avatarUrl={expert.avatarUrl}
                              size={32}
                            />
                            <span
                              style={{
                                flex: 1,
                                fontSize: 14,
                                fontWeight: selected ? 600 : 400,
                              }}
                            >
                              {expert.name}
                            </span>
                            {selected && <CheckIcon />}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        padding: '8px 12px',
                      }}
                    >
                      <Link
                        href="/workbench/experts"
                        style={{
                          fontSize: 13,
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}
                      >
                        召唤更多专家 ↗
                      </Link>
                    </div>
                  </SubPanel>
                )}

                {activeMenu === 'skill' && (
                  <SubPanel title="技能" width={340} search>
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="搜索技能"
                    />
                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                      {filteredSkills.length === 0 && (
                        <div
                          style={{
                            padding: 16,
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          暂无可用技能
                        </div>
                      )}
                      {filteredSkills.map((skill) => {
                        const on = skillIds.includes(skill.id);
                        const letter =
                          skill.slug.charAt(0).toUpperCase() ||
                          skill.name.charAt(0).toUpperCase();
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              border: 'none',
                              background: on ? '#f1f5f9' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                background: skillLetterColor(skill.name),
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {letter}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: 'var(--ink)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {skill.name}
                              </div>
                              {skill.descriptionShort && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--muted)',
                                    lineHeight: 1.35,
                                    marginTop: 2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={skill.descriptionShort}
                                >
                                  {skill.descriptionShort}
                                </div>
                              )}
                            </div>
                            {on && <CheckIcon />}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        padding: '8px 12px',
                      }}
                    >
                      <Link
                        href="/workbench/skills"
                        style={{
                          fontSize: 13,
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}
                      >
                        浏览技能市场 ↗
                      </Link>
                    </div>
                  </SubPanel>
                )}

                {activeMenu === 'connector' && (
                  <SubPanel title="连接器" width={320} search>
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="搜索连接器"
                    />
                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                      {filteredConnectors.length === 0 && (
                        <div
                          style={{
                            padding: 16,
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          暂无可用连接器
                        </div>
                      )}
                      {filteredConnectors.map((conn) => {
                        const on = connectorIds.includes(conn.id);
                        return (
                          <div
                            key={conn.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                            }}
                          >
                            <ConnectorIcon name={conn.name} size={32} />
                            <span
                              style={{
                                flex: 1,
                                fontSize: 14,
                                fontWeight: 500,
                              }}
                            >
                              {conn.name}
                            </span>
                            <Toggle on={on} onChange={() => toggleConnector(conn.id)} />
                          </div>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        padding: '8px 12px',
                      }}
                    >
                      <Link
                        href="/workbench/connectors"
                        style={{
                          fontSize: 13,
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}
                      >
                        管理连接器 ↗
                      </Link>
                    </div>
                  </SubPanel>
                )}
              </div>
            )}
          </div>

          {selectedExpert && (
            <span
              style={{
                ...chipStyle,
                background: '#fff',
                border: '1px solid var(--line)',
                padding: '4px 8px 4px 4px',
              }}
            >
              <ExpertAvatar
                name={selectedExpert.name}
                avatarUrl={selectedExpert.avatarUrl}
                size={28}
              />
              <span style={{ fontWeight: 600 }}>{selectedExpert.name}</span>
              <button
                type="button"
                aria-label="移除专家"
                onClick={removeExpert}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 0,
                  lineHeight: 1,
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </span>
          )}

          {selectedConnectors.map((conn) => (
            <button
              key={conn.id}
              type="button"
              title={`${conn.name}（点击关闭）`}
              onClick={() => toggleConnector(conn.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                borderRadius: 8,
                opacity: 1,
              }}
            >
              <ConnectorIcon name={conn.name} size={32} />
            </button>
          ))}
        </div>

        {footer && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function SubPanel({
  title,
  width,
  search,
  children,
}: {
  title: string;
  width: number;
  search?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 14,
        width,
        boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
        marginLeft: -4,
      }}
    >
      {!search && (
        <div
          style={{
            padding: '12px 14px 8px',
            fontSize: 13,
            fontWeight: 700,
            color: '#64748b',
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ padding: '10px 12px 6px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#f1f5f9',
          borderRadius: 10,
          padding: '8px 10px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            cx="11"
            cy="11"
            r="7"
            stroke="#94a3b8"
            strokeWidth="1.8"
          />
          <path
            d="M20 20l-3.5-3.5"
            stroke="#94a3b8"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 14,
          }}
        />
      </div>
    </div>
  );
}
