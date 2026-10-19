import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardPriceEntity } from '../database/entities/card-price.entity';
import { PriceSuggestionService } from './price-suggestion.service';
import { PriceSyncScheduler } from './price-sync.scheduler';
import { PriceSyncService } from './price-sync.service';
import { HttpTcgcsvClient, TCGCSV_CLIENT } from './tcgcsv-client';

@Module({
  imports: [TypeOrmModule.forFeature([CardPriceEntity])],
  providers: [
    PriceSuggestionService,
    PriceSyncService,
    PriceSyncScheduler,
    { provide: TCGCSV_CLIENT, useFactory: () => new HttpTcgcsvClient() },
  ],
  exports: [PriceSuggestionService],
})
export class PricesModule {}
