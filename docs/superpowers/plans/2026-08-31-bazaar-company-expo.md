# 创司集市 (Bazaar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Work Ally 落地「创司集市」：一人一司、虚拟 AI 产品展会、星级评分、产品榜（姓名·公司·产品·分），科技展会风 UI + AI 文案润色。

**Architecture:** 新内置应用 `slug=bazaar`，API `/apps/bazaar`，Prisma 三表 `BazaarCompany` / `BazaarProduct` / `BazaarRating`。产品分公式 `score = 20 + Σ(他人 stars)`，写入产品行供榜单排序。润色走 `AppRegistry.defaultModelConfigId` + `ModelsService.completeChatMessages`（不建 Agent）。前端 `components/bazaar/*` 深色展会风，挂在 `WorkbenchShell`。

**Tech Stack:** NestJS, Prisma/MySQL, Next.js (apps/web), `@work-ally/shared` Zod, 现有 `ModelsService`

**Spec:** `docs/superpowers/specs/2026-08-31-bazaar-company-expo-design.md`

## Global Constraints

- 显示名「创司集市」；slug `bazaar`；路由 `/workbench/apps/bazaar`；API `/api/apps/bazaar`
- 一人一司：`@@unique([tenantId, userId])`；同时上架 ≤ **8**
- 计分：`产品分 = 20 + Σ(他人星级)`；禁止自评；每人每产品一条评分可改
- 榜是**产品榜**，行内带员工姓名；分不按「人」累加
- 视觉：科技展会深色霓虹；v1 无图片上传（`coverHue` 渐变）
- 无 Jest；用 `pnpm --filter @work-ally/shared exec tsc --noEmit`、`pnpm --filter api exec tsc --noEmit`、`pnpm --filter web exec tsc --noEmit` + 手验
- 分支：建议从当前主干新建 `feat/bazaar`（若已在功能分支也可就地开干，提交前保持可审）

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/index.ts` | `BAZAAR_SLUG` + Zod schemas/types |
| `apps/api/prisma/schema.prisma` | 三表 + Tenant 关系 |
| `apps/api/prisma/migrations/<ts>_bazaar/` | SQL migration |
| `apps/api/src/modules/apps/bazaar-app.guard.ts` | 应用启用守卫 |
| `apps/api/src/modules/apps/app-registry.service.ts` | `BAZAAR_DEFAULT` / `ensureBazaar` / `getBazaarForUser` |
| `apps/api/src/modules/apps/admin-apps.controller.ts` | slug=`bazaar` ensure |
| `apps/api/src/modules/apps/bazaar/bazaar-score.ts` | `recomputeProductScore` |
| `apps/api/src/modules/apps/bazaar/bazaar-company.service.ts` | 公司 CRUD |
| `apps/api/src/modules/apps/bazaar/bazaar-products.service.ts` | 产品 CRUD / 上下架 / 润色 |
| `apps/api/src/modules/apps/bazaar/bazaar-ratings.service.ts` | 打星 + 重算 |
| `apps/api/src/modules/apps/bazaar/bazaar-market.service.ts` | 集市流 / 摊位 / 榜 |
| `apps/api/src/modules/apps/bazaar/bazaar.controller.ts` | HTTP 路由 |
| `apps/api/src/modules/apps/apps.module.ts` | 注册 controller/providers |
| `apps/web/src/components/bazaar/*` | UI |
| `apps/web/src/app/workbench/apps/bazaar/page.tsx` | 入口 |
| `apps/web/src/app/admin/apps/bazaar/page.tsx` | 管理端启用/模型 |
| `apps/web/src/app/workbench/apps/page.tsx` | 应用卡封面 |
| `apps/web/src/app/globals.css` | `.bazaar-*` 展会样式 |

---

### Task 1: Shared — BAZAAR_SLUG + Zod

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `BAZAAR_SLUG`, company/product/rating schemas + input types

- [ ] **Step 1: Append exports after notes schemas**

```ts
export const BAZAAR_SLUG = 'bazaar';

export const BazaarStallSkinSchema = z.enum([
  'neon-blue',
  'violet-pulse',
  'cyan-grid',
  'magenta-flare',
]);
export type BazaarStallSkin = z.infer<typeof BazaarStallSkinSchema>;

export const UpsertBazaarCompanySchema = z.object({
  name: z.string().trim().min(1).max(64),
  slogan: z.string().trim().max(120).optional().default(''),
  stallSkin: BazaarStallSkinSchema.optional().default('neon-blue'),
});
export type UpsertBazaarCompanyInput = z.infer<typeof UpsertBazaarCompanySchema>;

export const UpsertBazaarProductSchema = z.object({
  title: z.string().trim().min(1).max(80),
  pitch: z.string().trim().min(1).max(2000),
  features: z
    .array(z.string().trim().min(1).max(40))
    .max(8)
    .optional()
    .default([]),
  coverHue: z.number().int().min(0).max(359).optional().default(210),
});
export type UpsertBazaarProductInput = z.infer<typeof UpsertBazaarProductSchema>;

export const PatchBazaarProductSchema = UpsertBazaarProductSchema.partial();
export type PatchBazaarProductInput = z.infer<typeof PatchBazaarProductSchema>;

export const RateBazaarProductSchema = z.object({
  stars: z.number().int().min(1).max(5),
});
export type RateBazaarProductInput = z.infer<typeof RateBazaarProductSchema>;

export const PolishBazaarProductSchema = z.object({
  title: z.string().trim().min(1).max(80),
  pitch: z.string().trim().min(1).max(2000),
  features: z.array(z.string().trim().min(1).max(40)).max(8).optional().default([]),
});
export type PolishBazaarProductInput = z.infer<typeof PolishBazaarProductSchema>;
```

- [ ] **Step 2: Typecheck shared**

Run: `pnpm --filter @work-ally/shared exec tsc --noEmit`  
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add BAZAAR_SLUG and bazaar Zod schemas"
```

---

### Task 2: Prisma — Company / Product / Rating

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260831010000_bazaar/migration.sql`

**Interfaces:**
- Produces: Prisma models; Tenant relations `bazaarCompanies` / `bazaarProducts` / `bazaarRatings`

- [ ] **Step 1: Add models (and Tenant relation fields)**

在 `Tenant` 模型关系区追加：

```prisma
  bazaarCompanies BazaarCompany[]
  bazaarProducts  BazaarProduct[]
  bazaarRatings   BazaarRating[]
```

文件末尾追加：

```prisma
model BazaarCompany {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  name      String   @db.VarChar(64)
  slogan    String   @default("") @db.VarChar(120)
  stallSkin String   @default("neon-blue") @map("stall_skin") @db.VarChar(32)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant   Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products BazaarProduct[]

  @@unique([tenantId, userId])
  @@index([tenantId])
  @@map("bazaar_companies")
}

model BazaarProduct {
  id           String    @id @default(cuid())
  tenantId     String    @map("tenant_id")
  companyId    String    @map("company_id")
  userId       String    @map("user_id")
  title        String    @db.VarChar(80)
  pitch        String    @db.Text
  featuresJson String    @default("[]") @map("features_json") @db.Text
  coverHue     Int       @default(210) @map("cover_hue")
  status       String    @default("draft") @db.VarChar(16)
  score        Int       @default(0)
  ratingCount  Int       @default(0) @map("rating_count")
  avgStars     Decimal   @default(0) @map("avg_stars") @db.Decimal(3, 2)
  publishedAt  DateTime? @map("published_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  tenant  Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  company BazaarCompany  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  ratings BazaarRating[]

  @@index([tenantId, status, publishedAt])
  @@index([tenantId, status, score])
  @@index([tenantId, companyId])
  @@index([tenantId, userId])
  @@map("bazaar_products")
}

model BazaarRating {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  productId String   @map("product_id")
  userId    String   @map("user_id")
  stars     Int
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant  Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product BazaarProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, userId])
  @@index([tenantId, productId])
  @@map("bazaar_ratings")
}
```

- [ ] **Step 2: Write migration.sql**

```sql
-- CreateTable
CREATE TABLE `bazaar_companies` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `slogan` VARCHAR(120) NOT NULL DEFAULT '',
    `stall_skin` VARCHAR(32) NOT NULL DEFAULT 'neon-blue',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bazaar_companies_tenant_id_user_id_key`(`tenant_id`, `user_id`),
    INDEX `bazaar_companies_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bazaar_products` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `company_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `pitch` TEXT NOT NULL,
    `features_json` TEXT NOT NULL,
    `cover_hue` INTEGER NOT NULL DEFAULT 210,
    `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
    `score` INTEGER NOT NULL DEFAULT 0,
    `rating_count` INTEGER NOT NULL DEFAULT 0,
    `avg_stars` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bazaar_products_tenant_id_status_published_at_idx`(`tenant_id`, `status`, `published_at`),
    INDEX `bazaar_products_tenant_id_status_score_idx`(`tenant_id`, `status`, `score`),
    INDEX `bazaar_products_tenant_id_company_id_idx`(`tenant_id`, `company_id`),
    INDEX `bazaar_products_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bazaar_ratings` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `stars` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bazaar_ratings_product_id_user_id_key`(`product_id`, `user_id`),
    INDEX `bazaar_ratings_tenant_id_product_id_idx`(`tenant_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bazaar_companies` ADD CONSTRAINT `bazaar_companies_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_products` ADD CONSTRAINT `bazaar_products_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_products` ADD CONSTRAINT `bazaar_products_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `bazaar_companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_ratings` ADD CONSTRAINT `bazaar_ratings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `bazaar_ratings` ADD CONSTRAINT `bazaar_ratings_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `bazaar_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Generate client + migrate**

Run: `pnpm --filter api exec prisma generate`  
Run: `pnpm --filter api exec prisma migrate deploy`（或项目惯用的 `migrate dev`）  
Expected: client 含 `bazaarCompany` / `bazaarProduct` / `bazaarRating`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260831010000_bazaar
git commit -m "feat(api): add bazaar company/product/rating tables"
```

---

### Task 3: Registry + Guard + module wiring stub

**Files:**
- Modify: `apps/api/src/modules/apps/app-registry.service.ts`
- Create: `apps/api/src/modules/apps/bazaar-app.guard.ts`
- Modify: `apps/api/src/modules/apps/admin-apps.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`
- Create: `apps/api/src/modules/apps/bazaar/bazaar.controller.ts`（空壳 GET health 可选，或等 Task 4 再加真实路由——本任务至少注册 Guard + ensure）

**Interfaces:**
- Produces: `ensureBazaar(tenantId, ownerUserId)`, `getBazaarForUser(user)`, `BAZAAR_DEFAULT`
- Consumes: `BAZAAR_SLUG` from shared

- [ ] **Step 1: Mirror notes pattern in AppRegistryService**

```ts
import { BAZAAR_SLUG, NOTES_SLUG, STICKIES_SLUG } from '@work-ally/shared';

export const BAZAAR_DEFAULT = {
  slug: BAZAAR_SLUG,
  name: '创司集市',
  description: '一人一司的虚拟 AI 产品展会：摆摊、逛展、打星冲榜',
};
```

实现 `ensureBazaar`（upsert by `tenantId_slug`）、`getBazaarForUser`（enabled + ACL，复制 `getNotesForUser` 逻辑把 slug 换成 bazaar）。在 `listForUser` / `listForAdmin` 确保会 `ensureBazaar`（与 notes/stickies 同一处调用链）。

- [ ] **Step 2: Guard**

```ts
// bazaar-app.guard.ts — 同 NotesAppGuard，文案「无权使用创司集市应用」，调用 getBazaarForUser
```

- [ ] **Step 3: Admin controller**

在 `get` / `patch` 对 `slug === BAZAAR_SLUG` 时 `await this.registry.ensureBazaar(...)`。

- [ ] **Step 4: Register Guard in AppsModule providers**（controller 可在 Task 4 再挂）

- [ ] **Step 5: tsc api**

Run: `pnpm --filter api exec tsc --noEmit`  
Expected: pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/apps/app-registry.service.ts apps/api/src/modules/apps/bazaar-app.guard.ts apps/api/src/modules/apps/admin-apps.controller.ts apps/api/src/modules/apps/apps.module.ts
git commit -m "feat(api): register bazaar app in AppRegistry and guard"
```

---

### Task 4: Company + Products CRUD + publish/unpublish

**Files:**
- Create: `apps/api/src/modules/apps/bazaar/bazaar-score.ts`
- Create: `apps/api/src/modules/apps/bazaar/bazaar-company.service.ts`
- Create: `apps/api/src/modules/apps/bazaar/bazaar-products.service.ts`
- Create: `apps/api/src/modules/apps/bazaar/bazaar.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`

**Interfaces:**
- Produces:
  - `BazaarCompanyService.getMine / upsert`
  - `BazaarProductsService.listMine / create / update / remove / publish / unpublish / getOwned`
  - `serializeProduct` 含 `features: string[]`（解析 `featuresJson`）
  - `BASE_SCORE = 20`；`PUBLISHED_SHELF_LIMIT = 8`
- Consumes: Zod schemas；`AuthUser`

- [ ] **Step 1: Score helper**

```ts
// bazaar-score.ts
export const BAZAAR_BASE_SCORE = 20;

export function scoreFromStars(starValues: number[]): {
  score: number;
  ratingCount: number;
  avgStars: number;
} {
  const ratingCount = starValues.length;
  const sum = starValues.reduce((a, b) => a + b, 0);
  return {
    score: BAZAAR_BASE_SCORE + sum,
    ratingCount,
    avgStars: ratingCount === 0 ? 0 : Math.round((sum / ratingCount) * 100) / 100,
  };
}
```

- [ ] **Step 2: Company service**

- `getMine(user)` → row or null  
- `upsert(user, input)` → create or update；冲突唯一键则 update  
- serialize: `{ id, name, slogan, stallSkin, userId, createdAt, updatedAt }`

- [ ] **Step 3: Products service**

关键规则：
- `create`：必须已有公司，否则 `ConflictException('请先开设公司')`；默认 `status=draft`，`score=BAZAAR_BASE_SCORE`，`featuresJson=JSON.stringify(features)`
- `publish`：title/pitch 非空；统计同公司 `status=published` 数量，`>=8` 则 `BadRequestException('货架最多 8 件，请先下架')`；设 `publishedAt ??= now`；**不要**因再次上架给 `score` 加第二次基础分——调用 `recomputeFromDb(productId)`（无评分时 score 仍为 20）
- `unpublish`：`status=draft`，大厅/榜不可见；保留 ratings
- `remove`：作者可删（级联 ratings）

`recomputeFromDb`：读该产品全部 ratings.stars，写回 score/ratingCount/avgStars。

- [ ] **Step 4: Controller routes**

```ts
@Controller('apps/bazaar')
@UseGuards(JwtAuthGuard, BazaarAppGuard)
export class BazaarController {
  // GET/POST /company  → getMine / upsert (POST body UpsertBazaarCompanySchema)
  // PATCH /company     → upsert
  // GET /products      → listMine
  // POST /products     → create
  // GET /products/:id  → get (作者任意状态；他人仅 published，可放 Task 5)
  // PATCH /products/:id
  // DELETE /products/:id
  // POST /products/:id/publish
  // POST /products/:id/unpublish
}
```

- [ ] **Step 5: Wire module + tsc**

Run: `pnpm --filter api exec tsc --noEmit`  
Expected: pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/apps/bazaar apps/api/src/modules/apps/apps.module.ts
git commit -m "feat(api): bazaar company and product CRUD with shelf limit"
```

---

### Task 5: Ratings + Market + Stall + Leaderboard

**Files:**
- Create: `apps/api/src/modules/apps/bazaar/bazaar-ratings.service.ts`
- Create: `apps/api/src/modules/apps/bazaar/bazaar-market.service.ts`
- Modify: `apps/api/src/modules/apps/bazaar/bazaar.controller.ts`
- Modify: `apps/api/src/modules/apps/apps.module.ts`

**Interfaces:**
- Produces: `rate(user, productId, stars)`, `market(sort)`, `stall(userId)`, `leaderboard()`
- Leaderboard row: `{ productId, score, avgStars, ratingCount, title, companyName, userId, userName }`
- `userName`：`prisma.user.findMany` by ids（User 表有 `name`）

- [ ] **Step 1: Ratings service**

```ts
async rate(user: AuthUser, productId: string, stars: number) {
  const product = await findPublishedInTenant(...);
  if (!product) throw new NotFoundException('产品不存在');
  if (product.userId === user.userId) {
    throw new ForbiddenException('不能给自己的产品打星');
  }
  await prisma.bazaarRating.upsert({
    where: { productId_userId: { productId, userId: user.userId } },
    create: { tenantId: user.tenantId, productId, userId: user.userId, stars },
    update: { stars },
  });
  return products.recomputeFromDb(productId);
}
```

- [ ] **Step 2: Market service**

- `market(tenantId, sort: 'newest' | 'hottest')`：`status=published`  
  - newest: `orderBy publishedAt desc`  
  - hottest: `orderBy [{ score: 'desc' }, { ratingCount: 'desc' }, { updatedAt: 'desc' }]`  
  附带 company.name + user.name
- `stall(tenantId, userId)`：company + published products（无公司 404）
- `leaderboard(tenantId, take=50)`：同 hottest 排序；每行含 `userName`

- [ ] **Step 3: Controller**

```ts
// GET /market?sort=newest|hottest
// GET /stalls/:userId
// GET /company/:userId  → 只读公司（可并入 stalls）
// PUT /products/:id/rating  body RateBazaarProductSchema
// GET /leaderboard
// GET /products/:id     → published 对全租户；草稿仅作者
```

- [ ] **Step 4: tsc + Commit**

```bash
git add apps/api/src/modules/apps/bazaar
git commit -m "feat(api): bazaar ratings, market feed, and product leaderboard"
```

---

### Task 6: AI polish endpoint

**Files:**
- Modify: `apps/api/src/modules/apps/bazaar/bazaar-products.service.ts`
- Modify: `apps/api/src/modules/apps/bazaar/bazaar.controller.ts`

**Interfaces:**
- Produces: `polish(user, productId | body)` → `{ title, pitch, features }` **不写库**
- Consumes: `AppRegistryService.getBazaarForUser` → `defaultModelConfigId`；`ModelsService.completeChatMessages`

- [ ] **Step 1: Implement polish**

Prompt 约束：输出严格 JSON：`{"title":"...","pitch":"...","features":["..."]}`。解析失败抛 `BadRequestException('润色结果无法解析')`。  
无 `defaultModelConfigId`：`BadRequestException('请管理员为创司集市绑定默认模型')`。

可用 `POST /products/:id/polish`（读当前产品字段）或 body 覆盖（`PolishBazaarProductSchema`）——计划选定：**POST `/products/:id/polish` 可选 body 覆盖字段，默认用库中草稿**。

- [ ] **Step 2: tsc + Commit**

```bash
git add apps/api/src/modules/apps/bazaar
git commit -m "feat(api): bazaar product copy polish via bound model"
```

---

### Task 7: Admin page + apps list card

**Files:**
- Create: `apps/web/src/app/admin/apps/bazaar/page.tsx`（复制 `admin/apps/notes/page.tsx`，路径改为 `/admin/apps/bazaar`，文案创司集市）
- Modify: `apps/web/src/app/admin/layout.tsx`（若有应用导航链接列表，加上 bazaar）
- Modify: `apps/web/src/app/workbench/apps/page.tsx` — `isBazaar` 封面

**Interfaces:**
- Admin 可 toggle `enabled` + `defaultModelConfigId`

- [ ] **Step 1: Admin page** — 与 notes 同结构，slug `bazaar`

- [ ] **Step 2: Apps grid card**

```tsx
const isBazaar = app.slug === 'bazaar';
// cardClass += isBazaar ? 'apps-list-page__card--bazaar' : ''
// cover: 深色渐变块
// meta: 「摊位 · 打星 · 产品榜」
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/apps/bazaar apps/web/src/app/workbench/apps/page.tsx apps/web/src/app/admin/layout.tsx
git commit -m "feat(web): admin and apps-list entry for bazaar"
```

---

### Task 8: Frontend shell — types, router, market + onboarding

**Files:**
- Create: `apps/web/src/components/bazaar/types.ts`
- Create: `apps/web/src/components/bazaar/bazaar-app.tsx`
- Create: `apps/web/src/components/bazaar/market-hall.tsx`
- Create: `apps/web/src/components/bazaar/onboarding-company.tsx`
- Create: `apps/web/src/app/workbench/apps/bazaar/page.tsx`
- Modify: `apps/web/src/app/globals.css`（先加基础 `.bazaar` 变量与布局壳）

**Interfaces:**
- View state: `'market' | 'stall-mine' | 'stall-user' | 'product' | 'leaderboard' | 'onboarding'`
- `GET /apps/bazaar/company` 404/null → onboarding

- [ ] **Step 1: types.ts** — 对齐 API serialize 字段

- [ ] **Step 2: page.tsx**

```tsx
'use client';
import { BazaarApp } from '@/components/bazaar/bazaar-app';
export default function BazaarPage() {
  return <BazaarApp />;
}
```

- [ ] **Step 3: BazaarApp** — 加载 company；无则 Onboarding；有则默认 MarketHall（最新/最热切换调 `/apps/bazaar/market?sort=`）

- [ ] **Step 4: Onboarding** — 表单 name/slogan/stallSkin → `POST /apps/bazaar/company`

- [ ] **Step 5: tsc web + Commit**

```bash
git add apps/web/src/components/bazaar apps/web/src/app/workbench/apps/bazaar apps/web/src/app/globals.css
git commit -m "feat(web): bazaar shell, onboarding, and market hall"
```

---

### Task 9: Stall + product editor + polish apply

**Files:**
- Create: `apps/web/src/components/bazaar/my-stall.tsx`
- Create: `apps/web/src/components/bazaar/product-editor.tsx`
- Create: `apps/web/src/components/bazaar/user-stall.tsx`
- Modify: `apps/web/src/components/bazaar/bazaar-app.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Editor: title/pitch/features chips；按钮「AI 润色」→ 预览建议 →「采用」再 PATCH
- 上架/下架调用 publish/unpublish；货架满时展示 API 错误文案

- [ ] **Step 1: My stall** — 公司条 + 货架 `n/8` + 列表操作

- [ ] **Step 2: Product editor** — 新建/编辑模态或内页

- [ ] **Step 3: User stall** — `GET /apps/bazaar/stalls/:userId` 只读

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/bazaar apps/web/src/app/globals.css
git commit -m "feat(web): bazaar stall shelf and product editor with polish"
```

---

### Task 10: Product detail rating + leaderboard + expo CSS polish

**Files:**
- Create: `apps/web/src/components/bazaar/product-detail.tsx`
- Create: `apps/web/src/components/bazaar/leaderboard.tsx`
- Modify: `apps/web/src/components/bazaar/bazaar-app.tsx`
- Modify: `apps/web/src/app/globals.css` — 完整科技展会皮肤（深底、霓虹边、星标金色）
- Modify: `apps/web/src/app/workbench/apps/page.tsx` CSS class 若需 globals

**Interfaces:**
- Detail: 非作者显示 1–5 星；`PUT .../rating`；作者隐藏控件看统计
- Leaderboard: `GET /apps/bazaar/leaderboard`；行点击进详情

- [ ] **Step 1: Product detail + star control**

- [ ] **Step 2: Leaderboard list**

- [ ] **Step 3: Visual polish** — 对照 brainstorm「科技展会」四屏；封面用 `hsl(coverHue 80% 45%)` 渐变

- [ ] **Step 4: tsc web**

Run: `pnpm --filter web exec tsc --noEmit`  
Expected: pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/bazaar apps/web/src/app/globals.css
git commit -m "feat(web): bazaar product rating, leaderboard, and expo theme"
```

---

### Task 11: Smoke checklist + spec status

**Files:**
- Create: `.superpowers/sdd/bazaar-smoke.md`（或 `docs/superpowers/specs/` 旁注）
- Modify: `docs/superpowers/specs/2026-08-31-bazaar-company-expo-design.md` 状态改为已实现（手验后）

- [ ] **Step 1: 手验清单（全部勾上再改 spec 状态）**

| # | 场景 | 期望 |
|---|---|---|
| 1 | 管理端启用创司集市并绑模型 | 工作台出现应用 |
| 2 | 开公司 | 一人一司；重复 POST 更新 |
| 3 | 上架 8 件后再上架 | 失败提示 |
| 4 | 同事打星 / 改星 | 分=`20+Σ`；榜更新 |
| 5 | 自评 | 403 |
| 6 | 下架 | 大厅与榜消失；评分仍在；再上架基础分不翻倍 |
| 7 | AI 润色 | 返回建议；确认后才写入 |
| 8 | 跨租户 | 不可见 |

- [ ] **Step 2: Commit smoke doc（手验结果）**

```bash
git add .superpowers/sdd/bazaar-smoke.md docs/superpowers/specs/2026-08-31-bazaar-company-expo-design.md
git commit -m "docs: bazaar smoke checklist after MVP"
```

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| 一人一司 / 开公司 | 2, 4, 8 |
| 填卡片 + AI 润色 | 1, 4, 6, 9 |
| 星级 / 禁自评 / 公式 | 5, 10 |
| 产品榜含姓名 | 5, 10 |
| 货架 ≤8 | 4, 9 |
| 科技展会 UI | 8–10 |
| Registry / admin 模型 | 3, 7 |
| 租户隔离 | 4–5（所有查询带 tenantId） |
| 不做项（评论/上传/赛季） | 未列入任务 |

**Placeholder scan:** 无 TBD；polish/hottest 已钉死。  
**Type consistency:** `features` API 用 `string[]`，DB `featuresJson`；`stallSkin` 枚举四值与 shared 一致。
