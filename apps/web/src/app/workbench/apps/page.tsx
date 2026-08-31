'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { WorkbenchApp } from '@/components/stickies/types';

export default function AppsListPage() {
  const [apps, setApps] = useState<WorkbenchApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<WorkbenchApp[]>('/apps')
      .then(setApps)
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="apps-list-page">
      <h1 className="apps-list-page__title">应用</h1>
      <p className="apps-list-page__sub">管理员上架的内置办公应用</p>
      {loading && <p>加载中…</p>}
      {!loading && apps.length === 0 && (
        <p className="apps-list-page__empty">暂无可用应用，请联系管理员开通。</p>
      )}
      <div className="apps-list-page__grid">
        {apps.map((app) => {
          const isStickies = app.slug === 'stickies';
          const isNotes = app.slug === 'notes';
          const isBazaar = app.slug === 'bazaar';
          const cardClass = [
            'apps-list-page__card',
            isStickies ? 'apps-list-page__card--stickies' : '',
            isNotes ? 'apps-list-page__card--handbook' : '',
            isBazaar ? 'apps-list-page__card--bazaar' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <Link
              key={app.id}
              href={`/workbench/apps/${app.slug}`}
              className={cardClass}
            >
              {isStickies ? (
                <div className="apps-list-page__cover" aria-hidden>
                  <span className="apps-list-page__cal" />
                </div>
              ) : isNotes ? (
                <div className="apps-list-page__cover" aria-hidden>
                  <span className="apps-list-page__book" />
                </div>
              ) : isBazaar ? (
                <div className="apps-list-page__cover" aria-hidden />
              ) : (
                <span className="apps-list-page__icon">◆</span>
              )}
              <div className="apps-list-page__body">
                <h2>{app.name}</h2>
                <p>{app.description}</p>
                {isStickies && (
                  <span className="apps-list-page__meta">日 / 周 / 月 · 提醒</span>
                )}
                {isNotes && (
                  <span className="apps-list-page__meta">分类 · Markdown · 搜索 · AI</span>
                )}
                {isBazaar && (
                  <span className="apps-list-page__meta">摊位 · 打星 · 产品榜</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
