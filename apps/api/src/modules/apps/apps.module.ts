import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AclModule } from '../acl/acl.module';
import { ModelsModule } from '../models/models.module';
import { AppRegistryService } from './app-registry.service';
import { AppsController } from './apps.controller';
import { AdminAppsController } from './admin-apps.controller';
import { NotesAppGuard } from './notes-app.guard';
import { ImageStudioAppGuard } from './image-studio-app.guard';
import { AdminImageStudioController } from './image-studio/admin-image-studio.controller';
import { ImageStudioController } from './image-studio/image-studio.controller';
import { ImageStudioModelsService } from './image-studio/image-studio-models.service';
import { ImageStudioProjectsService } from './image-studio/image-studio-projects.service';
import { NotesController } from './notes/notes.controller';
import { HandbookCategoriesService } from './notes/handbook-categories.service';
import { HandbookNotesService } from './notes/handbook-notes.service';
import { NotesAiService } from './notes/notes-ai.service';
import { StickiesAppGuard } from './stickies-app.guard';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { TaskNotificationsService } from './tasks/task-notifications.service';
import { TaskReminderScheduler } from './tasks/task-reminder.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), AclModule, ModelsModule],
  controllers: [
    AppsController,
    AdminAppsController,
    AdminImageStudioController,
    ImageStudioController,
    TasksController,
    NotesController,
  ],
  providers: [
    AppRegistryService,
    StickiesAppGuard,
    NotesAppGuard,
    ImageStudioAppGuard,
    ImageStudioModelsService,
    ImageStudioProjectsService,
    HandbookCategoriesService,
    HandbookNotesService,
    NotesAiService,
    TasksService,
    TaskNotificationsService,
    TaskReminderScheduler,
  ],
  exports: [AppRegistryService, ImageStudioModelsService],
})
export class AppsModule {}
