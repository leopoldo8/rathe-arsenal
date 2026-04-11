import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CatalogService } from './catalog.service';
import {
  ISearchCardsResponse,
  SearchCardsDto,
} from './dtos/search-cards.dto';

// TODO(U1): apply @Throttle({ default: { limit: 30, ttl: 60_000 } }) once
// @nestjs/throttler lands. Target is 30 req/min/user on this endpoint.
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('search')
  async search(
    @Query() dto: SearchCardsDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISearchCardsResponse> {
    return this.catalogService.search(user.userId, dto.q, dto.limit);
  }
}
