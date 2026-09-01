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
    | 'run_finished'
    | 'artifact_created'
    | 'artifact_updated'
    | 'workspace_file_changed';
  runId: string;
  sessionId: string;
  ts: string;
  data?: Record<string, unknown>;
};

export type WorkspaceEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  children?: WorkspaceEntry[];
};

export type WorkspaceTree = {
  root: string;
  entries: WorkspaceEntry[];
};

export type SessionArtifact = {
  id: string;
  sessionId: string;
  runId: string;
  path: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceFileContent = {
  path: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  content?: string;
  encoding?: 'utf8' | 'base64';
  isBinary?: boolean;
  downloadOnly?: boolean;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachmentIds?: string[];
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
    messageId?: string;
    assistantMessageId?: string | null;
    createdAt?: string;
    events?: RuntimeEvent[];
  }>;
};

export type SessionListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
  expert: { id: string; name: string } | null;
  activeRun?: { id: string; state: string; createdAt?: string } | null;
};
