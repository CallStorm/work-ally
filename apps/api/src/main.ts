import 'reflect-metadata';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
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

function freePort(port: number) {
  const candidates = [
    path.resolve(process.cwd(), '../../scripts/kill-api-port.mjs'),
    path.resolve(process.cwd(), 'scripts/kill-api-port.mjs'),
    path.resolve(__dirname, '../../scripts/kill-api-port.mjs'),
    path.resolve(__dirname, '../../../scripts/kill-api-port.mjs'),
  ];
  const script = candidates.find((p) => fs.existsSync(p));
  if (!script) return;
  try {
    execSync(`node "${script}" ${port}`, { stdio: 'inherit' });
  } catch {
    // best-effort; listen retry still applies
  }
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
              `      Another API is likely still running — keep a single \`pnpm dev\`.\n` +
              `      To force free the port: node scripts/kill-api-port.mjs\n`,
          );
        }
        throw error;
      }
      // Wait first so a sibling nest --watch can finish; only steal the port late.
      // Early freePort() caused healthy instances to kill each other under multi-dev.
      if (attempt >= 3) {
        // eslint-disable-next-line no-console
        console.warn(
          `[api] Port ${port} still busy — freeing listeners then retry (${attempt}/${maxAttempts})…`,
        );
        freePort(port);
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[api] Port ${port} busy — waiting for other process (${attempt}/${maxAttempts})…`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
}

async function bootstrap() {
  registerProcessGuards();
  // Ensure agent bash/python child processes default to UTF-8 on Windows.
  process.env.PYTHONUTF8 ??= '1';
  process.env.PYTHONIOENCODING ??= 'utf-8';
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
