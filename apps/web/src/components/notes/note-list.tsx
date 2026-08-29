'use client';

import type { HandbookNote } from './types';

export type NoteListProps = {
  notes: HandbookNote[];
  selectedNoteId: string | null;
  query: string;
  onSelect: (id: string) => void;
  onCreate: () => void | Promise<void>;
};

function formatUpdatedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function itemClass(active: boolean) {
  return [
    'handbook-list__item',
    active ? 'handbook-list__item--active' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

export function NoteList({
  notes,
  selectedNoteId,
  query,
  onSelect,
  onCreate,
}: NoteListProps) {
  const searching = Boolean(query.trim());

  return (
    <div className="handbook-list">
      <div className="handbook-list__head">
        <button
          type="button"
          className="handbook-list__new"
          onClick={() => void onCreate()}
        >
          + 新建
        </button>
      </div>
      {notes.length === 0 ? (
        searching ? (
          <div className="handbook-list__empty">
            <p>没有匹配的笔记</p>
          </div>
        ) : null
      ) : (
        <ul className="handbook-list__items">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className={itemClass(selectedNoteId === note.id)}
                onClick={() => onSelect(note.id)}
              >
                <span className="handbook-list__title">
                  {note.pinned && (
                    <span className="handbook-list__pin">置顶</span>
                  )}
                  {note.title}
                </span>
                <span className="handbook-list__time">
                  {formatUpdatedAt(note.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
