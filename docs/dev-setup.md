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

## Workspace layout

See [requirements baseline](./requirements-baseline.md) §11.
