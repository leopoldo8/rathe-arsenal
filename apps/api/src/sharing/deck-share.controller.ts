import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DeckShareService } from './deck-share.service';
import { ICreatedShare, IShareState } from './dtos/share-state.dto';
import { UpdateShareDto } from './dtos/update-share.dto';

const MINUTE_MS = 60 * 1000;
const SHARE_TOGGLE_LIMIT = 30;

@Controller('decks/:deckId/share')
@UseGuards(OwnsTrackedDeckGuard)
export class DeckShareController {
  constructor(private readonly shares: DeckShareService) {}

  @Get()
  async get(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IShareState> {
    return this.shares.getState(user.userId, deckId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async enable(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ICreatedShare> {
    return this.shares.enable(user.userId, deckId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async update(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() dto: UpdateShareDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IShareState> {
    return this.shares.setShowContact(user.userId, deckId, dto.showContact);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async disable(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.shares.disable(user.userId, deckId);
  }
}
