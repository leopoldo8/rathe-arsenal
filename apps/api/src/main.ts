import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { initApiSentry } from './observability/sentry';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // OBS-03: ConfigModule has loaded .env by this point, so SENTRY_DSN is
  // readable here. No-op when absent (dev/CI without a DSN).
  initApiSentry(app.get(ConfigService).get<string>('SENTRY_DSN'));

  // A5: Railway terminates TLS and forwards the client IP in X-Forwarded-For.
  // `trust proxy = 1` tells Express to use the first forwarded IP as req.ip,
  // which is what the ThrottlerGuard uses for per-IP rate limiting. Without
  // this, every request appears to come from Railway's gateway IP and the
  // throttler effectively becomes a global limit shared by all users.
  app.set('trust proxy', 1);

  app.useLogger(app.get(Logger));

  // Wire NestJS DI into class-validator so injectable validators (e.g.
  // HeroIdentifierExistsInCatalog) can receive injected dependencies.
  // `fallbackOnErrors: true` means class-validator falls back to plain
  // instantiation when DI resolution fails — preserving the static-catalog
  // fallback behavior for validators that don't actually need injection.
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.setGlobalPrefix('api', { exclude: [] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS only needed in dev (production is same-origin: API serves SPA)
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({ origin: 'http://localhost:5173', credentials: true });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
