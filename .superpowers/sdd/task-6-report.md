# Task 6 Report — Web rename handbook → notes + redirect

**Status:** ✅ Complete  
**Branch:** `feat/handbook`  
**Commit:** `4d0d3de` — `refactor(web): rename handbook UI to notes with redirect`

## Summary

Renamed the web handbook UI surface to notes per plan Task 6. Component shell moved from `components/handbook/` to `components/notes/` with `NotesApp` export; API fetch paths updated to `/apps/notes/...`; user-facing copy changed 手册 → 笔记.

## Changes

| Area | Action |
|------|--------|
| `components/notes/*` | New home for app shell + tree/list/editor (CSS classes kept `handbook-*` / `hb-*`) |
| `workbench/apps/notes/page.tsx` | Renders `NotesApp` |
| `workbench/apps/handbook/page.tsx` | Server `redirect('/workbench/apps/notes')` |
| `admin/apps/notes/page.tsx` | Admin config; API `/admin/apps/notes`; copy 笔记 + AI mention |
| `admin/apps/handbook/page.tsx` | Server `redirect('/admin/apps/notes')` |
| `admin/layout.tsx` | Nav link → 应用 · 笔记 |
| `workbench/apps/page.tsx` | Card slug `notes`; meta includes AI |

## Verification

```bash
cd apps/web && npx tsc --noEmit
```

**Result:** pass (exit 0)

## Out of scope (Task 7)

- AI panel UI (`notes-ai-panel.tsx`) not implemented

## Concerns

- CSS class prefixes still use `handbook-*` / `apps-list-page__card--handbook` intentionally to limit blast radius; cosmetic rename can follow later.
- Apps list card styling keyed on slug `notes`; tenants still on legacy `handbook` slug until API registry migration (Task 3) runs.

## Files touched

- Added: `apps/web/src/components/notes/*`, `apps/web/src/app/workbench/apps/notes/page.tsx`, `apps/web/src/app/admin/apps/notes/page.tsx`
- Modified: handbook redirect pages, admin layout, apps list
- Removed: `apps/web/src/components/handbook/*`
