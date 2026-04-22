import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvSourceEntity } from '../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { CollectionReadService } from '../collection/collection-read.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CsvSourceEntity, CollectionCardEntity])],
  controllers: [CatalogController],
  providers: [CollectionReadService, CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
