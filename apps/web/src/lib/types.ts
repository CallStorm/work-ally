export type RuntimeEvent = {
  type:
    | 'run_started'
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'knowledge_hit'
    | 'message_delta'
    | 'message_done'
    | 'error'
    | 'run_finished';
  runId: string;
  sessionId: string;
  ts: string;
  data?: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
};

export type SessionDetail = {
  id: string;
  title: string | null;
  groupId: string;
  expertId: string | null;
  modelId: string;
  expert: { id: string; name: string } | null;
  messages: ChatMessage[];
  runs: Array<{
    id: string;
    state: string;
    stepsCount: number;
  }>;
};

export type SessionListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
  expert: { id: string; name: string } | null;
};
