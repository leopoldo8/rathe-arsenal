import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionCardEntity } from '../database/entities/collection-card.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CollectionCardEntity])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
