import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionModule } from '../../substitution/substitution.module';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubstituteDecisionEntity, TrackedDeckEntity]),
    // SubstitutionModule provides SubstitutionService for post-commit
    // readiness recompute inside bulkUpsert.
    SubstitutionModule,
  ],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
