import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      phone: string;
      password: string;
      name: string;
      tenantName: string;
    },
  ) {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: { phone: string; password: string }) {
    return this.auth.login(body.phone, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Get('me/groups')
  @UseGuards(JwtAuthGuard)
  myGroups(@CurrentUser() user: AuthUser) {
    return this.auth.myGroups(user);
  }
}
