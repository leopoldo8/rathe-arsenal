import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubstituteDecisionEntity, TrackedDeckEntity]),
  ],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
