import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TSupportedFormat } from '@rathe-arsenal/engine';
import { HeroIdentifierExistsInCatalog } from '../validators/hero-identifier-exists.validator';
import { DeckCardInputDto } from './deck-card-input.dto';

/**
 * Input DTO for `PUT /decks/:id` — atomically replaces a deck's composition.
 *
 * The three fields together define the full deck state:
 * - `cards`: full card list (delete-insert replacement inside the transaction).
 * - `heroIdentifier`: catalog cardIdentifier for the hero.
 * - `format`: format the deck is built for (bounded to four supported formats per R24).
 *
 * Bounded at 150 cards per @ArrayMaxSize to guard against excessively large payloads
 * at the DTO layer (the HTTP body-size limit is the first line of defence).
 */
export class UpdateDeckCompositionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(150)
  @Type(() => DeckCardInputDto)
  cards!: DeckCardInputDto[];

  @IsString()
  @MaxLength(64)
  @Validate(HeroIdentifierExistsInCatalog)
  heroIdentifier!: string;

  @IsIn(['Classic Constructed', 'Blitz', 'Living Legend', 'Silver Age'])
  format!: TSupportedFormat;
}
