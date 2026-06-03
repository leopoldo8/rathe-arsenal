import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  UserEntity,
  CsvSourceEntity,
  CollectionCardEntity,
  TrackedDeckEntity,
  DeckCardEntity,
  DeckReadinessSnapshotEntity,
  SubstituteDecisionEntity,
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  CardAliasEntity,
  StoreStockVariantEntity,
  ReviewAggregateEntity,
  DeckTagEntity,
  TrackedDeckTagEntity,
  VariantFetchJobEntity,
} from './entities';

/**
 * Wires the runtime TypeORM connection from `DATABASE_URL`. Other modules
 * call `TypeOrmModule.forFeature([X])` to access repositories.
 *
 * `database/datasource.ts` (the standalone DataSource for the migration CLI
 * and the `scripts/delete-user.ts` dev script) is separate by design — the CLI
 * cannot bootstrap a NestJS module just to run a migration.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') === 'development';
        return {
          type: 'postgres' as const,
          url: config.get<string>('DATABASE_URL')!,
          entities: [
            UserEntity,
            CsvSourceEntity,
            CollectionCardEntity,
            TrackedDeckEntity,
            DeckCardEntity,
            DeckReadinessSnapshotEntity,
            SubstituteDecisionEntity,
            StoreEntity,
            StoreStockEntity,
            StoreScrapeRunEntity,
            CardAliasEntity,
            StoreStockVariantEntity,
            ReviewAggregateEntity,
            DeckTagEntity,
            TrackedDeckTagEntity,
            VariantFetchJobEntity,
          ],
          // Pending migrations run on app boot in non-dev environments. Dev
          // still relies on `synchronize: true` for fast iteration.
          migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
          migrationsRun: !isDev,
          synchronize: isDev,
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
