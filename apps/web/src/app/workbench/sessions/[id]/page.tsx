import { Suspense } from 'react';
import SessionChat from '@/components/session-chat';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>加载对话…</main>}>
      <SessionChat sessionId={id} />
    </Suspense>
  );
}
