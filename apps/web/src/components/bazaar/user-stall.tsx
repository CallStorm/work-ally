'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import type { BazaarProductHint, BazaarStall } from './types';
import { BAZAAR_SHELF_LIMIT, bazaarCoverStyle } from './types';

type Props = {
  userId: string;
  onOpenProduct: (productId: string, hint?: BazaarProductHint) => void;
  onBack: () => void;
};

function starsLabel(avgStars: number, ratingCount: number) {
  if (ratingCount === 0) return '暂无评分';
  return `★ ${avgStars.toFixed(1)}`;
}

export function UserStall({ userId, onOpenProduct, onBack }: Props) {
  const [stall, setStall] = useState<BazaarStall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const loadStall = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    setStall(null);
    try {
      const next = await apiFetch<BazaarStall>(`/apps/bazaar/stalls/${userId}`);
      if (requestId !== fetchIdRef.current) return;
      setStall(next);
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setError(err.message || '公司不存在');
        return;
      }
      setError(err instanceof Error ? err.message : '加载摊位失败');
    } finally {
      if (requestId === fetchIdRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadStall();
  }, [loadStall]);

  const publishedCount = stall?.products.length ?? 0;

  return (
    <div className="bazaar-stall">
      <button type="button" className="bazaar-text-link" onClick={onBack}>
        ← 返回展会大厅
      </button>

      {error && (
        <div className="bazaar-app__error" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="bazaar-app__empty">加载摊位…</div>}

      {!loading && !error && stall && (
        <>
          <section
            className={`bazaar-stall__company bazaar-stall__company--${stall.company.stallSkin}`}
          >
            <div
              className={`bazaar-stall__avatar bazaar-stall__avatar--${stall.company.stallSkin}`}
              aria-hidden
            />
            <div className="bazaar-stall__company-copy">
              <h1>{stall.company.name}</h1>
              <p>{stall.company.slogan || '还没有口号'}</p>
            </div>
          </section>

          <p className="bazaar-stall__shelf">
            货架 {publishedCount} / {BAZAAR_SHELF_LIMIT}
          </p>

          {stall.products.length === 0 ? (
            <div className="bazaar-app__empty">该摊位还没有上架产品。</div>
          ) : (
            <ul className="bazaar-stall__grid">
              {stall.products.map((item) => (
                <li key={item.id}>
                  <article className="bazaar-stall-card">
                    <button
                      type="button"
                      className="bazaar-stall-card__cover bazaar-stall-card__cover--btn"
                      style={bazaarCoverStyle(item.coverHue)}
                      onClick={() =>
                        onOpenProduct(item.id, {
                          companyName: stall.company.name,
                        })
                      }
                      aria-label={`查看产品 ${item.title}`}
                    />
                    <h2>
                      <button
                        type="button"
                        className="bazaar-card__title"
                        onClick={() =>
                          onOpenProduct(item.id, {
                            companyName: stall.company.name,
                          })
                        }
                      >
                        {item.title}
                      </button>
                    </h2>
                    <p className="bazaar-stall-card__meta">
                      {starsLabel(item.avgStars, item.ratingCount)}
                      <span> · {item.score}分</span>
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
