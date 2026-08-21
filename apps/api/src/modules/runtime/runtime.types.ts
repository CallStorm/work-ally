export type RuntimeEventType =
  | 'run_started'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'knowledge_hit'
  | 'message_delta'
  | 'message_done'
  | 'error'
  | 'run_finished';

export type RuntimeEvent = {
  type: RuntimeEventType;
  runId: string;
  sessionId: string;
  ts: string;
  data?: Record<string, unknown>;
};

export const RUNTIME_EVENT = 'runtime.event';
