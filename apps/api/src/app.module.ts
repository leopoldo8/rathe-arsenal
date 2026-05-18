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
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TagsModule } from './tags/tags.module';

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
    // U12: settings/decisions endpoints also add per-endpoint 30/min overrides.
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
    // U12: user settings (GET/PATCH /api/users/me/settings)
    UsersModule,
    // U5 (Plan B): review_aggregate entity + service (no HTTP endpoints yet).
    ReviewsModule,
    // U3 (Deck Management v2): GET/POST/DELETE /api/tags for user-defined deck tags.
    TagsModule,
    // Serve the built SPA from apps/web/dist in production.
    // Path resolves at runtime relative to the compiled apps/api/dist/main.js.
    ServeStaticModule.forRoot({
      // __dirname at runtime = /app/apps/api/dist
      // 3x .. = /app → apps/web/dist = /app/apps/web/dist
      rootPath: join(__dirname, '..', '..', '..', 'apps', 'web', 'dist'),
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
