import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalCurrentUser } from '../auth/decorators/optional-current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ListVisitorEventDto } from './dtos/share-event.dto';
import { ISharedListMatches, ISharedListResponse } from './dtos/shared-list.dto';
import { SharedListViewService } from './shared-list-view.service';

const MINUTE_MS = 60 * 1000;
const PUBLIC_READ_LIMIT = 60;

@Controller('shared/lists')
export class SharedListsController {
  constructor(private readonly view: SharedListViewService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT, ttl: MINUTE_MS } })
  @Get(':token')
  async get(
    @Param('token') token: string,
    @OptionalCurrentUser() visitor: ICurrentUser | null,
  ): Promise<ISharedListResponse> {
    return this.view.view(token, visitor);
  }

  /** What a visitor did on the page (an offer, "Quero estas"): the kind only, never any content. */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT, ttl: MINUTE_MS } })
  @Post(':token/events')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordEvent(
    @Param('token') token: string,
    @Body() dto: ListVisitorEventDto,
    @OptionalCurrentUser() visitor: ICurrentUser | null,
  ): Promise<void> {
    await this.view.recordVisitorEvent(token, dto.kind, visitor);
  }

  @Throttle({ default: { limit: PUBLIC_READ_LIMIT, ttl: MINUTE_MS } })
  @Get(':token/matches')
  async matches(
    @Param('token') token: string,
    @CurrentUser() visitor: ICurrentUser,
  ): Promise<ISharedListMatches> {
    return this.view.matches(token, visitor.userId);
  }
}
