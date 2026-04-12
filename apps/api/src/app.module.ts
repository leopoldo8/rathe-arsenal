import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { FetchGuardModule } from './common/fetch-guard/fetch-guard.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CatalogModule } from './catalog/catalog.module';
import { FabraryModule } from './fabrary/fabrary.module';
import { SubstitutionModule } from './substitution/substitution.module';
import { DecksModule } from './decks/decks.module';
import { CollectionModule } from './collection/collection.module';
import { StoresModule } from './stores/stores.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    LoggerModule,
    FetchGuardModule,
    // A5: global rate limiter. 120 req/min per IP is the lenient default applied
    // to every route; sensitive auth endpoints override via @Throttle() with
    // tighter per-route limits. Health check opts out via @SkipThrottle().
    // IP attribution relies on `trust proxy` being enabled in main.ts so that
    // req.ip reflects the real client IP (not Railway's gateway).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 120 },
    ]),
    AuthModule,
    EmailModule,
    CatalogModule,
    FabraryModule,
    SubstitutionModule,
    DecksModule,
    CollectionModule,
    StoresModule,
    // Serve the built SPA from apps/web/dist in production.
    // Path resolves at runtime relative to the compiled apps/api/dist/main.js.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'web', 'dist'),
      exclude: ['/api/{*path}'],
      serveStaticOptions: { fallthrough: true },
    }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
