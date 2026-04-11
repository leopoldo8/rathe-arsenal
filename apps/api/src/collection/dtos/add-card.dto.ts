import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddCardRequestDto {
  @IsString()
  cardIdentifier!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;
}

export interface IAddCardRecomputedDeck {
  readonly trackedDeckId: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
}

export interface IAddCardResponse {
  readonly cardIdentifier: string;
  readonly newQuantity: number;
  readonly recomputedDecks: readonly IAddCardRecomputedDeck[];
}
