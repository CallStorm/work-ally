import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AdminGuard } from '../../common/admin.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.groups.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.get(user, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; description?: string },
  ) {
    return this.groups.create(user, body);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; description: string }>,
  ) {
    return this.groups.update(user, id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.remove(user, id);
  }

  @Put(':id/members')
  @UseGuards(AdminGuard)
  setMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
  ) {
    return this.groups.setMembers(user, id, body.userIds ?? []);
  }

  @Post(':id/members')
  @UseGuards(AdminGuard)
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { userIds: string[] },
  ) {
    return this.groups.addMembers(user, id, body.userIds ?? []);
  }

  @Delete(':id/members/:uid')
  @UseGuards(AdminGuard)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('uid') uid: string,
  ) {
    return this.groups.removeMember(user, id, uid);
  }
}
