# 闪签日历任务重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将闪签从便签墙重构为以日/周/月日历为中心的任务应用；新建 Task 域，整包退役 Sticky 实现与数据。

**Architecture:** 对外 slug/路由/API 前缀仍为 `stickies`；对内 Prisma `Task` + `TaskNotification`、Nest `tasks/*` 服务；前端用 `selectedDate` + `view` + 区间查询驱动日历壳，侧栏编辑，拖拽改期。旧 `StickyNote` 表与 AI 端点删除，不做迁移。

**Tech Stack:** NestJS 11, Prisma/MySQL, Next.js 15 (App Router), `@work-ally/shared` Zod, 现有 JWT + `StickiesAppGuard` + `@nestjs/schedule`

**Spec:** `docs/superpowers/specs/2026-08-28-stickies-calendar-tasks-design.md`

## Global Constraints

- 对外名称「闪签」；slug `stickies`；工作台路由 `/workbench/apps/stickies`
- API 前缀 `/apps/stickies`；任务资源路径 `/apps/stickies/tasks`
- 任务必须有 `dueAt`；创建缺省则为「今天」全天（`allDay=true`）
- 字段 v1：title、completed、dueAt、priority、时间(allDay)、reminderAt、notes
- 不做：AI、标签、子任务、重复、未安排、智能列表、旧数据迁移
- 全天：`dueAt` = 用户本地该日 00:00 的 UTC ISO；展示只取本地日历日
- 「隐藏已完成」→ `includeCompleted=false` 服务端过滤
- 本仓库尚无 Jest/Vitest；每任务用 `pnpm --filter @work-ally/api lint` / `pnpm --filter @work-ally/web lint` + 手验代替自动化单测

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/shared/src/index.ts` | 删除 Sticky/AI Zod；新增 Task Zod + `TaskPriority` |
| `apps/api/prisma/schema.prisma` | 删 Sticky*；加 `Task` / `TaskNotification` / `TaskPriority` |
| `apps/api/prisma/migrations/<ts>_stickies_calendar_tasks/migration.sql` | DROP 旧表 + CREATE 新表 |
| `apps/api/src/modules/apps/tasks/tasks.service.ts` | 区间列表、CRUD、序列化 |
| `apps/api/src/modules/apps/tasks/tasks.controller.ts` | HTTP 路由（挂在 stickies 前缀下） |
| `apps/api/src/modules/apps/tasks/task-notifications.service.ts` | 通知 CRUD |
| `apps/api/src/modules/apps/tasks/task-reminder.scheduler.ts` | 每分钟扫 due reminders |
| `apps/api/src/modules/apps/apps.module.ts` | 注册 tasks，移除 stickies 旧 providers |
| `apps/api/src/modules/apps/app-registry.service.ts` | 描述改为日历任务 |
| `apps/api/src/modules/apps/stickies/*` | **删除**（含 AI） |
| `apps/web/src/components/stickies/types.ts` | Task 前端类型 |
| `apps/web/src/components/stickies/date-utils.ts` | 本地日界、区间、全天 dueAt |
| `apps/web/src/components/stickies/stickies-app.tsx` | 日历壳（状态中心） |
| `apps/web/src/components/stickies/month-view.tsx` | 月视图 + 拖放改日 |
| `apps/web/src/components/stickies/week-view.tsx` | 周视图 + 拖放改时 |
| `apps/web/src/components/stickies/day-view.tsx` | 日视图 + 拖放改时 |
| `apps/web/src/components/stickies/task-chip.tsx` | 任务行/芯片 |
| `apps/web/src/components/stickies/task-detail-drawer.tsx` | 侧栏编辑 |
| `apps/web/src/components/stickies/quick-add.tsx` | 快速创建条 |
| `apps/web/src/components/stickies/sticky-card.tsx` | **删除** |
| `apps/web/src/app/globals.css` | 替换 `.stickies-*` 便签样式为日历样式 |
| `apps/web/src/app/admin/apps/stickies/page.tsx` | 文案去 AI/便签；可隐藏模型/AI 配置块 |

---

### Task 1: Shared Zod — Task schemas，移除 Sticky/AI

**Files:**
- Modify: `packages/shared/src/index.ts`
- Keep: `STICKIES_SLUG`, `UpdateAppRegistrySchema`

**Interfaces:**
- Produces: `TaskPrioritySchema`, `CreateTaskSchema`, `UpdateTaskSchema`, types `CreateTaskInput`, `UpdateTaskInput`
- Removes: all `Sticky*` and `StickiesAi*` exports

- [ ] **Step 1: Replace stickies schema block**

在 `packages/shared/src/index.ts` 中删除自 `STICKY_COLORS` 起至 `StickiesAiDigestInput` 的全部导出，改为：

```ts
export const STICKIES_SLUG = 'stickies';

export const TaskPrioritySchema = z.enum(['high', 'medium', 'low']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(50000).optional().default(''),
  priority: TaskPrioritySchema.optional().default('medium'),
  dueAt: z.string().datetime().optional(),
  allDay: z.boolean().optional().default(true),
  reminderAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(50000).optional(),
  completed: z.boolean().optional(),
  priority: TaskPrioritySchema.optional(),
  dueAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
```

保留 `UpdateAppRegistrySchema` 及之后内容不变。`STICKIES_SLUG` 若已存在则勿重复声明。

- [ ] **Step 2: Build shared package**

Run: `pnpm --filter @work-ally/shared build`  
（若无 build script：确认 `package.json` exports 指向 `src`，则跳过。）

Expected: 无类型错误；其它包暂时可能因仍引用 Sticky 类型而失败——在后续 Task 修复。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "refactor(shared): replace sticky schemas with task schemas"
```

---

### Task 2: Prisma — DROP Sticky，CREATE Task

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260828200000_stickies_calendar_tasks/migration.sql`
- Modify: `Tenant` model relations（去掉 sticky*，加上 tasks）

**Interfaces:**
- Produces: Prisma models `Task`, `TaskNotification`, enum `TaskPriority`
- Removes: `StickyNote`, `StickyNotification`, `StickyNoteType`

- [ ] **Step 1: Update schema.prisma**

删除 `enum StickyNoteType` 与 `model StickyNote` / `model StickyNotification`。在 `Tenant` 上替换关系字段。新增：

```prisma
enum TaskPriority {
  high
  medium
  low
}

model Task {
  id              String       @id @default(cuid())
  tenantId        String       @map("tenant_id")
  userId          String       @map("user_id")
  title           String
  notes           String       @default("") @db.Text
  completed       Boolean      @default(false)
  completedAt     DateTime?    @map("completed_at")
  priority        TaskPriority @default(medium)
  dueAt           DateTime     @map("due_at")
  allDay          Boolean      @default(true) @map("all_day")
  reminderAt      DateTime?    @map("reminder_at")
  reminderFiredAt DateTime?    @map("reminder_fired_at")
  sortOrder       Int          @default(0) @map("sort_order")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, dueAt])
  @@index([tenantId, userId, reminderAt])
  @@map("tasks")
}

model TaskNotification {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  taskId    String   @map("task_id")
  message   String   @db.VarChar(512)
  firedAt   DateTime @default(now()) @map("fired_at")
  read      Boolean  @default(false)

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, userId, read, firedAt])
  @@map("task_notifications")
}
```

- [ ] **Step 2: Write migration SQL**

`apps/api/prisma/migrations/20260828200000_stickies_calendar_tasks/migration.sql`:

```sql
-- Drop sticky tables / enum (MySQL)
DROP TABLE IF EXISTS `sticky_notifications`;
DROP TABLE IF EXISTS `sticky_notes`;
DROP TABLE IF EXISTS `StickyNotification`;
-- if enum exists:
-- DROP any leftover; Prisma MySQL often inlines enums

CREATE TABLE `tasks` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `notes` TEXT NOT NULL,
  `completed` BOOLEAN NOT NULL DEFAULT false,
  `completed_at` DATETIME(3) NULL,
  `priority` ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  `due_at` DATETIME(3) NOT NULL,
  `all_day` BOOLEAN NOT NULL DEFAULT true,
  `reminder_at` DATETIME(3) NULL,
  `reminder_fired_at` DATETIME(3) NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `tasks_tenant_id_user_id_due_at_idx` (`tenant_id`, `user_id`, `due_at`),
  INDEX `tasks_tenant_id_user_id_reminder_at_idx` (`tenant_id`, `user_id`, `reminder_at`),
  CONSTRAINT `tasks_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `task_notifications` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `task_id` VARCHAR(191) NOT NULL,
  `message` VARCHAR(512) NOT NULL,
  `fired_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`id`),
  INDEX `task_notifications_tenant_id_user_id_read_fired_at_idx` (`tenant_id`, `user_id`, `read`, `fired_at`),
  CONSTRAINT `task_notifications_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

若本地已有 `20260828120000_sparknotes_stickies` 未应用：可合并为一次 migrate；若已应用则本迁移负责 DROP。生成后以 `prisma migrate` 实际方言为准微调。

- [ ] **Step 3: Generate + migrate**

Run:

```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate
```

Expected: migrate 成功；`prisma` client 含 `task` / `taskNotification`。

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260828200000_stickies_calendar_tasks
git commit -m "feat(api): replace sticky tables with tasks"
```

---

### Task 3: TasksService + Controller（区间 CRUD）

**Files:**
- Create: `apps/api/src/modules/apps/tasks/tasks.service.ts`
- Create: `apps/api/src/modules/apps/tasks/tasks.controller.ts`
- Delete after wiring (Task 5): old `stickies/stickies.service.ts` / `stickies.controller.ts`

**Interfaces:**
- Consumes: `CreateTaskInput`, `UpdateTaskInput`, `AuthUser`, `PrismaService`
- Produces:
  - `TasksService.list(user, { from, to, includeCompleted })`
  - `create` / `get` / `update` / `remove`
  - Controller under `@Controller('apps/stickies')` with routes `tasks`, `tasks/:id`

- [ ] **Step 1: Implement `tasks.service.ts`**

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Task, TaskPriority } from '@prisma/client';
import type { CreateTaskInput, UpdateTaskInput } from '@work-ally/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';

function startOfLocalToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    user: AuthUser,
    filters: { from: string; to: string; includeCompleted?: boolean },
  ) {
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to must be ISO datetimes');
    }
    if (from >= to) {
      throw new BadRequestException('from must be before to');
    }

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      userId: user.userId,
      dueAt: { gte: from, lt: to },
    };
    if (filters.includeCompleted === false) {
      where.completed = false;
    }

    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [
        { dueAt: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return rows.map((t) => this.serialize(t));
  }

  async get(user: AuthUser, id: string) {
    return this.serialize(await this.findOwned(user, id));
  }

  async create(user: AuthUser, input: CreateTaskInput) {
    const dueAt = input.dueAt ? new Date(input.dueAt) : startOfLocalToday();
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('invalid dueAt');
    }
    const allDay = input.allDay ?? true;
    const reminderAt =
      input.reminderAt === undefined || input.reminderAt === null
        ? null
        : new Date(input.reminderAt);

    const task = await this.prisma.task.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        title: input.title.trim(),
        notes: input.notes ?? '',
        priority: (input.priority ?? 'medium') as TaskPriority,
        dueAt,
        allDay,
        reminderAt,
        reminderFiredAt: null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return this.serialize(task);
  }

  async update(user: AuthUser, id: string, input: UpdateTaskInput) {
    const existing = await this.findOwned(user, id);

    const dueAt =
      input.dueAt !== undefined ? new Date(input.dueAt) : existing.dueAt;
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('invalid dueAt');
    }

    let reminderAt = existing.reminderAt;
    let reminderFiredAt = existing.reminderFiredAt;
    if (input.reminderAt !== undefined) {
      reminderAt =
        input.reminderAt === null ? null : new Date(input.reminderAt);
      reminderFiredAt = null;
    }

    let completed = existing.completed;
    let completedAt = existing.completedAt;
    if (input.completed !== undefined) {
      completed = input.completed;
      completedAt = completed ? new Date() : null;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: input.title?.trim() ?? existing.title,
        notes: input.notes ?? existing.notes,
        priority: (input.priority as TaskPriority | undefined) ?? existing.priority,
        dueAt,
        allDay: input.allDay ?? existing.allDay,
        reminderAt,
        reminderFiredAt,
        completed,
        completedAt,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
    });
    return this.serialize(task);
  }

  async remove(user: AuthUser, id: string) {
    await this.findOwned(user, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  private async findOwned(user: AuthUser, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.userId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private serialize(t: Task) {
    return {
      id: t.id,
      title: t.title,
      notes: t.notes,
      completed: t.completed,
      completedAt: t.completedAt?.toISOString() ?? null,
      priority: t.priority,
      dueAt: t.dueAt.toISOString(),
      allDay: t.allDay,
      reminderAt: t.reminderAt?.toISOString() ?? null,
      reminderFiredAt: t.reminderFiredAt?.toISOString() ?? null,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Implement `tasks.controller.ts`**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateTaskSchema, UpdateTaskSchema } from '@work-ally/shared';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { parseBody } from '../../../common/zod';
import { StickiesAppGuard } from '../stickies-app.guard';
import { TasksService } from './tasks.service';
import { TaskNotificationsService } from './task-notifications.service';

@Controller('apps/stickies')
@UseGuards(JwtAuthGuard, StickiesAppGuard)
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly notifications: TaskNotificationsService,
  ) {}

  @Get('tasks')
  listTasks(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includeCompleted') includeCompleted?: string,
  ) {
    if (!from || !to) {
      throw new (require('@nestjs/common').BadRequestException)(
        'from and to are required',
      );
    }
    return this.tasks.list(user, {
      from,
      to,
      includeCompleted: includeCompleted !== 'false',
    });
  }

  @Post('tasks')
  createTask(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.tasks.create(user, parseBody(CreateTaskSchema, body));
  }

  @Get('tasks/:id')
  getTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.get(user, id);
  }

  @Patch('tasks/:id')
  updateTask(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.tasks.update(user, id, parseBody(UpdateTaskSchema, body));
  }

  @Delete('tasks/:id')
  deleteTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(user, id);
  }

  @Get('notifications')
  listNotifications(
    @CurrentUser() user: AuthUser,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(user, unread === 'true');
  }

  @Patch('notifications/:id/read')
  readNotification(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('notifications/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}
```

（Step 2 里 `BadRequestException` 改为正常 import，勿用 `require`。）

- [ ] **Step 3: Commit service+controller stubs**（通知服务在 Task 4 补齐；若编译缺类，先写 Task 4 空壳再 commit）

```bash
git add apps/api/src/modules/apps/tasks
git commit -m "feat(api): add stickies tasks CRUD by date range"
```

---

### Task 4: Task 通知 + 提醒调度

**Files:**
- Create: `apps/api/src/modules/apps/tasks/task-notifications.service.ts`
- Create: `apps/api/src/modules/apps/tasks/task-reminder.scheduler.ts`
- Reference: 旧 `stickies-notifications.service.ts` / `stickies-reminder.scheduler.ts` 逻辑迁移后删除

**Interfaces:**
- Produces: `TaskNotificationsService.createForReminder / list / markRead / markAllRead`
- Produces: `TaskReminderScheduler.processDueReminders` `@Cron(EVERY_MINUTE)`

- [ ] **Step 1: Notifications service**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/current-user.decorator';

@Injectable()
export class TaskNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForReminder(input: {
    tenantId: string;
    userId: string;
    taskId: string;
    message: string;
  }) {
    return this.prisma.taskNotification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        taskId: input.taskId,
        message: input.message.slice(0, 512),
      },
    });
  }

  async list(user: AuthUser, unreadOnly: boolean) {
    const rows = await this.prisma.taskNotification.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { firedAt: 'desc' },
      take: 50,
    });
    return rows.map((n) => ({
      id: n.id,
      taskId: n.taskId,
      message: n.message,
      firedAt: n.firedAt.toISOString(),
      read: n.read,
    }));
  }

  async markRead(user: AuthUser, id: string) {
    const row = await this.prisma.taskNotification.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.userId },
    });
    if (!row) throw new NotFoundException();
    return this.prisma.taskNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.taskNotification.updateMany({
      where: {
        tenantId: user.tenantId,
        userId: user.userId,
        read: false,
      },
      data: { read: true },
    });
    return { ok: true };
  }
}
```

- [ ] **Step 2: Reminder scheduler**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { TaskNotificationsService } from './task-notifications.service';

@Injectable()
export class TaskReminderScheduler {
  private readonly logger = new Logger(TaskReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: TaskNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueReminders() {
    const now = new Date();
    const due = await this.prisma.task.findMany({
      where: {
        completed: false,
        reminderAt: { lte: now },
        reminderFiredAt: null,
      },
      take: 100,
    });

    for (const task of due) {
      try {
        await this.notifications.createForReminder({
          tenantId: task.tenantId,
          userId: task.userId,
          taskId: task.id,
          message: task.title.trim() || '任务提醒',
        });
        await this.prisma.task.update({
          where: { id: task.id },
          data: { reminderFiredAt: now },
        });
      } catch (err) {
        this.logger.warn(`Reminder failed for task ${task.id}: ${String(err)}`);
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/apps/tasks
git commit -m "feat(api): task reminders and notifications"
```

---

### Task 5: 接线 AppsModule，退役旧 stickies 实现，更新 registry 文案

**Files:**
- Modify: `apps/api/src/modules/apps/apps.module.ts`
- Modify: `apps/api/src/modules/apps/app-registry.service.ts`
- Delete: `apps/api/src/modules/apps/stickies/` 整个目录（controller/service/ai/notifications/scheduler）
- Modify: 任何仍 import Sticky 的文件直至 `pnpm --filter @work-ally/api lint` 通过
- 若 `ModelsModule` 仅服务 stickies AI：可从 `AppsModule.imports` 移除（确认 admin 不依赖）

**Interfaces:**
- Produces: `AppsModule` providers = registry + guard + Tasks* + TaskNotifications* + TaskReminderScheduler
- Produces: `STICKIES_DEFAULT.description = '日历任务：日/周/月视图、提醒、拖拽改期'`

- [ ] **Step 1: Rewrite `apps.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AclModule } from '../acl/acl.module';
import { AppRegistryService } from './app-registry.service';
import { AppsController } from './apps.controller';
import { AdminAppsController } from './admin-apps.controller';
import { StickiesAppGuard } from './stickies-app.guard';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { TaskNotificationsService } from './tasks/task-notifications.service';
import { TaskReminderScheduler } from './tasks/task-reminder.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), AclModule],
  controllers: [AppsController, AdminAppsController, TasksController],
  providers: [
    AppRegistryService,
    StickiesAppGuard,
    TasksService,
    TaskNotificationsService,
    TaskReminderScheduler,
  ],
  exports: [AppRegistryService],
})
export class AppsModule {}
```

- [ ] **Step 2: Update registry description**

```ts
export const STICKIES_DEFAULT = {
  slug: STICKIES_SLUG,
  name: '闪签',
  description: '日历任务：日/周/月视图、优先级、提醒与拖拽改期',
};
```

对已存在的 `app_registry` 行：可选在 `ensureStickies` 里若 description 仍含「便签」则 `update` 一次（非必须）。

- [ ] **Step 3: Delete old stickies backend files**

删除目录 `apps/api/src/modules/apps/stickies/`。

- [ ] **Step 4: Lint API**

Run: `pnpm --filter @work-ally/api lint`  
Expected: 无错误。

- [ ] **Step 5: Manual API smoke**（API 已启动时）

```bash
# 替换 TOKEN / 日期
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/apps/stickies/tasks?from=2026-08-01T00:00:00.000Z&to=2026-09-01T00:00:00.000Z"
# 应返回 []

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"title\":\"验收任务\"}" \
  http://localhost:3001/api/apps/stickies/tasks
# 应返回含 dueAt、allDay:true、priority:medium 的对象

# 旧路径应 404:
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/apps/stickies/notes
```

Expected: list/create 200；`/notes` 与 `/ai/*` 不可用。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/apps packages/shared
git commit -m "refactor(api): wire tasks module and remove sticky backend"
```

---

### Task 6: 前端类型 + 日期工具

**Files:**
- Modify: `apps/web/src/components/stickies/types.ts`（整文件替换）
- Create: `apps/web/src/components/stickies/date-utils.ts`
- Delete: checklist helpers / `STICKY_COLOR_MAP` / `StickyNote`

**Interfaces:**
- Produces: `Task`, `TaskNotification`, `TaskPriority`, `CalendarView = 'day'|'week'|'month'`
- Produces: `startOfLocalDay`, `addDays`, `startOfWeek(monday)`, `startOfMonth`, `endOfMonthExclusive`, `rangeForView(view, anchor)`, `toAllDayDueAt(localDate)`, `formatYmd`

- [ ] **Step 1: Replace `types.ts`**

```ts
export type TaskPriority = 'high' | 'medium' | 'low';
export type CalendarView = 'day' | 'week' | 'month';

export type Task = {
  id: string;
  title: string;
  notes: string;
  completed: boolean;
  completedAt: string | null;
  priority: TaskPriority;
  dueAt: string;
  allDay: boolean;
  reminderAt: string | null;
  reminderFiredAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskNotification = {
  id: string;
  taskId: string;
  message: string;
  firedAt: string;
  read: boolean;
};

export type WorkbenchApp = {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: '#c45c4a',
  medium: '#c4a35a',
  low: '#7a8a99',
};
```

- [ ] **Step 2: Add `date-utils.ts`**

```ts
import type { CalendarView } from './types';

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-start week */
export function startOfWeek(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

export function startOfMonth(d: Date): Date {
  return startOfLocalDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonthExclusive(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export function toAllDayDueAt(localDay: Date): string {
  return startOfLocalDay(localDay).toISOString();
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return formatYmd(a) === formatYmd(b);
}

export function rangeForView(
  view: CalendarView,
  anchor: Date,
): { from: Date; to: Date } {
  if (view === 'day') {
    const from = startOfLocalDay(anchor);
    return { from, to: addDays(from, 1) };
  }
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  // month: include leading/trailing days of grid (6 weeks)
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  return { from: gridStart, to: addDays(gridStart, 42) };
}

export function tasksOnLocalDay<T extends { dueAt: string }>(
  tasks: T[],
  day: Date,
): T[] {
  const key = formatYmd(day);
  return tasks.filter((t) => formatYmd(new Date(t.dueAt)) === key);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/stickies/types.ts apps/web/src/components/stickies/date-utils.ts
git commit -m "feat(web): task types and calendar date helpers"
```

---

### Task 7: CalendarShell + QuickAdd + 月视图（可读可建）

**Files:**
- Rewrite: `apps/web/src/components/stickies/stickies-app.tsx`
- Create: `apps/web/src/components/stickies/quick-add.tsx`
- Create: `apps/web/src/components/stickies/month-view.tsx`
- Create: `apps/web/src/components/stickies/task-chip.tsx`
- Delete: `sticky-card.tsx`（若仍被引用先改引用）

**Interfaces:**
- Shell state: `view`, `selectedDate`, `anchorDate`, `tasks`, `hideCompleted`, `selectedTaskId`, notifications
- Load: `GET /apps/stickies/tasks?from=&to=&includeCompleted=`
- Create: `POST /apps/stickies/tasks` **必须带** `dueAt: toAllDayDueAt(selectedDate)`（勿依赖服务端默认今天，避免 API/浏览器时区不一致）

- [ ] **Step 1: `task-chip.tsx`** — 标题、优先级色点、完成勾选、`onOpen` / `onToggleComplete`

- [ ] **Step 2: `quick-add.tsx`** — controlled input；Enter → `onCreate(title)`

- [ ] **Step 3: `month-view.tsx`** — 42 格；每格 `tasksOnLocalDay`；点击格子 `onSelectDate`；点击任务 `onOpenTask`；本步可先不做拖拽（Task 10）

- [ ] **Step 4: Rewrite `stickies-app.tsx`**

结构：

```tsx
// 伪代码骨架 — 实现时写完整
export default function StickiesApp() {
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(() => startOfLocalDay(new Date()));
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  // load on view/anchor/hideCompleted change via rangeForView
  // header: 日|周|月, prev/next, 今天, 隐藏已完成, bell
  // body: view==='month' ? <MonthView .../> : placeholder for week/day
  // footer: <QuickAdd onCreate={...} />
}
```

周/日本任务可先放占位文案「周/日视图下一批接入」。

- [ ] **Step 5: 手验**

打开 `/workbench/apps/stickies`：月历可见；输入创建任务出现在选中日；刷新后仍在。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/stickies
git commit -m "feat(web): calendar shell with month view and quick add"
```

---

### Task 8: 周视图 + 日视图

**Files:**
- Create: `apps/web/src/components/stickies/week-view.tsx`
- Create: `apps/web/src/components/stickies/day-view.tsx`
- Modify: `stickies-app.tsx` 挂载三视图

**Interfaces:**
- Week: 7 列；全天区 + 小时轴（建议 0–23 或 6–22）；点击空白 → `onCreateAt(date, hour)` 创建非全天
- Day: 单列同构
- `onCreateAt`: `POST` with `allDay:false`, `dueAt` = 本地日 + hour:00

- [ ] **Step 1: 实现 WeekView / DayView**（共享内部 `TimeGrid` 可内联在 week 文件再被 day 复用，或抽 `time-grid.tsx`）

- [ ] **Step 2: Shell 切换 view 时用同一 `tasks` 数据源**

- [ ] **Step 3: 手验** — 周/日切换正确；点 14:00 空白创建带时刻任务；全天任务在全天区

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/stickies
git commit -m "feat(web): stickies week and day calendar views"
```

---

### Task 9: 任务详情侧栏

**Files:**
- Create: `apps/web/src/components/stickies/task-detail-drawer.tsx`
- Modify: `stickies-app.tsx`

**Interfaces:**
- Props: `task: Task | null`, `onClose`, `onChange(patch)`, `onDelete`
- 字段：title、completed、date、allDay、time、priority、reminder、notes
- 防抖 400ms `PATCH /apps/stickies/tasks/:id`；改 `reminderAt` 时后端会清 `reminderFiredAt`

- [ ] **Step 1: 实现抽屉 UI + 自动保存**

- [ ] **Step 2: Esc / 遮罩关闭**

- [ ] **Step 3: 手验** — 改优先级/日期后月历位置更新；删除任务消失

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/stickies
git commit -m "feat(web): task detail drawer with autosave"
```

---

### Task 10: 拖拽改期 / 改时

**Files:**
- Modify: `month-view.tsx`, `week-view.tsx`, `day-view.tsx`, `task-chip.tsx`
- 使用 HTML5 DnD（`draggable` + `onDragStart`/`onDrop`）即可，不引入新依赖

**Interfaces:**
- Month drop on day cell → `PATCH { dueAt: preserveTimeOrAllDay(newDay, task) }`
- Week/Day drop on hour → `PATCH { dueAt: thatInstant, allDay: false }`

辅助：

```ts
export function moveTaskToDay(task: Task, day: Date): { dueAt: string; allDay: boolean } {
  if (task.allDay) {
    return { dueAt: toAllDayDueAt(day), allDay: true };
  }
  const old = new Date(task.dueAt);
  const next = startOfLocalDay(day);
  next.setHours(old.getHours(), old.getMinutes(), 0, 0);
  return { dueAt: next.toISOString(), allDay: false };
}

export function moveTaskToSlot(day: Date, hour: number, minute = 0): {
  dueAt: string;
  allDay: boolean;
} {
  const next = startOfLocalDay(day);
  next.setHours(hour, minute, 0, 0);
  return { dueAt: next.toISOString(), allDay: false };
}
```

- [ ] **Step 1: 实现拖拽 + PATCH + 乐观更新**

- [ ] **Step 2: 手验** — 月内改日；周内改小时

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/stickies
git commit -m "feat(web): drag tasks across calendar days and hours"
```

---

### Task 11: 样式、铃铛、Admin 文案、清理旧 CSS/UI

**Files:**
- Modify: `apps/web/src/app/globals.css` — 删除便签 masonry/card 规则，新增日历布局（`.stickies-cal`, `.stickies-month`, `.stickies-timegrid`, `.stickies-drawer`…）
- Modify: `apps/web/src/app/admin/apps/stickies/page.tsx` — 标题/说明改为日历任务；隐藏或弱化「默认模型 / AI actions」区块（字段可留在 API）
- Modify: `apps/web/src/app/workbench/apps/page.tsx` 若有便签文案则更新
- 删除无用：`sticky-card.tsx`；确认无 ModelSelect 依赖

**视觉约束（来自 spec）：** 无彩色便签墙；优先级色点克制；无紫光/重阴影/装饰 emoji 堆砌。

- [ ] **Step 1: CSS 替换**

- [ ] **Step 2: Admin + 应用列表文案**

- [ ] **Step 3: `pnpm --filter @work-ally/web lint`**

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "style(web): calendar UI for stickies; update admin copy"
```

---

### Task 12: 端到端验收对照 spec

**Files:** 无新文件；对照 `docs/superpowers/specs/2026-08-28-stickies-calendar-tasks-design.md` 成功标准。

- [ ] **Step 1: 验收清单**

| # | 标准 | 结果 |
|---|---|---|
| 1 | 日/周/月切换，区间任务显示正确 | ☐ |
| 2 | 新建必有日期；侧栏可改齐 ABCDE 字段 | ☐ |
| 3 | 月拖拽改日、周/日拖拽改时 | ☐ |
| 4 | 提醒到点通知 + 铃铛已读 | ☐ |
| 5 | `/notes`、`/ai/*` 不可达；旧表已删 | ☐ |

- [ ] **Step 2: 修任何失败项后再次手验**

- [ ] **Step 3: 最终 commit（若有修复）**

```bash
git add -A
git commit -m "fix(stickies): address calendar-tasks acceptance gaps"
```

（无变更则跳过。）

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| 日/周/月三视图 | 7, 8 |
| 真实任务字段 ABCDE | 1–3, 9 |
| 必须有日期 / 默认今天 | 3, 7 |
| 无未安排/智能列表/AI/标签/子任务/重复 | Global + 删除旧代码 |
| 方案 2 新建 Task、退役 Sticky | 2, 5 |
| 对外闪签 + `/apps/stickies` | 3, 5 |
| `from`/`to` + `includeCompleted` | 3, 7 |
| 侧栏 + 不自动打开 | 9 |
| 拖拽 | 10 |
| 提醒/铃铛 | 4, 7, 11 |
| DROP 旧表无迁移 | 2 |
| Admin 文案 | 11 |
| 验收标准 | 12 |

## Placeholder / consistency notes

- Controller 中 `BadRequestException` 使用正常 import（勿 `require`）
- 全天 dueAt 与 `date-utils.toAllDayDueAt` / service `startOfLocalToday` 一致（服务器本地时区与浏览器一致时手验；若 API 与浏览器时区不同，创建应优先由**前端传 dueAt**，服务端仅在缺省时用服务器本地今天——QuickAdd 必须传 `dueAt`）
- **修正约束：** QuickAdd / 点格创建一律由前端传 `dueAt: toAllDayDueAt(selectedDate)`，不依赖服务端时区
