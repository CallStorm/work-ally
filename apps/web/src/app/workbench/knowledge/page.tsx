'use client';

import { useCallback } from 'react';
import AssetListPage from '@/components/asset-list-page';

export default function WorkbenchKnowledgePage() {
  const mapItem = useCallback((raw: Record<string, unknown>) => {
    const displayName = String(raw.displayName ?? raw.name ?? '');
    const provider = String(raw.provider ?? '');
    const visibility = String(raw.visibility ?? '');
    return {
      id: String(raw.id),
      title: displayName,
      subtitle: `${provider} · ${visibility}`,
    };
  }, []);

  return (
    <AssetListPage
      title="知识库"
      description="仅展示当前账号可用的第三方知识库绑定（ACL 过滤）。"
      endpoint="/knowledge"
      adminHref="/admin/knowledge"
      mapItem={mapItem}
    />
  );
}
