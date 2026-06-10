import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  CardAliasEntity,
  TrackedDeckEntity,
  DeckReadinessSnapshotEntity,
  StoreStockVariantEntity,
} from '../database/entities';
import { VariantFetchJobEntity } from '../database/entities/variant-fetch-job.entity';
import { CardNameMatcherService } from './card-name-matcher.service';
import { SbraubleScraperService } from './sbrauble-scraper.service';
import { SbraubleDetailParserService } from './sbrauble-detail-parser.service';
import { StoreIngestionService } from './store-ingestion.service';
import { ShoppingLineService } from './shopping-line.service';
import { VariantFetchService } from './variant-fetch.service';
import { VariantFetchQueueService } from './variant-fetch-queue.service';
import { VariantJobProcessorService } from './variant-job-processor.service';
import { ResolveJobCardsService } from './resolve-job-cards.service';
import { FirecrawlClientService } from './firecrawl-client.service';
import { AdminStoresController } from './admin/admin-stores.controller';
import { AdminApiKeyGuard } from './admin/admin-api-key.guard';

/**
 * Phase 1b stores module. Owns the store-data vertical:
 * scraper, card-name matcher, ingestion pipeline, and admin endpoint.
 *
 * FetchGuardModule and CatalogModule are both @Global(), so their services
 * are available here without explicit imports.
 *
 * Unit 1: entities + migrations + module skeleton.
 * Unit 2: CardNameMatcherService — deterministic + alias resolver.
 * Unit 3: SbraubleScraperService — HTML scraper + rate limiter.
 * Unit 4: StoreIngestionService — ingestion pipeline, delta guard, reconciliation,
 *          worker entry point (scripts/scrape-stores.ts), admin endpoint.
 * Unit 5: ShoppingLineService — read-time shopping line derivation + aggregate.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoreEntity,
      StoreStockEntity,
      StoreScrapeRunEntity,
      CardAliasEntity,
      TrackedDeckEntity,
      DeckReadinessSnapshotEntity,
      StoreStockVariantEntity,
      VariantFetchJobEntity,
    ]),
  ],
  controllers: [AdminStoresController],
  providers: [
    CardNameMatcherService,
    SbraubleScraperService,
    SbraubleDetailParserService,
    StoreIngestionService,
    ShoppingLineService,
    VariantFetchService,
    VariantFetchQueueService,
    VariantJobProcessorService,
    ResolveJobCardsService,
    FirecrawlClientService,
    AdminApiKeyGuard,
  ],
  exports: [
    CardNameMatcherService,
    SbraubleScraperService,
    SbraubleDetailParserService,
    StoreIngestionService,
    ShoppingLineService,
    VariantFetchService,
    VariantFetchQueueService,
    VariantJobProcessorService,
    ResolveJobCardsService,
  ],
})
export class StoresModule {}
