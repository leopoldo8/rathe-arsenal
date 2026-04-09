import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DecksService } from './decks.service';
import { TTrackedDeckListResponse } from './dtos/tracked-deck-list.response.dto';

@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Get()
  async list(
    @CurrentUser() user: ICurrentUser,
  ): Promise<TTrackedDeckListResponse> {
    return this.decksService.listForUser(user.userId);
  }

  @Delete(':deckId')
  @UseGuards(OwnsTrackedDeckGuard)
  async untrack(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.decksService.untrack(user.userId, deckId);
  }
}
