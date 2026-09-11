import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AppRegistryService } from './app-registry.service';
import type { AuthUser } from '../../common/current-user.decorator';

@Injectable()
export class ImageStudioAppGuard implements CanActivate {
  constructor(private readonly registry: AppRegistryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) return false;
    const app = await this.registry.getImageStudioForUser(user);
    if (!app) {
      throw new ForbiddenException('无权使用图工作室');
    }
    return true;
  }
}
