import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import {
  IImportProductResponse,
  IProductsResponse,
  ImportProductDto,
  SearchProductsQueryDto,
} from './dtos/product-requests.dto';
import { ProductsService } from './products.service';

/**
 * Routes:
 *   GET  /api/products?q=                       the ready-made decks that have a stored decklist
 *   POST /api/products/:productKey/import       their cards, their deck, or both
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async search(@Query() query: SearchProductsQueryDto): Promise<IProductsResponse> {
    return { products: await this.products.search(query.q) };
  }

  @Post(':productKey/import')
  importProduct(
    @Param('productKey') productKey: string,
    @Body() dto: ImportProductDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IImportProductResponse> {
    return this.products.importProduct(user.userId, productKey, dto);
  }
}
