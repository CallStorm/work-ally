# Task 2 Report: Prisma — NotesAiThread / NotesAiMessage

## Status

DONE

## Summary

Added `NotesAiThread` and `NotesAiMessage` models to the Prisma schema, linked to `Tenant` and `HandbookNote` (physical table `handbook_notes`). Migration applied to local MySQL; Prisma Client regenerated with new delegates.

## Changes

### `apps/api/prisma/schema.prisma`

- **Tenant:** `notesAiThreads NotesAiThread[]`
- **HandbookNote:** `aiThreads NotesAiThread[]`
- **NotesAiThread:** `tenantId`, `userId`, `noteId`; unique on `[tenantId, userId, noteId]`; index on `[tenantId, userId]`; cascades to tenant and note
- **NotesAiMessage:** `threadId`, `role` (string), `content` (Text), optional `draftMd` (LongText); index on `[threadId, createdAt]`; cascade on thread delete

### `apps/api/prisma/migrations/20260829230000_notes_ai/migration.sql`

Creates `notes_ai_threads` and `notes_ai_messages` with FKs: tenant CASCADE, note CASCADE (→ `handbook_notes`), thread CASCADE.

## Verification

```bash
npx prisma validate          # exit 0
npx prisma migrate deploy    # applied 20260829230000_notes_ai
npx prisma migrate status    # Database schema is up to date!
npx prisma generate          # exit 0 — NotesAiThread / NotesAiMessage in client
```

**Note:** Initial `prisma generate` failed with `EPERM` on `query_engine-windows.dll.node` while Nest dev server held the file lock. Resolved by stopping work-ally Node processes and re-running generate.

## Commit

| SHA | Subject |
|-----|---------|
| `c26f4b3` | feat(api): add notes AI thread and message tables |

Branch: `feat/handbook`

## Self-review

**Correctness**

- Schema matches task brief verbatim.
- `noteId` references `HandbookNote.id` / `handbook_notes` as specified.
- Unique constraint enforces one thread per tenant+user+note.

**Scope**

- Only schema + migration touched; no API routes or services yet.

**Concerns**

1. **`role` is plain `String`**, not `MessageRole` enum — matches brief; callers must validate `user|assistant|system`.
2. **No FK on `userId`** — intentional per brief (membership not enforced at DB level).
3. **Generated client is gitignored** — CI/dev must run `prisma generate` after pull.

## Out of scope (later tasks)

- Notes AI service/controller wiring
- Using `MessageRole` enum for message role column
