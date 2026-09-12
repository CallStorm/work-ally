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

# 5) Run apps (keep a **single** `pnpm dev` — do not also run `pnpm dev:api`)
pnpm dev
```

- Web: http://localhost:3002  
- API health: http://localhost:3001/api/health  
- MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)

> **Dev tip:** Nest `--watch` briefly drops port 3001 on rebuild. The web `/api` proxy retries through that gap. If you still see「无法连接 API」, you likely have two API processes fighting over 3001 — stop extras and keep one `pnpm dev`.

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
- `GET /api/runs/:id/events`（SSE；支持 Bearer 或 `?access_token=`）
- `GET /api/sessions/:id`

## 前端对话流

1. 启动 API + Web：`pnpm --filter @work-ally/api start` 与 `pnpm --filter @work-ally/web start`（或 `pnpm dev`）
2. 打开 http://localhost:3002/login 注册
3. 工作台输入消息发送 → 进入 `/workbench/sessions/:id` 看流式输出与右侧事件
4. 可继续追问（会触发新的 AgentRun + SSE）

## 图工作室

Admin 在「应用 · 图工作室」配置并启用图像模型后，用户从工作台打开图工作室即可（项目库 / 文生图 / 图生图）。冒烟：`pnpm smoke:image-studio`（未配置模型或未设 `IMAGE_STUDIO_SMOKE_GENERATE=1` 时跳过 generate）。

## Workspace layout

See [requirements baseline](./requirements-baseline.md) §11.
