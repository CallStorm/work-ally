# Task 5 Review: Notes AI service + routes

## Critical

None.

## Important

### I1 — AI route path mismatch (FIXED)

- **Was:** `@Get(':id/ai/messages')` / `@Post(':id/ai/messages')` → `/api/apps/notes/:id/ai/messages`
- **Spec/plan:** `/api/apps/notes/notes/:id/ai/messages`
- **Fix:** `@Get('notes/:id/ai/messages')` / `@Post('notes/:id/ai/messages')`; registered before `@Get('notes/:id')`
- **Commit:** `fix(api): nest notes AI routes under notes/:id`

## Minor

### M1 — `parseDraftMd` requires newline after ` ```md `

Regex `/```md\s*\n([\s\S]*?)```/` may miss fences like `` ```md\n`` vs `` ```md content`` on same line. Unlikely with current models; fallback to any-fence regex partially covers.

### M2 — `要求` included for all actions

`buildUserMessage` always appends `要求：${input.prompt}` even for `format`/`enrich` where system prompt defines behavior. Harmless if client sends action-appropriate prompt; schema requires `prompt` anyway.

### M3 — No rate limiting

Unlike `StickiesAiService`, no per-user throttle. Acceptable for MVP per plan.

### M4 — Manual smoke not executed

Format-with-model and no-model-400 paths not runtime-tested in this task.

## Service checklist (pass)

| Requirement | Status |
|-------------|--------|
| Note ownership (`tenantId` + `userId`) | ✓ |
| `truncateBody` at 12000 + `…(已截断)` | ✓ |
| `parseDraftMd` last `md` fence, else last any | ✓ |
| History last 8 user/assistant (incl. current) | ✓ |
| System prompts verbatim (format/enrich) | ✓ |
| Custom: md-fence system + prompt in user msg | ✓ |
| Return `{ messages, assistant: { content, draftMd } }` | ✓ |
| `completeChatMessages` + `defaultModelConfigId` | ✓ |
| No streaming/cancel | ✓ |

## Verdict

**PASS** after route fix. Service implementation aligns with Task 5 plan; only Important finding was the incorrect route prefix, now corrected and lint-clean.
