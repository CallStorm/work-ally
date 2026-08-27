# Models Provider Implementation Plan

> **For agentic workers:** Use executing-plans or implement task-by-task. Steps use checkbox syntax.

**Goal:** Tenant-level LLM providers (MiniMax / Anthropic presets) with encrypted keys, sync model list, remove auto.

**Architecture:** New `LlmProvider` table; `ModelConfig` FK to provider; Admin CRUD + sync; Runtime resolves credentials from provider; Session uses `modelConfigId`.

**Tech Stack:** NestJS, Prisma, existing `encryptSecret`, Next.js admin page, Pi/Mastra runners.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-22-models-provider-design.md`
- Never return plaintext API keys
- Anthropic Messages compatible only (一期)
- Remove `auto` from seed, UI, schema defaults for sessions

---

## File map

| File | Role |
|---|---|
| `apps/api/prisma/schema.prisma` | LlmProvider + ModelConfig.providerId + Session.modelConfigId |
| `apps/api/src/modules/models/*` | Provider + models service/controller |
| `apps/api/src/modules/runtime/*` | Resolve provider credentials |
| `apps/api/src/modules/sessions/*` | Require/validate modelConfigId |
| `apps/api/src/modules/auth/auth.service.ts` | Stop seeding auto |
| `packages/shared` | CreateSessionSchema |
| `apps/web/.../admin/models/page.tsx` | Provider UX |
| `apps/web/.../workbench-composer.tsx` | No auto; use modelConfigId |

---

### Task 1: Schema + migration

- [ ] Add `LlmProvider`, alter `ModelConfig`, optional `Session.modelConfigId`
- [ ] Migrate; bootstrap helper: env → MiniMax provider + attach non-auto models; delete auto rows

### Task 2: Models API

- [ ] Implement ModelsService: providers CRUD, sync-models, batch add models, list for workbench
- [ ] Wire controller routes under `/admin/llm-providers` and update `/admin/models`, `/models`

### Task 3: Sessions + shared + auth

- [ ] Session create accepts `modelConfigId`; validate enabled
- [ ] Remove auto seed; update CreateSessionSchema

### Task 4: Runtime

- [ ] Capability/runtime load ModelConfig+Provider; decrypt key; pass to Pi/Mastra
- [ ] Env fallback only if no provider

### Task 5: Web UI

- [ ] Admin models page: providers + sync + enable list
- [ ] Workbench: select by modelConfigId; no auto

### Task 6: Verify

- [ ] `pnpm --filter @work-ally/api lint` + shared build
- [ ] Smoke: create provider, sync, chat with selected model
