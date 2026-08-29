import { z } from 'zod';

/** Tenant membership roles (frozen). */
export const MembershipRole = z.enum(['admin', 'member']);
export type MembershipRole = z.infer<typeof MembershipRole>;

/** Normalize phone to digits only. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

/** Chinese mobile: 11 digits starting with 1. */
export const PhoneSchema = z
  .string()
  .min(1, '请填写手机号')
  .transform(normalizePhone)
  .refine((v) => /^1\d{10}$/.test(v), {
    message: '手机号格式无效，需为11位数字且以1开头',
  });

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
  'apps',
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
  /** Preferred: ModelConfig.id from GET /models */
  modelConfigId: z.string().min(1),
  /** Denormalized / legacy; ignored when modelConfigId resolves */
  modelId: z.string().min(1).optional(),
  content: z.string().min(1),
  attachmentIds: z.array(z.string()).default([]),
  context: SessionContextSchema.default({
    skillIds: [],
    connectorIds: [],
    knowledgeEnabled: false,
    knowledgeIds: [],
    attachmentIds: [],
  }),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const UpdateAclSchema = z.object({
  visibility: Visibility,
  entries: z.array(AclEntrySchema).default([]),
});
export type UpdateAclInput = z.infer<typeof UpdateAclSchema>;

export const CreateMemberSchema = z.object({
  phone: PhoneSchema,
  name: z.string().min(1).max(64),
  password: z.string().min(6).max(128),
  role: MembershipRole.default('member'),
  groupIds: z.array(z.string()).default([]),
});
export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = z
  .object({
    role: MembershipRole.optional(),
    status: z.enum(['active', 'disabled']).optional(),
    groupIds: z.array(z.string()).optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined || v.groupIds !== undefined, {
    message: '至少提供一个更新字段',
  });
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;

export const ResetMemberPasswordSchema = z.object({
  password: z.string().min(6).max(128),
});
export type ResetMemberPasswordInput = z.infer<typeof ResetMemberPasswordSchema>;

export const STICKIES_SLUG = 'stickies';

export const TaskPrioritySchema = z.enum(['high', 'medium', 'low']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(191),
  notes: z.string().max(50000).optional().default(''),
  priority: TaskPrioritySchema.optional().default('medium'),
  dueAt: z.string().datetime().optional(),
  allDay: z.boolean().optional().default(true),
  reminderAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(191).optional(),
  notes: z.string().max(50000).optional(),
  completed: z.boolean().optional(),
  priority: TaskPrioritySchema.optional(),
  dueAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const HANDBOOK_SLUG = 'handbook';

export const CreateHandbookCategorySchema = z.object({
  name: z.string().trim().min(1).max(64),
  parentId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateHandbookCategoryInput = z.infer<
  typeof CreateHandbookCategorySchema
>;

export const UpdateHandbookCategorySchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  parentId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateHandbookCategoryInput = z.infer<
  typeof UpdateHandbookCategorySchema
>;

export const CreateHandbookNoteSchema = z.object({
  title: z.string().trim().min(1).max(191).optional().default('无标题'),
  bodyMd: z.string().max(50000).optional().default(''),
  categoryId: z.string().cuid().nullable().optional(),
  pinned: z.boolean().optional().default(false),
});
export type CreateHandbookNoteInput = z.infer<typeof CreateHandbookNoteSchema>;

export const UpdateHandbookNoteSchema = z.object({
  title: z.string().trim().min(1).max(191).optional(),
  bodyMd: z.string().max(50000).optional(),
  categoryId: z.string().cuid().nullable().optional(),
  pinned: z.boolean().optional(),
});
export type UpdateHandbookNoteInput = z.infer<typeof UpdateHandbookNoteSchema>;

export const UpdateAppRegistrySchema = z.object({
  enabled: z.boolean().optional(),
  defaultModelConfigId: z.string().nullable().optional(),
  aiActionsEnabled: z.array(z.string()).optional(),
  visibility: Visibility.optional(),
});
export type UpdateAppRegistryInput = z.infer<typeof UpdateAppRegistrySchema>;

export const APP_NAME = 'WorkAlly';
export const API_PREFIX = '/api';
