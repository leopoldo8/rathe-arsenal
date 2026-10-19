import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardArtBlockEntity } from '../../database/entities/card-art-block.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { ShareImageEntity } from '../../database/entities/share-image.entity';
import { SharingCoreModule } from '../sharing-core.module';
import { CardFaceFetcher } from './card-face-fetcher';
import { ShareHtmlController } from './share-html.controller';
import { ShareImageController } from './share-image.controller';
import { ShareImageService } from './share-image.service';
import { SharePreviewStore } from './share-preview.store';
import { DEFAULT_SPA_INDEX_PATH, SPA_INDEX_HTML, SpaIndexHtml } from './spa-index-html';

@Module({
  imports: [
    SharingCoreModule,
    TypeOrmModule.forFeature([DeckCardEntity, ShareImageEntity, CardArtBlockEntity]),
  ],
  controllers: [ShareHtmlController, ShareImageController],
  providers: [
    { provide: SPA_INDEX_HTML, useValue: DEFAULT_SPA_INDEX_PATH },
    SpaIndexHtml,
    SharePreviewStore,
    CardFaceFetcher,
    ShareImageService,
  ],
  exports: [SharePreviewStore],
})
export class SharePreviewModule {}
