# Local development

## Prerequisites

- Node.js >= 20
- pnpm 9+
- Docker (for MySQL / Redis / MinIO)

## Quick start

```bash
# 1) Install
pnpm install

# 2) Start infra
pnpm docker:up

# 3) Configure API env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4) Generate Prisma client & migrate (requires MySQL up)
pnpm db:generate
pnpm db:migrate

# 5) Run apps
pnpm dev
```

- Web: http://localhost:3000  
- API health: http://localhost:3001/api/health  
- MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)

## Runtime 最小可跑通

1. `apps/api/.env` 中默认 `RUNTIME_PROVIDER=mock`（无模型 Key 也可跑通多步事件）
2. 配置 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` 并把 `RUNTIME_PROVIDER` 改为 `mastra`（或删掉该项自动检测）即可走真模型
3. 冒烟：

```bash
pnpm --filter @work-ally/api start &
pnpm smoke:runtime
```

关键路径：
- `POST /api/auth/register`
- `POST /api/sessions`（`wait:true` 同步等 Run 完成）
- `GET /api/runs/:id`
- `GET /api/runs/:id/events`（SSE）
- `GET /api/sessions/:id`

## Workspace layout

See [requirements baseline](./requirements-baseline.md) §11.
