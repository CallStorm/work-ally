# Task 1 Report: Shared — NOTES_SLUG + AI schemas

## Status

DONE

## Summary

Added `NOTES_SLUG = 'notes'`, deprecated `HANDBOOK_SLUG` as an alias to `NOTES_SLUG`, and exported Zod schemas/types for notes AI message input. Existing `CreateHandbookCategorySchema` and related handbook-named schemas left unchanged per brief (rename deferred to Task 3).

## Changes

### `packages/shared/src/index.ts`

**Slug exports:**

```ts
export const NOTES_SLUG = 'notes';
/** @deprecated use NOTES_SLUG */
export const HANDBOOK_SLUG = NOTES_SLUG;
```

Previously `HANDBOOK_SLUG = 'handbook'`. Both constants now resolve to `'notes'` so legacy imports keep working while the canonical slug changes.

**AI schemas:**

| Export | Kind | Details |
|--------|------|---------|
| `NotesAiActionSchema` | Zod enum | `'format' \| 'enrich' \| 'custom'` |
| `NotesAiAction` | type | inferred |
| `CreateNotesAiMessageSchema` | Zod object | `prompt` (1–4000), `action` (default `'custom'`), `bodyMd` (max 50000), `title` (max 191, default `''`) |
| `CreateNotesAiMessageInput` | type | inferred |

## Verification

```bash
pnpm --filter @work-ally/shared exec tsc --noEmit
```

**Result:** exit code 0 — no type errors.

## Commit

| SHA | Subject |
|-----|---------|
| `6e84bc0` | feat(shared): add NOTES_SLUG and notes AI message schemas |

Branch: `feat/handbook`

## Self-review

**Correctness**

- Exports match task brief verbatim.
- `HANDBOOK_SLUG` deprecated alias preserves backward-compatible import path while value changes from `'handbook'` to `'notes'`.
- Zod defaults and limits align with plan (`docs/superpowers/plans/2026-08-29-notes-rename-ai.md`).

**Scope**

- Only `packages/shared/src/index.ts` modified.
- Handbook category/note Zod schemas not renamed (Task 3).

**Concerns**

1. **Downstream slug mismatch:** API and web still reference `HANDBOOK_SLUG` and hardcoded `'handbook'` (e.g. `app-registry.service.ts`, `admin-apps.controller.ts`, `auth.service.ts`, `apps/page.tsx`). Those consumers will receive `'notes'` from the shared constant but DB seeds/routes may still use `'handbook'` until later tasks migrate registry and routes.
2. **No runtime tests:** Shared package has lint/tsc only; schema behavior (defaults, trim, max lengths) will be exercised when API routes adopt `CreateNotesAiMessageSchema` in a later task.

## Out of scope (later tasks)

- Rename `CreateHandbookCategorySchema` → `CreateNotesCategorySchema` (Task 3)
- API route wiring for notes AI endpoint
- App registry seed slug migration from `handbook` to `notes`
