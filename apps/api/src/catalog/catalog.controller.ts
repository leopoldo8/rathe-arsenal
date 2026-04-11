import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CatalogService } from './catalog.service';
import {
  ISearchCardsResponse,
  SearchCardsDto,
} from './dtos/search-cards.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // Unit 1: 30 req/min per IP on the autocomplete endpoint. Tight-but-lenient
  // budget that comfortably covers interactive typing while blocking scraping.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('search')
  async search(
    @Query() dto: SearchCardsDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISearchCardsResponse> {
    return this.catalogService.search(user.userId, dto.q, dto.limit);
  }
}
