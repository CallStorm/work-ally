'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import type {
  CategorySelection,
  HandbookCategory,
  HandbookNote,
} from './types';

function notesPath(selection: CategorySelection, query: string) {
  const params = new URLSearchParams();
  if (selection !== 'all') params.set('categoryId', selection);
  const q = query.trim();
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `/apps/handbook/notes?${qs}` : '/apps/handbook/notes';
}

export function HandbookApp() {
  const [categories, setCategories] = useState<HandbookCategory[]>([]);
  const [notes, setNotes] = useState<HandbookNote[]>([]);
  const [selection] = useState<CategorySelection>('all');
  const [selectedNoteId] = useState<string | null>(null);
  const [query] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++fetchIdRef.current;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const [nextCategories, nextNotes] = await Promise.all([
          apiFetch<HandbookCategory[]>('/apps/handbook/categories'),
          apiFetch<HandbookNote[]>(notesPath(selection, query)),
        ]);
        if (requestId !== fetchIdRef.current) return;
        setCategories(nextCategories);
        setNotes(nextNotes);
      } catch (err) {
        if (requestId !== fetchIdRef.current) return;
        if (err instanceof ApiError && err.status === 403) {
          setLoadError(err.message || '无权使用手册应用');
        } else {
          setLoadError(err instanceof Error ? err.message : '加载手册失败');
        }
      } finally {
        if (requestId === fetchIdRef.current) setLoading(false);
      }
    })();
  }, [selection, query]);

  return (
    <div className="handbook-app">
      {loadError && (
        <div className="handbook-app__error" role="alert">
          {loadError}
        </div>
      )}
      {loading && <div className="handbook-app__empty">加载中…</div>}
      <div className="handbook-app__cols">
        <aside className="handbook-app__tree">
          分类（{categories.length}）
        </aside>
        <section className="handbook-app__list">
          笔记（{notes.length}）
        </section>
        <section className="handbook-app__editor">
          {selectedNoteId ? `笔记 ${selectedNoteId}` : '编辑'}
        </section>
      </div>
    </div>
  );
}
