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
  content: z.string().default(''),
  attachmentIds: z.array(z.string()).default([]),
  context: SessionContextSchema.default({
    skillIds: [],
    connectorIds: [],
    knowledgeEnabled: false,
    knowledgeIds: [],
    attachmentIds: [],
  }),
}).superRefine((val, ctx) => {
  const text = val.content.trim();
  if (!text && val.attachmentIds.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入内容或添加附件', path: ['content'] });
  }
  if (val.attachmentIds.length > ATTACHMENT_MAX_COUNT) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `最多 ${ATTACHMENT_MAX_COUNT} 个附件`, path: ['attachmentIds'] });
  }
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

export const NOTES_SLUG = 'notes';
/** @deprecated use NOTES_SLUG */
export const HANDBOOK_SLUG = NOTES_SLUG;

export const NotesAiActionSchema = z.enum(['format', 'enrich', 'custom']);
export type NotesAiAction = z.infer<typeof NotesAiActionSchema>;

export const CreateNotesAiMessageSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  action: NotesAiActionSchema.optional().default('custom'),
  /** Current editor markdown snapshot from client */
  bodyMd: z.string().max(50000),
  title: z.string().trim().max(191).optional().default(''),
  /** Clear prior thread messages before this turn (format/enrich should set true) */
  resetSession: z.boolean().optional().default(false),
});
export type CreateNotesAiMessageInput = z.infer<typeof CreateNotesAiMessageSchema>;

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

export const IMAGE_STUDIO_SLUG = 'image-studio';

export const ImageStudioProviderSchema = z.enum([
  'openai_compatible',
  'gemini',
  'minimax',
]);
export type ImageStudioProvider = z.infer<typeof ImageStudioProviderSchema>;

export const CreateImageStudioProjectSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(2000).optional().default(''),
  defaultModelId: z.string().cuid().nullable().optional(),
});
export type CreateImageStudioProjectInput = z.infer<
  typeof CreateImageStudioProjectSchema
>;

export const UpdateImageStudioProjectSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().max(2000).optional(),
  starred: z.boolean().optional(),
  defaultModelId: z.string().cuid().nullable().optional(),
  currentAssetId: z.string().cuid().nullable().optional(),
  workspaceState: z.record(z.unknown()).nullable().optional(),
});
export type UpdateImageStudioProjectInput = z.infer<
  typeof UpdateImageStudioProjectSchema
>;

export const ImageStudioAspectRatioSchema = z.enum([
  '1:1',
  '16:9',
  '4:3',
  '3:2',
  '2:3',
  '3:4',
  '9:16',
  '21:9',
]);
export type ImageStudioAspectRatio = z.infer<typeof ImageStudioAspectRatioSchema>;

export const ImageStudioOverlayPositionSchema = z.enum([
  'top',
  'center',
  'bottom',
]);
export type ImageStudioOverlayPosition = z.infer<
  typeof ImageStudioOverlayPositionSchema
>;

export const GenerateImageStudioSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  modelId: z.string().cuid().optional(),
  sourceAssetId: z.string().cuid().nullable().optional(),
  n: z.number().int().min(1).max(4).optional().default(1),
  parentTurnId: z.string().cuid().nullable().optional(),
  aspectRatio: ImageStudioAspectRatioSchema.optional(),
  /** When set, model generates a no-text background and server composites this title. */
  overlayTitle: z.string().trim().max(40).optional(),
  overlaySubtitle: z.string().trim().max(80).optional(),
  overlayPosition: ImageStudioOverlayPositionSchema.optional().default('center'),
});
export type GenerateImageStudioInput = z.infer<typeof GenerateImageStudioSchema>;

/** Expand a short scene draft into a stronger image-gen prompt (no title glyphs). */
export const EnhanceImageStudioPromptSchema = z.object({
  draft: z.string().trim().min(1).max(2000),
  overlayTitle: z.string().trim().max(40).optional(),
  overlaySubtitle: z.string().trim().max(80).optional(),
});
export type EnhanceImageStudioPromptInput = z.infer<
  typeof EnhanceImageStudioPromptSchema
>;

export const CreateImageStudioModelSchema = z.object({
  name: z.string().trim().min(1).max(128),
  provider: ImageStudioProviderSchema.default('openai_compatible'),
  baseUrl: z.string().url().max(512),
  apiKey: z.string().trim().min(1).max(2048),
  modelName: z.string().trim().min(1).max(191),
  capabilities: z
    .object({
      textToImage: z.boolean().default(true),
      imageToImage: z.boolean().default(true),
    })
    .default({ textToImage: true, imageToImage: true }),
  defaultParams: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});
export type CreateImageStudioModelInput = z.infer<
  typeof CreateImageStudioModelSchema
>;

export const UpdateImageStudioModelSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  provider: ImageStudioProviderSchema.optional(),
  baseUrl: z.string().url().max(512).optional(),
  apiKey: z.string().trim().min(1).max(2048).optional(),
  modelName: z.string().trim().min(1).max(191).optional(),
  capabilities: z
    .object({
      textToImage: z.boolean(),
      imageToImage: z.boolean(),
    })
    .optional(),
  defaultParams: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateImageStudioModelInput = z.infer<
  typeof UpdateImageStudioModelSchema
>;

export const UpdateAppRegistrySchema = z.object({
  enabled: z.boolean().optional(),
  defaultModelConfigId: z.string().nullable().optional(),
  aiActionsEnabled: z.array(z.string()).optional(),
  visibility: Visibility.optional(),
});
export type UpdateAppRegistryInput = z.infer<typeof UpdateAppRegistrySchema>;

export const APP_NAME = 'WorkAlly';
export const API_PREFIX = '/api';

export const ATTACHMENT_MAX_COUNT = 5;
export const ATTACHMENT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export const AttachmentAllowedExtensions = [
  '.md', '.txt', '.json', '.csv',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.pdf', '.docx', '.xlsx',
] as const;
