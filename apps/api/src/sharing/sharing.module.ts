import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CollectionModule } from '../collection/collection.module';
import { CardListLineEntity } from '../database/entities/card-list-line.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { SubstitutionModule } from '../substitution/substitution.module';
import { DeckShareController } from './deck-share.controller';
import { DeckShareService } from './deck-share.service';
import { ListShareController } from './list-share.controller';
import { ListShareService } from './list-share.service';
import { SharePreviewModule } from './preview/share-preview.module';
import { noIndexMiddleware } from './no-index.middleware';
import { SharedDeckCopyService } from './shared-deck-copy.service';
import { SharedDeckReplacements } from './shared-deck-replacements';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { SharedDeckViewService } from './shared-deck-view.service';
import { SharedDecksController } from './shared-decks.controller';
import { SharedListViewService } from './shared-list-view.service';
import { SharedListsController } from './shared-lists.controller';
import { SharingCoreModule } from './sharing-core.module';
import { VisitorDecksMissingService } from './visitor-decks-missing.service';
import { VisitorWantListService } from './visitor-want-list.service';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [
    SharingCoreModule,
    SharePreviewModule,
    AuthModule,
    CollectionModule,
    SubstitutionModule,
    PricesModule,
    TypeOrmModule.forFeature([DeckCardEntity, CardListLineEntity, CardReplacementEntity]),
  ],
  controllers: [DeckShareController, SharedDecksController, ListShareController, SharedListsController],
  providers: [
    DeckShareService,
    SharedDeckViewService,
    SharedDeckCopyService,
    SharedDeckReplacements,
    ListShareService,
    SharedListViewService,
    VisitorDecksMissingService,
    VisitorWantListService,
  ],
})
export class SharingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(noIndexMiddleware)
      .forRoutes({ path: 'shared/{*splat}', method: RequestMethod.ALL });
  }
}
