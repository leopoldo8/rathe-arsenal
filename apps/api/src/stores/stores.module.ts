import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  CardAliasEntity,
} from '../database/entities';
import { CardNameMatcherService } from './card-name-matcher.service';
import { SbraubleScraperService } from './sbrauble-scraper.service';

/**
 * Phase 1b stores module. Owns the store-data vertical:
 * scraper, card-name matcher, shopping-line service, and admin endpoint.
 *
 * FetchGuardModule and CatalogModule are both @Global(), so their services
 * are available here without explicit imports.
 *
 * Unit 1: entities + migrations + module skeleton.
 * Unit 2: CardNameMatcherService — deterministic + alias resolver.
 * Unit 3: SbraubleScraperService — HTML scraper + rate limiter.
 * Units 4-6: ingestion, shopping-line service, frontend — added in subsequent PRs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoreEntity,
      StoreStockEntity,
      StoreScrapeRunEntity,
      CardAliasEntity,
    ]),
  ],
  providers: [CardNameMatcherService, SbraubleScraperService],
  exports: [CardNameMatcherService, SbraubleScraperService],
})
export class StoresModule {}
