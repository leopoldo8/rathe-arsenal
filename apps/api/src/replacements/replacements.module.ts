import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CollectionModule } from '../collection/collection.module';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { StoresModule } from '../stores/stores.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { SwapsCoreModule } from '../swaps/swaps-core.module';
import { AlternativesService } from './alternatives.service';
import { ReplacementsController } from './replacements.controller';
import { ReplacementsCoreModule } from './replacements-core.module';
import { ReplacementsService } from './replacements.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackedDeckEntity, DeckCardEntity]),
    AuthModule,
    CollectionModule,
    StoresModule,
    SubstitutionModule,
    SwapsCoreModule,
    ReplacementsCoreModule,
  ],
  controllers: [ReplacementsController],
  providers: [AlternativesService, ReplacementsService],
})
export class ReplacementsModule {}
