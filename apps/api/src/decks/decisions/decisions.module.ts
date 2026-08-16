import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionModule } from '../../substitution/substitution.module';
import { SwapsCoreModule } from '../../swaps/swaps-core.module';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapSuggestionEntity, TrackedDeckEntity]),
    // SubstitutionModule provides SubstitutionService for post-commit
    // readiness recompute inside bulkUpsert.
    SubstitutionModule,
    // SwapsCoreModule provides SwapSuggestionQueryService (the
    // exclusion/approval sets bulkUpsert needs for its recompute call).
    SwapsCoreModule,
  ],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
