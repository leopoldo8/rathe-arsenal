import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { AuthModule } from '../auth/auth.module';
import { SubstitutionModule } from '../substitution/substitution.module';
import { DecisionsModule } from '../decks/decisions/decisions.module';
import { FabraryModule } from '../fabrary/fabrary.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { CollectionReadService } from './collection-read.service';
import { SourcesService } from './sources/sources.service';
import { SourcesController } from './sources/sources.controller';
import { FabraryImportService } from './sources/fabrary-import.service';
import { CsvParserService } from './csv/csv-parser.service';
import { DuplicateDetectionService } from './csv/duplicate-detection.service';
import { CsvController } from './csv/csv.controller';
import { CsvUploadService } from './csv/csv-upload.service';
import { LibraryController } from './library/library.controller';
import { LibraryService } from './library/library.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CsvSourceEntity,
      CollectionCardEntity,
      DeckCardEntity,
      DeckReadinessSnapshotEntity,
      TrackedDeckEntity,
      StoreStockEntity,
    ]),
    AuthModule,
    SubstitutionModule,
    DecisionsModule,
    FabraryModule,
  ],
  controllers: [CollectionController, CsvController, LibraryController, SourcesController],
  providers: [
    CollectionService,
    CollectionReadService,
    SourcesService,
    CsvParserService,
    DuplicateDetectionService,
    CsvUploadService,
    LibraryService,
    FabraryImportService,
  ],
  exports: [
    CollectionService,
    CollectionReadService,
    SourcesService,
    CsvParserService,
    DuplicateDetectionService,
    CsvUploadService,
  ],
})
export class CollectionModule {}
