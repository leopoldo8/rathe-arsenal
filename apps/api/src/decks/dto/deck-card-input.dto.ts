import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, Validate } from 'class-validator';
import { DeckLineHoldsACopy } from '../validators/deck-card-rows.validator';

/**
 * A single card entry within the PUT /decks/:id composition body.
 *
 * `slot` is bounded to the four deck slots supported by the engine:
 * mainboard, equipment, weapon, hero.
 *
 * `quantity` counts the copies in the starting deck and `inventoryQuantity` the copies carried
 * outside it; a line may hold only inventory copies, so `quantity` can be 0 when the inventory is not.
 */
export class DeckCardInputDto {
  @IsString()
  @MaxLength(64)
  cardIdentifier!: string;

  @IsInt()
  @Min(0)
  @Max(4)
  @Validate(DeckLineHoldsACopy)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  inventoryQuantity?: number;

  @IsIn(['mainboard', 'equipment', 'weapon', 'hero'])
  slot!: 'mainboard' | 'equipment' | 'weapon' | 'hero';
}
