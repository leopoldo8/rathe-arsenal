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
  FirecrawlUsageEntity,
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
// Door 11: the `quote` intent and the `offer`, `quote_sent` and `buy` events. The same lists as migration
// 1778533611000; a synchronized database built before it keeps the old ones, because checks compare by name only.
const SHARE_CHECKS: ReadonlyArray<{ table: string; name: string; needle: string; expression: string }> = [
  {
    table: 'share_link',
    name: 'CHK_share_link_intent_valid',
    needle: 'quote',
    expression: `"intent" IN ('deck', 'missing', 'want', 'sell', 'quote')`,
  },
  {
    table: 'share_event',
    name: 'CHK_share_event_kind_valid',
    needle: 'quote_sent',
    expression: `"kind" IN ('created', 'opened', 'signed_up', 'offer', 'quote_sent', 'buy')`,
  },
  {
    table: 'share_event',
    name: 'CHK_share_event_intent_valid',
    needle: 'quote',
    expression: `"intent" IS NULL OR "intent" IN ('deck', 'missing', 'want', 'sell', 'quote')`,
  },
  {
    table: 'user',
    name: 'CHK_user_referred_via_valid',
    needle: 'quote',
    expression: `"referredVia" IN ('deck', 'want', 'sell', 'quote')`,
  },
];

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
            FirecrawlUsageEntity,
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
          for (const check of SHARE_CHECKS) {
            await dataSource.query(`
              DO $$ BEGIN
                IF EXISTS (
                  SELECT 1 FROM pg_constraint
                  WHERE conname = '${check.name}' AND conrelid = '"${check.table}"'::regclass
                    AND pg_get_constraintdef(oid) NOT LIKE '%${check.needle}%'
                ) THEN
                  ALTER TABLE "${check.table}" DROP CONSTRAINT "${check.name}";
                  ALTER TABLE "${check.table}" ADD CONSTRAINT "${check.name}" CHECK (${check.expression});
                END IF;
              END $$;`);
          }
        }
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}
