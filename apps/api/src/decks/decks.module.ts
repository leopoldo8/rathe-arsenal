import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { FabraryModule } from '../fabrary/fabrary.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { CollectionModule } from '../collection/collection.module';
import { DecksImportService } from './import/decks-import.service';
import { DecksImportController } from './import/decks-import.controller';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';
import { TestDeckController } from './test/test-deck.controller';
import { TestDeckService } from './test/test-deck.service';
import { ReSolveController } from './re-solve/re-solve.controller';
import { ReSolveService } from './re-solve/re-solve.service';
import { VariantFetchController } from './variant-fetch.controller';
import { VariantJobsController } from './variant-jobs.controller';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { DecisionsModule } from './decisions/decisions.module';
import { HeroIdentifierExistsInCatalog } from './validators/hero-identifier-exists.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrackedDeckEntity,
      DeckCardEntity,
      DeckReadinessSnapshotEntity,
      StoreEntity,
      StoreStockEntity,
    ]),
    FabraryModule,
    SubstitutionModule,
    CollectionModule,
    AuthModule,
    StoresModule,
    DecisionsModule,
  ],
  controllers: [
    DecksImportController,
    DecksController,
    TestDeckController,
    ReSolveController,
    VariantFetchController,
    VariantJobsController,
  ],
  providers: [
    DecksImportService,
    DecksService,
    TestDeckService,
    ReSolveService,
    // Shared U5/U6 validator — registered here so NestJS DI resolves it when
    // useContainer is configured. Falls back to static catalog singleton at
    // runtime until useContainer(app.select(AppModule), { fallbackOnErrors: true })
    // is added to main.ts (tracked as a gap for U6 to resolve).
    HeroIdentifierExistsInCatalog,
  ],
})
export class DecksModule {}
