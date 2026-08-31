'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Leaderboard } from './leaderboard';
import { MarketHall } from './market-hall';
import { MyStall } from './my-stall';
import { OnboardingCompany } from './onboarding-company';
import { ProductDetail } from './product-detail';
import { UserStall } from './user-stall';
import type { BazaarCompany, BazaarProductHint, BazaarView } from './types';

export function BazaarApp() {
  const [view, setView] = useState<BazaarView>('market');
  const [company, setCompany] = useState<BazaarCompany | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [productHint, setProductHint] = useState<BazaarProductHint | null>(null);
  const [stallUserId, setStallUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const loadCompany = useCallback(async () => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const mine = await apiFetch<BazaarCompany | null>('/apps/bazaar/company');
      if (requestId !== fetchIdRef.current) return;
      if (!mine) {
        setCompany(null);
        setView('onboarding');
        return;
      }
      setCompany(mine);
      setView((current) => (current === 'onboarding' ? 'market' : current));
    } catch (err) {
      if (requestId !== fetchIdRef.current) return;
      if (err instanceof ApiError && err.status === 404) {
        setCompany(null);
        setView('onboarding');
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setLoadError(err.message || '无权使用创司集市应用');
        return;
      }
      setLoadError(err instanceof Error ? err.message : '加载创司集市失败');
    } finally {
      if (requestId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  function goMarket() {
    setView('market');
  }

  function goMyStall() {
    if (!company) {
      setView('onboarding');
      return;
    }
    setView('stall-mine');
  }

  function goLeaderboard() {
    setView('leaderboard');
  }

  function goProduct(id: string, hint?: BazaarProductHint) {
    setProductId(id);
    setProductHint(hint ?? null);
    setView('product');
  }

  function goStall(userId: string) {
    setStallUserId(userId);
    setView('stall-user');
  }

  function handleCreated(next: BazaarCompany) {
    setCompany(next);
    setView('market');
  }

  const showChrome = !loading && !loadError && view !== 'onboarding';

  return (
    <div className="bazaar-app">
      {showChrome && (
        <header className="bazaar-app__header">
          <button
            type="button"
            className="bazaar-app__brand"
            onClick={goMarket}
          >
            创司集市
          </button>
          <nav className="bazaar-app__nav" aria-label="创司集市">
            <button
              type="button"
              className={
                view === 'stall-mine'
                  ? 'bazaar-app__nav-btn is-active'
                  : 'bazaar-app__nav-btn'
              }
              onClick={goMyStall}
            >
              我的摊位
            </button>
            <button
              type="button"
              className={
                view === 'leaderboard'
                  ? 'bazaar-app__nav-btn is-active'
                  : 'bazaar-app__nav-btn'
              }
              onClick={goLeaderboard}
            >
              排行榜
            </button>
          </nav>
        </header>
      )}
      {loadError && (
        <div className="bazaar-app__error" role="alert">
          {loadError}
        </div>
      )}
      {loading && <div className="bazaar-app__empty">加载中…</div>}
      {!loading && !loadError && view === 'onboarding' && (
        <OnboardingCompany onCreated={handleCreated} />
      )}
      {!loading && !loadError && view === 'market' && company && (
        <MarketHall
          company={company}
          onOpenMyStall={goMyStall}
          onOpenLeaderboard={goLeaderboard}
          onOpenProduct={goProduct}
          onOpenStall={goStall}
        />
      )}
      {!loading && !loadError && view === 'stall-mine' && company && (
        <MyStall
          company={company}
          onCompanyChange={setCompany}
          onOpenProduct={goProduct}
        />
      )}
      {!loading && !loadError && view === 'stall-user' && stallUserId && (
        <UserStall
          userId={stallUserId}
          onOpenProduct={goProduct}
          onBack={goMarket}
        />
      )}
      {!loading && !loadError && view === 'product' && productId && (
        <ProductDetail
          productId={productId}
          hint={productHint}
          onBack={goMarket}
          onOpenStall={goStall}
          onOpenMyStall={goMyStall}
        />
      )}
      {!loading && !loadError && view === 'leaderboard' && (
        <Leaderboard onOpenProduct={goProduct} />
      )}
    </div>
  );
}
