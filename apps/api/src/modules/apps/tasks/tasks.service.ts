import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Task, TaskPriority } from '@prisma/client';
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

    const where: Prisma.TaskWhereInput = {
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
