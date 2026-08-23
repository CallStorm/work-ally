'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConnectorIcon from '@/components/connector-icon';
import WorkbenchAssetTabs from '@/components/workbench-asset-tabs';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Connector = {
  id: string;
  name: string;
  description: string | null;
  mcpInstructions: string | null;
  mcpServerName: string | null;
  mcpServerVersion: string | null;
  displayDescription: string;
  descriptionSource: 'manual' | 'mcp' | 'none';
  transport: string;
  visibility: string;
  status: string;
  healthStatus: string;
};

function connectorDescription(item: Connector) {
  if (item.displayDescription?.trim()) return item.displayDescription.trim();
  return '暂无描述（管理员可在测试连接后自动同步 MCP instructions）';
}

function isHealthy(item: Connector) {
  return item.status === 'active' && item.healthStatus === 'ok';
}

export default function WorkbenchConnectorsPage() {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Connector[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !auth) router.replace('/login');
  }, [ready, auth, router]);

  useEffect(() => {
    if (!auth) return;
    void apiFetch<Connector[]>('/connectors')
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : '加载失败'),
      );
  }, [auth]);

  const activeItems = useMemo(
    () => items.filter((item) => item.status === 'active'),
    [items],
  );

  const isAdmin =
    auth?.user.role === 'admin';

  if (!ready || !auth) {
    return <main style={{ padding: 24, color: '#64748b' }}>加载中…</main>;
  }

  return (
    <main
      style={{
        padding: '24px 32px 48px',
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gap: 24,
      }}
    >
      <WorkbenchAssetTabs />

      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {activeItems.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: '1px dashed #e2e8f0',
            borderRadius: 14,
            padding: 40,
            textAlign: 'center',
            color: '#64748b',
            fontSize: 14,
          }}
        >
          暂无可用连接器。
          {isAdmin && (
            <>
              {' '}
              <Link href="/admin/connectors" style={{ color: '#3b82f6' }}>
                去管理后台配置 MCP
              </Link>
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {activeItems.map((item) => (
            <ConnectorCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}

function ConnectorCard({ item }: { item: Connector }) {
  const healthy = isHealthy(item);

  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 16,
        display: 'grid',
        gap: 12,
        minHeight: 118,
        boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
        }}
      >
        <ConnectorIcon name={item.name} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            flex: 1,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 650,
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </h3>
          <StatusDot healthy={healthy} status={item.healthStatus} />
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.6,
          color: item.displayDescription?.trim() ? '#475569' : '#94a3b8',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
        }}
      >
        {connectorDescription(item)}
      </p>
    </article>
  );
}

function StatusDot({
  healthy,
  status,
}: {
  healthy: boolean;
  status: string;
}) {
  const color = healthy ? '#22c55e' : status === 'error' ? '#f59e0b' : '#cbd5e1';
  return (
    <span
      title={healthy ? '连接正常' : status === 'error' ? '连接异常' : '未检测'}
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}
