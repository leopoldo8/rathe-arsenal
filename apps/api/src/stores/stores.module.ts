import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  CardAliasEntity,
} from '../database/entities';

/**
 * Phase 1b stores module. Owns the store-data vertical:
 * scraper, card-name matcher, shopping-line service, and admin endpoint.
 *
 * Units 2-6 add their services and controllers here.
 * Unit 1 wires the schema (entities, migrations) and module skeleton only.
 *
 * FetchGuardModule and CatalogModule are both @Global(), so their services
 * are available here without explicit imports.
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
})
export class StoresModule {}
