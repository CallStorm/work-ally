export default function AdminHomePage() {
  return (
    <main style={{ padding: 28 }}>
      <h1 style={{ marginTop: 0, fontFamily: 'Fraunces, Georgia, serif' }}>概览</h1>
      <p style={{ color: 'var(--muted)' }}>
        管理成员、连接器凭据、技能/专家/知识库 ACL、默认 Agent 与模型列表。
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 20,
        }}
      >
        {['成员', '组', '专家', '技能', '连接器', '知识库'].map((label) => (
          <div
            key={label}
            style={{
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>—</div>
          </div>
        ))}
      </div>
    </main>
  );
}
