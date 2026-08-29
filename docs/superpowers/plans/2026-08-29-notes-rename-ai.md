# 笔记改名 + 旁路 AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「手册」全面更名为「笔记」（slug `notes`），并增加笔记旁路 AI 多轮对话：整篇应用与一层还原。

**Architecture:** 对外契约全部切到 `/apps/notes` 与 `NOTES_SLUG`；Prisma 笔记表暂留 `handbook_*`，新增 `notes_ai_threads` / `notes_ai_messages`。AI 不走 Mastra Agent，扩展 `ModelsService` 多轮 completion（优先 `AppRegistry.defaultModelConfigId`）。前端将 `components/handbook` 迁为 `components/notes`，编辑器旁 AI 抽屉客户端持有 `previousBodyMd`。

**Tech Stack:** NestJS, Prisma/MySQL, Next.js 15, `@work-ally/shared` Zod, 现有 Anthropic-compatible `ModelsService.completeChat`

**Spec:** `docs/superpowers/specs/2026-08-29-notes-rename-ai-design.md`

## Global Constraints

- 显示名「笔记」；slug `notes`；路由 `/workbench/apps/notes`；API `/api/apps/notes`
- 物理表 `handbook_categories` / `handbook_notes` 本版不改名；AI 表用 `notes_ai_*`
- AI：旁路多轮；整篇替换；客户端一层还原；无 Diff、无选区替换、无 MCP/专家/知识库
- 输出约定：助手须给出 ` ```md ` … ` ``` ` 完整正文；解析失败不可应用
- 上下文：正文最多 **12000** 字符（超出截断尾部并注明）；历史最近 **8** 条消息
- 无 Jest；用 `tsc --noEmit` + 手验
- 分支：在 `feat/handbook` 上继续，或新建 `feat/notes-ai`（实现时以当前分支为准）

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/index.ts` | `NOTES_SLUG`、AI Zod；`HANDBOOK_SLUG` 标 deprecated 别名一期 |
| `apps/api/prisma/schema.prisma` | `NotesAiThread` / `NotesAiMessage` |
| `apps/api/prisma/migrations/<ts>_notes_ai/` | CREATE AI 表 |
| `apps/api/src/modules/apps/app-registry.service.ts` | `ensureNotes`（迁 handbook→notes） |
| `apps/api/src/modules/apps/notes-app.guard.ts` | 原 HandbookAppGuard |
| `apps/api/src/modules/apps/notes/*` | 由 handbook 迁入 + AI controller/service |
| `apps/api/src/modules/models/models.service.ts` | `completeChatMessages` 多轮 + modelConfigId |
| `apps/api/src/modules/models/models.module.ts` | export ModelsService（若尚未） |
| `apps/web/src/components/notes/*` | 原 handbook 组件迁入 + `notes-ai-panel.tsx` |
| `apps/web/src/app/workbench/apps/notes/page.tsx` | 入口 |
| `apps/web/src/app/workbench/apps/handbook/page.tsx` | redirect → notes |
| `apps/web/src/app/admin/apps/notes/page.tsx` | 管理端 |
| `apps/web/src/app/workbench/apps/page.tsx` | 卡片文案/slug |
| `apps/api/src/modules/auth/auth.service.ts` | 新租户 seed notes |

---

### Task 1: Shared — NOTES_SLUG + AI schemas

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `NOTES_SLUG = 'notes'`；`HANDBOOK_SLUG` 保留 `= 'notes'` 或 deprecated `= NOTES_SLUG`（计划选定：**二者皆为 `'notes'`**，避免旧 import 崩）
- Produces: `NotesAiActionSchema`, `CreateNotesAiMessageSchema`, types

- [ ] **Step 1: Add exports**

```ts
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
});
export type CreateNotesAiMessageInput = z.infer<typeof CreateNotesAiMessageSchema>;
```

保留既有 `CreateHandbookCategorySchema` 等命名本版可不改（内部仍可用），或同步别名 `CreateNotesCategorySchema = CreateHandbookCategorySchema`——**本任务只加 NOTES_SLUG + AI schema**，分类/笔记 Zod 改名放到 Task 3 顺手做。

- [ ] **Step 2: tsc shared**

Run: `pnpm --filter @work-ally/shared exec tsc --noEmit`  
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add NOTES_SLUG and notes AI message schemas"
```

---

### Task 2: Prisma — NotesAiThread / NotesAiMessage

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260829230000_notes_ai/migration.sql`

**Interfaces:**
- Produces: models linked to Tenant；`noteId` 指向 `HandbookNote.id`（物理表仍 handbook_notes）

- [ ] **Step 1: schema**

在 Tenant 增加 `notesAiThreads NotesAiThread[]`。新增：

```prisma
model NotesAiThread {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  noteId    String   @map("note_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant   Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  note     HandbookNote      @relation(fields: [noteId], references: [id], onDelete: Cascade)
  messages NotesAiMessage[]

  @@unique([tenantId, userId, noteId])
  @@index([tenantId, userId])
  @@map("notes_ai_threads")
}

model NotesAiMessage {
  id        String   @id @default(cuid())
  threadId  String   @map("thread_id")
  role      String   // user | assistant | system
  content   String   @db.Text
  draftMd   String?  @map("draft_md") @db.LongText
  createdAt DateTime @default(now()) @map("created_at")

  thread NotesAiThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
  @@map("notes_ai_messages")
}
```

在 `HandbookNote` 上增加 `aiThreads NotesAiThread[]`。

- [ ] **Step 2: migration SQL** — CREATE 两表 + FK（note cascade、tenant cascade）

- [ ] **Step 3: migrate deploy + generate**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): add notes AI thread and message tables"
```

---

### Task 3: Registry + API rename handbook → notes

**Files:**
- Modify: `app-registry.service.ts`（ensureNotes：若有 handbook 则 update slug/name/description）
- Rename/move: `handbook-app.guard.ts` → `notes-app.guard.ts`
- Move dir: `apps/api/src/modules/apps/handbook/` → `notes/`；controller `@Controller('apps/notes')`
- Modify: `admin-apps.controller.ts`、`auth.service.ts`、`apps.module.ts`
- Optional: 短期保留 `@Controller('apps/handbook')` 空壳 redirect——**本版不做 API 双挂**，只做 Web 页 redirect

**Interfaces:**
- `getNotesForUser` / `updateNotes` / `NOTES_DEFAULT`
- Guard 文案：`无权使用笔记应用`

- [ ] **Step 1: ensureNotes**

```ts
export const NOTES_DEFAULT = {
  slug: NOTES_SLUG,
  name: '笔记',
  description: '个人工作笔记：分类、富文本、搜索与 AI 改稿',
};

async ensureNotes(tenantId: string, ownerUserId: string) {
  const asNotes = await this.prisma.appRegistry.findUnique({
    where: { tenantId_slug: { tenantId, slug: NOTES_SLUG } },
  });
  if (asNotes) {
    if (asNotes.name !== NOTES_DEFAULT.name || !asNotes.description.includes('AI')) {
      return this.prisma.appRegistry.update({
        where: { id: asNotes.id },
        data: {
          name: NOTES_DEFAULT.name,
          description: NOTES_DEFAULT.description,
        },
      });
    }
    return asNotes;
  }
  const legacy = await this.prisma.appRegistry.findUnique({
    where: { tenantId_slug: { tenantId, slug: 'handbook' } },
  });
  if (legacy) {
    return this.prisma.appRegistry.update({
      where: { id: legacy.id },
      data: {
        slug: NOTES_SLUG,
        name: NOTES_DEFAULT.name,
        description: NOTES_DEFAULT.description,
      },
    });
  }
  return this.prisma.appRegistry.create({
    data: {
      tenantId,
      slug: NOTES_SLUG,
      name: NOTES_DEFAULT.name,
      description: NOTES_DEFAULT.description,
      ownerUserId,
      visibility: 'tenant',
      enabled: true,
    },
  });
}
```

`listForUser` / admin：调用 `ensureNotes` 替代 `ensureHandbook`。

- [ ] **Step 2: Move services/controller to `notes/`，前缀 `apps/notes`**

内部仍用 `prisma.handbookCategory` / `handbookNote`。

- [ ] **Step 3: Admin patch 认 `NOTES_SLUG`；auth seed 用 notes**

- [ ] **Step 4: tsc api**

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(api): rename handbook app surface to notes"
```

---

### Task 4: ModelsService — multi-turn completion with modelConfigId

**Files:**
- Modify: `apps/api/src/modules/models/models.service.ts`
- Modify: `models.module.ts` — `exports: [ModelsService]`
- Modify: `apps.module.ts` — `imports: [ModelsModule]`

**Interfaces:**
- Produces:

```ts
async completeChatMessages(input: {
  tenantId: string;
  modelConfigId?: string | null;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}): Promise<string>
```

- Prefer `resolveCredentials({ tenantId, modelConfigId })`；若无 config 则 `resolveFirstAvailableCredentials`；仍无则 BadRequest「请先在管理端为笔记配置模型或添加可用模型」

- [ ] **Step 1: Implement** — 复用现有 `completeChat` 的 fetch `/v1/messages` 逻辑，`messages` 数组传入；`system` 独立字段

- [ ] **Step 2: tsc**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): support multi-turn chat completion with modelConfigId"
```

---

### Task 5: Notes AI service + routes

**Files:**
- Create: `apps/api/src/modules/apps/notes/notes-ai.service.ts`
- Modify: `notes.controller.ts`（或 handbook 迁后的 controller）

**Interfaces:**
- `listMessages(user, noteId)`
- `postMessage(user, noteId, input: CreateNotesAiMessageInput)` → `{ messages: [...], assistant: { content, draftMd } }`
- Helpers: `truncateBody(bodyMd)`, `parseDraftMd(text)`, `buildSystem(action)`, `ensureThread`

**System prompts (verbatim):**

format:
`你是笔记排版助手。只根据用户提供的标题与正文整理结构（标题层级、列表、分段），不要编造未出现的事实。必须在回复末尾给出完整 Markdown 正文，放在唯一的 md 围栏中：以三反引号 md 开始、三反引号结束。`

enrich:
`你是 SOP/工作流程写作助手。在不编造具体环境细节的前提下，补全步骤、注意项与验收项；不确定处标注「待确认」。必须在回复末尾给出完整 Markdown 正文，放在唯一的 md 围栏中。`

custom: 同上通用约束 + 用户 prompt。

**parseDraftMd:** 取最后一个 ` ```md ` … ` ``` ` 内文本；若无则尝试任意 ` ``` ` 围栏；仍无则 `draftMd=null`。

**History:** 最近 8 条 user/assistant（不含 system 行入库也可；system 每次现拼）。

**body truncate:** `bodyMd.length > 12000` → `bodyMd.slice(0, 12000) + '\n\n…(已截断)'`

- [ ] **Step 1: Implement service** — 校验 note 归属；写 user message；调 completeChatMessages；写 assistant（content 全文 + draftMd）；返回

- [ ] **Step 2: Routes**

```ts
@Get('notes/:id/ai/messages')
@Post('notes/:id/ai/messages')
```

本版 **不做** cancel 流式（一次性返回，YAGNI）；若耗时过长可后续加。

- [ ] **Step 3: 手验** — 有模型时 format；无模型 400

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): notes AI thread messages for format and enrich"
```

---

### Task 6: Web rename handbook → notes + redirect

**Files:**
- Move: `components/handbook/*` → `components/notes/*`（更新 import、API 路径 `/apps/notes/...`、类名可暂留 `handbook-*` / `hb-*` CSS 以免大爆炸，或全局替换为 `notes-*`——**本任务：API 路径与文案必改；CSS 类名可保留 hb-/handbook- 前缀**）
- Create: `app/workbench/apps/notes/page.tsx`
- Replace: `app/workbench/apps/handbook/page.tsx` → `redirect('/workbench/apps/notes')`
- Move: admin page；更新 nav 链接与 apps list 卡片（slug notes，名「笔记」，meta 含 AI）

- [ ] **Step 1: Move components + fix fetch paths**

- [ ] **Step 2: Pages + admin + list card**

- [ ] **Step 3: Browser** — `/workbench/apps/notes` 可用；`/handbook` 跳转

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(web): rename handbook UI to notes with redirect"
```

---

### Task 7: AI panel UI + apply/restore

**Files:**
- Create: `apps/web/src/components/notes/notes-ai-panel.tsx`
- Modify: `note-editor.tsx` — AI 按钮；`onOpenAi` / 或由 `notes-app.tsx` 控抽屉
- Modify: `notes-app.tsx` — 布局第四栏或 overlay 抽屉；`previousBodyMd` state；切换笔记清 previous、加载消息

**Interfaces:**
- Props: `noteId`, `title`, `bodyMd`, `open`, `onClose`, `onApply(draftMd: string)`, `canRestore`, `onRestore`
- Panel: 快捷按钮 format/enrich；输入框；消息列表；应用/还原

**Apply flow in notes-app:**

```ts
function handleApply(draftMd: string) {
  setPreviousBodyMd(selectedNote.bodyMd);
  handleChangeBody(draftMd); // existing autosave path
}
function handleRestore() {
  if (previousBodyMd == null) return;
  handleChangeBody(previousBodyMd);
  setPreviousBodyMd(null);
}
```

切换 `selectedNoteId` 时：`setPreviousBodyMd(null)`；`loadAiMessages(noteId)`。

- [ ] **Step 1: Panel UI**

- [ ] **Step 2: Wire editor toolbar AI + app state**

- [ ] **Step 3: CSS** — `.notes-ai` 抽屉宽约 320–360px，可与 hb-editor 并排

- [ ] **Step 4: 手验** — 完善内容 → 应用 → 还原；换笔记对话隔离

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): notes AI side panel with apply and restore"
```

---

### Task 8: Admin model binding hint + smoke

**Files:**
- Modify: `admin/apps/notes/page.tsx` — 说明可绑 `defaultModelConfigId`（若 stickies/admin 已有模型下拉则复用；否则文案：使用租户已启用的默认模型，`completeChatMessages` 已 fallback）
- Modify: spec status → 实现中/已实现

**Admin 模型绑定：** 若 `UpdateAppRegistrySchema` 已含 `defaultModelConfigId`，在笔记 admin 页加简单 `<select>` 拉 `/models` 列表写入 PATCH——**有则做，无现成 UI 则仅文案 + fallback**（Task 4 已支持 fallback）。

- [ ] **Step 1: Admin 文案/可选模型选择**

- [ ] **Step 2: 冒烟清单**

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 应用列表见「笔记」 | slug notes |
| 2 | /handbook 跳转 /notes | 200 |
| 3 | CRUD 分类笔记 | 同前 |
| 4 | AI 优化排版 | 返回 draftMd，可应用 |
| 5 | 还原 | 回应用前 |
| 6 | 换笔记 | 对话不串 |
| 7 | 无模型（可临时关） | 可读错误 |

- [ ] **Step 3: Commit docs + leftovers**

```bash
git commit -m "docs: mark notes rename+AI implemented after smoke"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| 全面改名 notes | 1, 3, 6 |
| 旁路多轮 AI | 5, 7 |
| 整篇应用 + 一层还原 | 7 |
| 快捷 format/enrich | 5, 7 |
| 模型配置 / fallback | 4, 8 |
| 表 handbook_* 保留 | 2, 3 |
| 不做 Diff/选区/MCP | — |

## Consistency notes

- `HANDBOOK_SLUG` === `NOTES_SLUG` === `'notes'` 避免遗漏替换  
- AI 新表物理名 `notes_ai_*`；笔记数据表仍 `handbook_*`  
- 本版 AI **非流式**，降低前端复杂度
