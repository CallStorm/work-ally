# Task 7 Report — Notes AI side panel with apply/restore

**Status:** ✅ Complete  
**Branch:** `feat/handbook`  
**Commit:** `aaea263` — `feat(web): notes AI side panel with apply and restore`

## Summary

Implemented the notes AI side panel per plan Task 7: multi-turn chat UI beside the editor, quick actions (优化排版 / 完善内容), custom prompts, message history from GET `/apps/notes/notes/:id/ai/messages`, apply/restore with client-side `previousBodyMd`.

## Changes

| File | Action |
|------|--------|
| `apps/web/src/components/notes/notes-ai-panel.tsx` | Created — AI drawer UI, fetch/send, apply/restore controls |
| `apps/web/src/components/notes/note-editor.tsx` | Modified — toolbar「AI」button; `onOpenAi` / `aiOpen` props |
| `apps/web/src/components/notes/notes-app.tsx` | Modified — `aiOpen`, `previousBodyMd`, 4th column layout, apply/restore handlers |
| `apps/web/src/app/globals.css` | Modified — `.notes-ai*` styles; `handbook-app__cols--ai-open` grid |

### Panel behavior

- Loads message history when `open` and `noteId` change
- Quick actions POST with `action` `format` / `enrich` and fixed Chinese prompts
- Custom input POST with `action` `custom`
- Assistant messages show content + collapsible `draftMd` preview
-「应用到笔记」enabled only when latest assistant has `draftMd`; hint when missing
-「还原」enabled when `canRestore` (parent holds one-level `previousBodyMd`)
- Loading/disabled while GET/POST in flight; errors in alert region

### Apply / restore (notes-app)

- Apply: `setPreviousBodyMd(selectedNote.bodyMd)` then `handleChangeBody(draftMd)` (autosave)
- Restore: `handleChangeBody(previousBodyMd)` then clear snapshot
- Switch note: `setPreviousBodyMd(null)`; panel reloads thread
- Close panel: does not clear `previousBodyMd`

## Verification

```bash
cd apps/web && npx tsc --noEmit
```

**Result:** pass (exit 0)

Browser smoke (Task 8): format/enrich → apply → restore; note switch isolation; no-model error — not run in this task (requires live API + model).

## Concerns

- AI panel uses live POST; end-to-end happy path depends on Task 4–5 API and tenant model config (Task 8 smoke).
- On narrow viewports panel stacks below editor; desktop uses 340px 4th column.
- `previousBodyMd` is session-only (refresh loses restore snapshot), per spec.

## Fix-up (review `NEEDS_FIX`)

**Commit:** `6ff3ccb` — `fix(web): sync editor and isolate notes AI threads`

| Issue | Fix |
|-------|-----|
| C1 TipTap not syncing on apply/restore | `note-editor.tsx`: `setContent(incoming, { emitUpdate: false })` when external `bodyMd` differs from `lastEmittedMdRef` / current editor markdown |
| C2 POST race on note switch | `notes-ai-panel.tsx`: capture `sendNoteId`; ignore response if `noteIdRef` changed; `key={noteId}` on panel |
| I1 stale messages on switch | Clear `messages` on `noteId` change and at `loadHistory` start |
| I2 apply snapshot stale | `bodyMdRef` in `notes-app.tsx` updated in `handleChangeBody`; apply snapshots `bodyMdRef.current` |

```bash
cd apps/web && npx tsc --noEmit
```

**Result:** pass (exit 0)
