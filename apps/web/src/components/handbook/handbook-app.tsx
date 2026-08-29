'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { CategoryTree } from './category-tree';
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

function noteMatchesSelection(note: HandbookNote, selection: CategorySelection) {
  if (selection === 'all') return true;
  if (selection === 'uncategorized') return note.categoryId == null;
  return note.categoryId === selection;
}

export function HandbookApp() {
  const [categories, setCategories] = useState<HandbookCategory[]>([]);
  const [notes, setNotes] = useState<HandbookNote[]>([]);
  const [selection, setSelection] = useState<CategorySelection>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [query] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const requestId = ++fetchIdRef.current;
      if (!opts?.silent) {
        setLoading(true);
        setLoadError(null);
      }
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
        const message =
          err instanceof Error ? err.message : '加载手册失败';
        if (opts?.silent) {
          setActionError(message);
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setLoadError(err.message || '无权使用手册应用');
        } else {
          setLoadError(message);
        }
      } finally {
        if (requestId === fetchIdRef.current && !opts?.silent) {
          setLoading(false);
        }
      }
    },
    [selection, query],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleSelect(next: CategorySelection) {
    setActionError(null);
    setSelection(next);
    setSelectedNoteId((current) => {
      if (!current) return null;
      const note = notes.find((n) => n.id === current);
      if (!note || !noteMatchesSelection(note, next)) return null;
      return current;
    });
  }

  async function handleCreate(name: string, parentId?: string | null) {
    setActionError(null);
    try {
      await apiFetch<HandbookCategory>('/apps/handbook/categories', {
        method: 'POST',
        body: JSON.stringify({
          name,
          parentId: parentId ?? null,
        }),
      });
      await loadData({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '创建分类失败');
    }
  }

  async function handleRename(id: string, name: string) {
    setActionError(null);
    try {
      await apiFetch<HandbookCategory>(`/apps/handbook/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await loadData({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '重命名分类失败');
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/apps/handbook/categories/${id}`, { method: 'DELETE' });
      setSelectedNoteId((current) => {
        const note = notes.find((n) => n.id === current);
        return note?.categoryId === id ? null : current;
      });
      if (selection === id) {
        setSelection('all');
        return;
      }
      await loadData({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除分类失败');
    }
  }

  return (
    <div className="handbook-app">
      {loadError && (
        <div className="handbook-app__error" role="alert">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="handbook-app__error" role="alert">
          {actionError}
        </div>
      )}
      {loading && <div className="handbook-app__empty">加载中…</div>}
      <div className="handbook-app__cols">
        <aside className="handbook-app__tree">
          <CategoryTree
            categories={categories}
            selection={selection}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onRename={handleRename}
            onDelete={handleDelete}
          />
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
