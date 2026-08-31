'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { BazaarLeaderboardRow, BazaarProductHint } from './types';

type Props = {
  onOpenProduct: (productId: string, hint?: BazaarProductHint) => void;
};

function secondary(row: BazaarLeaderboardRow) {
  if (row.ratingCount === 0) return '暂无评分';
  return `★ ${row.avgStars.toFixed(1)} · ${row.ratingCount} 评`;
}

export function Leaderboard({ onOpenProduct }: Props) {
  const [rows, setRows] = useState<BazaarLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const next = await apiFetch<BazaarLeaderboardRow[]>(
        '/apps/bazaar/leaderboard',
      );
      if (requestId !== fetchIdRef.current) return;
      setRows(next);
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : '加载排行榜失败');
    } finally {
      if (requestId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="bazaar-board">
      <h1 className="bazaar-board__title">本租户产品榜</h1>

      {error && (
        <div className="bazaar-app__error" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="bazaar-app__empty">加载排行榜…</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="bazaar-app__empty">还没有上架产品入榜。</div>
      )}
      {!loading && !error && rows.length > 0 && (
        <ol className="bazaar-board__list">
          {rows.map((row, index) => (
            <li key={row.productId}>
              <button
                type="button"
                className="bazaar-board__row"
                onClick={() =>
                  onOpenProduct(row.productId, {
                    userName: row.userName,
                    companyName: row.companyName,
                  })
                }
              >
                <span className="bazaar-board__rank">#{index + 1}</span>
                <span className="bazaar-board__copy">
                  <span className="bazaar-board__line">
                    {row.userName || '同事'} · {row.companyName} · {row.title}
                  </span>
                  <span className="bazaar-board__sub">{secondary(row)}</span>
                </span>
                <strong className="bazaar-board__score">{row.score}</strong>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
