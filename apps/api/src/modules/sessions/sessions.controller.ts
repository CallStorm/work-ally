import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CreateSessionInput } from '@work-ally/shared';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('group_id') groupId?: string) {
    return this.sessions.list(user, groupId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.get(user, id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateSessionInput & { wait?: boolean },
  ) {
    const { wait, ...payload } = body;
    const created = await this.sessions.create(user, payload);
    if (wait) {
      await created.execution;
    } else {
      // ensure rejection is logged by runtime service
      void created.execution.catch(() => undefined);
    }
    return {
      sessionId: created.sessionId,
      runId: created.runId,
      messageId: created.messageId,
    };
  }

  @Post(':id/messages')
  async addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { content: string; attachmentIds?: string[]; wait?: boolean },
  ) {
    const created = await this.sessions.addMessage(user, id, body);
    if (body.wait) {
      await created.execution;
    } else {
      void created.execution.catch(() => undefined);
    }
    return {
      sessionId: created.sessionId,
      runId: created.runId,
      messageId: created.messageId,
    };
  }
}
