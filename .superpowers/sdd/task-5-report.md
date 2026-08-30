# Task 5 Report: Notes AI service + routes

## Status: Complete (fix-up applied)

## Commit

- `5c4d309` — `feat(api): notes AI thread messages for format and enrich`
- `30d1c1f` — `fix(api): nest notes AI routes under notes/:id`

## Files changed

| File | Action |
|------|--------|
| `apps/api/src/modules/apps/notes/notes-ai.service.ts` | Created |
| `apps/api/src/modules/apps/notes/notes.controller.ts` | Modified — AI routes + NotesAiService injection |
| `apps/api/src/modules/apps/apps.module.ts` | Modified — register NotesAiService provider |

## Implementation summary

### NotesAiService

- **`listMessages(user, noteId)`** — verifies note ownership; returns `{ messages: [] }` if no thread, else serialized user/assistant messages ordered by `createdAt`.
- **`postMessage(user, noteId, input)`** — verifies ownership; upserts thread; persists user message; loads last 8 user/assistant messages; calls `ModelsService.completeChatMessages` with `defaultModelConfigId` from `getNotesForUser`; parses `draftMd`; persists assistant message; returns `{ messages, assistant: { content, draftMd } }`.
- **`truncateBody(bodyMd)`** — slices at 12000 chars + `\n\n…(已截断)`.
- **`parseDraftMd(text)`** — last ` ```md ` fence, else last any fence, else `null`.
- **`buildSystem(action)`** — verbatim Chinese prompts for `format` / `enrich`; generic md-fence prompt for `custom`.
- **`ensureThread(user, noteId)`** — upsert on `(tenantId, userId, noteId)`.

User message format: `标题` + `正文` (truncated) + `要求` (prompt).

Model config resolved via `AppRegistryService.getNotesForUser(user).defaultModelConfigId`; fallback handled inside `completeChatMessages`.

### Routes

Controller prefix `@Controller('apps/notes')`:

| Method | Path | Handler |
|--------|------|---------|
| GET | `notes/:id/ai/messages` | `listAiMessages` |
| POST | `notes/:id/ai/messages` | `postAiMessage` (body validated with `CreateNotesAiMessageSchema`) |

Full API paths: `/api/apps/notes/notes/:id/ai/messages`.

No streaming/cancel endpoints (YAGNI per plan).

## Verification

```bash
cd apps/api && npm run lint   # tsc --noEmit — PASS
```

Manual smoke (not run in this task):

- POST with `action: "format"` when tenant has model → 200 + `assistant.draftMd`
- POST when no model configured → 400「请先在管理端为笔记配置模型或添加可用模型」

## Concerns / notes

1. **Controller whitespace:** `notes.controller.ts` diff includes line-ending/format normalization from prior edits; no behavioral change to existing CRUD routes.
2. **No rate limiting:** Unlike `StickiesAiService`, notes AI has no per-user rate cap; acceptable for MVP per plan.
3. **History window:** After persisting the new user message, the last 8 DB rows (including it) are sent to the model — matches spec.

## Fix-up (post-review)

**Issue:** AI routes were registered as `:id/ai/messages` → `/apps/notes/:id/ai/messages`, inconsistent with plan/spec and note CRUD prefix.

**Fix:** Changed to `@Get('notes/:id/ai/messages')` / `@Post('notes/:id/ai/messages')`; moved above `@Get('notes/:id')` for route specificity. Service logic unchanged — self-review found no Critical/Important service bugs.

**Commit:** `fix(api): nest notes AI routes under notes/:id`

**Re-verify:** `cd apps/api && npm run lint` — PASS

## Next tasks

- Task 6: Web rename handbook → notes
- Task 7: AI panel UI + apply/restore (consumes these endpoints)
