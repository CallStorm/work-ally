# Task 10 Report: Spec status + smoke checklist for handbook

## Status

DONE

## Summary

End-to-end smoke of the handbook v1 App passed (API + browser). Design spec status updated from “已批准，待写实现计划” to **已实现**.

## Changes

| File | Action |
|------|--------|
| `docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md` | Status → **已实现**（v1，2026-08-29；端到端冒烟通过） |

No product code changes.

## Smoke checklist

Tenant: new admin `13900001029` (Handbook Smoke). Web `localhost:3000`, API `localhost:3001`. Handbook re-enabled after step 6.

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | 工作台 → 应用 → 手册 | 进入三栏 | **PASS** — cards 闪签 + 手册; `/workbench/apps/handbook` grid `200px 260px 1200px` (tree / list / editor) |
| 2 | 建分类「运维」、子分类「发布」 | 树正确 | **PASS** — API: parent delete with child → 400 `请先删除或移走子分类`. UI: 全部 / 未分类 / 运维 → 发布; child menu has no 添加子分类 |
| 3 | 在「发布」下新建 Markdown 笔记 | 自动保存 | **PASS** — UI note 发布SOP + body `UI_SMOKE_MD_99`; list time 15:33 → 15:34 after debounce PATCH |
| 4 | 搜索关键词 | 列表过滤 | **PASS** — `UI_SMOKE_MD_99` / `UNIQUE_SMOKE_KW_42` hit; `ZZZNOMATCH` → 没有匹配的笔记 |
| 5 | 删分类（无子） | 笔记进未分类 | **PASS** — delete 发布; note `categoryId=null`; 未分类 lists it; 运维 empty |
| 6 | 管理端关闭手册 | 列表不可用 / API 403 | **PASS** — uncheck 上架; `/apps` only 闪签; GET categories/notes 403 `无权使用手册应用`; direct handbook page shows that error |
| 7 | 与闪签互不影响 | 两边数据独立 | **PASS** — stickies task `stickies-smoke-independent` still listed after handbook disable; handbook notes unchanged after re-enable |

## Spec coverage check

| Spec item | Coverage |
|-----------|----------|
| App slug/路由/名称 | Implemented (Tasks 1, 3, 6, 9); smoke 1, 6 |
| 分类 ≤2 层 + 删分类笔记归未分类 | Tasks 4, 7; smoke 2, 5 |
| 笔记 Markdown CRUD + 置顶 | Tasks 5, 8; smoke 3 (pin not re-exercised this run) |
| 全局搜索 | Tasks 5, 8; smoke 4 |
| 三栏 IA | Tasks 6–9; smoke 1 |
| AppRegistry + ACL Guard | Task 3; smoke 6 |
| Admin 开关 | Tasks 3, 9; smoke 6 |
| 与闪签 / 组织知识库不重叠 | No calendar/RAG in handbook; smoke 7 |
| AI 引用预留（不做） | No Task — correct |
| body 超限拒绝 | Tasks 1 + 5 (Zod); not re-hit in this smoke |
| 示例笔记 | Task 8 optional; empty-state 插入示例 present, not inserted this run |

Placeholders confirmed in this run: `categoryId=uncategorized` list filter; `HANDBOOK_SLUG` + stickies both on `/apps`; admin list returns both apps.

## Commits

| SHA | Subject |
|-----|---------|
| `44cf183` | docs: mark handbook design as implemented |

Branch: `feat/handbook`

## Self-review

**Correctness**

- Spec status matches facts: Tasks 1–9 shipped on this branch; smoke 1–7 passed against running servers.
- Step 6 restored `enabled: true` so the smoke tenant is not left disabled.

**Scope**

- Docs-only commit. Report file is untracked under `.superpowers/sdd/` (not committed).

**Concerns**

- Pin toggle and bodyMd > 50000 were not re-run in this smoke (covered by earlier tasks / Zod).
- Direct `/workbench/apps/handbook` while disabled still renders the three-column shell; unavailability is the guard 403 (`无权使用手册应用`), same as Task 9.

## Final Important fixes

Status: DONE (branch `feat/handbook`)

| Finding | Fix |
|---------|-----|
| `body_md` TEXT cannot hold 50k CJK (utf8mb4) | Prisma `HandbookNote.bodyMd` → `@db.LongText`. New migration `20260829154500_handbook_notes_body_md_longtext` runs `ALTER TABLE handbook_notes MODIFY body_md LONGTEXT NOT NULL`. Applied via `prisma migrate deploy`. |
| No recategorize UI | Editor category `<select>`: 未分类 + flat list (`parent / child` labels). Change PATCHes `categoryId` through the existing autosave path. |
| Autosave pending single slot | `pendingRef` is `Map<noteId, NotePatch>`; coalesce in-flight per note; `drainPending()` awaits a full drain before switching notes/categories. Identical failed patches are not retried in a loop. |
| Search GET on every keystroke (Minor) | Debounce search GET ~300ms (`debouncedQuery`). |

### Commits

| SHA | Subject |
|-----|---------|
| `ebe503a` | fix(api): store handbook note body as LONGTEXT |
| `2e2e374` | fix(web): recategorize notes and key autosave pending by id |

### Verify

- `pnpm --filter @work-ally/api exec tsc --noEmit` — pass (exit 0)
- `pnpm --filter @work-ally/web exec tsc --noEmit` — pass (exit 0)
- `prisma migrate deploy` — applied `20260829154500_handbook_notes_body_md_longtext`
- `prisma generate` — EPERM (API process locking the query engine DLL); schema type is still `String`, tsc unaffected
- Browser: new tenant, create 运维 + note, move via 笔记分类 select → 未分类 empty, 运维 lists the note, selector stays 运维
