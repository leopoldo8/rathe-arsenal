import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalCurrentUser } from '../auth/decorators/optional-current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ISharedDeckCoverage, ISharedDeckMatches, ISharedDeckResponse } from './dtos/shared-deck.dto';
import { SharedDeckCopyService } from './shared-deck-copy.service';
import { SharedDeckViewService } from './shared-deck-view.service';

const MINUTE_MS = 60 * 1000;
const PUBLIC_READ_LIMIT = 60;
const COPY_LIMIT = 10;

@Controller('shared/decks')
export class SharedDecksController {
  constructor(
    private readonly view: SharedDeckViewService,
    private readonly copyService: SharedDeckCopyService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT, ttl: MINUTE_MS } })
  @Get(':token')
  async get(
    @Param('token') token: string,
    @OptionalCurrentUser() visitor: ICurrentUser | null,
  ): Promise<ISharedDeckResponse> {
    return this.view.view(token, visitor);
  }

  @Throttle({ default: { limit: PUBLIC_READ_LIMIT, ttl: MINUTE_MS } })
  @Get(':token/coverage')
  async coverage(
    @Param('token') token: string,
    @CurrentUser() visitor: ICurrentUser,
  ): Promise<ISharedDeckCoverage> {
    return this.view.coverage(token, visitor.userId);
  }

  @Throttle({ default: { limit: PUBLIC_READ_LIMIT, ttl: MINUTE_MS } })
  @Get(':token/matches')
  async matches(
    @Param('token') token: string,
    @CurrentUser() visitor: ICurrentUser,
  ): Promise<ISharedDeckMatches> {
    return this.view.matches(token, visitor.userId);
  }

  @Post(':token/copy')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: COPY_LIMIT, ttl: MINUTE_MS } })
  async copy(
    @Param('token') token: string,
    @CurrentUser() visitor: ICurrentUser,
  ): Promise<{ deckId: number }> {
    return this.copyService.copy(token, visitor.userId);
  }
}
