import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateHandbookCategorySchema,
  UpdateHandbookCategorySchema,
} from '@work-ally/shared';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { parseBody } from '../../../common/zod';
import { HandbookAppGuard } from '../handbook-app.guard';
import { HandbookCategoriesService } from './handbook-categories.service';

@Controller('apps/handbook')
@UseGuards(JwtAuthGuard, HandbookAppGuard)
export class HandbookController {
  constructor(private readonly categories: HandbookCategoriesService) {}

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
}
