'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Markdown } from 'tiptap-markdown';
import type { HandbookNote } from './types';

const BODY_MD_MAX = 50000;

const HIGHLIGHTS = [
  { label: '黄', value: '#fef08a' },
  { label: '绿', value: '#bbf7d0' },
  { label: '蓝', value: '#bfdbfe' },
  { label: '粉', value: '#fbcfe8' },
  { label: '橙', value: '#fed7aa' },
];

const TEXT_COLORS = [
  { label: '默认', value: '' },
  { label: '红', value: '#dc2626' },
  { label: '橙', value: '#ea580c' },
  { label: '绿', value: '#16a34a' },
  { label: '蓝', value: '#2563eb' },
  { label: '紫', value: '#7c3aed' },
  { label: '灰', value: '#64748b' },
];

export type NoteEditorProps = {
  note: HandbookNote | null;
  onChangeTitle: (title: string) => void;
  onChangeBody: (bodyMd: string) => void;
  onDelete: () => void | Promise<void>;
  onOpenAi?: () => void;
  aiOpen?: boolean;
};

function Tool(props: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { title, active, disabled, onClick, children, wide } = props;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={[
        'hb-tool',
        wide ? 'hb-tool--wide' : null,
        active ? 'hb-tool--on' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="hb-tool-sep" aria-hidden />;
}

function readMarkdown(editor: Editor) {
  return (
    (
      editor.storage as {
        markdown?: { getMarkdown?: () => string };
      }
    ).markdown?.getMarkdown?.() ?? ''
  );
}

function countChars(text: string) {
  return text.replace(/\s+/g, '').length;
}

function blockValue(editor: Editor | null) {
  if (!editor) return 'paragraph';
  if (editor.isActive('heading', { level: 1 })) return 'h1';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('bulletList')) return 'bullet';
  if (editor.isActive('orderedList')) return 'ordered';
  if (editor.isActive('blockquote')) return 'quote';
  if (editor.isActive('codeBlock')) return 'code';
  return 'paragraph';
}

function setBlock(editor: Editor, value: string) {
  const c = editor.chain().focus();
  if (value === 'h1') c.toggleHeading({ level: 1 }).run();
  else if (value === 'h2') c.toggleHeading({ level: 2 }).run();
  else if (value === 'h3') c.toggleHeading({ level: 3 }).run();
  else if (value === 'bullet') c.toggleBulletList().run();
  else if (value === 'ordered') c.toggleOrderedList().run();
  else if (value === 'quote') c.toggleBlockquote().run();
  else if (value === 'code') c.toggleCodeBlock().run();
  else c.setParagraph().run();
}

function setLink(editor: Editor) {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  const prev = editor.getAttributes('link').href as string | undefined;
  const href = window.prompt('链接地址', prev ?? 'https://');
  if (href === null) return;
  const next = href.trim();
  if (!next) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run();
}

export function NoteEditor({
  note,
  onChangeTitle,
  onChangeBody,
  onDelete,
  onOpenAi,
  aiOpen,
}: NoteEditorProps) {
  const [insertOpen, setInsertOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [, bump] = useState(0);
  const lastEmittedMdRef = useRef('');

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        }),
        Placeholder.configure({ placeholder: '请输入正文' }),
        Markdown.configure({
          html: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: note?.bodyMd ?? '',
      editorProps: {
        attributes: {
          class: 'hb-prose',
          'aria-label': '笔记正文',
        },
      },
      onUpdate: ({ editor: ed }) => {
        setCharCount(countChars(ed.getText()));
        bump((n) => n + 1);
        const md = readMarkdown(ed);
        if (md.length > BODY_MD_MAX) return;
        lastEmittedMdRef.current = md;
        onChangeBody(md);
      },
      onSelectionUpdate: () => bump((n) => n + 1),
    },
    [note?.id],
  );

  useEffect(() => {
    if (!note) return;
    lastEmittedMdRef.current = note.bodyMd;
  }, [note?.id]);

  useEffect(() => {
    if (!editor || !note) return;
    const incoming = note.bodyMd;
    const currentMd = readMarkdown(editor);
    if (incoming === lastEmittedMdRef.current || incoming === currentMd) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
    lastEmittedMdRef.current = incoming;
    setCharCount(countChars(editor.getText()));
  }, [editor, note?.bodyMd, note?.id]);

  useEffect(() => {
    if (!editor) return;
    setCharCount(countChars(editor.getText()));
  }, [editor, note?.id]);

  if (!note) {
    return (
      <div className="hb-editor hb-editor--empty">
        <div className="hb-editor__blank">
          <div className="hb-editor__blank-mark" aria-hidden />
          <p>从左侧选择分类，或新建一篇笔记</p>
        </div>
      </div>
    );
  }

  const run = (fn: (ed: Editor) => void) => {
    if (editor) fn(editor);
  };

  return (
    <div className="hb-editor">
      <div
        className="hb-toolbar"
        role="toolbar"
        aria-label="编辑工具栏"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Tool
          title="撤销"
          disabled={!editor?.can().undo()}
          onClick={() => run((ed) => ed.chain().focus().undo().run())}
        >
          ↺
        </Tool>
        <Tool
          title="重做"
          disabled={!editor?.can().redo()}
          onClick={() => run((ed) => ed.chain().focus().redo().run())}
        >
          ↻
        </Tool>
        <Tool
          title="清除格式"
          disabled={!editor}
          onClick={() =>
            run((ed) => ed.chain().focus().unsetAllMarks().clearNodes().run())
          }
        >
          ⌫
        </Tool>

        <Sep />

        <div className="hb-toolbar__menu-wrap">
          <Tool
            title="插入"
            wide
            disabled={!editor}
            active={insertOpen}
            onClick={() => {
              setInsertOpen((v) => !v);
              setHighlightOpen(false);
              setColorOpen(false);
              setMoreOpen(false);
            }}
          >
            ＋ 插入 ▾
          </Tool>
          {insertOpen && editor ? (
            <div className="hb-pop" role="menu">
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setLink(editor);
                  setInsertOpen(false);
                }}
              >
                链接
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setHorizontalRule().run();
                  setInsertOpen(false);
                }}
              >
                分隔线
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().toggleCodeBlock().run();
                  setInsertOpen(false);
                }}
              >
                代码块
              </button>
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().toggleBlockquote().run();
                  setInsertOpen(false);
                }}
              >
                引用
              </button>
            </div>
          ) : null}
        </div>

        <Sep />

        <Tool
          title="加粗"
          active={editor?.isActive('bold')}
          disabled={!editor}
          onClick={() => run((ed) => ed.chain().focus().toggleBold().run())}
        >
          <strong>B</strong>
        </Tool>
        <Tool
          title="斜体"
          active={editor?.isActive('italic')}
          disabled={!editor}
          onClick={() => run((ed) => ed.chain().focus().toggleItalic().run())}
        >
          <em>I</em>
        </Tool>
        <Tool
          title="下划线"
          active={editor?.isActive('underline')}
          disabled={!editor}
          onClick={() =>
            run((ed) => ed.chain().focus().toggleUnderline().run())
          }
        >
          <span className="hb-tool__u">U</span>
        </Tool>
        <Tool
          title="删除线"
          active={editor?.isActive('strike')}
          disabled={!editor}
          onClick={() => run((ed) => ed.chain().focus().toggleStrike().run())}
        >
          <span className="hb-tool__s">S</span>
        </Tool>

        <div className="hb-toolbar__menu-wrap">
          <Tool
            title="高亮"
            active={Boolean(editor?.isActive('highlight')) || highlightOpen}
            disabled={!editor}
            onClick={() => {
              setHighlightOpen((v) => !v);
              setColorOpen(false);
              setInsertOpen(false);
              setMoreOpen(false);
            }}
          >
            <span className="hb-tool__mark">H</span>
          </Tool>
          {highlightOpen && editor ? (
            <div className="hb-pop hb-pop--swatches" role="menu">
              {HIGHLIGHTS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  role="menuitem"
                  title={h.label}
                  className="hb-swatch"
                  style={{ background: h.value }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .toggleHighlight({ color: h.value })
                      .run();
                    setHighlightOpen(false);
                  }}
                />
              ))}
              <button
                type="button"
                role="menuitem"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setHighlightOpen(false);
                }}
              >
                清除
              </button>
            </div>
          ) : null}
        </div>

        <div className="hb-toolbar__menu-wrap">
          <Tool
            title="文字颜色"
            active={colorOpen}
            disabled={!editor}
            onClick={() => {
              setColorOpen((v) => !v);
              setHighlightOpen(false);
              setInsertOpen(false);
              setMoreOpen(false);
            }}
          >
            <span className="hb-tool__a">A</span>
          </Tool>
          {colorOpen && editor ? (
            <div className="hb-pop hb-pop--swatches" role="menu">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  role="menuitem"
                  title={c.label}
                  className="hb-swatch hb-swatch--text"
                  style={{
                    color: c.value || 'inherit',
                    borderBottomColor: c.value || '#94a3b8',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (!c.value) editor.chain().focus().unsetColor().run();
                    else editor.chain().focus().setColor(c.value).run();
                    setColorOpen(false);
                  }}
                >
                  A
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Sep />

        <label className="hb-block-select">
          <span className="sr-only">段落样式</span>
          <select
            value={blockValue(editor)}
            disabled={!editor}
            aria-label="段落样式"
            onChange={(e) => {
              if (!editor) return;
              setBlock(editor, e.target.value);
            }}
          >
            <option value="paragraph">正文</option>
            <option value="h1">标题 1</option>
            <option value="h2">标题 2</option>
            <option value="h3">标题 3</option>
            <option value="bullet">无序列表</option>
            <option value="ordered">有序列表</option>
            <option value="quote">引用</option>
            <option value="code">代码块</option>
          </select>
        </label>

        <Tool
          title="左对齐"
          active={
            !editor?.isActive({ textAlign: 'center' }) &&
            !editor?.isActive({ textAlign: 'right' })
          }
          disabled={!editor}
          onClick={() =>
            run((ed) => ed.chain().focus().setTextAlign('left').run())
          }
        >
          L
        </Tool>
        <Tool
          title="居中"
          active={editor?.isActive({ textAlign: 'center' })}
          disabled={!editor}
          onClick={() =>
            run((ed) => ed.chain().focus().setTextAlign('center').run())
          }
        >
          C
        </Tool>
        <Tool
          title="右对齐"
          active={editor?.isActive({ textAlign: 'right' })}
          disabled={!editor}
          onClick={() =>
            run((ed) => ed.chain().focus().setTextAlign('right').run())
          }
        >
          R
        </Tool>

        <Tool
          title="AI 改稿"
          wide
          active={aiOpen}
          disabled={!note || !onOpenAi}
          onClick={() => onOpenAi?.()}
        >
          AI
        </Tool>

        <div className="hb-toolbar__spacer" />

        <div className="hb-toolbar__menu-wrap">
          <Tool
            title="更多"
            active={moreOpen}
            onClick={() => {
              setMoreOpen((v) => !v);
              setInsertOpen(false);
              setHighlightOpen(false);
              setColorOpen(false);
            }}
          >
            ...
          </Tool>
          {moreOpen ? (
            <div className="hb-pop hb-pop--right" role="menu">
              <button
                type="button"
                role="menuitem"
                className="hb-pop__danger"
                onClick={() => {
                  setMoreOpen(false);
                  void onDelete();
                }}
              >
                删除笔记
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hb-doc">
        <input
          className="hb-doc__title"
          value={note.title === '无标题' ? '' : note.title}
          onChange={(e) => onChangeTitle(e.target.value || '无标题')}
          aria-label="笔记标题"
          placeholder="请输入标题"
          maxLength={191}
        />
        <div className="hb-doc__body">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="hb-status">
        <span>{charCount} 个字</span>
      </div>
    </div>
  );
}
