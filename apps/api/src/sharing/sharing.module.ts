import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CollectionModule } from '../collection/collection.module';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { SubstitutionModule } from '../substitution/substitution.module';
import { DeckShareController } from './deck-share.controller';
import { DeckShareService } from './deck-share.service';
import { SharePreviewModule } from './preview/share-preview.module';
import { noIndexMiddleware } from './no-index.middleware';
import { SharedDeckCopyService } from './shared-deck-copy.service';
import { SharedDeckViewService } from './shared-deck-view.service';
import { SharedDecksController } from './shared-decks.controller';
import { SharingCoreModule } from './sharing-core.module';

@Module({
  imports: [
    SharingCoreModule,
    SharePreviewModule,
    AuthModule,
    CollectionModule,
    SubstitutionModule,
    TypeOrmModule.forFeature([DeckCardEntity]),
  ],
  controllers: [DeckShareController, SharedDecksController],
  providers: [DeckShareService, SharedDeckViewService, SharedDeckCopyService],
})
export class SharingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(noIndexMiddleware)
      .forRoutes({ path: 'shared/{*splat}', method: RequestMethod.ALL });
  }
}
