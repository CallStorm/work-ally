import type { RuntimeEvent } from '@/lib/types';

export type RunTraceSubStep = {
  id: string;
  label: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: 'running' | 'done';
  ts: string;
};

export type RunTracePhase = {
  id: string;
  kind: 'prepare' | 'thinking';
  title: string;
  message?: string;
  steps: RunTraceSubStep[];
  ts: string;
};

export type RunTraceModel = {
  phases: RunTracePhase[];
  status: 'running' | 'done' | 'error';
  durationSec?: number;
};

const HIDDEN_THINKING = new Set(['Pi turn start']);

function shouldHideThinking(message: string) {
  if (HIDDEN_THINKING.has(message)) return true;
  if (message.startsWith('Pi runtime ·')) return true;
  return false;
}

function flushThinkingPhase(
  phases: RunTracePhase[],
  message: string,
  ts: string,
) {
  const trimmed = message.trim();
  if (!trimmed || shouldHideThinking(trimmed)) return;
  phases.push({
    id: `thinking-${ts}`,
    kind: 'thinking',
    title: '深度思考',
    message: trimmed,
    steps: [],
    ts,
  });
}

function ensureThinkingPhase(phases: RunTracePhase[], ts: string) {
  const last = phases[phases.length - 1];
  if (last?.kind === 'thinking') return last;
  const phase: RunTracePhase = {
    id: `thinking-${ts}`,
    kind: 'thinking',
    title: '深度思考',
    steps: [],
    ts,
  };
  phases.push(phase);
  return phase;
}

export function buildRunTrace(events: RuntimeEvent[]): RunTraceModel {
  const phases: RunTracePhase[] = [];
  const pendingTools = new Map<string, { phaseIdx: number; stepIdx: number }>();
  let startedAt: number | null = null;
  let finishedAt: number | null = null;
  let status: RunTraceModel['status'] = 'running';
  let pendingThinking = '';

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
        continue;
      }
      if (pendingThinking) {
        flushThinkingPhase(phases, pendingThinking, ev.ts);
        pendingThinking = '';
      } else {
        flushThinkingPhase(phases, message, ev.ts);
      }
      continue;
    }

    if (ev.type === 'tool_call') {
      if (pendingThinking) {
        flushThinkingPhase(phases, pendingThinking, ev.ts);
        pendingThinking = '';
      }

      const toolName = String(ev.data?.toolName ?? 'tool');
      const isPrepareTool =
        toolName.startsWith('mcp_') ||
        toolName.includes('skill') ||
        (!phases.length && toolName !== 'bash');

      if (isPrepareTool && !phases.some((p) => p.kind === 'prepare')) {
        const preparePhase: RunTracePhase = {
          id: `prepare-${ev.ts}`,
          kind: 'prepare',
          title: `运行校验、处理：${formatToolLabel(toolName)}`,
          steps: [],
          ts: ev.ts,
        };
        phases.push(preparePhase);
        const step: RunTraceSubStep = {
          id: `tool-${ev.ts}-${toolName}`,
          label: inferStepLabel(toolName, ev.data?.input),
          toolName,
          input: ev.data?.input,
          status: 'running',
          ts: ev.ts,
        };
        preparePhase.steps.push(step);
        pendingTools.set(toolName, {
          phaseIdx: phases.length - 1,
          stepIdx: preparePhase.steps.length - 1,
        });
        continue;
      }

      const phase = ensureThinkingPhase(phases, ev.ts);
      const step: RunTraceSubStep = {
        id: `tool-${ev.ts}-${toolName}`,
        label: inferStepLabel(toolName, ev.data?.input),
        toolName,
        input: ev.data?.input,
        status: 'running',
        ts: ev.ts,
      };
      phase.steps.push(step);
      pendingTools.set(toolName, {
        phaseIdx: phases.length - 1,
        stepIdx: phase.steps.length - 1,
      });
      continue;
    }

    if (ev.type === 'tool_result') {
      const toolName = String(ev.data?.toolName ?? 'tool');
      const output = ev.data?.output;
      const loc = pendingTools.get(toolName);
      if (loc) {
        const phase = phases[loc.phaseIdx];
        const step = phase?.steps[loc.stepIdx];
        if (step) {
          phase.steps[loc.stepIdx] = { ...step, output, status: 'done' };
          pendingTools.delete(toolName);
          continue;
        }
      }
      const phase = ensureThinkingPhase(phases, ev.ts);
      phase.steps.push({
        id: `tool-result-${ev.ts}-${toolName}`,
        label: inferStepLabel(toolName, undefined),
        toolName,
        output,
        status: 'done',
        ts: ev.ts,
      });
    }
  }

  if (pendingThinking) {
    flushThinkingPhase(phases, pendingThinking, `pending-${Date.now()}`);
  }

  const end = finishedAt ?? (startedAt ? Date.now() : null);
  const durationSec =
    startedAt && end ? Math.max(1, Math.round((end - startedAt) / 1000)) : undefined;

  return { phases, status, durationSec };
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
      return first.length > 42 ? `${first.slice(0, 42)}…` : first;
    }
    return '执行 bash 命令';
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
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
