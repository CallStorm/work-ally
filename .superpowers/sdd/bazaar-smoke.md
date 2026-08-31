# Bazaar Task 11 Smoke — 创司集市 MVP

**Branch:** `feat/bazaar`  
**HEAD:** `657377a` — `fix(bazaar): return myStars on product detail for raters`  
**Date:** 2026-08-31  
**Method:** static code review at HEAD (API + web + Prisma). **Live browser + DB 手验未跑** — 凡依赖登录会话、两租户、真实模型的步骤标 **PENDING (live)**。

判定约定：

- **PASS (static)** — 代码路径与期望一致，且不依赖运行时外部系统。
- **PENDING (live)** — 接线已在，但必须浏览器/DB/模型才能闭环。
- **FAIL** — 静态即与期望冲突。本表无 FAIL。

| # | 场景 | 期望 | 状态 | 证据 |
|---|---|---|---|---|
| 1 | 管理端启用创司集市并绑模型 | 工作台出现应用 | **PASS (static)** · **PENDING (live)** | Admin `apps/web/src/app/admin/apps/bazaar/page.tsx`：`enabled` 上架 + `defaultModelConfigId` 润色模型。`AppRegistryService.listForUser` 过滤 `enabled: true` + ACL。工作台 `workbench/apps/page.tsx` `isBazaar` 卡链到 `/workbench/apps/bazaar`。守卫 `getBazaarForUser`：未启用 → null → `BazaarAppGuard` 403「无权使用创司集市应用」。绑模型不决定列表可见性，只供润色。**未点过管理端开关。** |
| 2 | 开公司 | 一人一司；重复 POST 更新 | **PASS (static)** · **PENDING (live)** | DB `UNIQUE (tenant_id, user_id)`。`BazaarCompanyService.upsert` Prisma `upsert` on `tenantId_userId`；`POST`/`PATCH /apps/bazaar/company` 都走 upsert。Onboarding `POST /apps/bazaar/company`；无公司时 `bazaar-app.tsx` 进 `onboarding`。**未实际提交表单。** |
| 3 | 上架 8 件后再上架 | 失败提示 | **PASS (static)** · **PENDING (live)** | `PUBLISHED_SHELF_LIMIT = 8`；`publish()` 对非已上架计数，满则 `BadRequestException('货架最多 8 件，请先下架')`。`MyStall` 展示 `货架 n / 8`，`togglePublish` catch 把 API message 打到 `role="alert"`。已上架再点上架会跳过计数（不把自己挤掉）。**未造满 8 件。** |
| 4 | 同事打星 / 改星 | 分=`20+Σ`；榜更新 | **PASS (static)** · **PENDING (live)** | `scoreFromStars`：`score = BAZAAR_BASE_SCORE(20) + Σ stars`。`BazaarRatingsService.rate` upsert `productId_userId`（改星替换、不叠两笔）后 `recomputeFromDb`。详情非作者 1–5 ★ `PUT .../rating`，响应写回 `product.score`；`myStars` 由 GET 水合（`657377a`）。榜 `GET /leaderboard`：`status=published`，`score desc, ratingCount desc, updatedAt desc`，行含 `userName · companyName · title · score`。**未用第二账号打星。** |
| 5 | 自评 | 403 | **PASS (static)** · **PENDING (live)** | `rate()`：`product.userId === user.userId` → `ForbiddenException('不能给自己的产品打星')`。详情 `isAuthor` 隐藏星控件，只显示「产品统计」+ `当前 {score}分 = 基础20 + 他人星级合计`。**未用作者账号打 PUT。** |
| 6 | 下架 | 大厅与榜消失；评分仍在；再上架基础分不翻倍 | **PASS (static)** · **PENDING (live)** | `unpublish` 只设 `status=draft`，不删 `bazaar_ratings`、不改 `score`。`market`/`leaderboard`/`stall` 均 `status: 'published'`。再 `publish` → `recomputeFromDb`（恒 `20+Σ`），`publishedAt` 保留首次，不二次加 20。**未走下架→再上架。** |
| 7 | AI 润色 | 返回建议；确认后才写入 | **PENDING (live)** | 静态：`polish()` 调绑定模型 `completeChatMessages`，`parsePolishResult` 后 **return，无 Prisma write**。无 `defaultModelConfigId` → 400「请管理员为创司集市绑定默认模型」。编辑器 `POST .../polish` → `setPreview`；「采用」才 `PATCH`。**未接真实模型跑一轮。** |
| 8 | 跨租户 | 不可见 | **PASS (static)** · **PENDING (live)** | 所有 bazaar 查询带 `tenantId`（company unique、product findFirst、market/stall/leaderboard where、rating findFirst）。跨租户同 id 会 404「产品不存在」。Guard 按本租户 registry。**未准备租户 B。** |

## Static verification

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

**Result:** both exit 0 (2026-08-31, HEAD `657377a`).

无 Jest（计划 Global Constraints）。未起 web/api、未连 DB、未开浏览器。

## Live follow-up（全部 PENDING）

- [ ] #1 管理端上架 + 绑模型 → 工作台出现「创司集市」卡；关掉上架后列表消失、进应用 403
- [ ] #2 开公司；同一用户再 POST 更新而非第二家
- [ ] #3 第 9 件上架失败，alert「货架最多 8 件，请先下架」
- [ ] #4 同事 1→5 星；分=`20+Σ`；榜行姓名·公司·产品·分刷新
- [ ] #5 作者 PUT rating → 403；UI 无星控件
- [ ] #6 下架后大厅/榜无此卡；`bazaar_ratings` 仍在；再上架 score 仍 `20+Σ` 而非 40+
- [ ] #7 润色返回建议且库未变；点「采用」后 PATCH 写入
- [ ] #8 租户 B 看不见租户 A 的公司/产品/榜

## Spec status

未改为「已实现」。见 `docs/superpowers/specs/2026-08-31-bazaar-company-expo-design.md`：**实现完成，手验部分 PENDING**。

## Concerns

- `ensureBazaar` 默认 `enabled: true`，新租户可能未经管理端勾选就出现在工作台。
- 绑模型与列表可见解耦：只启用、不绑模型时应用仍出现；润色才会 400。
- 货架满时 UI 不禁用「上架」，靠 API 400 + alert。
- 作者路径靠隐藏控件；403 只在直打 API 时出现。
