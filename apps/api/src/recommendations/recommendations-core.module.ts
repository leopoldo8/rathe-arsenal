import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationDismissalEntity } from '../database/entities/recommendation-dismissal.entity';
import { RecommendationRunEntity } from '../database/entities/recommendation-run.entity';
import { RecommendationEntity } from '../database/entities/recommendation.entity';
import { RecommendationQueueService } from './recommendation-queue.service';
import { RecommendationsQueryService } from './recommendations-query.service';

/** Leaf module: the deck-list writers in `DecksModule` and `ReplacementsModule` enqueue through it without a cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([RecommendationRunEntity, RecommendationEntity, RecommendationDismissalEntity])],
  providers: [RecommendationQueueService, RecommendationsQueryService],
  exports: [RecommendationQueueService, RecommendationsQueryService],
})
export class RecommendationsCoreModule {}
