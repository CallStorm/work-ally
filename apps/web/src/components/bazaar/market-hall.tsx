'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { BazaarCompany, BazaarMarketItem, MarketSort } from './types';

type Props = {
  company: BazaarCompany;
  onOpenMyStall: () => void;
  onOpenLeaderboard: () => void;
  onOpenProduct: (productId: string) => void;
  onOpenStall: (userId: string) => void;
};

function coverStyle(hue: number) {
  return {
    background: `linear-gradient(135deg, hsl(${hue} 72% 46%), hsl(${hue} 68% 26%))`,
  };
}

function starsLabel(item: BazaarMarketItem) {
  if (item.ratingCount === 0) return '暂无评分';
  return `★ ${item.avgStars.toFixed(1)}`;
}

export function MarketHall({
  company,
  onOpenMyStall,
  onOpenLeaderboard,
  onOpenProduct,
  onOpenStall,
}: Props) {
  const [sort, setSort] = useState<MarketSort>('newest');
  const [items, setItems] = useState<BazaarMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const loadMarket = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await apiFetch<BazaarMarketItem[]>(
        `/apps/bazaar/market?sort=${sort}`,
      );
      if (requestId !== fetchIdRef.current) return;
      setItems(next);
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : '加载展会失败');
    } finally {
      if (requestId === fetchIdRef.current) setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  return (
    <div className="bazaar-market">
      <div className="bazaar-market__toolbar">
        <div className="bazaar-tabs" role="tablist" aria-label="展会排序">
          <button
            type="button"
            role="tab"
            aria-selected={sort === 'newest'}
            className={
              sort === 'newest' ? 'bazaar-tabs__tab is-active' : 'bazaar-tabs__tab'
            }
            onClick={() => setSort('newest')}
          >
            最新
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === 'hottest'}
            className={
              sort === 'hottest' ? 'bazaar-tabs__tab is-active' : 'bazaar-tabs__tab'
            }
            onClick={() => setSort('hottest')}
          >
            最热
          </button>
        </div>
        <button
          type="button"
          className="bazaar-btn bazaar-btn--ghost"
          onClick={onOpenMyStall}
        >
          + 上架新品
        </button>
      </div>

      <p className="bazaar-market__welcome">
        {company.name}
        {company.slogan ? ` · ${company.slogan}` : ''}
      </p>

      {error && (
        <div className="bazaar-app__error" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="bazaar-app__empty">加载展会…</div>}
      {!loading && !error && items.length === 0 && (
        <div className="bazaar-app__empty">
          展会还没有上架产品。去
          <button type="button" className="bazaar-text-link" onClick={onOpenMyStall}>
            我的摊位
          </button>
          摆第一件货，或看看
          <button
            type="button"
            className="bazaar-text-link"
            onClick={onOpenLeaderboard}
          >
            排行榜
          </button>
          。
        </div>
      )}
      {!loading && items.length > 0 && (
        <ul className="bazaar-market__grid">
          {items.map((item) => (
            <li key={item.id}>
              <article className="bazaar-card">
                <button
                  type="button"
                  className="bazaar-card__cover"
                  style={coverStyle(item.coverHue)}
                  onClick={() => onOpenProduct(item.id)}
                  aria-label={`查看产品 ${item.title}`}
                />
                <div className="bazaar-card__body">
                  <h2>
                    <button
                      type="button"
                      className="bazaar-card__title"
                      onClick={() => onOpenProduct(item.id)}
                    >
                      {item.title}
                    </button>
                  </h2>
                  <p className="bazaar-card__meta">
                    <button
                      type="button"
                      className="bazaar-text-link"
                      onClick={() => onOpenStall(item.userId)}
                    >
                      {item.userName || '同事'}
                    </button>
                    {' · '}
                    <button
                      type="button"
                      className="bazaar-text-link"
                      onClick={() => onOpenStall(item.userId)}
                    >
                      {item.companyName}
                    </button>
                  </p>
                  <p className="bazaar-card__score">
                    {starsLabel(item)}
                    <span> · {item.score}分</span>
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
