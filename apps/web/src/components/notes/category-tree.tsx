'use client';

import { useEffect, useRef, useState } from 'react';
import type { CategorySelection, HandbookCategory } from './types';

export type CategoryTreeProps = {
  categories: HandbookCategory[];
  selection: CategorySelection;
  onSelect: (selection: CategorySelection) => void;
  onCreate: (name: string, parentId?: string | null) => void | Promise<void>;
  onRename: (id: string, name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

type Draft =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'rename'; id: string; name: string };

function itemClass(active: boolean, extra?: string) {
  return [
    'handbook-tree__item',
    extra,
    active ? 'handbook-tree__item--active' : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

function NameField({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <input
      className="handbook-tree__input"
      value={value}
      autoFocus
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={64}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

export function CategoryTree({
  categories,
  selection,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: CategoryTreeProps) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [createName, setCreateName] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);

  const roots = categories.filter((c) => c.parentId === null);
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parentId === id);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuId(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function startCreate(parentId: string | null) {
    submittingRef.current = false;
    setMenuId(null);
    setCreateName('');
    setDraft({ mode: 'create', parentId });
  }

  function submitCreate() {
    if (submittingRef.current) return;
    const name = createName.trim();
    if (!name || draft?.mode !== 'create') {
      setDraft(null);
      return;
    }
    submittingRef.current = true;
    void onCreate(name, draft.parentId);
    setDraft(null);
    setCreateName('');
  }

  function startRename(cat: HandbookCategory) {
    submittingRef.current = false;
    setMenuId(null);
    setDraft({ mode: 'rename', id: cat.id, name: cat.name });
  }

  function submitRename() {
    if (submittingRef.current || draft?.mode !== 'rename') return;
    const name = draft.name.trim();
    if (!name || name === categories.find((c) => c.id === draft.id)?.name) {
      setDraft(null);
      return;
    }
    submittingRef.current = true;
    void onRename(draft.id, name);
    setDraft(null);
  }

  function confirmDelete(id: string) {
    setMenuId(null);
    if (!confirm('确定删除该分类？分类下的笔记将移到「未分类」。')) return;
    void onDelete(id);
  }

  function renderMenu(cat: HandbookCategory, canAddChild: boolean) {
    if (menuId !== cat.id) return null;
    return (
      <div className="handbook-tree__menu" role="menu">
        <button type="button" role="menuitem" onClick={() => startRename(cat)}>
          重命名
        </button>
        {canAddChild && (
          <button
            type="button"
            role="menuitem"
            onClick={() => startCreate(cat.id)}
          >
            添加子分类
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => confirmDelete(cat.id)}
        >
          删除
        </button>
      </div>
    );
  }

  function renderRow(cat: HandbookCategory, child: boolean) {
    const renaming = draft?.mode === 'rename' && draft.id === cat.id;
    return (
      <div
        className={itemClass(
          selection === cat.id,
          child ? 'handbook-tree__item--child' : undefined,
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuId(cat.id);
        }}
      >
        {renaming && draft.mode === 'rename' ? (
          <NameField
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
            onSubmit={submitRename}
            onCancel={() => setDraft(null)}
            placeholder="分类名称"
            ariaLabel="重命名分类"
          />
        ) : (
          <>
            <button
              type="button"
              className="handbook-tree__label"
              onClick={() => onSelect(cat.id)}
            >
              {cat.name}
            </button>
            <button
              type="button"
              className="handbook-tree__more"
              aria-label="分类操作"
              aria-haspopup="menu"
              aria-expanded={menuId === cat.id}
              onClick={(e) => {
                e.stopPropagation();
                setMenuId((cur) => (cur === cat.id ? null : cat.id));
              }}
            >
              ⋯
            </button>
          </>
        )}
        {renderMenu(cat, !child)}
      </div>
    );
  }

  const creatingRoot = draft?.mode === 'create' && draft.parentId === null;

  return (
    <nav className="handbook-tree" ref={rootRef} aria-label="分类">
      <div className="handbook-tree__head">
        <span className="handbook-tree__head-title">分类</span>
        <button
          type="button"
          className="handbook-tree__head-add"
          aria-label="新建分类"
          onClick={() => startCreate(null)}
        >
          +
        </button>
      </div>
      <ul className="handbook-tree__list">
        <li>
          <button
            type="button"
            className={itemClass(selection === 'all')}
            onClick={() => onSelect('all')}
          >
            全部
          </button>
        </li>
        <li>
          <button
            type="button"
            className={itemClass(selection === 'uncategorized')}
            onClick={() => onSelect('uncategorized')}
          >
            未分类
          </button>
        </li>
        {roots.map((root) => (
          <li key={root.id}>
            {renderRow(root, false)}
            <ul className="handbook-tree__children">
              {childrenOf(root.id).map((child) => (
                <li key={child.id}>{renderRow(child, true)}</li>
              ))}
              {draft?.mode === 'create' && draft.parentId === root.id && (
                <li className="handbook-tree__item handbook-tree__item--child">
                  <NameField
                    value={createName}
                    onChange={setCreateName}
                    onSubmit={submitCreate}
                    onCancel={() => setDraft(null)}
                    placeholder="子分类名称"
                    ariaLabel="新建子分类"
                  />
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
      {creatingRoot ? (
        <NameField
          value={createName}
          onChange={setCreateName}
          onSubmit={submitCreate}
          onCancel={() => setDraft(null)}
          placeholder="分类名称"
          ariaLabel="新建分类"
        />
      ) : null}
    </nav>
  );
}
