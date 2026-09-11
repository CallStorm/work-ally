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
  CreateImageStudioModelSchema,
  UpdateImageStudioModelSchema,
} from '@work-ally/shared';
import { AdminGuard } from '../../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../../common/current-user.decorator';
import { JwtAuthGuard } from '../../../common/jwt-auth.guard';
import { parseBody } from '../../../common/zod';
import { ImageStudioModelsService } from './image-studio-models.service';

@Controller('admin/apps/image-studio')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminImageStudioController {
  constructor(private readonly models: ImageStudioModelsService) {}

  @Get('models')
  list(@CurrentUser() user: AuthUser) {
    return this.models.listForAdmin(user.tenantId);
  }

  @Post('models')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.models.create(
      user.tenantId,
      parseBody(CreateImageStudioModelSchema, body),
    );
  }

  @Patch('models/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.models.update(
      user.tenantId,
      id,
      parseBody(UpdateImageStudioModelSchema, body),
    );
  }

  @Delete('models/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.models.remove(user.tenantId, id);
  }

  @Post('models/:id/test')
  test(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.models.test(user.tenantId, id);
  }

  @Post('models/:id/default')
  setDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.models.setDefault(user.tenantId, id);
  }
}
