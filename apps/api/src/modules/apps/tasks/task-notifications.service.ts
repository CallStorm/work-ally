import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common/current-user.decorator';

/** Stub until Task 4 implements TaskNotificationsService. */
@Injectable()
export class TaskNotificationsService {
  async list(_user: AuthUser, _unreadOnly?: boolean) {
    return [];
  }

  async markRead(_user: AuthUser, _id: string) {
    return { ok: true };
  }

  async markAllRead(_user: AuthUser) {
    return { ok: true };
  }
}
