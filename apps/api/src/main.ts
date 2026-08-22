import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const corsOrigins = process.env.WEB_ORIGIN?.split(',').map((s) => s.trim());
  app.enableCors({
    // Dev default: reflect request Origin (supports localhost + LAN IP).
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`WorkAlly API listening on http://localhost:${port}/api`);
}

bootstrap();
