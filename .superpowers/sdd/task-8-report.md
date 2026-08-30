# Task 8 Report — Admin model binding + smoke docs

**Status:** ✅ Complete (static); live AI smoke **PENDING**  
**Branch:** `feat/handbook`  
**Commit:** `c106213` — `docs: mark notes rename+AI implemented after smoke`

## Summary

Task 8: notes admin page binds `defaultModelConfigId` via model dropdown; spec marked implemented; 7-row smoke checklist with static PASS/PENDING.

## Changes

| File | Action |
|------|--------|
| `apps/web/src/app/admin/apps/notes/page.tsx` | Model `<select>` from `/admin/models`; PATCH on change; help text |
| `docs/superpowers/specs/2026-08-29-notes-rename-ai-design.md` | Status → **已实现** |
| `.superpowers/sdd/task-8-smoke.md` | Created — 7-row checklist |

### Admin model binding

- Loads `ModelRow[]` from `/admin/models` (same shape as models page)
- Empty option: 使用租户已启用的默认模型（fallback）
- Enabled models only in options; PATCH `{ defaultModelConfigId: id \| null }`
- Help: AI 改稿使用此模型；未选择时回退；均无则报错；link to `/admin/models` when no models

## Smoke

See `.superpowers/sdd/task-8-smoke.md`. Static: #1–3, #6–7 PASS; #4–5 PENDING (live model + browser).

## Verification

```bash
cd apps/web && npx tsc --noEmit
```

**Result:** pass (exit 0)
