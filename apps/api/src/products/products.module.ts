import { Module } from '@nestjs/common';
import { join } from 'path';
import { AuthModule } from '../auth/auth.module';
import { CollectionModule } from '../collection/collection.module';
import { RecommendationsCoreModule } from '../recommendations/recommendations-core.module';
import { PRODUCTS_DIR } from './product-file';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule, CollectionModule, RecommendationsCoreModule],
  controllers: [ProductsController],
  providers: [ProductsService, { provide: PRODUCTS_DIR, useValue: join(__dirname, 'data') }],
})
export class ProductsModule {}
