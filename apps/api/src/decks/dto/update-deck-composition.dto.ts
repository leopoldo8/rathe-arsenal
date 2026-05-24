import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateIf,
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

  /**
   * Hero identifier (catalog cardIdentifier). May be null when the deck was
   * imported from Fabrary before the T+5000 hero-backfill migration ran. The
   * service resolves null by looking up `deck.hero` (display name) in the
   * catalog at save time; if neither path produces a known hero, the save
   * fails with a clear 400 (HeroIdentifierExistsInCatalog).
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(64)
  @Validate(HeroIdentifierExistsInCatalog)
  heroIdentifier!: string | null;

  @IsIn(['Classic Constructed', 'Blitz', 'Living Legend', 'Silver Age'])
  format!: TSupportedFormat;
}
