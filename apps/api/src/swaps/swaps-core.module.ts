import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SwapSuggestionQueryService } from './swap-suggestion-query.service';
import { SwapsReconciliationService } from './swaps-reconciliation.service';

/**
 * Leaf module for the swaps workstream's persistence primitives --
 * `SwapSuggestionQueryService` (reads the exclusion/approval sets every
 * recompute needs) and `SwapsReconciliationService` (writes reconciliation
 * mutations). Depends on nothing app-level so it can be imported by both
 * `SubstitutionModule` (which needs reconciliation inside
 * `computeAndStoreReadiness`) and `SwapsModule` (the five lifecycle
 * endpoints, which need `SubstitutionService` to recompute after a
 * mutation) without the two forming an import cycle.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SwapSuggestionEntity, TrackedDeckEntity])],
  providers: [SwapSuggestionQueryService, SwapsReconciliationService],
  exports: [SwapSuggestionQueryService, SwapsReconciliationService],
})
export class SwapsCoreModule {}
