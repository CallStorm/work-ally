'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
import type { HandbookNote } from './types';

const BODY_MD_MAX = 50000;

export type NoteEditorProps = {
  note: HandbookNote | null;
  onChangeTitle: (title: string) => void;
  onChangeBody: (bodyMd: string) => void;
  onDelete: () => void | Promise<void>;
};

type ToolbarBtnProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarBtn({ label, active, disabled, onClick }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={
        active
          ? 'handbook-editor__tool handbook-editor__tool--active'
          : 'handbook-editor__tool'
      }
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function getMarkdown(editor: NonNullable<ReturnType<typeof useEditor>>) {
  return (
    editor.storage as { markdown?: { getMarkdown?: () => string } }
  ).markdown?.getMarkdown?.() ?? '';
}

export function NoteEditor({
  note,
  onChangeTitle,
  onChangeBody,
  onDelete,
}: NoteEditorProps) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        }),
        Placeholder.configure({
          placeholder: '开始编写…',
        }),
        Markdown.configure({
          html: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: note?.bodyMd ?? '',
      editorProps: {
        attributes: {
          class: 'handbook-editor__prose',
          'aria-label': '笔记正文',
        },
      },
      onUpdate: ({ editor: ed }) => {
        const md = getMarkdown(ed);
        if (md.length > BODY_MD_MAX) {
          return;
        }
        onChangeBody(md);
      },
    },
    [note?.id],
  );

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

      <div
        className="handbook-editor__toolbar"
        role="toolbar"
        aria-label="格式"
      >
        <ToolbarBtn
          label="B"
          active={editor?.isActive('bold')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarBtn
          label="I"
          active={editor?.isActive('italic')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarBtn
          label="U"
          active={editor?.isActive('underline')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <span className="handbook-editor__tool-sep" aria-hidden />
        <ToolbarBtn
          label="H1"
          active={editor?.isActive('heading', { level: 1 })}
          disabled={!editor}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarBtn
          label="H2"
          active={editor?.isActive('heading', { level: 2 })}
          disabled={!editor}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarBtn
          label="H3"
          active={editor?.isActive('heading', { level: 3 })}
          disabled={!editor}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <span className="handbook-editor__tool-sep" aria-hidden />
        <ToolbarBtn
          label="列表"
          active={editor?.isActive('bulletList')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarBtn
          label="编号"
          active={editor?.isActive('orderedList')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarBtn
          label="引用"
          active={editor?.isActive('blockquote')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarBtn
          label="代码"
          active={editor?.isActive('codeBlock')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
        <ToolbarBtn
          label="链接"
          active={editor?.isActive('link')}
          disabled={!editor}
          onClick={() => {
            if (!editor) return;
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const prev = editor.getAttributes('link').href as string | undefined;
            const href = window.prompt('链接地址', prev ?? 'https://');
            if (href === null) return;
            const trimmed = href.trim();
            if (!trimmed) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href: trimmed }).run();
          }}
        />
      </div>

      <div className="handbook-editor__canvas">
        <EditorContent editor={editor} />
      </div>

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
