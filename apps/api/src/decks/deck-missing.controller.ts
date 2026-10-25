import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DeckMissingService, IDeckMissingResponse } from './deck-missing.service';

@Controller('decks/:deckId')
export class DeckMissingController {
  constructor(private readonly deckMissing: DeckMissingService) {}

  @Get('missing')
  @UseGuards(OwnsTrackedDeckGuard)
  async missing(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IDeckMissingResponse> {
    return this.deckMissing.missingFor(user.userId, deckId);
  }
}
