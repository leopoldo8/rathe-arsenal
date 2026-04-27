import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

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

  @IsUUID()
  sourceId!: string;

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
