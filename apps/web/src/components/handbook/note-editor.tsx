'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { HandbookNote } from './types';

export type NoteEditorProps = {
  note: HandbookNote | null;
  onChangeTitle: (title: string) => void;
  onChangeBody: (bodyMd: string) => void;
  onDelete: () => void | Promise<void>;
};

type EditorMode = 'edit' | 'preview';

export function NoteEditor({
  note,
  onChangeTitle,
  onChangeBody,
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
      />
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
