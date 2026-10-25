import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  UserEntity,
  CsvSourceEntity,
  CollectionCardEntity,
  ImportPendingLineEntity,
  TrackedDeckEntity,
  DeckCardEntity,
  DeckReadinessSnapshotEntity,
  CardReplacementEntity,
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  CardAliasEntity,
  StoreStockVariantEntity,
  ReviewAggregateEntity,
  DeckTagEntity,
  TrackedDeckTagEntity,
  VariantFetchJobEntity,
  RecommendationRunEntity,
  RecommendationEntity,
  RecommendationDismissalEntity,
  ChatConversationEntity,
  ChatMessageEntity,
  ChatProposalEntity,
  ChatUsageEntity,
  TournamentDeckEntity,
  TournamentDeckCardEntity,
  RulesEntryEntity,
  ShareEventEntity,
  ShareImageEntity,
  ShareLinkEntity,
  CardArtBlockEntity,
  CardListEntity,
  CardListLineEntity,
  CardPriceEntity,
  CardPriceGroupSyncEntity,
  SignInCodeEntity,
  UserSessionEntity,
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
            ImportPendingLineEntity,
            TrackedDeckEntity,
            DeckCardEntity,
            DeckReadinessSnapshotEntity,
            CardReplacementEntity,
            StoreEntity,
            StoreStockEntity,
            StoreScrapeRunEntity,
            CardAliasEntity,
            StoreStockVariantEntity,
            ReviewAggregateEntity,
            DeckTagEntity,
            TrackedDeckTagEntity,
            VariantFetchJobEntity,
            RecommendationRunEntity,
            RecommendationEntity,
            RecommendationDismissalEntity,
            ChatConversationEntity,
            ChatMessageEntity,
            ChatProposalEntity,
            ChatUsageEntity,
            TournamentDeckEntity,
            TournamentDeckCardEntity,
            RulesEntryEntity,
            ShareEventEntity,
            ShareImageEntity,
            ShareLinkEntity,
            CardArtBlockEntity,
            CardListEntity,
            CardListLineEntity,
            CardPriceEntity,
            CardPriceGroupSyncEntity,
            SignInCodeEntity,
            UserSessionEntity,
          ],
          // Pending migrations run on app boot in non-dev environments. Dev
          // still relies on `synchronize: true` for fast iteration.
          migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
          migrationsRun: !isDev,
          synchronize: isDev,
          logging: false,
        };
      },
      // The lowercased-address unique index (door 14) is an expression index, which entity
      // decorators cannot declare; where the schema is synchronized instead of migrated, create it here.
      dataSourceFactory: async (options?: DataSourceOptions) => {
        const dataSource = await new DataSource(options as DataSourceOptions).initialize();
        if ((options as { synchronize?: boolean }).synchronize === true) {
          await dataSource.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_email_lower" ON "user" (lower("email"))`,
          );
          // synchronize compares checks by name only, so a database built before the new import kinds
          // would keep the old list of kinds; replace it when it does not name them.
          await dataSource.query(`
            DO $$ BEGIN
              IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'CHK_csv_source_kind_valid' AND conrelid = 'csv_source'::regclass
                  AND pg_get_constraintdef(oid) NOT LIKE '%paste%'
              ) THEN
                ALTER TABLE csv_source DROP CONSTRAINT "CHK_csv_source_kind_valid";
                ALTER TABLE csv_source ADD CONSTRAINT "CHK_csv_source_kind_valid"
                  CHECK (kind IN ('csv', 'paste', 'product', 'fabrary', 'manual'));
              END IF;
            END $$;`);
        }
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}
