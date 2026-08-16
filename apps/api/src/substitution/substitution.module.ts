import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthModule } from '../auth/auth.module';
import { CollectionReadService } from '../collection/collection-read.service';
import { SwapsCoreModule } from '../swaps/swaps-core.module';
import { SubstitutionService } from './substitution.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrackedDeckEntity,
      DeckCardEntity,
      CsvSourceEntity,
      CollectionCardEntity,
      DeckReadinessSnapshotEntity,
    ]),
    AuthModule,
    // Leaf module (no app-level deps) providing SwapsReconciliationService --
    // computeAndStoreReadiness is the choke point that reconciles
    // swap_suggestion after every recompute (design §11).
    SwapsCoreModule,
  ],
  providers: [CollectionReadService, SubstitutionService],
  exports: [SubstitutionService],
})
export class SubstitutionModule {}
