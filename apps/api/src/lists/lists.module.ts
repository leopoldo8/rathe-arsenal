import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionModule } from '../collection/collection.module';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { PricesModule } from '../prices/prices.module';
import { SharedDeckMissingService } from '../sharing/shared-deck-missing.service';
import { ListAccess } from './list-access.service';
import { ListFromDeckService } from './list-from-deck.service';
import { ListLinesService } from './list-lines.service';
import { ListSaleService } from './list-sale.service';
import { ListViewService } from './list-view.service';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';

@Module({
  imports: [CollectionModule, PricesModule, TypeOrmModule.forFeature([TrackedDeckEntity, DeckCardEntity])],
  controllers: [ListsController],
  providers: [ListsService, ListLinesService, ListSaleService, ListAccess, ListViewService, ListFromDeckService, SharedDeckMissingService],
})
export class ListsModule {}
