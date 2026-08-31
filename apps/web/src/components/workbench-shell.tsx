'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCurrentGroup } from '@/lib/group-context';
import type { SessionListItem } from '@/lib/types';

const SIDEBAR_KEY = 'workbench.sidebarCollapsed';
const THEME_KEY = 'workbench.theme';
const HISTORY_PREVIEW = 5;
const assetPaths = ['/workbench/experts', '/workbench/skills', '/workbench/connectors'];
const appPaths = ['/workbench/apps'];

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: ReactNode;
  active: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: '/workbench',
    label: '新建任务',
    icon: <NavIconNewTask />,
    active: (pathname) => pathname === '/workbench',
  },
  {
    href: '/workbench/apps',
    label: '应用',
    shortLabel: '应用',
    icon: <NavIconApps />,
    active: (pathname) =>
      appPaths.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ),
  },
  {
    href: '/workbench/experts',
    label: '专家·技能·连接器',
    shortLabel: '资源',
    icon: <NavIconAssets />,
    active: (pathname) =>
      assetPaths.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      ),
  },
  // 知识库入口暂时隐藏，后续再开放
];

export default function WorkbenchShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { auth, ready, logout } = useAuth();
  const { groups, currentGroupId, currentGroup, setCurrentGroupId } =
    useCurrentGroup();
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = auth?.user.role === 'admin';

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
        document.documentElement.dataset.workbenchTheme = saved;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!userMenuRef.current?.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!currentGroupId) return;
    let cancelled = false;

    async function loadSessions() {
      try {
        const rows = await apiFetch<SessionListItem[]>(
          `/sessions?group_id=${currentGroupId}`,
        );
        if (!cancelled) setSessions(rows);
      } catch {
        if (!cancelled) setSessions([]);
      }
    }

    void loadSessions();
    // Poll so in-progress runs show up while user stays on the page.
    const timer = window.setInterval(() => void loadSessions(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentGroupId, pathname]);

  const activeSessionId = useMemo(() => {
    const match = pathname.match(/^\/workbench\/sessions\/([^/?]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      (s.title ?? '未命名会话').toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const previewSessions = historyExpanded
    ? sessions
    : sessions.slice(0, HISTORY_PREVIEW);
  const hiddenHistoryCount = Math.max(0, sessions.length - HISTORY_PREVIEW);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  function openSearch() {
    setSearchQuery('');
    setSearchOpen(true);
  }

  function goToSession(id: string) {
    setSearchOpen(false);
    router.push(`/workbench/sessions/${id}`);
  }

  function setThemePreference(next: 'light' | 'dark') {
    setTheme(next);
    document.documentElement.dataset.workbenchTheme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={`workbench-layout${sidebarCollapsed ? ' workbench-layout--collapsed' : ''}${theme === 'dark' ? ' workbench-layout--dark' : ''}`}
    >
      <aside className="workbench-sidebar">
        <div className="workbench-sidebar__top">
          <button
            type="button"
            className="workbench-icon-btn"
            aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            onClick={toggleSidebar}
          >
            <NavIconPanel />
          </button>
          {!sidebarCollapsed && (
            <Link href="/workbench" className="workbench-brand">
              <span className="workbench-brand__mark">W</span>
              <span>WorkAlly</span>
            </Link>
          )}
          {!sidebarCollapsed && (
            <button
              type="button"
              className="workbench-icon-btn workbench-sidebar__search"
              aria-label="搜索历史"
              onClick={openSearch}
            >
              <NavIconSearch />
            </button>
          )}
        </div>

        <nav className="workbench-nav">
          {navItems.map((item) => {
            const isActive = item.active(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`workbench-nav__item${isActive ? ' is-active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {item.icon}
                {!sidebarCollapsed && (
                  <span className="workbench-nav__label">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <section className="workbench-history">
            <div className="workbench-history__head">最近</div>
            <div className="workbench-history__list">
              {previewSessions.length === 0 && (
                <div className="workbench-history__empty">暂无会话</div>
              )}
              {previewSessions.map((s) => {
                const title = s.title || '未命名会话';
                const active = activeSessionId === s.id;
                const running =
                  s.activeRun?.state === 'running' ||
                  s.activeRun?.state === 'queued';
                return (
                  <Link
                    key={s.id}
                    href={`/workbench/sessions/${s.id}`}
                    className={`workbench-history__item${active ? ' is-active' : ''}${running ? ' is-running' : ''}`}
                    title={running ? `${title}（执行中）` : title}
                  >
                    <span className="workbench-history__title">
                      {running && (
                        <span className="workbench-history__pulse" aria-hidden />
                      )}
                      {title}
                    </span>
                    <span className="workbench-history__time">
                      {running ? '执行中' : formatRelativeTime(s.updatedAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
            {sessions.length > HISTORY_PREVIEW && (
              <button
                type="button"
                className="workbench-history__toggle"
                onClick={() => setHistoryExpanded((v) => !v)}
              >
                {historyExpanded
                  ? '收起'
                  : `查看更多 (${hiddenHistoryCount})`}
              </button>
            )}
          </section>
        )}

        <div className="workbench-sidebar__foot" ref={userMenuRef}>
          {sidebarCollapsed && (
            <button
              type="button"
              className="workbench-icon-btn"
              aria-label="搜索历史"
              onClick={openSearch}
            >
              <NavIconSearch />
            </button>
          )}

          <button
            type="button"
            className={`workbench-user-trigger${userMenuOpen ? ' is-open' : ''}`}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            onClick={() => setUserMenuOpen((v) => !v)}
          >
            <span className="workbench-user__avatar">
              {(auth?.user.name ?? '?').charAt(0).toUpperCase()}
            </span>
            {!sidebarCollapsed && (
              <span className="workbench-user-trigger__meta">
                <span className="workbench-user-trigger__name">
                  {auth?.user.name ?? '未登录'}
                </span>
                <span className="workbench-user-trigger__group">
                  {currentGroup?.name ?? '未选择工作组'}
                </span>
              </span>
            )}
          </button>

          {userMenuOpen && (
            <div className="workbench-user-menu" role="menu">
              <div className="workbench-user-menu__head">
                <div className="workbench-user-menu__name">
                  {auth?.user.name ?? '未登录'}
                </div>
                {auth?.user.phone && (
                  <div className="workbench-user-menu__sub">
                    {auth.user.phone}
                  </div>
                )}
              </div>

              <div className="workbench-user-menu__section">
                <div className="workbench-user-menu__section-title">
                  <NavIconGroup />
                  当前工作组
                </div>
                {groups.length === 0 ? (
                  <div className="workbench-user-menu__empty">暂无工作组</div>
                ) : (
                  <div
                    className="workbench-user-menu__group-list"
                    role="menu"
                    aria-label="切换工作组"
                  >
                    {groups.map((g) => {
                      const active = g.id === currentGroupId;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          className={`workbench-user-menu__group-item${active ? ' is-active' : ''}`}
                          onClick={() => {
                            setCurrentGroupId(g.id);
                            setUserMenuOpen(false);
                          }}
                        >
                          <span className="workbench-user-menu__group-check">
                            {active ? '✓' : ''}
                          </span>
                          <span className="workbench-user-menu__group-label">
                            {g.name}
                            {g.isDefault ? '（默认）' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="workbench-user-menu__row">
                <span className="workbench-user-menu__label">
                  <NavIconAppearance />
                  外观
                </span>
                <div className="workbench-theme-switch">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === 'light'}
                    className={theme === 'light' ? 'is-active' : undefined}
                    onClick={() => setThemePreference('light')}
                  >
                    浅色
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={theme === 'dark'}
                    className={theme === 'dark' ? 'is-active' : undefined}
                    onClick={() => setThemePreference('dark')}
                  >
                    深色
                  </button>
                </div>
              </div>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="workbench-user-menu__action"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <NavIconAdmin />
                  管理后台
                </Link>
              )}

              <button
                type="button"
                className="workbench-user-menu__action"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                  router.replace('/login');
                }}
              >
                <NavIconLogout />
                退出登录
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="workbench-main">
        <div className="workbench-main__content">{children}</div>
      </div>

      {searchOpen && (
        <div
          className="workbench-search-overlay"
          role="presentation"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="workbench-search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="搜索任务"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workbench-search-modal__head">
              <NavIconSearch />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索任务"
                className="workbench-search-modal__input"
              />
              <button
                type="button"
                className="workbench-icon-btn"
                aria-label="关闭"
                onClick={() => setSearchOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="workbench-search-modal__label">最近任务</div>
            <div className="workbench-search-modal__list">
              {filteredSessions.length === 0 && (
                <div className="workbench-history__empty">没有匹配的任务</div>
              )}
              {filteredSessions.map((s) => {
                const title = s.title || '未命名会话';
                const running =
                  s.activeRun?.state === 'running' ||
                  s.activeRun?.state === 'queued';
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="workbench-search-modal__item"
                    onClick={() => goToSession(s.id)}
                  >
                    <span>{title}</span>
                    <span className="workbench-history__time">
                      {running ? '执行中' : formatRelativeTime(s.updatedAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function NavIconPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function NavIconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NavIconNewTask() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10h8M8 14h5M7 4h10a2 2 0 0 1 2 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NavIconApps() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function NavIconAssets() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 10.5c.6-1.2 1.6-1.8 2.5-1.8s1.9.6 2.5 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 14.2c1-1.1 2.2-1.7 3.5-1.7s2.5.6 3.5 1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NavIconGroup() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 18c.8-2.2 2.4-3.5 4.5-3.5s3.7 1.3 4.5 3.5M13.5 17.5c.5-1.3 1.6-2 3-2s2.5.7 3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NavIconAppearance() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2" fill="currentColor" />
      <circle cx="15" cy="7" r="2" fill="currentColor" />
      <circle cx="12" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

function NavIconAdmin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7.5 12 3l8 4.5V18l-8 4.5L4 18V7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavIconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h6A1.5 1.5 0 0 1 19 5.5v13A1.5 1.5 0 0 1 17.5 20h-6A1.5 1.5 0 0 1 10 18.5V17"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M13 12H4m0 0 2.5-2.5M4 12l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
