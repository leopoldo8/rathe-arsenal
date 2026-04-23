import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { AuthModule } from '../auth/auth.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { DecisionsModule } from '../decks/decisions/decisions.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionReadService } from './collection-read.service';
import { SourcesService } from './sources/sources.service';
import { CsvParserService } from './csv/csv-parser.service';
import { DuplicateDetectionService } from './csv/duplicate-detection.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CsvSourceEntity,
      CollectionCardEntity,
      DeckCardEntity,
      DeckReadinessSnapshotEntity,
      TrackedDeckEntity,
    ]),
    AuthModule,
    SubstitutionModule,
    DecisionsModule,
  ],
  controllers: [CollectionController],
  providers: [
    CollectionService,
    CollectionReadService,
    SourcesService,
    CsvParserService,
    DuplicateDetectionService,
  ],
  exports: [
    CollectionService,
    CollectionReadService,
    SourcesService,
    CsvParserService,
    DuplicateDetectionService,
  ],
})
export class CollectionModule {}
