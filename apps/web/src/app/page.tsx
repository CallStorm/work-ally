import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(720px, 100%)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 20,
          padding: '40px 36px',
          boxShadow: '0 20px 50px rgba(16, 24, 32, 0.06)',
        }}
      >
        <p
          style={{
            margin: 0,
            color: 'var(--accent)',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          WORKALLY
        </p>
        <h1
          style={{
            margin: '12px 0 10px',
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 'clamp(2rem, 4vw, 2.8rem)',
            lineHeight: 1.15,
          }}
        >
          团队办公 Agent 工作台
        </h1>
        <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 16 }}>
          脚手架已就绪：工作台与管理后台入口如下。业务能力按需求基线迭代。
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/workbench"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            进入工作台
          </Link>
          <Link
            href="/admin"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              padding: '12px 18px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            管理后台
          </Link>
        </div>
      </div>
    </main>
  );
}
