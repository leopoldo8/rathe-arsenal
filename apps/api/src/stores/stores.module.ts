import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  CardAliasEntity,
} from '../database/entities';
import { CardNameMatcherService } from './card-name-matcher.service';

/**
 * Phase 1b stores module. Owns the store-data vertical:
 * scraper, card-name matcher, shopping-line service, and admin endpoint.
 *
 * CatalogModule is @Global(), so CatalogService is available here without
 * an explicit import.
 *
 * Unit 1: schema (entities, migrations) + module skeleton.
 * Unit 2: CardNameMatcherService — deterministic + alias resolver.
 * Units 3-6: scraper, ingestion, shopping-line service, admin endpoint.
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
  providers: [CardNameMatcherService],
  exports: [CardNameMatcherService],
})
export class StoresModule {}
