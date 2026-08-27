import type { RuntimeEvent } from '@/lib/types';

export type AgentStepStatus = 'running' | 'done' | 'error';

export type ThinkingStep = {
  id: string;
  kind: 'thinking';
  summary: string;
  body: string;
  status: AgentStepStatus;
  ts: string;
};

export type ToolStep = {
  id: string;
  kind: 'tool';
  toolName: string;
  label: string;
  input?: unknown;
  output?: unknown;
  status: AgentStepStatus;
  ts: string;
};

export type AgentStep = ThinkingStep | ToolStep;

export type RunTimeline = {
  steps: AgentStep[];
  status: 'running' | 'done' | 'error';
  durationSec?: number;
};

const HIDDEN_THINKING = new Set(['Pi turn start']);

function shouldHideThinking(message: string) {
  if (HIDDEN_THINKING.has(message)) return true;
  if (message.startsWith('Pi runtime ·')) return true;
  return false;
}

/** One-line summary for thinking blocks (Claude Code style). */
export function summarizeThinking(body: string): string {
  const line =
    body
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  if (!line) return '思考中';
  return line.length > 72 ? `${line.slice(0, 72)}…` : line;
}

export function buildRunTimeline(events: RuntimeEvent[]): RunTimeline {
  const steps: AgentStep[] = [];
  const pendingTools = new Map<string, number>();
  let startedAt: number | null = null;
  let finishedAt: number | null = null;
  let status: RunTimeline['status'] = 'running';
  let pendingThinking = '';
  let streamingThinkingId: string | null = null;

  const pushThinking = (message: string, ts: string, done: boolean) => {
    const trimmed = message.trim();
    if (!trimmed || shouldHideThinking(trimmed)) return;

    if (streamingThinkingId) {
      const idx = steps.findIndex((s) => s.id === streamingThinkingId);
      if (idx >= 0 && steps[idx].kind === 'thinking') {
        steps[idx] = {
          ...steps[idx],
          body: trimmed,
          summary: summarizeThinking(trimmed),
          status: done ? 'done' : 'running',
          ts,
        };
        if (done) streamingThinkingId = null;
        return;
      }
    }

    const id = `thinking-${ts}-${steps.length}`;
    steps.push({
      id,
      kind: 'thinking',
      summary: summarizeThinking(trimmed),
      body: trimmed,
      status: done ? 'done' : 'running',
      ts,
    });
    streamingThinkingId = done ? null : id;
  };

  for (const ev of events) {
    if (ev.type === 'run_started') {
      startedAt = Date.parse(ev.ts);
    }
    if (ev.type === 'run_finished') {
      finishedAt = Date.parse(ev.ts);
      status = 'done';
    }
    if (ev.type === 'error') {
      status = 'error';
    }

    if (ev.type === 'thinking') {
      const message = String(ev.data?.message ?? '');
      const streaming = Boolean(ev.data?.streaming);
      if (streaming) {
        pendingThinking = message;
        pushThinking(message, ev.ts, false);
        continue;
      }
      const finalMsg = pendingThinking || message;
      pendingThinking = '';
      pushThinking(finalMsg, ev.ts, true);
      continue;
    }

    if (ev.type === 'tool_call') {
      if (pendingThinking) {
        pushThinking(pendingThinking, ev.ts, true);
        pendingThinking = '';
      }
      streamingThinkingId = null;

      const toolName = String(ev.data?.toolName ?? 'tool');
      const toolCallId = String(ev.data?.toolCallId ?? '');
      const pendingKey = toolCallId || `${toolName}-${steps.length}`;
      const step: ToolStep = {
        id: `tool-${ev.ts}-${pendingKey}`,
        kind: 'tool',
        toolName,
        label: inferStepLabel(toolName, ev.data?.input),
        input: ev.data?.input,
        status: 'running',
        ts: ev.ts,
      };
      pendingTools.set(pendingKey, steps.length);
      if (toolCallId) pendingTools.set(toolCallId, steps.length);
      steps.push(step);
      continue;
    }

    if (ev.type === 'tool_result') {
      const toolName = String(ev.data?.toolName ?? 'tool');
      const toolCallId = String(ev.data?.toolCallId ?? '');
      const output = ev.data?.output;
      const input = ev.data?.input;
      const isError = Boolean(ev.data?.isError);
      const loc =
        (toolCallId ? pendingTools.get(toolCallId) : undefined) ??
        [...pendingTools.entries()].reverse().find(([k]) => k.startsWith(`${toolName}-`))?.[1];

      // Prefer latest running step with same tool name
      let idx = loc;
      if (idx == null) {
        for (let i = steps.length - 1; i >= 0; i -= 1) {
          const s = steps[i];
          if (s.kind === 'tool' && s.toolName === toolName && s.status === 'running') {
            idx = i;
            break;
          }
        }
      }

      if (idx != null && steps[idx]?.kind === 'tool') {
        const prev = steps[idx] as ToolStep;
        steps[idx] = {
          ...prev,
          input: prev.input ?? input,
          output,
          status: isError ? 'error' : 'done',
          label: inferStepLabel(toolName, prev.input ?? input),
        };
        if (toolCallId) pendingTools.delete(toolCallId);
        continue;
      }

      steps.push({
        id: `tool-result-${ev.ts}-${toolName}`,
        kind: 'tool',
        toolName,
        label: inferStepLabel(toolName, input),
        input,
        output,
        status: isError ? 'error' : 'done',
        ts: ev.ts,
      });
    }
  }

  if (pendingThinking) {
    pushThinking(pendingThinking, `pending-${Date.now()}`, status !== 'running');
  }

  // Close any still-running thinking when run finished
  if (status !== 'running') {
    for (let i = 0; i < steps.length; i += 1) {
      if (steps[i].status === 'running') {
        steps[i] = { ...steps[i], status: status === 'error' ? 'error' : 'done' };
      }
    }
  }

  const end = finishedAt ?? (startedAt ? Date.now() : null);
  const durationSec =
    startedAt && end
      ? Math.max(1, Math.round((end - startedAt) / 1000))
      : undefined;

  return { steps, status, durationSec };
}

/** @deprecated use buildRunTimeline */
export function buildRunTrace(events: RuntimeEvent[]) {
  const timeline = buildRunTimeline(events);
  return {
    phases: [] as never[],
    status: timeline.status,
    durationSec: timeline.durationSec,
    steps: timeline.steps,
  };
}

export function formatToolLabel(toolName: string) {
  if (toolName.startsWith('mcp_')) {
    const parts = toolName.replace(/^mcp_/, '').split('__');
    if (parts.length >= 2) {
      return `${parts[0]} / ${parts.slice(1).join('__')}`;
    }
    return toolName.replace(/^mcp_/, '');
  }
  return toolName;
}

export function toolKindBadge(toolName: string): string {
  const n = toolName.toLowerCase();
  if (n.startsWith('mcp_')) return 'MCP';
  if (n === 'bash') return 'Bash';
  if (n === 'read') return 'Read';
  if (n === 'write') return 'Write';
  if (n === 'edit') return 'Edit';
  if (n.includes('skill')) return 'Skill';
  return formatToolLabel(toolName);
}

export function inferStepLabel(toolName: string, input: unknown): string {
  if (toolName === 'bash' && input && typeof input === 'object') {
    const command = String((input as { command?: unknown }).command ?? '');
    if (/geocod|nominatim|latitude|longitude/i.test(command)) {
      const city = extractCityHint(command);
      return city ? `获取${city}地理坐标` : '获取地理坐标';
    }
    if (/forecast|weather|open-meteo|meteo/i.test(command)) {
      const city = extractCityHint(command);
      return city ? `查询${city}当前天气与预报` : '查询当前天气与预报';
    }
    if (/curl|wget|fetch/i.test(command)) {
      return '执行网络请求';
    }
    if (command.trim()) {
      const first = command.trim().split('\n')[0] ?? command;
      return first.length > 56 ? `${first.slice(0, 56)}…` : first;
    }
    return '执行 bash 命令';
  }

  if (input && typeof input === 'object') {
    const path = String(
      (input as { path?: unknown; file_path?: unknown; filePath?: unknown }).path ??
        (input as { file_path?: unknown }).file_path ??
        (input as { filePath?: unknown }).filePath ??
        '',
    );
    if (path) {
      const base = path.split(/[/\\]/).pop() || path;
      if (toolName === 'read') return `读取 ${base}`;
      if (toolName === 'write') return `写入 ${base}`;
      if (toolName === 'edit') return `编辑 ${base}`;
      return `${formatToolLabel(toolName)} ${base}`;
    }
  }

  if (toolName === 'read') return '读取文件';
  if (toolName === 'write') return '写入文件';
  if (toolName === 'edit') return '编辑文件';

  return formatToolLabel(toolName);
}

function extractCityHint(command: string): string | null {
  const qMatch = command.match(/q=([^&"'\s]+)/i);
  if (qMatch?.[1]) {
    try {
      return decodeURIComponent(qMatch[1]);
    } catch {
      return qMatch[1];
    }
  }
  const zhMatch = command.match(/[\u4e00-\u9fff]{2,6}/);
  return zhMatch?.[0] ?? null;
}

export function stringifyTracePayload(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  // Pi tool results often nest text in content[]
  if (typeof value === 'object' && value !== null && 'content' in value) {
    const content = (value as { content: unknown }).content;
    if (Array.isArray(content)) {
      const texts = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && 'text' in part) {
            return String((part as { text: unknown }).text ?? '');
          }
          return '';
        })
        .filter(Boolean);
      if (texts.length) return texts.join('\n');
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
