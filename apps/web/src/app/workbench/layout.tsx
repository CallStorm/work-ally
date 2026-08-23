'use client';

import WorkbenchShell from '@/components/workbench-shell';
import { GroupProvider } from '@/lib/group-context';

export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GroupProvider>
      <WorkbenchShell>{children}</WorkbenchShell>
    </GroupProvider>
  );
}
