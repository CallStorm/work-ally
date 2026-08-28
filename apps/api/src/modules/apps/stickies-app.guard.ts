import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppRegistryService } from './app-registry.service';
import type { AuthUser } from '../../common/current-user.decorator';

@Injectable()
export class StickiesAppGuard implements CanActivate {
  constructor(private readonly registry: AppRegistryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return false;
    const app = await this.registry.getStickiesForUser(user);
    if (!app) {
      throw new ForbiddenException('无权使用闪签应用');
    }
    return true;
  }
}
