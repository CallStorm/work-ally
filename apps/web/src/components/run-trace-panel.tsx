'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildRunTrace,
  formatToolLabel,
  stringifyTracePayload,
  type RunTracePhase,
  type RunTraceSubStep,
} from '@/lib/run-trace';
import type { RuntimeEvent } from '@/lib/types';

export default function RunTracePanel({
  events,
  running,
}: {
  events: RuntimeEvent[];
  running?: boolean;
}) {
  const trace = useMemo(() => buildRunTrace(events), [events]);
  const [expanded, setExpanded] = useState(Boolean(running));

  useEffect(() => {
    if (running) setExpanded(true);
    if (!running && trace.status === 'done') setExpanded(false);
  }, [running, trace.status]);

  if (trace.phases.length === 0 && !running) return null;

  const toolCount = trace.phases.reduce((n, p) => n + p.steps.length, 0);
  const summary = running
    ? '执行中…'
    : trace.status === 'error'
      ? '执行失败'
      : `已完成${trace.durationSec ? ` · ${trace.durationSec}s` : ''}`;

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '2px 0',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          fontSize: 13,
          color: '#64748b',
        }}
      >
        {running && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: '#3b82f6',
              display: 'inline-block',
            }}
          />
        )}
        <span style={{ fontWeight: 600, color: '#334155' }}>{summary}</span>
        {toolCount > 0 && (
          <span style={{ color: '#94a3b8' }}>{toolCount} 次工具调用</span>
        )}
        <span style={{ color: '#94a3b8' }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gap: 10,
            paddingLeft: 2,
          }}
        >
          {trace.phases.length === 0 && running && (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>正在准备…</div>
          )}
          {trace.phases.map((phase) => (
            <TracePhase key={phase.id} phase={phase} running={running} />
          ))}
        </div>
      )}
    </div>
  );
}

function TracePhase({
  phase,
  running,
}: {
  phase: RunTracePhase;
  running?: boolean;
}) {
  const [open, setOpen] = useState(
    phase.kind === 'thinking' ? Boolean(running) : false,
  );

  useEffect(() => {
    if (running && phase.kind === 'thinking') setOpen(true);
    if (!running && phase.kind === 'thinking') setOpen(false);
  }, [running, phase.kind]);

  if (phase.kind === 'prepare') {
    return (
      <CollapsibleRow
        icon="compass"
        title={phase.title}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {phase.steps.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {phase.steps.map((step) => (
              <TraceSubStep key={step.id} step={step} />
            ))}
          </div>
        )}
      </CollapsibleRow>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <CollapsibleRow
        icon="thinking"
        title="深度思考"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      >
        {phase.message && (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: 1.65,
              color: '#64748b',
              borderLeft: '2px solid #e2e8f0',
              paddingLeft: 12,
              whiteSpace: 'pre-wrap',
            }}
          >
            {phase.message}
          </div>
        )}
        {phase.steps.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 6,
              marginTop: phase.message ? 10 : 8,
            }}
          >
            {phase.steps.map((step) => (
              <TraceSubStep key={step.id} step={step} />
            ))}
          </div>
        )}
      </CollapsibleRow>
    </div>
  );
}

function TraceSubStep({ step }: { step: RunTraceSubStep }) {
  const [open, setOpen] = useState(false);
  const inputBlock = formatToolPayload(step.toolName, step.input, 'input');
  const outputBlock = formatToolPayload(step.toolName, step.output, 'output');
  const hasDetail = Boolean(inputBlock || outputBlock);

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: hasDetail ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <StepIcon />
          <span style={{ fontSize: 13, color: '#475569' }}>{step.label}</span>
          {step.status === 'running' && (
            <span style={{ fontSize: 12, color: '#3b82f6' }}>运行中</span>
          )}
        </span>
        {hasDetail && (
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
        )}
      </button>

      {open && hasDetail && (
        <div
          style={{
            marginTop: 6,
            marginLeft: 22,
            display: 'grid',
            gap: 8,
          }}
        >
          {inputBlock && (
            <PayloadBlock title={inputBlock.title} text={inputBlock.text} />
          )}
          {outputBlock && (
            <PayloadBlock title={outputBlock.title} text={outputBlock.text} />
          )}
        </div>
      )}

      {step.toolName !== 'bash' && (
        <div
          style={{
            marginLeft: 22,
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          {formatToolLabel(step.toolName)}
        </div>
      )}
    </div>
  );
}

function CollapsibleRow({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: 'compass' | 'thinking' | 'tool';
  title: string;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '2px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon === 'compass' && <CompassIcon />}
          {icon === 'thinking' && (
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              {title}
            </span>
          )}
          {icon === 'tool' && <span style={{ fontSize: 14 }}>🔧</span>}
          {icon !== 'thinking' && (
            <span style={{ fontSize: 13, color: '#475569' }}>{title}</span>
          )}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && children}
    </div>
  );
}

function StepIcon() {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        border: '1.5px solid #cbd5e1',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 1.5,
          background: '#94a3b8',
          display: 'block',
        }}
      />
    </span>
  );
}

function CompassIcon() {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        border: '1.5px solid #cbd5e1',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        color: '#94a3b8',
        flexShrink: 0,
      }}
    >
      ◎
    </span>
  );
}

function PayloadBlock({ title, text }: { title: string; text: string }) {
  const isBash = title === 'bash';
  return (
    <div
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        border: isBash ? 'none' : '1px solid #eef2f6',
        background: isBash ? '#0f172a' : '#f8fafc',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: isBash ? '#94a3b8' : '#64748b',
          borderBottom: isBash ? '1px solid #1e293b' : '1px solid #eef2f6',
        }}
      >
        {title}
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          color: isBash ? '#e2e8f0' : '#334155',
          fontSize: 12,
          lineHeight: 1.5,
          overflow: 'auto',
          maxHeight: 260,
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
): { title: string; text: string } | null {
  const text = stringifyTracePayload(value);
  if (!text) return null;

  if (kind === 'input' && toolName === 'bash' && value && typeof value === 'object') {
    const command = (value as { command?: unknown }).command;
    if (typeof command === 'string' && command.trim()) {
      return { title: 'bash', text: command };
    }
  }

  return { title: kind === 'input' ? '输入' : '输出', text };
}
