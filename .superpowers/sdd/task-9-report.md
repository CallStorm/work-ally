# Task 9 Report: Apps list card + CSS + Admin page

## Status

DONE

## Summary

Handbook apps-list card (class + meta `分类 · Markdown · 搜索`), `.handbook-*` three-column styles, admin page `/admin/apps/handbook` (enabled + visibility, no ACL UI — same as stickies), and admin nav link.

## Changes

| File | Action |
|------|--------|
| `apps/web/src/app/workbench/apps/page.tsx` | Modified — `apps-list-page__card--handbook`, book cover, meta |
| `apps/web/src/app/globals.css` | Modified — handbook card + `.handbook-*` layout |
| `apps/web/src/app/admin/apps/handbook/page.tsx` | Created — enabled/visibility, title 应用 · 手册 |
| `apps/web/src/app/admin/layout.tsx` | Modified — nav `应用 · 手册` |

### Apps list

- `slug === 'handbook'` → `apps-list-page__card--handbook`
- Meta: `分类 · Markdown · 搜索`
- Cover: `apps-list-page__book` (parallel to stickies calendar)

### CSS

- Columns: `200px 260px minmax(0, 1fr)`
- Tree child indent `padding-left: 16px`
- Editor textarea `flex: 1; min-height: 0; resize: none`
- `@media (max-width: 900px)` stacks columns

### Admin

- Copy of stickies page without AI note
- `GET`/`PATCH` `/admin/apps/handbook`
- No ACL entries UI (stickies also has none)

## Verification

```bash
pnpm --filter @work-ally/web lint
```

**Result:** exit 1. `next lint` is deprecated and prompts to create ESLint config (none in repo). Interactive prompt aborted. Pre-existing, not caused by this task.

```bash
pnpm --filter @work-ally/web exec tsc --noEmit
```

**Result:** exit 0.

### Browser (registered admin `13908291509`)

| Step | Result |
|------|--------|
| `/workbench/apps` | Two cards: 闪签 + 手册; handbook meta `分类 · Markdown · 搜索` |
| `/workbench/apps/handbook` | Grid `200px 260px 1200px`; tree / list / editor |
| `/admin/apps/handbook` | Title 应用 · 手册; nav has 闪签 + 手册; enabled + visibility |
| Uncheck 上架 | Apps list shows only 闪签 |
| Direct `/workbench/apps/handbook` | Error `无权使用手册应用` |
| Re-enable via PATCH | `enabled: true` restored |

## Commits

| SHA | Subject |
|-----|---------|
| `45bacc5` | feat(web): handbook app card, styles, and admin page |

Branch: `feat/handbook`

## Self-review

**Correctness**

- Card class and meta match the plan verbatim.
- Admin aligned with stickies: enabled + visibility only.
- Grep `admin/apps/stickies` in web: layout nav (updated) + stickies page API (left as stickies).

**Scope**

- No API/schema/component logic changes.

**Concerns**

- `pnpm --filter @work-ally/web lint` cannot run without an ESLint config (repo-wide). Typecheck used instead.
- Mobile stack CSS is in place; viewport was not resized in the browser (desktop 3-col verified via computed style).
- Disabled handbook still serves the Next page shell; unavailability is the API guard 403 shown as `无权使用手册应用` (same pattern as a failed load, not a route-level block).
