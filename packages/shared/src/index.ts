import { z } from 'zod';

/** Tenant membership roles (frozen). */
export const MembershipRole = z.enum(['owner', 'admin', 'member']);
export type MembershipRole = z.infer<typeof MembershipRole>;

/** Resource visibility (frozen ACL). */
export const Visibility = z.enum(['private', 'restricted', 'tenant']);
export type Visibility = z.infer<typeof Visibility>;

export const PrincipalType = z.enum(['group', 'user']);
export type PrincipalType = z.infer<typeof PrincipalType>;

export const AclEntrySchema = z.object({
  principalType: PrincipalType,
  principalId: z.string().min(1),
});
export type AclEntry = z.infer<typeof AclEntrySchema>;

export const ResourceType = z.enum([
  'connectors',
  'skills',
  'experts',
  'knowledge',
]);
export type ResourceType = z.infer<typeof ResourceType>;

export const McpTransport = z.enum(['sse', 'streamable_http']);
export type McpTransport = z.infer<typeof McpTransport>;

export const KnowledgeProvider = z.enum(['dify', 'ragflow']);
export type KnowledgeProvider = z.infer<typeof KnowledgeProvider>;

export const AgentMode = z.enum(['expert', 'default']);
export type AgentMode = z.infer<typeof AgentMode>;

export const AgentRunState = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export type AgentRunState = z.infer<typeof AgentRunState>;

export const MessageRole = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRole>;

export const SessionContextSchema = z.object({
  skillIds: z.array(z.string()).default([]),
  connectorIds: z.array(z.string()).default([]),
  knowledgeEnabled: z.boolean().default(false),
  knowledgeIds: z.array(z.string()).default([]),
  attachmentIds: z.array(z.string()).default([]),
});
export type SessionContext = z.infer<typeof SessionContextSchema>;

export const CreateSessionSchema = z.object({
  groupId: z.string().min(1),
  expertId: z.string().nullable().optional(),
  modelId: z.string().min(1).default('auto'),
  content: z.string().min(1),
  attachmentIds: z.array(z.string()).default([]),
  context: SessionContextSchema.default({}),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const UpdateAclSchema = z.object({
  visibility: Visibility,
  entries: z.array(AclEntrySchema).default([]),
});
export type UpdateAclInput = z.infer<typeof UpdateAclSchema>;

export const APP_NAME = 'WorkAlly';
export const API_PREFIX = '/api';
