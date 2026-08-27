import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function registerProcessGuards() {
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[api] unhandledRejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    // eslint-disable-next-line no-console
    console.error('[api] uncaughtException:', error);
  });
}

async function listen(app: Awaited<ReturnType<typeof NestFactory.create>>, port: number) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await app.listen(port);
      return;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as NodeJS.ErrnoException).code)
          : '';
      if (code !== 'EADDRINUSE' || attempt === maxAttempts) {
        if (code === 'EADDRINUSE') {
          // eslint-disable-next-line no-console
          console.error(
            `\n[api] Port ${port} is already in use (EADDRINUSE).\n` +
              `      Run: node scripts/kill-api-port.mjs\n` +
              `      Or stop the other API process, then restart pnpm dev.\n`,
          );
        }
        throw error;
      }
      const waitMs = 1500 * attempt;
      // eslint-disable-next-line no-console
      console.warn(
        `[api] Port ${port} busy, retrying in ${waitMs}ms (${attempt}/${maxAttempts})…`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

async function bootstrap() {
  registerProcessGuards();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  const corsOrigins = process.env.WEB_ORIGIN?.split(',').map((s) => s.trim());
  app.enableCors({
    // Dev default: reflect request Origin (supports localhost + LAN IP).
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await listen(app, port);
  // eslint-disable-next-line no-console
  console.log(`WorkAlly API listening on http://localhost:${port}/api`);
}

bootstrap();
