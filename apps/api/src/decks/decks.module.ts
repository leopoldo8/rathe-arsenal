import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { RejectedSubstituteEntity } from '../database/entities/rejected-substitute.entity';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { FabraryModule } from '../fabrary/fabrary.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { DecksImportService } from './import/decks-import.service';
import { DecksImportController } from './import/decks-import.controller';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';
import { TestDeckController } from './test/test-deck.controller';
import { TestDeckService } from './test/test-deck.service';
import { ReSolveController } from './re-solve/re-solve.controller';
import { ReSolveService } from './re-solve/re-solve.service';
import { VariantFetchController } from './variant-fetch.controller';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrackedDeckEntity,
      DeckCardEntity,
      CollectionCardEntity,
      DeckReadinessSnapshotEntity,
      RejectedSubstituteEntity,
      StoreEntity,
      StoreStockEntity,
    ]),
    FabraryModule,
    SubstitutionModule,
    AuthModule,
    StoresModule,
  ],
  controllers: [
    DecksImportController,
    DecksController,
    TestDeckController,
    ReSolveController,
    VariantFetchController,
  ],
  providers: [
    DecksImportService,
    DecksService,
    TestDeckService,
    ReSolveService,
  ],
})
export class DecksModule {}
