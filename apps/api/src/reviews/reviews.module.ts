import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewAggregateEntity } from '../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstituteDecisionEntity } from '../database/entities/substitute-decision.entity';
import { DecisionsModule } from '../decks/decisions/decisions.module';
import { ReviewAggregateService } from './review-aggregate.service';
import { ReviewsController } from './reviews.controller';

/**
 * ReviewsModule — owns the `review_aggregate` read-model and the
 * `POST /api/reviews/bulk` endpoint (U6) and `GET /api/reviews` endpoint (U5).
 *
 * Exports `ReviewAggregateService` so that other modules (e.g.,
 * SubstitutionModule, DecksModule) can call `computeForDeck` after
 * persisting a new snapshot.
 *
 * `ReviewsController` is registered here to handle `/api/reviews/*` routes.
 * It delegates to `DecisionsService` (from `DecisionsModule`) for the bulk
 * write pipeline, and to `ReviewAggregateService` for the list endpoint.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReviewAggregateEntity,
      DeckReadinessSnapshotEntity,
      TrackedDeckEntity,
      SubstituteDecisionEntity,
    ]),
    // DecisionsModule provides DecisionsService for the bulk endpoint.
    DecisionsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewAggregateService],
  exports: [ReviewAggregateService],
})
export class ReviewsModule {}
