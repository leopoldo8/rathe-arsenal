import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CollectionModule } from '../collection/collection.module';
import { SwapSuggestionEntity } from '../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { SubstitutionModule } from '../substitution/substitution.module';
import { SwapsController } from './swaps.controller';
import { SwapsCoreModule } from './swaps-core.module';
import { SwapsService } from './swaps.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapSuggestionEntity, TrackedDeckEntity]),
    SwapsCoreModule,
    SubstitutionModule,
    CollectionModule,
    CatalogModule,
  ],
  controllers: [SwapsController],
  providers: [SwapsService],
})
export class SwapsModule {}
