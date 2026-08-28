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
