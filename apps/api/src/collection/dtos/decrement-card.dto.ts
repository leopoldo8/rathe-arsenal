import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CONDITION_VALUES,
  EDITION_VALUES,
  FINISH_VALUES,
  ICopyVersion,
} from '../versions/copy-version';

/**
 * Body for `POST /api/collection/cards/decrement`. Subtracts `quantity`
 * (default 1) from the user's `(cardIdentifier, sourceId)` row in
 * `collection_card`. The source is preserved — only the per-card row's
 * quantity is mutated, dropping to 0 and being deleted when fully
 * decremented.
 */
export class DecrementCardRequestDto {
  @IsString()
  cardIdentifier!: string;

  /**
   * Optional only for a card held in one import at one version, the one row there is to take from;
   * with copies in more than one import or version the answer is 400.
   */
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  /** The version of the row to take from; parts left out are "Não sei". */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  printingCode?: string;

  @IsOptional()
  @IsIn(EDITION_VALUES)
  edition?: ICopyVersion['edition'];

  @IsOptional()
  @IsIn(FINISH_VALUES)
  finish?: ICopyVersion['finish'];

  @IsOptional()
  @IsIn(CONDITION_VALUES)
  condition?: ICopyVersion['condition'];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;
}

export interface IDecrementCardResponse {
  readonly cardIdentifier: string;
  readonly sourceId: string;
  /** Quantity remaining on the row after the decrement. 0 means deleted. */
  readonly newQuantity: number;
  /** True when the row was deleted because quantity reached 0. */
  readonly removed: boolean;
  readonly recomputedDecks: ReadonlyArray<{
    readonly trackedDeckId: number;
    readonly rawPercent: number;
    readonly effectivePercent: number;
  }>;
}
