# Task 8 Review: Admin model binding + smoke docs

**Commit:** `c106213` · **Branch:** `feat/handbook`

## Critical

None.

## Important

None.

## Minor

### M1 — `Promise.all` blocks admin page if `/admin/models` fails

**File:** `apps/web/src/app/admin/apps/notes/page.tsx` (~L43–52)

Pre–Task 8 loaded only `/admin/apps/notes`; now a models fetch failure clears `app` and leaves the page on “加载应用配置…”. Prefer independent loads or degrade to empty model list.

### M2 — Bound disabled model not shown in `<select>`

Only `enabled` models appear in options; a stored `defaultModelConfigId` for a disabled model has no matching `<option>` (UI may look like fallback while DB retains the id).

### M3 — PATCH errors silent

`save()` has no `catch`; failed model PATCH leaves prior selection with no user feedback (same pattern as stickies admin).

## Verification

| Check | Result |
|-------|--------|
| Model `<select>` from `/admin/models`; enabled only | ✓ |
| PATCH `{ defaultModelConfigId: id \| null }` on change | ✓ |
| Fallback option + help + link when no models | ✓ |
| API `updateNotes` accepts `defaultModelConfigId` | ✓ |
| Spec status **已实现** (code-complete; plan Task 8) | ✓ |
| Smoke #4–5 **PENDING** + Live follow-up section | ✓ honest |
| Smoke #1–3, #6–7 static PASS evidence | ✓ |
| `cd apps/web && npx tsc --noEmit` | ✓ exit 0 |

## Verdict

**APPROVE** — Task 8 deliverables met; smoke honestly defers live AI (#4–5); spec **已实现** acceptable as code-complete with documented live gap.
