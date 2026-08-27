export default function PlaceholderPage({
  title,
}: {
  title: string;
}) {
  return (
    <main style={{ padding: 28 }}>
      <h1 style={{ marginTop: 0, fontFamily: 'Fraunces, Georgia, serif' }}>{title}</h1>
      <p style={{ color: 'var(--muted)' }}>脚手架占位页，后续按需求基线实现列表与 ACL 过滤。</p>
    </main>
  );
}
