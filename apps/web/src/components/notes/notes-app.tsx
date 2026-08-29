'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { CategoryTree } from './category-tree';
import { NoteEditor } from './note-editor';
import { NoteList } from './note-list';
import type {
  CategorySelection,
  HandbookCategory,
  HandbookNote,
} from './types';

const AUTOSAVE_MS = 500;
const SEARCH_DEBOUNCE_MS = 300;
const BODY_MD_MAX = 50000;

type NotePatch = { title?: string; bodyMd?: string; categoryId?: string | null };

function notesPath(selection: CategorySelection, query: string) {
  const params = new URLSearchParams();
  if (selection !== 'all') params.set('categoryId', selection);
  const q = query.trim();
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `/apps/notes/notes?${qs}` : '/apps/notes/notes';
}

function noteMatchesSelection(note: HandbookNote, selection: CategorySelection) {
  if (selection === 'all') return true;
  if (selection === 'uncategorized') return note.categoryId == null;
  return note.categoryId === selection;
}

function categoryIdForCreate(selection: CategorySelection): string | null {
  if (selection === 'all' || selection === 'uncategorized') return null;
  return selection;
}

function buildNotePatch(patch: NotePatch): {
  body: NotePatch | null;
  error: string | null;
} {
  const body: NotePatch = {};
  if (patch.title !== undefined) {
    body.title = patch.title.trim() || '无标题';
  }
  if (patch.bodyMd !== undefined) {
    if (patch.bodyMd.length > BODY_MD_MAX) {
      return { body: null, error: '正文超过 50000 字符上限' };
    }
    body.bodyMd = patch.bodyMd;
  }
  if (patch.categoryId !== undefined) {
    body.categoryId = patch.categoryId;
  }
  return { body: Object.keys(body).length > 0 ? body : null, error: null };
}

function applyPending(
  notes: HandbookNote[],
  pending: Map<string, NotePatch>,
) {
  if (pending.size === 0) return notes;
  return notes.map((n) => {
    const patch = pending.get(n.id);
    return patch ? { ...n, ...patch } : n;
  });
}

function mergePending(
  pending: Map<string, NotePatch>,
  id: string,
  patch: NotePatch,
) {
  const prev = pending.get(id);
  pending.set(id, prev ? { ...prev, ...patch } : patch);
}

function pendingPatchDiffers(a: NotePatch, b: NotePatch): boolean {
  return (
    a.title !== b.title ||
    a.bodyMd !== b.bodyMd ||
    a.categoryId !== b.categoryId
  );
}

export function NotesApp() {
  const [categories, setCategories] = useState<HandbookCategory[]>([]);
  const [notes, setNotes] = useState<HandbookNote[]>([]);
  const [selection, setSelection] = useState<CategorySelection>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const pendingRef = useRef(new Map<string, NotePatch>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingIdsRef = useRef(new Set<string>());
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const drainPendingRef = useRef<() => Promise<void>>(async () => {});

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      await drainPendingRef.current();
      const requestId = ++fetchIdRef.current;
      if (!opts?.silent) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const [nextCategories, nextNotes] = await Promise.all([
          apiFetch<HandbookCategory[]>('/apps/notes/categories'),
          apiFetch<HandbookNote[]>(notesPath(selection, debouncedQuery)),
        ]);
        if (requestId !== fetchIdRef.current) return;
        setCategories(nextCategories);
        setNotes(applyPending(nextNotes, pendingRef.current));
      } catch (err) {
        if (requestId !== fetchIdRef.current) return;
        const message =
          err instanceof Error ? err.message : '加载笔记失败';
        if (opts?.silent) {
          setActionError(message);
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setLoadError(err.message || '无权使用笔记应用');
        } else {
          setLoadError(message);
        }
      } finally {
        if (requestId === fetchIdRef.current && !opts?.silent) {
          setLoading(false);
        }
      }
    },
    [selection, debouncedQuery],
  );

  function requeuePending(id: string, failed: NotePatch) {
    const current = pendingRef.current.get(id);
    pendingRef.current.set(id, current ? { ...failed, ...current } : failed);
  }

  async function flushOne(id: string, patch: NotePatch): Promise<void> {
    const { body, error } = buildNotePatch(patch);
    if (error) {
      requeuePending(id, patch);
      setActionError(error);
      return;
    }
    if (!body) return;

    try {
      const updated = await apiFetch<HandbookNote>(
        `/apps/notes/notes/${id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      if (deletingIdsRef.current.has(id)) return;
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== updated.id) return n;
          const later = pendingRef.current.get(n.id);
          if (later) {
            return { ...n, ...later, updatedAt: updated.updatedAt };
          }
          return updated;
        }),
      );
    } catch (err) {
      if (deletingIdsRef.current.has(id)) return;
      requeuePending(id, patch);
      setActionError(err instanceof Error ? err.message : '保存失败');
    }
  }

  function flushSave(): Promise<void> {
    if (inFlightSaveRef.current) return inFlightSaveRef.current;

    const attempted = new Map<string, NotePatch>();
    const work = (async () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const id of [...pendingRef.current.keys()]) {
          const patch = pendingRef.current.get(id);
          if (!patch) continue;
          const prev = attempted.get(id);
          if (prev && !pendingPatchDiffers(prev, patch)) continue;
          pendingRef.current.delete(id);
          attempted.set(id, patch);
          await flushOne(id, patch);
          progressed = true;
        }
      }
    })();

    let inflight: Promise<void>;
    inflight = work.finally(() => {
      if (inFlightSaveRef.current === inflight) {
        inFlightSaveRef.current = null;
      }
      for (const [id, patch] of pendingRef.current) {
        const prev = attempted.get(id);
        if (!prev || pendingPatchDiffers(prev, patch)) {
          void flushSave();
          break;
        }
      }
    });
    inFlightSaveRef.current = inflight;
    return inflight;
  }

  async function drainPending(): Promise<void> {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await flushSave();
    while (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
  }

  drainPendingRef.current = drainPending;

  function scheduleSave(id: string, patch: NotePatch) {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
    mergePending(pendingRef.current, id, patch);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushSave();
    }, AUTOSAVE_MS);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void loadData({ silent: hasLoadedRef.current }).then(() => {
      hasLoadedRef.current = true;
    });
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const leftover = pendingRef.current;
      pendingRef.current = new Map();
      leftover.forEach((patch, id) => {
        const { body } = buildNotePatch(patch);
        if (!body) return;
        void apiFetch(`/apps/notes/notes/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      });
    };
  }, []);

  useEffect(() => {
    if (!selectedNoteId) return;
    if (!notes.some((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [notes, selectedNoteId]);

  async function handleSelect(next: CategorySelection) {
    await drainPending();
    setActionError(null);
    setSelection(next);
    setSelectedNoteId((current) => {
      if (!current) return null;
      const note = notes.find((n) => n.id === current);
      if (!note || !noteMatchesSelection(note, next)) return null;
      return current;
    });
  }

  async function handleCreate(
    extra?: { title?: string; bodyMd?: string },
  ) {
    await drainPending();
    setActionError(null);
    try {
      const created = await apiFetch<HandbookNote>('/apps/notes/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: extra?.title ?? '无标题',
          bodyMd: extra?.bodyMd ?? '',
          categoryId: categoryIdForCreate(selection),
        }),
      });
      setNotes((prev) => {
        if (prev.some((n) => n.id === created.id)) return prev;
        return [created, ...prev];
      });
      setSelectedNoteId(created.id);
      await loadData({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '创建笔记失败');
    }
  }

  async function handleSelectNote(id: string) {
    if (id === selectedNoteId) return;
    await drainPending();
    setSelectedNoteId(id);
  }

  function handleChangeTitle(title: string) {
    if (!selectedNoteId) return;
    setActionError(null);
    scheduleSave(selectedNoteId, { title });
  }

  function handleChangeBody(bodyMd: string) {
    if (!selectedNoteId) return;
    setActionError(null);
    scheduleSave(selectedNoteId, { bodyMd });
  }

  async function handleDeleteNote() {
    if (!selectedNoteId) return;
    if (!confirm('确定删除该笔记？')) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current.delete(selectedNoteId);
    if (pendingRef.current.size > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flushSave();
      }, AUTOSAVE_MS);
    }
    setActionError(null);
    const id = selectedNoteId;
    deletingIdsRef.current.add(id);
    try {
      await apiFetch(`/apps/notes/notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setSelectedNoteId(null);
    } catch (err) {
      deletingIdsRef.current.delete(id);
      setActionError(err instanceof Error ? err.message : '删除笔记失败');
    }
  }

  async function handleCreateCategory(name: string, parentId?: string | null) {
    setActionError(null);
    try {
      await apiFetch<HandbookCategory>('/apps/notes/categories', {
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
      await apiFetch<HandbookCategory>(`/apps/notes/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await loadData({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '重命名分类失败');
    }
  }

  async function handleDeleteCategory(id: string) {
    setActionError(null);
    try {
      await apiFetch(`/apps/notes/categories/${id}`, { method: 'DELETE' });
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

  const selectedNote =
    notes.find((n) => n.id === selectedNoteId) ?? null;

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
      <div className="handbook-app__search">
        <input
          type="search"
          className="handbook-app__search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="搜索标题和正文"
          aria-label="搜索笔记"
        />
      </div>
      <div className="handbook-app__cols">
        <aside className="handbook-app__tree">
          <CategoryTree
            categories={categories}
            selection={selection}
            onSelect={(next) => void handleSelect(next)}
            onCreate={handleCreateCategory}
            onRename={handleRename}
            onDelete={handleDeleteCategory}
          />
        </aside>
        <section className="handbook-app__list">
          <NoteList
            notes={notes}
            selectedNoteId={selectedNoteId}
            query={query}
            onSelect={(id) => void handleSelectNote(id)}
            onCreate={() => handleCreate()}
          />
        </section>
        <section className="handbook-app__editor">
          <NoteEditor
            key={selectedNote?.id ?? 'empty'}
            note={selectedNote}
            onChangeTitle={handleChangeTitle}
            onChangeBody={handleChangeBody}
            onDelete={handleDeleteNote}
          />
        </section>
      </div>
    </div>
  );
}
