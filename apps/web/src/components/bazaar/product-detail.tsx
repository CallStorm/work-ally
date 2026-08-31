'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { BazaarCompany, BazaarProduct, BazaarProductHint } from './types';
import { bazaarCoverStyle } from './types';

type Props = {
  productId: string;
  hint?: BazaarProductHint | null;
  onBack: () => void;
  onOpenStall: (userId: string) => void;
  onOpenMyStall: () => void;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function starsLabel(avgStars: number, ratingCount: number) {
  if (ratingCount === 0) return '暂无评分';
  return `★ ${avgStars.toFixed(1)} · ${ratingCount} 人评分`;
}

export function ProductDetail({
  productId,
  hint,
  onBack,
  onOpenStall,
  onOpenMyStall,
}: Props) {
  const { auth } = useAuth();
  const [product, setProduct] = useState<BazaarProduct | null>(null);
  const [company, setCompany] = useState<BazaarCompany | null>(null);
  const [myStars, setMyStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    setProduct(null);
    setCompany(null);
    setMyStars(0);
    try {
      const next = await apiFetch<BazaarProduct>(
        `/apps/bazaar/products/${productId}`,
      );
      if (requestId !== fetchIdRef.current) return;
      setProduct(next);
      setMyStars(next.myStars ?? 0);
      try {
        const co = await apiFetch<BazaarCompany>(
          `/apps/bazaar/company/${next.userId}`,
        );
        if (requestId !== fetchIdRef.current) return;
        setCompany(co);
      } catch {
        if (requestId !== fetchIdRef.current) return;
        setCompany(null);
      }
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setError(err.message || '产品不存在');
        return;
      }
      setError(err instanceof Error ? err.message : '加载产品失败');
    } finally {
      if (requestId === fetchIdRef.current) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAuthor = Boolean(
    product && auth && product.userId === auth.user.userId,
  );
  const userName = isAuthor
    ? auth?.user.name || '我'
    : hint?.userName || '同事';
  const companyName = company?.name || hint?.companyName || '公司';

  async function rate(stars: number) {
    setRatingBusy(true);
    setError(null);
    try {
      const next = await apiFetch<BazaarProduct>(
        `/apps/bazaar/products/${productId}/rating`,
        { method: 'PUT', body: JSON.stringify({ stars }) },
      );
      setProduct(next);
      setMyStars(stars);
    } catch (err) {
      setError(err instanceof Error ? err.message : '打星失败');
    } finally {
      setRatingBusy(false);
    }
  }

  function openStall() {
    if (!product) return;
    if (isAuthor) {
      onOpenMyStall();
      return;
    }
    onOpenStall(product.userId);
  }

  const lit = hoverStars || myStars;

  return (
    <div className="bazaar-detail">
      <button type="button" className="bazaar-text-link" onClick={onBack}>
        ← 返回展会大厅
      </button>

      {error && (
        <div className="bazaar-app__error" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="bazaar-app__empty">加载产品…</div>}

      {!loading && product && (
        <>
          <div
            className="bazaar-detail__cover"
            style={bazaarCoverStyle(product.coverHue)}
            aria-hidden
          />
          <h1 className="bazaar-detail__title">{product.title}</h1>
          <p className="bazaar-detail__byline">
            <button type="button" className="bazaar-text-link" onClick={openStall}>
              {userName}
            </button>
            {' · '}
            <button type="button" className="bazaar-text-link" onClick={openStall}>
              {companyName}
            </button>
            {' · '}
            <button type="button" className="bazaar-text-link" onClick={openStall}>
              进入摊位 →
            </button>
          </p>
          {product.status === 'draft' && (
            <p className="bazaar-detail__draft">草稿 · 尚未上架</p>
          )}
          <p className="bazaar-detail__pitch">{product.pitch}</p>
          {product.features.length > 0 && (
            <p className="bazaar-detail__features">
              功能点：{product.features.join(' · ')}
            </p>
          )}

          <section className="bazaar-detail__rate">
            {!isAuthor && product.status === 'published' && (
              <>
                <p className="bazaar-detail__rate-label">
                  给它打星（每人一次，可改）
                </p>
                <div
                  className="bazaar-stars"
                  role="group"
                  aria-label="给它打星，1 到 5 星"
                  onMouseLeave={() => setHoverStars(0)}
                >
                  {STAR_VALUES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={
                        n <= lit
                          ? 'bazaar-stars__btn is-on'
                          : 'bazaar-stars__btn'
                      }
                      aria-label={`${n} 星`}
                      aria-pressed={myStars === n}
                      disabled={ratingBusy}
                      onMouseEnter={() => setHoverStars(n)}
                      onFocus={() => setHoverStars(n)}
                      onBlur={() => setHoverStars(0)}
                      onClick={() => void rate(n)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </>
            )}
            {isAuthor && (
              <p className="bazaar-detail__rate-label">产品统计</p>
            )}
            <p className="bazaar-detail__stats-stars">
              {starsLabel(product.avgStars, product.ratingCount)}
            </p>
            <p className="bazaar-detail__score">
              当前 {product.score}分 = 基础20 + 他人星级合计
            </p>
          </section>
        </>
      )}
    </div>
  );
}
