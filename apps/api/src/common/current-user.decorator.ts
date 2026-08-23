import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MembershipRole } from '@work-ally/shared';

export type AuthUser = {
  userId: string;
  tenantId: string;
  role: MembershipRole;
  phone: string;
  name: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
