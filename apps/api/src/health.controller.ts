import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@work-ally/shared';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      app: APP_NAME,
      service: 'api',
    };
  }
}
