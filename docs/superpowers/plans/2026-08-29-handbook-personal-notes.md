# 手册（个人工作知识笔记）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作台新增内置 App「手册」（slug `handbook`）：个人 Markdown 工作流程/SOP 笔记，左侧分类树（≤2 层）+ 顶部全局搜索 + 三栏编辑。

**Architecture:** 与闪签同模式——`AppRegistry` soft-seed、`HandbookAppGuard`、Nest 模块挂在 `/apps/handbook`、Prisma 表按 `(tenantId, userId)` 隔离、Next 页面 `/workbench/apps/handbook`。第一版不做分享、AI 引用、标签、附件。

**Tech Stack:** NestJS, Prisma/MySQL, Next.js 15 App Router, `@work-ally/shared` Zod, 已有 `react-markdown` + `remark-gfm` 做预览

**Spec:** `docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md`

## Global Constraints

- 显示名「手册」；slug `handbook`；路由 `/workbench/apps/handbook`；API 前缀 `/apps/handbook`
- 数据隔离：`tenantId + userId`；无分享
- 分类最多 2 层；系统概念「全部」「未分类」不入库
- 正文 Markdown；`bodyMd` 上限 **50000** 字符；超限拒绝保存并提示
- 不做：协作、双向链接、标签、附件、富文本、版本历史、与闪签互链、对话检索
- 本仓库无 Jest/Vitest；每任务用 `pnpm --filter @work-ally/api lint` / `pnpm --filter @work-ally/web lint`（或对应 `tsc`）+ 手验代替自动化单测
- 样式跟工作台 token（`var(--panel)`、`var(--line)`、`var(--muted)` 等），类名前缀 `.handbook-`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/index.ts` | `HANDBOOK_SLUG` + Category/Note Zod |
| `apps/api/prisma/schema.prisma` | `HandbookCategory` / `HandbookNote` + Tenant 关系 |
| `apps/api/prisma/migrations/<ts>_handbook_notes/migration.sql` | CREATE 表 |
| `apps/api/src/modules/apps/app-registry.service.ts` | `ensureHandbook`、list 时 seed、`getHandbookForUser`、`updateHandbook` |
| `apps/api/src/modules/apps/handbook-app.guard.ts` | 启用 + ACL |
| `apps/api/src/modules/apps/admin-apps.controller.ts` | list/get/patch 支持 handbook |
| `apps/api/src/modules/apps/handbook/handbook-categories.service.ts` | 分类 CRUD + 深度校验 |
| `apps/api/src/modules/apps/handbook/handbook-notes.service.ts` | 笔记 CRUD + 搜索 |
| `apps/api/src/modules/apps/handbook/handbook.controller.ts` | HTTP 路由 |
| `apps/api/src/modules/apps/apps.module.ts` | 注册 handbook providers |
| `apps/api/src/modules/auth/auth.service.ts` | 新租户同时 seed handbook |
| `apps/web/src/components/handbook/types.ts` | 前端类型 |
| `apps/web/src/components/handbook/handbook-app.tsx` | 三栏壳 + 状态 |
| `apps/web/src/components/handbook/category-tree.tsx` | 左栏分类 |
| `apps/web/src/components/handbook/note-list.tsx` | 中栏列表 |
| `apps/web/src/components/handbook/note-editor.tsx` | 右栏编辑/预览 + 防抖保存 |
| `apps/web/src/app/workbench/apps/handbook/page.tsx` | 页面入口 |
| `apps/web/src/app/admin/apps/handbook/page.tsx` | 管理端开关 |
| `apps/web/src/app/workbench/apps/page.tsx` | 应用卡片区分 handbook |
| `apps/web/src/app/globals.css` | `.handbook-*` 样式 |

---

### Task 1: Shared Zod — Handbook schemas

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `HANDBOOK_SLUG`, `CreateHandbookCategorySchema`, `UpdateHandbookCategorySchema`, `CreateHandbookNoteSchema`, `UpdateHandbookNoteSchema` 及对应 `*Input` types

- [ ] **Step 1: Append schemas after stickies block**

在 `STICKIES_SLUG` / Task schemas 之后、`UpdateAppRegistrySchema` 之前（或之后均可，保持可读）加入：

```ts
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
```

- [ ] **Step 2: Verify shared package types**

Run: `pnpm --filter @work-ally/shared exec tsc --noEmit`  
（若无 tsc script：从 repo root `pnpm exec tsc -p packages/shared` 或跳过并在 api 引用时编译。）

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add handbook category and note schemas"
```

---

### Task 2: Prisma — HandbookCategory + HandbookNote

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260829120000_handbook_notes/migration.sql`

**Interfaces:**
- Produces: models `HandbookCategory`, `HandbookNote`；Tenant 上 `handbookCategories` / `handbookNotes`

- [ ] **Step 1: Add models to schema.prisma**

在 `Tenant` 的 relations 中增加：

```prisma
  handbookCategories HandbookCategory[]
  handbookNotes      HandbookNote[]
```

在文件末尾（Task 模型附近）新增：

```prisma
model HandbookCategory {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  name      String   @db.VarChar(64)
  parentId  String?  @map("parent_id")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  notes  HandbookNote[]

  @@index([tenantId, userId, parentId])
  @@map("handbook_categories")
}

model HandbookNote {
  id         String   @id @default(cuid())
  tenantId   String   @map("tenant_id")
  userId     String   @map("user_id")
  categoryId String?  @map("category_id")
  title      String   @db.VarChar(191)
  bodyMd     String   @default("") @map("body_md") @db.Text
  pinned     Boolean  @default(false)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  tenant   Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category HandbookCategory?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([tenantId, userId, categoryId])
  @@index([tenantId, userId, updatedAt])
  @@map("handbook_notes")
}
```

注意：`HandbookCategory` 不做自引用 Prisma relation（避免复杂）；`parentId` 仅存字符串，深度在 service 校验。

- [ ] **Step 2: Write migration SQL**

`apps/api/prisma/migrations/20260829120000_handbook_notes/migration.sql`：

```sql
-- CreateTable
CREATE TABLE `handbook_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `handbook_categories_tenant_id_user_id_parent_id_idx`(`tenant_id`, `user_id`, `parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `handbook_notes` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body_md` TEXT NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `handbook_notes_tenant_id_user_id_category_id_idx`(`tenant_id`, `user_id`, `category_id`),
    INDEX `handbook_notes_tenant_id_user_id_updated_at_idx`(`tenant_id`, `user_id`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `handbook_categories` ADD CONSTRAINT `handbook_categories_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handbook_notes` ADD CONSTRAINT `handbook_notes_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handbook_notes` ADD CONSTRAINT `handbook_notes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `handbook_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply migration**

Run: `pnpm --filter @work-ally/api exec prisma migrate deploy`  
（本地开发也可用 `prisma migrate dev`；以仓库惯用命令为准。）

Expected: 迁移成功；`prisma generate` 后 client 含新模型。

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260829120000_handbook_notes
git commit -m "feat(api): add handbook category and note tables"
```

---

### Task 3: AppRegistry + Guard + Admin API

**Files:**
- Modify: `apps/api/src/modules/apps/app-registry.service.ts`
- Create: `apps/api/src/modules/apps/handbook-app.guard.ts`
- Modify: `apps/api/src/modules/apps/admin-apps.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`（先注册 Guard；controller 在 Task 4/5）

**Interfaces:**
- Produces: `ensureHandbook`, `getHandbookForUser`, `getHandbookAdmin`, `updateHandbook`
- Consumes: `HANDBOOK_SLUG`

- [ ] **Step 1: Extend AppRegistryService**

增加常量与方法（保留现有 stickies 逻辑）：

```ts
import { HANDBOOK_SLUG, STICKIES_SLUG } from '@work-ally/shared';

export const HANDBOOK_DEFAULT = {
  slug: HANDBOOK_SLUG,
  name: '手册',
  description: '个人工作手册：分类、Markdown 流程笔记与快速搜索',
};

// ensureHandbook — 同 ensureStickies 结构，用 HANDBOOK_*，无「便签」文案修正

// listForUser / getStickiesAdmin 路径：在 ensureStickies 之后调用 ensureHandbook

// getHandbookForUser(user) — 同 getStickiesForUser，换 slug/ensure
// getHandbookAdmin(tenantId) — 同 getStickiesAdmin
// updateHandbook(tenantId, body) — 同 updateStickies 字段子集（enabled/visibility 等）
```

`listForUser` 内：

```ts
await this.ensureStickies(user.tenantId, ownerId);
await this.ensureHandbook(user.tenantId, ownerId);
```

`AdminAppsController.list`：ensure 两者后返回该租户全部 `appRegistry` 行（或至少 stickies + handbook），不要只返回闪签一条。

- [ ] **Step 2: HandbookAppGuard**

`handbook-app.guard.ts`：

```ts
@Injectable()
export class HandbookAppGuard implements CanActivate {
  constructor(private readonly registry: AppRegistryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return false;
    const app = await this.registry.getHandbookForUser(user);
    if (!app) {
      throw new ForbiddenException('无权使用手册应用');
    }
    return true;
  }
}
```

- [ ] **Step 3: Admin patch 支持 handbook**

```ts
if (slug !== STICKIES_SLUG && slug !== HANDBOOK_SLUG) {
  throw new NotFoundException('应用不存在');
}
const app =
  slug === STICKIES_SLUG
    ? await this.registry.updateStickies(user.tenantId, input)
    : await this.registry.updateHandbook(user.tenantId, input);
```

`GET` 已按 slug 查库，ensure 在 list 时完成即可；`GET :slug` 对 handbook 在缺失时可 `ensureHandbook` 再取。

- [ ] **Step 4: Auth 新租户 seed**

在 `auth.service.ts` 创建租户事务里，闪签 `appRegistry.create` 之后再 create handbook 一行（`HANDBOOK_SLUG` / 手册 / 上述 description）。

- [ ] **Step 5: Register Guard in AppsModule**

```ts
providers: [..., HandbookAppGuard],
```

- [ ] **Step 6: Lint API**

Run: `pnpm --filter @work-ally/api exec tsc --noEmit`（或项目惯用 lint）

Expected: 通过（若尚无 handbook controller，勿引用未存在类）。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/apps/app-registry.service.ts \
  apps/api/src/modules/apps/handbook-app.guard.ts \
  apps/api/src/modules/apps/admin-apps.controller.ts \
  apps/api/src/modules/apps/apps.module.ts \
  apps/api/src/modules/auth/auth.service.ts
git commit -m "feat(api): register handbook app in registry and admin"
```

---

### Task 4: Categories API

**Files:**
- Create: `apps/api/src/modules/apps/handbook/handbook-categories.service.ts`
- Create: `apps/api/src/modules/apps/handbook/handbook.controller.ts`（本任务写 categories 路由；notes 路由 Task 5 补全）
- Modify: `apps/api/src/modules/apps/apps.module.ts`

**Interfaces:**
- Produces: `HandbookCategoriesService.list|create|update|remove`；序列化 `{ id, name, parentId, sortOrder, createdAt, updatedAt }`
- Depth rule: `parentId == null` → 第 1 层；parent 的 `parentId` 必须为 `null`（即父只能是根）；禁止把节点挂到第 2 层之下；更新 `parentId` 时同样校验；禁止 `parentId === id`；若目标 parent 不存在或不属于本人 → 404

- [ ] **Step 1: Implement HandbookCategoriesService**

核心逻辑要点：

```ts
async list(user: AuthUser) {
  const rows = await this.prisma.handbookCategory.findMany({
    where: { tenantId: user.tenantId, userId: user.userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map((r) => this.serialize(r));
}

async create(user: AuthUser, input: CreateHandbookCategoryInput) {
  await this.assertParentAllowed(user, input.parentId ?? null);
  // create...
}

async update(...) {
  const existing = await this.findOwned(...);
  const nextParent =
    input.parentId !== undefined ? input.parentId : existing.parentId;
  if (nextParent === existing.id) {
    throw new BadRequestException('分类不能成为自己的父级');
  }
  await this.assertParentAllowed(user, nextParent);
  // 若将该节点设为别人的 parent 前，若自己已有子节点且 nextParent != null → 会变成 3 层：拒绝
  if (nextParent != null) {
    const childCount = await this.prisma.handbookCategory.count({
      where: { tenantId: user.tenantId, userId: user.userId, parentId: existing.id },
    });
    if (childCount > 0) {
      throw new BadRequestException('含有子分类的节点不能移到第二层');
    }
  }
  // update...
}

async remove(user: AuthUser, id: string) {
  const existing = await this.findOwned(...);
  const childCount = await this.prisma.handbookCategory.count({
    where: { tenantId: user.tenantId, userId: user.userId, parentId: id },
  });
  if (childCount > 0) {
    throw new BadRequestException('请先删除或移走子分类');
  }
  await this.prisma.handbookNote.updateMany({
    where: { tenantId: user.tenantId, userId: user.userId, categoryId: id },
    data: { categoryId: null },
  });
  await this.prisma.handbookCategory.delete({ where: { id } });
  return { ok: true };
}

private async assertParentAllowed(user: AuthUser, parentId: string | null) {
  if (parentId == null) return;
  const parent = await this.prisma.handbookCategory.findFirst({
    where: { id: parentId, tenantId: user.tenantId, userId: user.userId },
  });
  if (!parent) throw new NotFoundException('父分类不存在');
  if (parent.parentId != null) {
    throw new BadRequestException('分类最多两层');
  }
}
```

- [ ] **Step 2: Controller routes**

```ts
@Controller('apps/handbook')
@UseGuards(JwtAuthGuard, HandbookAppGuard)
export class HandbookController {
  constructor(private readonly categories: HandbookCategoriesService) {}

  @Get('categories')
  listCategories(@CurrentUser() user: AuthUser) {
    return this.categories.list(user);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.categories.create(
      user,
      parseBody(CreateHandbookCategorySchema, body),
    );
  }

  @Patch('categories/:id')
  updateCategory(...) { ... }

  @Delete('categories/:id')
  deleteCategory(...) { ... }
}
```

- [ ] **Step 3: Wire module**

`controllers: [..., HandbookController]`  
`providers: [..., HandbookCategoriesService]`

- [ ] **Step 4: Manual API check**

登录后：

1. `GET /api/apps/handbook/categories` → `[]`
2. `POST` `{ "name": "发布" }` → 有 id
3. `POST` `{ "name": "回滚", "parentId": "<发布id>" }` → ok
4. `POST` `{ "name": "过深", "parentId": "<回滚id>" }` → 400 分类最多两层

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/apps/handbook apps/api/src/modules/apps/apps.module.ts
git commit -m "feat(api): handbook categories CRUD with two-level limit"
```

---

### Task 5: Notes API（列表 / 搜索 / CRUD）

**Files:**
- Create: `apps/api/src/modules/apps/handbook/handbook-notes.service.ts`
- Modify: `apps/api/src/modules/apps/handbook/handbook.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`

**Interfaces:**
- Produces: `list({ categoryId?, q? })`, `get`, `create`, `update`, `remove`
- Serialize: `{ id, title, bodyMd, categoryId, pinned, createdAt, updatedAt }`（时间为 ISO 字符串）
- `categoryId` 若非空须属于本人；`q` trim 后非空则标题/正文 `contains`（MySQL 默认大小写规则即可）；`categoryId` 与 `q` 可同时生效（搜索时若带 categoryId 则限定分类，否则全局）
- 列表排序：`pinned desc`, `updatedAt desc`

- [ ] **Step 1: Implement HandbookNotesService**

```ts
async list(
  user: AuthUser,
  filters: { categoryId?: string | null; q?: string },
) {
  const where: Prisma.HandbookNoteWhereInput = {
    tenantId: user.tenantId,
    userId: user.userId,
  };
  if (filters.categoryId === 'uncategorized') {
    where.categoryId = null;
  } else if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { bodyMd: { contains: q } },
    ];
  }
  const rows = await this.prisma.handbookNote.findMany({
    where,
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  });
  return rows.map((r) => this.serialize(r));
}

async create(user: AuthUser, input: CreateHandbookNoteInput) {
  await this.assertCategory(user, input.categoryId ?? null);
  const note = await this.prisma.handbookNote.create({
    data: {
      tenantId: user.tenantId,
      userId: user.userId,
      title: (input.title ?? '无标题').trim() || '无标题',
      bodyMd: input.bodyMd ?? '',
      categoryId: input.categoryId ?? null,
      pinned: input.pinned ?? false,
    },
  });
  return this.serialize(note);
}
// update/remove/findOwned 同 tasks.service 模式
```

Zod 已限制 `bodyMd` ≤ 50000；非法 body 由 `parseBody` 拒绝。

- [ ] **Step 2: Add note routes to HandbookController**

```ts
@Get('notes')
listNotes(
  @CurrentUser() user: AuthUser,
  @Query('categoryId') categoryId?: string,
  @Query('q') q?: string,
) {
  return this.notes.list(user, { categoryId, q });
}

@Post('notes')
createNote(...) { ... }

@Get('notes/:id')
getNote(...) { ... }

@Patch('notes/:id')
updateNote(...) { ... }

@Delete('notes/:id')
deleteNote(...) { ... }
```

- [ ] **Step 3: Manual check**

1. 创建笔记带 `categoryId`  
2. `GET notes?q=重启` 命中正文  
3. 用户 B token 读用户 A 的 note id → 404  
4. `bodyMd` 超 50000 → 400

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/apps/handbook
git commit -m "feat(api): handbook notes CRUD and search"
```

---

### Task 6: Web — types + workbench page shell

**Files:**
- Create: `apps/web/src/components/handbook/types.ts`
- Create: `apps/web/src/components/handbook/handbook-app.tsx`（先空壳：加载分类/笔记状态，三栏占位）
- Create: `apps/web/src/app/workbench/apps/handbook/page.tsx`

**Interfaces:**
- Produces: `HandbookCategory`, `HandbookNote` 类型与 `HandbookApp` 组件

- [ ] **Step 1: types.ts**

```ts
export type HandbookCategory = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HandbookNote = {
  id: string;
  title: string;
  bodyMd: string;
  categoryId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 左栏选中：全部 | 未分类 | 某分类 id */
export type CategorySelection = 'all' | 'uncategorized' | string;
```

- [ ] **Step 2: handbook-app.tsx 最小壳**

- `useEffect` 拉 `/apps/handbook/categories` 与按 selection 拉 `/apps/handbook/notes`
- state：`categories`, `notes`, `selection`, `selectedNoteId`, `query`, `loading`
- 三栏 div 结构 + className `handbook-app`（子组件下任务再填）

- [ ] **Step 3: page.tsx**

```tsx
'use client';
import { HandbookApp } from '@/components/handbook/handbook-app';

export default function HandbookPage() {
  return <HandbookApp />;
}
```

- [ ] **Step 4: 浏览器打开 `/workbench/apps/handbook`**

Expected: 不 404；能进壳（API 若 403 显示无权提示）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/handbook apps/web/src/app/workbench/apps/handbook
git commit -m "feat(web): scaffold handbook workbench page"
```

---

### Task 7: Web — Category tree

**Files:**
- Create: `apps/web/src/components/handbook/category-tree.tsx`
- Modify: `apps/web/src/components/handbook/handbook-app.tsx`

**Interfaces:**
- Props: `categories`, `selection`, `onSelect`, `onCreate`, `onRename`, `onDelete`

- [ ] **Step 1: category-tree.tsx**

- 固定项：「全部」「未分类」
- 根分类下列出 `parentId === null`；其子项缩进列出
- 「+ 分类」：prompt 或行内输入名称 → `POST /apps/handbook/categories`
- 右键或「⋯」：重命名 `PATCH`、删除 `DELETE`（确认）
- 选中态 class `handbook-tree__item--active`

- [ ] **Step 2: 接入 handbook-app**

选择分类时重置 `selectedNoteId`（可选保留若仍属该分类）；刷新 notes 列表。

- [ ] **Step 3: 手验**

建两层分类、删除叶子、删父前有子应看到错误提示。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/handbook
git commit -m "feat(web): handbook category tree"
```

---

### Task 8: Web — Note list + editor + search + autosave

**Files:**
- Create: `apps/web/src/components/handbook/note-list.tsx`
- Create: `apps/web/src/components/handbook/note-editor.tsx`
- Modify: `apps/web/src/components/handbook/handbook-app.tsx`

**Interfaces:**
- List: 展示 title、更新时间、置顶标记；「+ 新建」→ `POST` 后选中
- Editor: 标题 input + Markdown textarea + 「编辑|预览」切换；预览用 `react-markdown` + `remark-gfm`
- Autosave: 标题/正文变更后 **400–600ms 防抖** `PATCH /apps/handbook/notes/:id`（参考闪签 drawer）
- 顶部搜索：受控 `query`；变更后重新 `GET notes?q=&categoryId=`（`all` 不传 categoryId；`uncategorized` 传 `uncategorized`）
- 删除：确认后 `DELETE`，清空选中

- [ ] **Step 1: note-list.tsx**

列出 `notes`；点击设置 `selectedNoteId`。

- [ ] **Step 2: note-editor.tsx**

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// mode: 'edit' | 'preview'
// onChangeTitle / onChangeBody → 父组件防抖 save
```

空选中时显示「选择或新建一篇笔记」。

- [ ] **Step 3: handbook-app 串联**

新建默认：`{ title: '无标题', bodyMd: '', categoryId: selection 为具体 id 时用该 id，否则 null }`。

可选：首次空库时展示示例按钮，一键创建：

```md
# 示例：发布前检查

1. 确认变更单
2. 备份
3. 执行发布脚本
4. 冒烟验证
```

用户可删。

- [ ] **Step 4: 手验**

编辑自动保存、搜索命中、预览代码块、删除。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/handbook
git commit -m "feat(web): handbook note list, editor, search, autosave"
```

---

### Task 9: Apps list card + CSS + Admin page

**Files:**
- Modify: `apps/web/src/app/workbench/apps/page.tsx`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/admin/apps/handbook/page.tsx`
- Modify: admin 导航（若有应用链接列表，增加手册；搜索 `admin/apps/stickies` 引用处一并加上 handbook）

- [ ] **Step 1: apps list**

对 `slug === 'handbook'` 使用专用 class（如 `apps-list-page__card--handbook`）与一行 meta：`分类 · Markdown · 搜索`。

- [ ] **Step 2: globals.css**

增加三栏布局（左约 200px、中约 260px、右弹性）、树缩进、编辑区 textarea 等高、小屏可改为上下堆叠（简单 `max-width` 媒体查询即可）。

- [ ] **Step 3: Admin handbook page**

复制 `admin/apps/stickies/page.tsx` 精简版：标题「应用 · 手册」；说明个人工作流程笔记；开关 `enabled` + `visibility`（若闪签页有 ACL UI 则同样接 `/admin/apps/handbook` 的 entries——无则只做 enabled/visibility，与闪签当前能力对齐）。

- [ ] **Step 4: 找到 admin 侧栏/链接**

Grep `apps/stickies`，为 handbook 增加对等链接。

- [ ] **Step 5: Lint web + 手验**

Run: `pnpm --filter @work-ally/web lint`  
手验：应用列表两张卡、管理端可关手册、关闭后工作台不可用。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/workbench/apps/page.tsx \
  apps/web/src/app/globals.css \
  apps/web/src/app/admin/apps/handbook
# 以及改动的 admin nav 文件
git commit -m "feat(web): handbook app card, styles, and admin page"
```

---

### Task 10: Spec 状态 + 冒烟清单

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md`（状态改为已实现或「实现中」按事实）

- [ ] **Step 1: 端到端冒烟**

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 工作台 → 应用 → 手册 | 进入三栏 |
| 2 | 建分类「运维」→ 子类「发布」 | 树正确 |
| 3 | 在「发布」下新建笔记写 Markdown | 自动保存 |
| 4 | 搜索关键词 | 列表过滤 |
| 5 | 删分类（无子） | 笔记进未分类 |
| 6 | 管理端关闭手册 | 列表不可用 / API 403 |
| 7 | 与闪签互不影响 | 两边数据独立 |

- [ ] **Step 2: Commit docs if status changed**

```bash
git add docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md
git commit -m "docs: mark handbook design as implemented"
```

---

## Spec coverage check

| Spec 项 | Task |
|---------|------|
| App slug/路由/名称 | 1, 3, 6, 9 |
| 分类 ≤2 层 + 删分类笔记归未分类 | 4, 7 |
| 笔记 Markdown CRUD + 置顶 | 5, 8 |
| 全局搜索 | 5, 8 |
| 三栏 IA | 6–8 |
| AppRegistry + ACL Guard | 3 |
| Admin 开关 | 3, 9 |
| 与闪签/组织知识库不重叠 | 全程无日历/RAG |
| AI 引用预留（不做） | 无 Task — 正确 |
| body 超限拒绝 | 1 + 5（Zod） |
| 示例笔记 | 8 可选 |

## Placeholder / consistency notes

- `categoryId=uncategorized` 为列表查询约定字符串，非 DB id
- `HANDBOOK_SLUG` 与闪签一样在 shared 导出
- Admin list 必须返回多应用，避免手册 seed 后管理端仍只见闪签
