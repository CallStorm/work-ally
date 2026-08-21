import Link from 'next/link';

const nav = [
  { href: '/admin', label: '概览' },
  { href: '/admin/members', label: '成员与组' },
  { href: '/admin/connectors', label: '连接器' },
  { href: '/admin/skills', label: '技能' },
  { href: '/admin/experts', label: '专家' },
  { href: '/admin/knowledge', label: '知识库' },
  { href: '/admin/default-agent', label: '默认 Agent' },
  { href: '/admin/models', label: '模型配置' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          borderRight: '1px solid var(--line)',
          background: '#fff',
          padding: '20px 14px',
        }}
      >
        <div style={{ padding: '4px 10px', fontWeight: 700, marginBottom: 16 }}>
          管理后台
        </div>
        <nav style={{ display: 'grid', gap: 6 }}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--bg)',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 24, padding: '0 10px' }}>
          <Link href="/workbench" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            ← 返回工作台
          </Link>
        </div>
      </aside>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
