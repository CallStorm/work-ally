# Task 6 Review: Web rename handbook → notes + redirect

**Commit:** `4d0d3de` · **Branch:** `feat/handbook`

## Critical

None.

## Important

None.

## Minor

### M1 — Apps list card styling keyed on slug `notes` only

`workbench/apps/page.tsx` applies `apps-list-page__card--handbook` when `app.slug === 'notes'`. Tenants still on legacy registry slug `handbook` (pre–Task 3 migration) get generic card styling until API migrates. Functional link still works via `href={/workbench/apps/${app.slug}}`.

### M2 — Internal type/CSS names retain `Handbook*` / `handbook-*`

Intentional per plan (CSS blast-radius). User-facing copy and routes are 笔记/notes.

### M3 — Redirect page component names

`HandbookRedirectPage` / `AdminHandbookRedirectPage` — cosmetic only.

## Verification

| Check | Result |
|-------|--------|
| No `/apps/handbook` fetch paths (except redirects) | ✓ — all fetches use `/apps/notes/...`, `/admin/apps/notes` |
| No workbench/admin nav links to handbook routes | ✓ |
| `components/notes/*`, `NotesApp` export | ✓ — `components/handbook/` removed |
| Workbench redirect `/workbench/apps/handbook` → notes | ✓ |
| Admin redirect `/admin/apps/handbook` → notes | ✓ |
| Admin nav → 应用 · 笔记 | ✓ |
| Apps list slug `notes`, meta AI | ✓ |
| `cd apps/web && npx tsc --noEmit` | ✓ exit 0 |
| AI panel absent (Task 7) | ✓ — no `notes-ai-panel.tsx` |

## Verdict

**APPROVE**
