import Link from 'next/link';

const nav = [
  { href: '/workbench', label: '首页' },
  { href: '/workbench/experts', label: '专家' },
  { href: '/workbench/skills', label: '技能' },
  { href: '/workbench/connectors', label: '连接器' },
  { href: '/workbench/knowledge', label: '知识库' },
];

export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          background: 'var(--sidebar)',
          color: 'var(--sidebar-ink)',
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ padding: '4px 10px', fontWeight: 700 }}>WorkAlly</div>
        <nav style={{ display: 'grid', gap: 6 }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: 10, opacity: 0.75, fontSize: 13 }}>
          最近会话（占位）
        </div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--line)',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>当前组：未选择（脚手架）</span>
          <Link href="/admin" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            管理后台
          </Link>
        </header>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
