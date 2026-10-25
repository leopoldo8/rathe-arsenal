import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardArtBlockEntity } from '../../database/entities/card-art-block.entity';
import { CardListLineEntity } from '../../database/entities/card-list-line.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { ShareImageEntity } from '../../database/entities/share-image.entity';
import { CollectionModule } from '../../collection/collection.module';
import { DecksModule } from '../../decks/decks.module';
import { SharedDeckMissingService } from '../shared-deck-missing.service';
import { SharedGroupAskService } from '../shared-group-ask.service';
import { SharingCoreModule } from '../sharing-core.module';
import { CardFaceFetcher } from './card-face-fetcher';
import { ShareHtmlController } from './share-html.controller';
import { ShareImageController, ShareListImageController } from './share-image.controller';
import { ShareImageService } from './share-image.service';
import { SharePreviewStore } from './share-preview.store';
import { DEFAULT_SPA_INDEX_PATH, SPA_INDEX_HTML, SpaIndexHtml } from './spa-index-html';

@Module({
  imports: [
    SharingCoreModule,
    CollectionModule,
    DecksModule,
    TypeOrmModule.forFeature([DeckCardEntity, CardListLineEntity, ShareImageEntity, CardArtBlockEntity]),
  ],
  controllers: [ShareHtmlController, ShareImageController, ShareListImageController],
  providers: [
    { provide: SPA_INDEX_HTML, useValue: DEFAULT_SPA_INDEX_PATH },
    SpaIndexHtml,
    SharePreviewStore,
    SharedDeckMissingService,
    SharedGroupAskService,
    CardFaceFetcher,
    ShareImageService,
  ],
  exports: [SharedDeckMissingService, SharedGroupAskService],
})
export class SharePreviewModule {}
