'use client';

import type { HandbookCategory, HandbookNote } from './types';

export type NoteListProps = {
  notes: HandbookNote[];
  selectedNoteId: string | null;
  query: string;
  childCategories: HandbookCategory[];
  breadcrumb: Array<{ id: string | null; name: string }>;
  onSelectNote: (id: string) => void;
  onOpenCategory: (id: string) => void;
  onBreadcrumb: (id: string | null) => void;
  onCreate: () => void | Promise<void>;
};

function formatUpdatedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FolderGlyph() {
  return (
    <svg
      className="handbook-list__folder-icon"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h4.1c.5 0 1 .2 1.3.6l1.1 1.2c.3.4.8.6 1.3.6H21.5A2.5 2.5 0 0 1 24 10.9V20a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 4 20V8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function noteItemClass(active: boolean) {
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
  childCategories,
  breadcrumb,
  onSelectNote,
  onOpenCategory,
  onBreadcrumb,
  onCreate,
}: NoteListProps) {
  const searching = Boolean(query.trim());
  const showFolders = !searching && childCategories.length > 0;
  const empty = !showFolders && notes.length === 0;

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

      {breadcrumb.length > 0 ? (
        <nav className="handbook-list__crumb" aria-label="分类路径">
          {breadcrumb.map((crumb, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <span key={crumb.id ?? 'root'} className="handbook-list__crumb-part">
                {index > 0 ? (
                  <span className="handbook-list__crumb-sep" aria-hidden>
                    /
                  </span>
                ) : null}
                {isLast ? (
                  <span className="handbook-list__crumb-current">{crumb.name}</span>
                ) : (
                  <button
                    type="button"
                    className="handbook-list__crumb-link"
                    onClick={() => onBreadcrumb(crumb.id)}
                  >
                    {crumb.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      {showFolders ? (
        <ul className="handbook-list__folders">
          {childCategories.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                className="handbook-list__folder"
                onClick={() => onOpenCategory(cat.id)}
              >
                <FolderGlyph />
                <span className="handbook-list__folder-text">
                  <span className="handbook-list__folder-name">{cat.name}</span>
                  <span className="handbook-list__folder-meta">
                    {cat.noteCount ?? 0} 项
                    {cat.updatedAt
                      ? ` · ${formatUpdatedAt(cat.updatedAt)}更新`
                      : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        searching ? (
          <div className="handbook-list__empty">
            <p>没有匹配的笔记</p>
          </div>
        ) : showFolders ? null : (
          <div className="handbook-list__empty">
            <p>暂无笔记</p>
          </div>
        )
      ) : notes.length === 0 ? null : (
        <ul className="handbook-list__items">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className={noteItemClass(selectedNoteId === note.id)}
                onClick={() => onSelectNote(note.id)}
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
