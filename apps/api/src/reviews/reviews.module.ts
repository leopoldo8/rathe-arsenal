import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewAggregateEntity } from '../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { ReviewAggregateService } from './review-aggregate.service';

/**
 * ReviewsModule — owns the `review_aggregate` read-model.
 *
 * No HTTP controller in this module (U5 scope). Controllers will be added
 * in U6 / U8 / U10 when the Reviews surface is wired to the frontend.
 *
 * Exports `ReviewAggregateService` so that other modules (e.g.,
 * SubstitutionModule, DecksModule) can call `computeForDeck` after
 * persisting a new snapshot.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReviewAggregateEntity,
      DeckReadinessSnapshotEntity,
    ]),
  ],
  providers: [ReviewAggregateService],
  exports: [ReviewAggregateService],
})
export class ReviewsModule {}
