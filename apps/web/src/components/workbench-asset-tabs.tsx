'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  {
    href: '/workbench/experts',
    label: '专家',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M6 20v-1.2A5.8 5.8 0 0 1 11.8 13h.4A5.8 5.8 0 0 1 18 18.8V20"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/workbench/skills',
    label: '技能',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="m14 6 4 4-8 8H6v-4l8-8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M13 7l4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/workbench/connectors',
    label: '连接器',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM18 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8.6 9.4 15.4 14.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

export default function WorkbenchAssetTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="资源导航"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: active ? 650 : 500,
              textDecoration: 'none',
              color: active ? 'var(--wb-accent)' : 'var(--wb-muted)',
              background: active ? 'var(--wb-accent-soft)' : 'transparent',
              border: active ? '1px solid transparent' : '1px solid transparent',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
