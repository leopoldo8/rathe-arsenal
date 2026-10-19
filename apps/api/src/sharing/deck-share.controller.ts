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
import { TDeckShareIntent } from '../database/entities/share-link.entity';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DeckShareService } from './deck-share.service';
import { IDeckShareState, ILinkState } from './dtos/share-state.dto';
import { EnableShareDto, UpdateShareDto } from './dtos/update-share.dto';
import { ParseDeckShareIntentPipe } from './parse-deck-share-intent.pipe';

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
  ): Promise<IDeckShareState> {
    return this.shares.getState(user.userId, deckId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async enable(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() dto: EnableShareDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ILinkState> {
    return this.shares.enable(user.userId, deckId, dto.intent);
  }

  @Patch(':intent')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async update(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Param('intent', ParseDeckShareIntentPipe) intent: TDeckShareIntent,
    @Body() dto: UpdateShareDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ILinkState> {
    return this.shares.setShowContact(user.userId, deckId, intent, dto.showContact);
  }

  @Delete(':intent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async disable(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Param('intent', ParseDeckShareIntentPipe) intent: TDeckShareIntent,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.shares.disable(user.userId, deckId, intent);
  }
}
