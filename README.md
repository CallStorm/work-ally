# work-ally

面向企业全员办公的云端 SaaS Agent 平台：连接器（MCP）、技能、专家、第三方知识库，提升团队日常办公效率。

## 文档

- **[需求基线总册](docs/requirements-baseline.md)** — 已冻结的产品需求、信息架构、领域对象与 API、技术选型
- **[本地开发](docs/dev-setup.md)** — 安装与启动

## 技术栈（摘要）

Next.js + NestJS + Mastra（待接入）· MySQL · Redis/BullMQ · MinIO · pnpm monorepo

## 仓库结构

```text
apps/web          Next.js 工作台 + 管理后台（壳）
apps/api          NestJS API + Prisma（模块桩）
packages/shared   共享 Zod / 常量
packages/tsconfig 共用 TS 配置
docker/           MySQL + Redis + MinIO
docs/             需求与开发文档
```

## 快速开始

```bash
pnpm install
pnpm docker:up
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## 状态

需求与技术选型已定稿；脚手架已落地；业务 API / Agent Runtime 待实现。
