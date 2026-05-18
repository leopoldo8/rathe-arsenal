import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CatalogService } from './catalog.service';
import {
  ISearchCardsResponse,
  SearchCardsDto,
} from './dtos/search-cards.dto';
import { IHeroListResponse } from './dtos/hero-list-item.dto';

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

  // U17: Hero list for HeroDropdown — bounded set (~143 heroes, ~22KB JSON).
  // Covered by the existing 120 req/min IP global throttle; no additional
  // per-endpoint throttle needed since this is a cheap synchronous projection.
  @Get('heroes')
  getHeroes(): IHeroListResponse {
    return this.catalogService.listHeroes();
  }
}
