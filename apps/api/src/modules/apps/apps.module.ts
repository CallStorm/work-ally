import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AclModule } from '../acl/acl.module';
import { AppRegistryService } from './app-registry.service';
import { AppsController } from './apps.controller';
import { AdminAppsController } from './admin-apps.controller';
import { HandbookAppGuard } from './handbook-app.guard';
import { HandbookController } from './handbook/handbook.controller';
import { HandbookCategoriesService } from './handbook/handbook-categories.service';
import { HandbookNotesService } from './handbook/handbook-notes.service';
import { StickiesAppGuard } from './stickies-app.guard';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { TaskNotificationsService } from './tasks/task-notifications.service';
import { TaskReminderScheduler } from './tasks/task-reminder.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), AclModule],
  controllers: [
    AppsController,
    AdminAppsController,
    TasksController,
    HandbookController,
  ],
  providers: [
    AppRegistryService,
    StickiesAppGuard,
    HandbookAppGuard,
    HandbookCategoriesService,
    HandbookNotesService,
    TasksService,
    TaskNotificationsService,
    TaskReminderScheduler,
  ],
  exports: [AppRegistryService],
})
export class AppsModule {}
