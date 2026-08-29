'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { HandbookCategory, HandbookNote } from './types';

export type NoteEditorProps = {
  note: HandbookNote | null;
  categories: HandbookCategory[];
  onChangeTitle: (title: string) => void;
  onChangeBody: (bodyMd: string) => void;
  onChangeCategory: (categoryId: string | null) => void;
  onDelete: () => void | Promise<void>;
};

type EditorMode = 'edit' | 'preview';

function categoryOptions(categories: HandbookCategory[]) {
  const sorted = [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh'),
  );
  const childrenOf = (id: string) =>
    sorted.filter((c) => c.parentId === id);
  const roots = sorted.filter((c) => c.parentId == null);
  const options: { id: string; label: string }[] = [];
  for (const root of roots) {
    options.push({ id: root.id, label: root.name });
    for (const child of childrenOf(root.id)) {
      options.push({ id: child.id, label: `${root.name} / ${child.name}` });
    }
  }
  const seen = new Set(options.map((o) => o.id));
  for (const c of sorted) {
    if (!seen.has(c.id)) options.push({ id: c.id, label: c.name });
  }
  return options;
}

export function NoteEditor({
  note,
  categories,
  onChangeTitle,
  onChangeBody,
  onChangeCategory,
  onDelete,
}: NoteEditorProps) {
  const [mode, setMode] = useState<EditorMode>('edit');

  if (!note) {
    return (
      <div className="handbook-editor__empty">选择或新建一篇笔记</div>
    );
  }

  return (
    <div className="handbook-editor">
      <input
        className="handbook-editor__title"
        value={note.title}
        onChange={(e) => onChangeTitle(e.target.value)}
        aria-label="笔记标题"
        placeholder="无标题"
        maxLength={191}
      />
      <label className="handbook-editor__category">
        <span className="handbook-editor__category-label">分类</span>
        <select
          className="handbook-editor__category-select"
          value={note.categoryId ?? ''}
          onChange={(e) => onChangeCategory(e.target.value || null)}
          aria-label="笔记分类"
        >
          <option value="">未分类</option>
          {categoryOptions(categories).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <div className="handbook-editor__tabs" role="tablist" aria-label="编辑或预览">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'edit'}
          className={
            mode === 'edit'
              ? 'handbook-editor__tab handbook-editor__tab--active'
              : 'handbook-editor__tab'
          }
          onClick={() => setMode('edit')}
        >
          编辑
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          className={
            mode === 'preview'
              ? 'handbook-editor__tab handbook-editor__tab--active'
              : 'handbook-editor__tab'
          }
          onClick={() => setMode('preview')}
        >
          预览
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea
          className="handbook-editor__body"
          value={note.bodyMd}
          onChange={(e) => onChangeBody(e.target.value)}
          aria-label="笔记正文"
          placeholder="使用 Markdown 编写…"
          maxLength={50000}
        />
      ) : (
        <div className="handbook-editor__preview handbook-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {note.bodyMd}
          </ReactMarkdown>
        </div>
      )}
      <button
        type="button"
        className="handbook-editor__delete"
        onClick={() => void onDelete()}
      >
        删除
      </button>
    </div>
  );
}
