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
