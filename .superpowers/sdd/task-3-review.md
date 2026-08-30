# Task 3 Review: Registry + API rename handbook → notes

**Commit:** `075153d` — `refactor(api): rename handbook app surface to notes`  
**Branch:** `feat/handbook`  
**Reviewer:** SDD quality review  
**Date:** 2026-08-30

## Scope checked

- `.superpowers/sdd/task-3-brief.md`, `task-3-report.md`, plan Task 3
- `app-registry.service.ts`, `notes/`, `notes-app.guard.ts`, `admin-apps.controller.ts`, `auth.service.ts`, `apps.module.ts`
- Confirmed removed: `handbook/` dir, `handbook-app.guard.ts`, `HandbookController`, all `ensureHandbook` / `HANDBOOK_*` API symbols
- `npm run lint` (tsc) in `apps/api`: **pass**

---

## Critical

None.

---

## Important

### 1. `ensureNotes` does not dedupe when both `notes` and legacy `handbook` rows exist

**File:** `apps/api/src/modules/apps/app-registry.service.ts` (`ensureNotes`, ~L103–138)

If Task 1 aliased `HANDBOOK_SLUG` to `'notes'` before Task 3 shipped, `ensureHandbook` could create a new `notes` row while an older `handbook` row still exists. `ensureNotes` returns early when `asNotes` is found and never removes or merges the orphan `handbook` row. `listForUser` / `listForAdmin` then return **two** app entries for the same product; ACL/model config on the stale row is ignored by `NotesAppGuard` (which uses `NOTES_SLUG` only).

**Fix:** After resolving `asNotes`, look up legacy `handbook` for the tenant and delete (or disable) it when present.

---

## Minor

### 1. Admin `GET /admin/apps/handbook` bypasses migration

**File:** `apps/api/src/modules/apps/admin-apps.controller.ts` (`get`, ~L35–41)

`ensureNotes` runs only when `slug === NOTES_SLUG`. A direct GET with `handbook` returns the legacy row without migrating. `PATCH` already requires `NOTES_SLUG`, so admin update via old slug 404s until web is updated (Task 6). Acceptable interim gap; listing apps or hitting `notes` slug triggers migration.

### 2. No API integration tests for renamed routes

No new or updated tests for `apps/notes/*` or `ensureNotes` migration. Matches prior state (none existed for handbook); worth adding in a follow-up.

---

## Verified OK

| Expectation | Status |
|-------------|--------|
| `NOTES_DEFAULT`, `ensureNotes` with legacy `handbook` → `notes` migration | Matches brief |
| `getNotesForUser` / `getNotesAdmin` / `updateNotes` | Renamed correctly |
| `listForUser` / `listForAdmin` call `ensureNotes` | Yes |
| `handbook/` → `notes/`, `@Controller('apps/notes')` | Done |
| `NotesAppGuard`, message `无权使用笔记应用` | Done |
| `auth.service.ts` seeds `NOTES_SLUG` + 笔记 metadata | Done |
| `apps.module.ts` wires `NotesController`, `NotesAppGuard` | Done |
| Prisma delegates `handbookCategory` / `handbookNote` unchanged | Intentional |
| `HandbookCategoriesService` / `HandbookNotesService` class names | Intentional |
| No `/apps/handbook` API alias | Out of scope (explicit) |
| Web still calls `/apps/handbook` | Out of scope (Task 6) |

---

## Verdict

**NEEDS_FIX** — One Important migration gap: orphan `handbook` registry rows when `notes` already exists. Implementation otherwise matches Task 3 brief/plan; API compiles; rename leftovers in `apps/api` are clean.
