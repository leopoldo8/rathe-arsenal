import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { ImportPendingLineEntity } from '../database/entities/import-pending-line.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { PricesModule } from '../prices/prices.module';
import { SubstitutionModule } from '../substitution/substitution.module';
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
import { CollectionVersionsService } from './versions/collection-versions.service';
import { CollectionVersionsController } from './versions/collection-versions.controller';
import { ImportsController } from './imports/imports.controller';
import { ImportsService } from './imports/imports.service';
import { ImportWriterService } from './imports/import-writer.service';
import { PendingService } from './imports/pending.service';
import { SpareController } from './spare/spare.controller';
import { SpareCopiesService } from './spare/spare-copies.service';
import { SpareViewService } from './spare/spare-view.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CsvSourceEntity,
      CollectionCardEntity,
      DeckCardEntity,
      DeckReadinessSnapshotEntity,
      TrackedDeckEntity,
      StoreStockEntity,
      ImportPendingLineEntity,
      UserEntity,
    ]),
    AuthModule,
    SubstitutionModule,
    FabraryModule,
    PricesModule,
  ],
  controllers: [
    CollectionController,
    CsvController,
    LibraryController,
    SourcesController,
    CollectionVersionsController,
    ImportsController,
    SpareController,
  ],
  providers: [
    CollectionService,
    CollectionReadService,
    SourcesService,
    CsvParserService,
    DuplicateDetectionService,
    CsvUploadService,
    LibraryService,
    FabraryImportService,
    CollectionVersionsService,
    ImportsService,
    ImportWriterService,
    PendingService,
    SpareCopiesService,
    SpareViewService,
  ],
  exports: [
    CollectionService,
    CollectionReadService,
    SourcesService,
    CsvParserService,
    DuplicateDetectionService,
    CsvUploadService,
    ImportWriterService,
    SpareCopiesService,
  ],
})
export class CollectionModule {}
