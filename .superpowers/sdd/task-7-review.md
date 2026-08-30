# Task 7 Review: Notes AI side panel + apply/restore

**Commit:** `aaea263` · **Fix:** `6ff3ccb` · **Branch:** `feat/handbook`

## Critical

### C1 — Apply/restore does not update TipTap editor

**Status:** ✅ Fixed in `6ff3ccb`

`NoteEditor` now syncs TipTap when `note.bodyMd` changes externally for the same note id via `editor.commands.setContent(incoming, { emitUpdate: false })`, guarded by `lastEmittedMdRef` vs incoming/current markdown.

### C2 — In-flight POST can attach wrong thread after note switch

**Status:** ✅ Fixed in `6ff3ccb`

`sendMessage` captures `sendNoteId` and ignores response if `noteIdRef.current` changed. `<NotesAiPanel key={noteId}>` remounts on note switch.

## Important

### I1 — Note switch shows previous note’s messages until GET finishes

**Status:** ✅ Fixed in `6ff3ccb`

`setMessages([])` on `noteId` change and at start of `loadHistory`; remount via `key={noteId}`.

### I2 — Apply snapshot may miss unsaved editor edits

**Status:** ✅ Fixed in `6ff3ccb`

`bodyMdRef` updated synchronously in `handleChangeBody` and on selected-note change; `handleApplyAi` snapshots `bodyMdRef.current`.

## Minor (unchanged)

### M1 — POST `bodyMd`/`title` can lag editor by one render

Still possible one-frame lag for AI context; lower impact than apply snapshot.

### M2 — No `key` on `NotesAiPanel`

**Status:** ✅ Fixed in `6ff3ccb` (`key={selectedNote.id}`)

## Verdict

**APPROVE** — Critical and Important findings resolved in `6ff3ccb`; `tsc --noEmit` passes.
