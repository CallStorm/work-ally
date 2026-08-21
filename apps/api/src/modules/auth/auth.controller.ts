import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('_scaffold')
  scaffold() {
    return { module: 'auth', status: 'stub' };
  }
}
