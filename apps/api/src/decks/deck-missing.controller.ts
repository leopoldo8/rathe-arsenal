import { Controller, Get, Logger, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { copiesPerStoreState, DeckMissingService, IDeckMissingResponse } from './deck-missing.service';

@Controller('decks/:deckId')
export class DeckMissingController {
  private readonly logger = new Logger(DeckMissingController.name);

  constructor(private readonly deckMissing: DeckMissingService) {}

  @Get('missing')
  @UseGuards(OwnsTrackedDeckGuard)
  async missing(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IDeckMissingResponse> {
    const answer = await this.deckMissing.missingFor(user.userId, deckId);
    // Only the owner's list is counted: the public pages read the same service without passing through here.
    this.logger.log({ event: 'missing.served', deckId, copies: copiesPerStoreState(answer.lines) });
    return answer;
  }
}
