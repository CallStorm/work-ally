# Task 3 Report: Registry + API rename handbook → notes

## Status

DONE

## Summary

Renamed the handbook app surface to notes across registry, admin, auth seed, and API routes. `ensureNotes` migrates legacy `handbook` slug rows to `notes` and refreshes name/description. Controller now serves `apps/notes`; Prisma still uses `handbookCategory` / `handbookNote` tables.

## Changes

### `app-registry.service.ts`

- `HANDBOOK_DEFAULT` → `NOTES_DEFAULT` (name 笔记, AI description)
- `ensureHandbook` → `ensureNotes` with legacy `handbook` → `notes` migration
- `getHandbookForUser` / `getHandbookAdmin` / `updateHandbook` → `getNotesForUser` / `getNotesAdmin` / `updateNotes`
- `listForUser` / `listForAdmin` call `ensureNotes`

### Module move

- `handbook/` → `notes/` (`NotesController` at `@Controller('apps/notes')`)
- `handbook-app.guard.ts` → `notes-app.guard.ts` (`NotesAppGuard`, message: 无权使用笔记应用)
- Services kept as `HandbookCategoriesService` / `HandbookNotesService` (Prisma delegates unchanged)

### Other

- `admin-apps.controller.ts`: `NOTES_SLUG`, `ensureNotes`, `updateNotes`
- `auth.service.ts`: register seed uses `NOTES_SLUG` + 笔记 metadata
- `apps.module.ts`: wires `NotesController`, `NotesAppGuard`

## Verification

```bash
cd apps/api && npm run lint   # tsc --noEmit, exit 0
```

No API integration tests run (none existed for handbook routes).

## Commit

| SHA | Subject |
|-----|---------|
| `075153d` | refactor(api): rename handbook app surface to notes |

Branch: `feat/handbook`

## Concerns

1. **No `/apps/handbook` API alias** — per brief; web still calls old path until Task 4+.
2. **Service class names still `Handbook*`** — intentional; Prisma models/tables unchanged.
3. **Existing tenants** — first `listForUser`/`ensureNotes` call migrates `handbook` slug; no duplicate rows because unique `(tenantId, slug)`.
4. **Admin GET `:slug`** accepts `notes` only; old admin URLs with `handbook` slug will 404 unless migrated first via ensureNotes on list.

## Out of scope

- Web frontend rename (`components/handbook`, routes)
- Shared Zod schema renames (`CreateHandbookCategorySchema`, etc.)
- Notes AI service/controller (later tasks)

## Fix-up

When `notes` registry already exists, `ensureNotes` now deletes any orphan `handbook` row for the same tenant (and related `acl_entries` with `resourceType: app`) via `deleteOrphanHandbookRegistry`, before updating metadata or returning.

| SHA | Subject |
|-----|---------|
| `a54b881` | fix(api): drop orphan handbook registry when notes exists |

Verified: `cd apps/api && npm run lint` exit 0.
