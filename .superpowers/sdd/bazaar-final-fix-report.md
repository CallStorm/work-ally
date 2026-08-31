# Bazaar Final Fix Report — Review findings on feat/bazaar

**Branch:** `feat/bazaar`  
**Date:** 2026-08-31  
**Status:** DONE

## Summary

Fixed three Important findings from the final bazaar branch review: concurrent rating score staleness, concurrent shelf-8 over-publish, and unvalidated polish model JSON.

## Fixes

| Finding | Change |
|---------|--------|
| Rating score race | `rate()` wraps product `FOR UPDATE`, rating upsert, and `recomputeFromDb` in one Prisma `$transaction`. `recomputeFromDb` accepts a transaction client so aggregate+update use the same connection. |
| Shelf ≤8 race | `publish()` locks `bazaar_companies` with `FOR UPDATE`, re-reads the product, counts published, then updates inside `$transaction`. Stall UI disables **all**「上架」buttons while any publish/unpublish is in flight (`busyId !== null`); 「下架」still only disables the busy card. |
| Polish output Zod | After JSON parse, `PolishBazaarProductSchema.safeParse`; failure throws `BadRequestException('润色结果无法解析')`. |

## Files

| File | Action |
|------|--------|
| `apps/api/src/modules/apps/bazaar/bazaar-ratings.service.ts` | Modify — transactional upsert + recompute |
| `apps/api/src/modules/apps/bazaar/bazaar-products.service.ts` | Modify — transactional publish; Zod polish parse; tx-aware recompute |
| `apps/web/src/components/bazaar/my-stall.tsx` | Modify — disable all 上架 while busy |

## Verification

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

**Result (2026-08-31, after the three code fixes):**

| Command | Exit code | Output |
|---------|-----------|--------|
| `pnpm --filter api exec tsc --noEmit` | 0 | empty (no errors) |
| `pnpm --filter web exec tsc --noEmit` | 0 | empty (no errors) |

No Jest in this repo. Race safety is structural (row locks + interactive transaction); not live-concurrency tested.

## Self-review

- [x] Rating upsert and score recompute share one transaction and a product row lock
- [x] Publish counts under a company row lock inside `$transaction`
- [x] All 上架 buttons disabled while any stall toggle is in flight
- [x] Polish JSON validated with `PolishBazaarProductSchema`; invalid → `润色结果无法解析`
- [x] Both `tsc --noEmit` commands exit 0
