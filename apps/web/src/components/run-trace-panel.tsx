'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRunTimeline,
  stringifyTracePayload,
  toolKindBadge,
  type AgentStep,
  type ToolStep,
} from '@/lib/run-trace';
import type { RuntimeEvent } from '@/lib/types';

export default function RunTracePanel({
  events,
  running,
}: {
  events: RuntimeEvent[];
  running?: boolean;
}) {
  const timeline = useMemo(() => buildRunTimeline(events), [events]);
  const [expandAll, setExpandAll] = useState(false);

  if (timeline.steps.length === 0 && !running) return null;

  const summary = running
    ? '执行中'
    : timeline.status === 'error'
      ? '执行失败'
      : '已完成';

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          fontSize: 12,
          color: '#64748b',
        }}
      >
        {running ? <PulseDot /> : <CheckDot ok={timeline.status !== 'error'} />}
        <span style={{ fontWeight: 600, color: '#475569' }}>{summary}</span>
        {timeline.steps.length > 0 && (
          <span>{timeline.steps.length} 步</span>
        )}
        {timeline.durationSec != null && !running && (
          <span>· {timeline.durationSec}s</span>
        )}
        {timeline.steps.length > 2 && (
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
            }}
          >
            {expandAll ? '全部收起' : '全部展开'}
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 0,
          borderLeft: '1px solid #e8edf2',
          marginLeft: 5,
          paddingLeft: 14,
        }}
      >
        {timeline.steps.length === 0 && running && (
          <div style={{ fontSize: 13, color: '#94a3b8', padding: '4px 0' }}>
            正在准备…
          </div>
        )}
        {timeline.steps.map((step, i) => (
          <TimelineStepRow
            key={step.id}
            step={step}
            forceOpen={expandAll}
            autoOpen={
              Boolean(running) &&
              i === timeline.steps.length - 1 &&
              step.status === 'running'
            }
          />
        ))}
      </div>
    </div>
  );
}

function TimelineStepRow({
  step,
  forceOpen,
  autoOpen,
}: {
  step: AgentStep;
  forceOpen: boolean;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const userToggled = useRef(false);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    if (userToggled.current) return;
    if (autoOpen) setOpen(true);
    else if (!autoOpen && step.status !== 'running') setOpen(false);
  }, [forceOpen, autoOpen, step.status]);

  const hasDetail =
    step.kind === 'thinking'
      ? step.body.trim().length > 0
      : Boolean(
          formatToolPayload(step.toolName, step.input, 'input') ||
            formatToolPayload(step.toolName, step.output, 'output'),
        );

  const badge = step.kind === 'thinking' ? 'Thinking' : toolKindBadge(step.toolName);
  const title = step.kind === 'thinking' ? step.summary : step.label;

  return (
    <div style={{ padding: '3px 0 6px', position: 'relative' }}>
      <span
        style={{
          position: 'absolute',
          left: -18,
          top: 10,
          width: 7,
          height: 7,
          borderRadius: 999,
          background:
            step.status === 'running'
              ? '#3b82f6'
              : step.status === 'error'
                ? '#ef4444'
                : '#94a3b8',
          boxShadow:
            step.status === 'running'
              ? '0 0 0 3px rgba(59,130,246,0.18)'
              : 'none',
        }}
      />

      <button
        type="button"
        onClick={() => {
          if (!hasDetail) return;
          userToggled.current = true;
          setOpen((v) => !v);
        }}
        style={{
          width: '100%',
          border: 'none',
          background: open ? '#f8fafc' : 'transparent',
          borderRadius: 8,
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: hasDetail ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 650,
            color: step.kind === 'thinking' ? '#7c6fad' : '#0f6e56',
            background: step.kind === 'thinking' ? '#f3f0fa' : '#e8f6f0',
            borderRadius: 6,
            padding: '2px 7px',
            minWidth: 64,
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: '#334155',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily:
              step.kind === 'tool' && step.toolName === 'bash'
                ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
                : 'inherit',
          }}
        >
          {title}
        </span>
        {step.status === 'running' && (
          <span style={{ fontSize: 11, color: '#3b82f6', flexShrink: 0 }}>
            …
          </span>
        )}
        {hasDetail && (
          <span
            style={{
              color: '#94a3b8',
              fontSize: 11,
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.12s ease',
              flexShrink: 0,
            }}
          >
            ▾
          </span>
        )}
      </button>

      {open && hasDetail && (
        <div style={{ marginTop: 4, marginLeft: 4 }}>
          {step.kind === 'thinking' ? (
            <ScrollBody text={step.body} live={step.status === 'running'} />
          ) : (
            <ToolDetail step={step} />
          )}
        </div>
      )}
    </div>
  );
}

function ToolDetail({ step }: { step: ToolStep }) {
  const inputBlock = formatToolPayload(step.toolName, step.input, 'input');
  const outputBlock = formatToolPayload(step.toolName, step.output, 'output');
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {inputBlock && (
        <PayloadBlock title={inputBlock.title} text={inputBlock.text} dark={inputBlock.dark} />
      )}
      {outputBlock && (
        <PayloadBlock title={outputBlock.title} text={outputBlock.text} dark={outputBlock.dark} />
      )}
    </div>
  );
}

function ScrollBody({ text, live }: { text: string; live?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!live || !ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [text, live]);

  return (
    <div
      ref={ref}
      style={{
        fontSize: 12.5,
        lineHeight: 1.6,
        color: '#64748b',
        background: '#fafbfc',
        border: '1px solid #eef2f6',
        borderRadius: 8,
        padding: '8px 10px',
        whiteSpace: 'pre-wrap',
        maxHeight: 200,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      {text}
    </div>
  );
}

function PayloadBlock({
  title,
  text,
  dark,
}: {
  title: string;
  text: string;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: dark ? 'none' : '1px solid #eef2f6',
        background: dark ? '#0f172a' : '#fafbfc',
      }}
    >
      <div
        style={{
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: dark ? '#94a3b8' : '#64748b',
          borderBottom: dark ? '1px solid #1e293b' : '1px solid #eef2f6',
        }}
      >
        {title}
      </div>
      <pre
        style={{
          margin: 0,
          padding: '8px 10px',
          color: dark ? '#e2e8f0' : '#334155',
          fontSize: 12,
          lineHeight: 1.5,
          overflow: 'auto',
          maxHeight: 180,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function formatToolPayload(
  toolName: string,
  value: unknown,
  kind: 'input' | 'output',
): { title: string; text: string; dark?: boolean } | null {
  if (kind === 'input' && toolName === 'bash' && value && typeof value === 'object') {
    const command = (value as { command?: unknown }).command;
    if (typeof command === 'string' && command.trim()) {
      return { title: 'command', text: command, dark: true };
    }
  }

  if (
    kind === 'input' &&
    value &&
    typeof value === 'object' &&
    'path' in (value as object)
  ) {
    const obj = value as Record<string, unknown>;
    const path = String(obj.path ?? '');
    if (toolName === 'write' && typeof obj.content === 'string') {
      const content = obj.content as string;
      const preview =
        content.length > 2000 ? `${content.slice(0, 2000)}…` : content;
      return {
        title: path || 'input',
        text: preview,
      };
    }
    if (path && (toolName === 'read' || toolName === 'edit')) {
      const text = stringifyTracePayload(value);
      if (!text) return { title: 'path', text: path };
    }
  }

  const text = stringifyTracePayload(value);
  if (!text) return null;
  return {
    title: kind === 'input' ? 'input' : 'output',
    text: text.length > 8000 ? `${text.slice(0, 8000)}…` : text,
    dark: toolName === 'bash' && kind === 'output',
  };
}

function PulseDot() {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: '#3b82f6',
        display: 'inline-block',
        boxShadow: '0 0 0 3px rgba(59,130,246,0.2)',
      }}
    />
  );
}

function CheckDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: ok ? '#10b981' : '#ef4444',
        display: 'inline-block',
      }}
    />
  );
}
