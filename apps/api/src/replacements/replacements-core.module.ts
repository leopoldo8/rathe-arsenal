import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { ReplacementsQueryService } from './replacements-query.service';

/**
 * Leaf module for reading and closing `card_replacement` rows. It depends on
 * nothing app-level, so `SubstitutionModule` (whose readiness compute honors
 * active replacements) and `DecksModule` (composition save and deck detail) can
 * import it without a cycle, as `SwapsCoreModule` allows for swap rows.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CardReplacementEntity])],
  providers: [ReplacementsQueryService],
  exports: [ReplacementsQueryService],
})
export class ReplacementsCoreModule {}
