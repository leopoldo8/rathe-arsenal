import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { ITrackedDeckDetailSnapshot } from '../../decks/dtos/tracked-deck-detail.response.dto';

/** The most copies of one card the collection holds; the deck's own limit is checked against the deck. */
export const MAX_OWNED_TOTAL = 20;

export class SetOwnedRequestDto {
  @IsInt()
  @Min(1)
  deckId!: number;

  @IsString()
  @IsNotEmpty()
  cardIdentifier!: string;

  @IsInt()
  @Min(0)
  @Max(MAX_OWNED_TOTAL)
  ownedTotal!: number;
}

export interface ISetOwnedResponse {
  readonly ownedTotal: number;
  readonly previousManualQuantity: number;
  readonly snapshot: ITrackedDeckDetailSnapshot;
}
