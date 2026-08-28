import {
  BadRequestException,
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
      throw new BadRequestException('from and to are required');
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
