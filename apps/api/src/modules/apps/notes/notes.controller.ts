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

import {

  CreateHandbookCategorySchema,

  CreateHandbookNoteSchema,

  CreateNotesAiMessageSchema,

  UpdateHandbookCategorySchema,

  UpdateHandbookNoteSchema,

} from '@work-ally/shared';

import { JwtAuthGuard } from '../../../common/jwt-auth.guard';

import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';

import { parseBody } from '../../../common/zod';

import { NotesAppGuard } from '../notes-app.guard';

import { HandbookCategoriesService } from './handbook-categories.service';

import { HandbookNotesService } from './handbook-notes.service';

import { NotesAiService } from './notes-ai.service';



@Controller('apps/notes')

@UseGuards(JwtAuthGuard, NotesAppGuard)

export class NotesController {

  constructor(

    private readonly categories: HandbookCategoriesService,

    private readonly notes: HandbookNotesService,

    private readonly notesAi: NotesAiService,

  ) {}



  @Get('categories')

  listCategories(@CurrentUser() user: AuthUser) {

    return this.categories.list(user);

  }



  @Post('categories')

  createCategory(@CurrentUser() user: AuthUser, @Body() body: unknown) {

    return this.categories.create(

      user,

      parseBody(CreateHandbookCategorySchema, body),

    );

  }



  @Patch('categories/:id')

  updateCategory(

    @CurrentUser() user: AuthUser,

    @Param('id') id: string,

    @Body() body: unknown,

  ) {

    return this.categories.update(

      user,

      id,

      parseBody(UpdateHandbookCategorySchema, body),

    );

  }



  @Delete('categories/:id')

  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {

    return this.categories.remove(user, id);

  }



  @Get('notes')

  listNotes(

    @CurrentUser() user: AuthUser,

    @Query('categoryId') categoryId?: string,

    @Query('q') q?: string,

  ) {

    return this.notes.list(user, { categoryId, q });

  }



  @Post('notes')

  createNote(@CurrentUser() user: AuthUser, @Body() body: unknown) {

    return this.notes.create(user, parseBody(CreateHandbookNoteSchema, body));

  }



  @Get('notes/:id')

  getNote(@CurrentUser() user: AuthUser, @Param('id') id: string) {

    return this.notes.get(user, id);

  }



  @Patch('notes/:id')

  updateNote(

    @CurrentUser() user: AuthUser,

    @Param('id') id: string,

    @Body() body: unknown,

  ) {

    return this.notes.update(user, id, parseBody(UpdateHandbookNoteSchema, body));

  }



  @Delete('notes/:id')

  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string) {

    return this.notes.remove(user, id);

  }



  @Get(':id/ai/messages')

  listAiMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {

    return this.notesAi.listMessages(user, id);

  }



  @Post(':id/ai/messages')

  postAiMessage(

    @CurrentUser() user: AuthUser,

    @Param('id') id: string,

    @Body() body: unknown,

  ) {

    return this.notesAi.postMessage(

      user,

      id,

      parseBody(CreateNotesAiMessageSchema, body),

    );

  }

}

