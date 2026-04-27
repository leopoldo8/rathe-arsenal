import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CollectionService } from './collection.service';
import {
  AddCardRequestDto,
  IAddCardResponse,
} from './dtos/add-card.dto';
import {
  DecrementCardRequestDto,
  IDecrementCardResponse,
} from './dtos/decrement-card.dto';
import { MarkOwnedRequestDto } from './dtos/mark-owned.request.dto';
import { IMarkOwnedResponse } from './dtos/mark-owned.response.dto';

@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post('mark-owned')
  async markOwned(
    @Body() dto: MarkOwnedRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IMarkOwnedResponse> {
    return this.collectionService.markOwned(
      user.userId,
      dto.deckId,
      dto.cardIdentifier,
    );
  }

  @Post('cards')
  async addCard(
    @Body() dto: AddCardRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IAddCardResponse> {
    return this.collectionService.addCard(
      user.userId,
      dto.cardIdentifier,
      dto.quantity ?? 1,
    );
  }

  /**
   * Subtracts from a `(cardIdentifier, sourceId)` row in the user's
   * collection. Powers the hover `−` stepper on `/library`.
   */
  @Post('cards/decrement')
  async decrementCard(
    @Body() dto: DecrementCardRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IDecrementCardResponse> {
    return this.collectionService.decrementCardFromSource(
      user.userId,
      dto.cardIdentifier,
      dto.sourceId,
      dto.quantity ?? 1,
    );
  }
}
