import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * A single card entry within the PUT /decks/:id composition body.
 *
 * `slot` is bounded to the four deck slots supported by the engine:
 * mainboard, equipment, weapon, hero.
 */
export class DeckCardInputDto {
  @IsString()
  @MaxLength(64)
  cardIdentifier!: string;

  @IsInt()
  @Min(1)
  @Max(4)
  quantity!: number;

  @IsIn(['mainboard', 'equipment', 'weapon', 'hero'])
  slot!: 'mainboard' | 'equipment' | 'weapon' | 'hero';
}
