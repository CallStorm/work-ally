'use client';

import { Suspense } from 'react';
import WorkbenchComposer from '@/components/workbench-composer';

export default function WorkbenchHomePage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 40, color: 'var(--muted)' }}>加载中…</main>
      }
    >
      <WorkbenchComposer />
    </Suspense>
  );
}
