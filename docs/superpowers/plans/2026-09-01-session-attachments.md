# 会话用户附件上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页与会话追问支持 `+` 上传附件；MinIO 持久化；Run 前装配文本/办公抽文/工作区拷贝；图片在 `supportsVision` 开启时端到端多模态进同一 ModelConfig。

**Architecture:** 薄上传（`POST /attachments`）+ Run 时装配（`AttachmentAssemblyService`）；装配结果拼进 user message 传给现有 Pi Runtime；`pdf/docx/xlsx` 原件进 `session/uploads/` 且不参与产物晋升。

**Tech Stack:** NestJS 11, Prisma/MySQL, MinIO（`@aws-sdk/client-s3`）, Next.js 15, `@work-ally/shared` Zod, Pi (`@mariozechner/pi-coding-agent`), pdf-parse / mammoth / xlsx

**Spec:** `docs/superpowers/specs/2026-09-01-session-attachments-design.md`

## Global Constraints

- 每条消息最多 **5** 个附件；单文件 ≤ **20MB**；合计 ≤ **50MB**
- 允许类型：文本 `md/txt/json/csv`；图片 `png/jpg/jpeg/webp/gif`；办公 `pdf/docx/xlsx`
- 图片：**端到端多模态**（同一 ModelConfig），非「先视觉模型再文本 LLM」两段式
- `ModelConfig.supportsVision`（Admin 开关）；开则 image parts，关则仅路径/文件名文字
- 上传入口：首页 composer + 会话追问，两处都有
- 附件 ≠ 产物：`uploads/` 不自动晋升 `SessionArtifact`；不进资源侧栏交付物
- 鉴权：一期 `GET/DELETE /attachments/:id` 仅 uploader 本人
- 本仓库尚无 Jest/Vitest；每任务用 `pnpm --filter @work-ally/api exec tsc --noEmit` / `pnpm --filter @work-ally/web exec tsc --noEmit` + 手验

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/index.ts` | 附件常量、MIME 白名单、`CreateSessionSchema` 放宽（仅附件可发） |
| `apps/api/prisma/schema.prisma` | `Attachment.extractedText`；`ModelConfig.supportsVision` |
| `apps/api/prisma/migrations/<ts>_session_attachments/migration.sql` | ALTER 两表 |
| `apps/api/src/modules/storage/object-storage.service.ts` | MinIO put/get/delete |
| `apps/api/src/modules/storage/storage.module.ts` | 导出 Storage |
| `apps/api/src/modules/attachments/attachment-types.ts` | 扩展名/MIME 分类、限额常量 |
| `apps/api/src/modules/attachments/attachments.service.ts` | 上传 CRUD、校验、删前检查 |
| `apps/api/src/modules/attachments/attachments.controller.ts` | HTTP 路由 |
| `apps/api/src/modules/attachments/text-extract.service.ts` | pdf/docx/xlsx/文本抽取 |
| `apps/api/src/modules/attachments/attachment-assembly.service.ts` | Run 前装配 → `AssembledUserMessage` |
| `apps/api/src/modules/sessions/sessions.service.ts` | 发消息前校验 attachmentIds |
| `apps/api/src/modules/runtime/runtime.service.ts` | 调装配再传 Pi |
| `apps/api/src/modules/runtime/pi-runner.service.ts` | 接受 `userContent` parts（spike 后） |
| `apps/api/src/modules/workspace/artifact.service.ts` | `shouldSkipPath` 排除 `uploads/` |
| `apps/api/src/modules/models/models.service.ts` | `supportsVision` 读写 |
| `apps/web/src/lib/attachments.ts` | 上传 hook、限额校验 |
| `apps/web/src/components/attachment-chips.tsx` | 芯片 UI |
| `apps/web/src/components/composer-addons.tsx` | 启用「文件」菜单 |
| `apps/web/src/components/workbench-composer.tsx` | 顶层 attachmentIds |
| `apps/web/src/components/session-chat.tsx` | 追问上传 + 历史芯片 |
| `apps/web/src/app/admin/models/page.tsx` | 支持视觉开关 |
| `.superpowers/sdd/session-attachments-smoke.md` | 手验清单 |

---

### Task 0: Spike — Pi 多模态 image parts

**Files:**
- Modify: `apps/api/src/modules/runtime/pi-runner.service.ts`（试验分支，可 revert 后正式 Task 7 落地）
- Read: `node_modules/@mariozechner/pi-coding-agent` / `pi-ai` 类型与 `session.prompt` 签名

**Interfaces:**
- Produces: 结论文档段落写入本 plan 末尾「Spike 结论」或 Task 7 注释：`prompt(string)` vs `prompt(UserContent[])` 可行 API

- [ ] **Step 1: 最小 spike 脚本或临时 endpoint**

在 `pi-runner.service.ts` 加私有方法 `spikeVisionPrompt(session, imageBase64, mime)`，用现有 MiniMax provider 发一条「描述这张图」；image 从本地读一张小 png。

- [ ] **Step 2: 记录结论**

若 Pi 支持 content blocks → Task 7 走 `UserContent[]`。  
若不支持 → Task 7 仍拷图到 `uploads/` + 字符串提示；在 smoke 清单标「多模态 blocked」并开 follow-up issue（不在本 plan 假装完成 vision 验收）。

- [ ] **Step 3: Commit spike 笔记（代码若保留须 feature-flag 或删试验代码）**

```bash
git commit -m "docs(api): record pi multimodal spike result for attachments"
```

---

### Task 1: Prisma — extractedText + supportsVision

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260901120000_session_attachments/migration.sql`

**Interfaces:**
- Produces: DB 列 `attachments.extracted_text`，`model_configs.supports_vision`

- [ ] **Step 1: schema 变更**

```prisma
model Attachment {
  // ...existing fields...
  extractedText String? @map("extracted_text") @db.LongText
}

model ModelConfig {
  // ...existing fields...
  supportsVision Boolean @default(false) @map("supports_vision")
}
```

- [ ] **Step 2: migration.sql**

```sql
ALTER TABLE `attachments` ADD COLUMN `extracted_text` LONGTEXT NULL;
ALTER TABLE `model_configs` ADD COLUMN `supports_vision` BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Generate client**

Run: `cd apps/api && npx prisma generate`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260901120000_session_attachments
git commit -m "feat(api): add attachment extractedText and model supportsVision"
```

---

### Task 2: Shared — 附件常量与 CreateSession 校验

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `ATTACHMENT_MAX_COUNT`, `ATTACHMENT_MAX_FILE_BYTES`, `ATTACHMENT_MAX_TOTAL_BYTES`, `AttachmentMimeCategory`, `CreateSessionSchema` 更新

- [ ] **Step 1: 追加常量（在文件末尾合适位置）**

```ts
export const ATTACHMENT_MAX_COUNT = 5;
export const ATTACHMENT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export const AttachmentAllowedExtensions = [
  '.md', '.txt', '.json', '.csv',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.pdf', '.docx', '.xlsx',
] as const;
```

- [ ] **Step 2: 放宽 CreateSessionSchema**

将 `content: z.string().min(1)` 改为：

```ts
content: z.string().default(''),
attachmentIds: z.array(z.string()).default([]),
```

并加 `.superRefine`：

```ts
.superRefine((val, ctx) => {
  const text = val.content.trim();
  if (!text && val.attachmentIds.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '请输入内容或添加附件', path: ['content'] });
  }
  if (val.attachmentIds.length > ATTACHMENT_MAX_COUNT) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `最多 ${ATTACHMENT_MAX_COUNT} 个附件`, path: ['attachmentIds'] });
  }
});
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @work-ally/shared exec tsc --noEmit`  
Expected: pass

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): attachment limits and optional session content with attachments"
```

---

### Task 3: ObjectStorageService (MinIO)

**Files:**
- Create: `apps/api/src/modules/storage/object-storage.service.ts`
- Create: `apps/api/src/modules/storage/storage.module.ts`
- Modify: `apps/api/src/app.module.ts`（import StorageModule）
- Modify: `apps/api/package.json`（add `@aws-sdk/client-s3`）

**Interfaces:**
- Produces:
  - `putObject(key: string, body: Buffer, contentType: string): Promise<void>`
  - `getObject(key: string): Promise<Buffer>`
  - `deleteObject(key: string): Promise<void>`

- [ ] **Step 1: 安装依赖**

Run: `pnpm --filter @work-ally/api add @aws-sdk/client-s3`

- [ ] **Step 2: 实现 service（读 env MINIO_*，ensure bucket）**

```ts
@Injectable()
export class ObjectStorageService {
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> { /* S3 PutObject */ }
  async getObject(key: string): Promise<Buffer> { /* S3 GetObject */ }
  async deleteObject(key: string): Promise<void> { /* S3 DeleteObject */ }
}
```

`storageKey` 由调用方传入完整 key：`tenants/${tenantId}/attachments/${id}/${safeFilename}`。

- [ ] **Step 3: StorageModule exports ObjectStorageService**

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @work-ally/api exec tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/storage apps/api/package.json pnpm-lock.yaml apps/api/src/app.module.ts
git commit -m "feat(api): add MinIO object storage service"
```

---

### Task 4: Attachments API — upload / get / content / delete

**Files:**
- Create: `apps/api/src/modules/attachments/attachment-types.ts`
- Modify: `apps/api/src/modules/attachments/attachments.service.ts`
- Modify: `apps/api/src/modules/attachments/attachments.controller.ts`
- Modify: `apps/api/src/modules/attachments/attachments.module.ts`（import StorageModule）

**Interfaces:**
- Produces:
  - `AttachmentsService.upload(user, file): Promise<{ id, filename, mime, size }>`
  - `AttachmentsService.getForUser(user, id)`
  - `AttachmentsService.getContentBuffer(user, id): Promise<{ buffer, filename, mime }>`
  - `AttachmentsService.deleteIfUnused(user, id)`
  - `AttachmentsService.assertOwned(ids, user): Promise<Attachment[]>`（供 sessions/assembly 用）

- [ ] **Step 1: attachment-types.ts**

```ts
export type AttachmentKind = 'text' | 'image' | 'office' | 'unknown';

export function classifyAttachment(filename: string, mime: string): AttachmentKind { /* by ext */ }
export function assertAllowedUpload(filename: string, mime: string, size: number): void { /* throw BadRequest */ }
export function safeStorageFilename(name: string): string { /* strip path, replace unsafe chars */ }
```

- [ ] **Step 2: upload 实现**

对齐 `skills.controller.ts` 的 `FileInterceptor('file', { limits: { fileSize: ATTACHMENT_MAX_FILE_BYTES } })`。

流程：校验 → 创建 Attachment 行（先拿 id）→ putObject → 返回 DTO。失败时 deleteObject + 删 DB 行。

- [ ] **Step 3: GET /attachments/:id 与 GET /attachments/:id/content**

content 设置 `Content-Type` + `Content-Disposition: attachment`。

- [ ] **Step 4: DELETE /attachments/:id**

查询所有 Message 的 `attachmentIds` JSON 是否含该 id（Prisma raw 或 load recent messages）；含则 403。

- [ ] **Step 5: 手验 curl**

```bash
TOKEN=... # login
curl -sf -H "Authorization: Bearer $TOKEN" -F "file=@test.txt" http://127.0.0.1:3001/api/attachments
```

Expected: JSON `{ id, filename, mime, size }`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(api): attachments upload download and delete endpoints"
```

---

### Task 5: Sessions — attachmentIds 校验与空正文默认

**Files:**
- Modify: `apps/api/src/modules/sessions/sessions.service.ts`
- Modify: `apps/api/src/modules/attachments/attachments.module.ts`（exports AttachmentsService）
- Modify: `apps/api/src/modules/sessions/sessions.module.ts`（import AttachmentsModule）

**Interfaces:**
- Consumes: `AttachmentsService.assertOwned(ids, user)`
- Produces: create/addMessage 前校验合计 size ≤ 50MB；content 空时用「请结合附件回答」

- [ ] **Step 1: 私有方法 validateAttachments(user, ids: string[])**

```ts
private async validateAttachments(user: AuthUser, ids: string[]) {
  if (ids.length > ATTACHMENT_MAX_COUNT) throw new BadRequestException(...);
  const rows = await this.attachments.assertOwned(ids, user);
  const total = rows.reduce((s, r) => s + r.size, 0);
  if (total > ATTACHMENT_MAX_TOTAL_BYTES) throw new BadRequestException(...);
  return rows;
}
```

- [ ] **Step 2: create / addMessage 调用**

```ts
const attachmentIds = input.attachmentIds ?? [];
await this.validateAttachments(user, attachmentIds);
const content = input.content.trim() || (attachmentIds.length ? '请结合附件回答' : input.content);
```

- [ ] **Step 3: Typecheck + 手验 POST /sessions 带 attachmentIds**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): validate attachmentIds on session create and follow-up"
```

---

### Task 6: TextExtractService

**Files:**
- Create: `apps/api/src/modules/attachments/text-extract.service.ts`
- Modify: `apps/api/package.json`（add `pdf-parse`, `mammoth`, `xlsx` + types if needed）
- Modify: `apps/api/src/modules/attachments/attachments.module.ts`

**Interfaces:**
- Produces: `extractText(kind, buffer, filename): Promise<string>` — 失败 throw 或返回空串由 caller 处理
- Produces: `truncateExtracted(text, maxBytes = 102_400): string`

- [ ] **Step 1: 安装依赖**

Run: `pnpm --filter @work-ally/api add pdf-parse mammoth xlsx`

- [ ] **Step 2: 实现三类抽取 + 文本直读**

pdf → pdf-parse；docx → mammoth.extractRawText；xlsx → 前 50 行 CSV 化；txt/md/json/csv → utf8。

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): attachment text extraction for pdf docx xlsx and text files"
```

---

### Task 7: AttachmentAssemblyService + Runtime 集成

**Files:**
- Create: `apps/api/src/modules/attachments/attachment-assembly.service.ts`
- Modify: `apps/api/src/modules/runtime/runtime.service.ts`
- Modify: `apps/api/src/modules/runtime/pi-runner.service.ts`
- Modify: `apps/api/src/modules/workspace/artifact.service.ts`（`shouldSkipPath`）

**Interfaces:**
- Produces:

```ts
export type AssembledUserMessage = {
  text: string;
  images: Array<{ mime: string; base64: string; filename: string }>;
  workspacePaths: string[]; // relative paths copied under uploads/
};

export class AttachmentAssemblyService {
  assemble(input: {
    user: AuthUser;
    sessionId: string;
    tenantId: string;
    attachmentIds: string[];
    userText: string;
    modelConfigId: string | null;
  }): Promise<AssembledUserMessage>;
}
```

- Consumes: AttachmentsService, TextExtractService, ObjectStorageService, RuntimePathsService, Prisma (supportsVision)

- [ ] **Step 1: shouldSkipPath 加 uploads**

```ts
if (parts[0] === 'uploads' || parts.includes('uploads')) return true;
```

（或 `normalized.startsWith('uploads/')`）

- [ ] **Step 2: assemble 逻辑**

对每个 attachment：
- text 类：extract → 更新 `extractedText` → 拼 `[附件: name]\n(text)`
- office：extract + copy to `{sessionWorkspace}/uploads/{safeName}`
- image：copy to uploads；若 `supportsVision` push `{ mime, base64, filename }`

最终 `text = userText + '\n\n' + blocks.join('\n---\n')`

- [ ] **Step 3: runtime.service executeRun**

在 `piRunner.run` 前：

```ts
const assembled = await assembly.assemble({
  user: /* from session.creator membership? use run owner via JWT-less internal: tenantId + message */,
  sessionId: run.sessionId,
  tenantId: run.session.tenantId,
  attachmentIds: run.message.attachmentIds as string[],
  userText: run.message.content,
  modelConfigId: run.session.modelConfigId,
});
```

将 `assembled.text` 作为 `userMessage`；新增 `images: assembled.images` 传给 pi-runner。

- [ ] **Step 4: pi-runner 支持 images（依 Task 0 spike）**

若 spike 成功：`buildPrompt` 改为接受 images，调用 Pi API 的 multimodal 形态。  
若失败：`userMessage` 已含路径提示；images 数组忽略并 log warn。

- [ ] **Step 5: 手验**

会话带 txt 附件 → Run 后 assistant 能引用 txt 内容。  
带 pdf → `uploads/` 有文件且回复提及抽取内容。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(api): assemble attachments before runtime and exclude uploads from artifacts"
```

---

### Task 8: Admin — supportsVision

**Files:**
- Modify: `apps/api/src/modules/models/models.service.ts`
- Modify: `apps/api/src/modules/models/models.controller.ts`
- Modify: `apps/web/src/app/admin/models/page.tsx`

**Interfaces:**
- Produces: PATCH body `supportsVision?: boolean`；GET models 列表含 `supportsVision`

- [ ] **Step 1: API updateModel 接受 supportsVision**

- [ ] **Step 2: listEnabledModels / listAllModels 返回 supportsVision**

- [ ] **Step 3: Admin UI 每行模型加 checkbox「支持视觉」**

PATCH on toggle。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: admin model supportsVision toggle for attachment images"
```

---

### Task 9: Web — attachment-chips + upload hook

**Files:**
- Create: `apps/web/src/lib/attachments.ts`
- Create: `apps/web/src/components/attachment-chips.tsx`

**Interfaces:**
- Produces:
  - `uploadAttachment(file: File): Promise<AttachmentMeta>`
  - `useAttachmentUpload(maxCount?: number)` → `{ items, addFiles, remove, clear, attachmentIds, totalBytes, error }`

- [ ] **Step 1: attachments.ts**

复用 `apiFetch` + FormData；客户端校验扩展名/大小/个数/合计（常量从 shared 复制或将来 shared 导出给 web）。

- [ ] **Step 2: attachment-chips.tsx**

展示 filename、size、spinner、error、× 移除。

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): attachment upload hook and chips component"
```

---

### Task 10: Web — 首页 ComposerAddons + workbench-composer

**Files:**
- Modify: `apps/web/src/components/composer-addons.tsx`
- Modify: `apps/web/src/components/workbench-composer.tsx`

**Interfaces:**
- Consumes: `useAttachmentUpload`, `AttachmentChips`
- Produces: `ComposerAddons` props `attachmentIds` / `onAttachmentIdsChange` 或内聚 hook

- [ ] **Step 1: ComposerAddons 启用 file 菜单**

去掉「即将推出」；点击触发 hidden file input；集成 chips。

- [ ] **Step 2: workbench-composer send()**

```ts
body: JSON.stringify({
  ...
  content: text || '请结合附件回答',
  attachmentIds: upload.attachmentIds,
  context: { skillIds, connectorIds, knowledgeEnabled: false, knowledgeIds: [] }, // 不再塞 attachmentIds 到 context
})
```

发送按钮：`disabled` 改为 `!content.trim() && attachmentIds.length === 0`。

- [ ] **Step 3: 手验首页上传 txt → 建会话 → 助手能读**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): home composer file attachments upload and send"
```

---

### Task 11: Web — session-chat 追问 + 历史芯片

**Files:**
- Modify: `apps/web/src/components/session-chat.tsx`
- Modify: `apps/web/src/lib/types.ts`（Message 含 attachmentIds 若 API 已返回）

**Interfaces:**
- Consumes: attachment hook + chips
- Produces: follow-up POST 带 attachmentIds；用户气泡下只读 chips（点击下载）

- [ ] **Step 1: 输入区左侧 + 按钮 + chips**

- [ ] **Step 2: sendFollowUp 带 attachmentIds；允许仅附件**

- [ ] **Step 3: 渲染历史 user message 的 attachmentIds（需 session API 返回 message.attachmentIds）**

若 GET session 未返回 attachmentIds，补 API 序列化（小改 sessions.service get）。

- [ ] **Step 4: 手验追问传 pdf + 图**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): session follow-up attachments and history chips"
```

---

### Task 12: Smoke 清单 + spec 状态

**Files:**
- Create: `.superpowers/sdd/session-attachments-smoke.md`
- Modify: `docs/superpowers/specs/2026-09-01-session-attachments-design.md`（状态 → 已实现，手验后）

- [ ] **Step 1: smoke 清单**

```markdown
- [ ] POST /attachments txt + png + pdf
- [ ] 首页仅附件建会话
- [ ] 追问再传 pdf
- [ ] uploads/ 有 pdf；产物侧栏无 uploads
- [ ] supportsVision 开：png 问题模型能描述
- [ ] supportsVision 关：仅路径提示
- [ ] 超 5 个 / 20MB / 50MB 拒绝
- [ ] 历史消息芯片可下载
```

- [ ] **Step 2: 手验勾完改 spec 状态**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: session attachments smoke checklist"
```

---

## Spike 结论（Task 0 完成后填写）

- [x] Pi multimodal API: **supported (partial)** — `session.prompt(text, { images: ImageContent[] })` and `sendUserMessage(string | (TextContent|ImageContent)[])`; `ImageContent = { type, data: base64, mimeType }`. Not `prompt(UserContent[])` — text + optional `images` option. Requires `model.input` includes `"image"` in `models.json` or Pi strips images to placeholder.
- [x] Task 7 vision 验收: **blocked** on current MiniMax (`MiniMax-M3` @ `api.minimaxi.com/anthropic`) — image blocks return HTTP 400; text-only works. Task 7 should implement Pi image path + `writeModelsJson` `input: ['text','image']` when `supportsVision`, but fall back to uploads path hint for MiniMax until provider supports vision. Smoke「模型能描述 png」标 blocked + follow-up issue.

## Plan self-review

| Spec 要求 | Task |
|---|---|
| MinIO 上传 | 3, 4 |
| 限额 5/20MB/50MB | 2, 4, 5, 9 |
| pdf/docx/xlsx 抽文 + uploads | 6, 7 |
| 图片多模态同一 ModelConfig | 0, 7, 8 |
| 首页 + 追问入口 | 10, 11 |
| supportsVision Admin | 1, 8 |
| uploads 不晋升产物 | 7 |
| 附件不进交付物侧栏 | 7（后端排除即可） |
| DELETE 未绑定可删 | 4 |
