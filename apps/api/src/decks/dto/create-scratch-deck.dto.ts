import { IsIn, IsString, MaxLength, Validate } from 'class-validator';
import { TSupportedFormat } from '@rathe-arsenal/engine';
import { HeroIdentifierExistsInCatalog } from '../validators/hero-identifier-exists.validator';

/**
 * Input DTO for `POST /decks` — creates an empty scratch deck with
 * `status='idea'` and `fabraryUlid=NULL`.
 *
 * Format is bounded to the four formats supported by the legality engine
 * (origin R24). Clash, Draft, Open, Sealed, and UltimatePitFight are
 * rejected at validation per the scope boundary in the plan.
 */
export class CreateScratchDeckDto {
  /** Catalog cardIdentifier for the hero (e.g. `'dorinthea-ironsong'`). */
  @IsString()
  @MaxLength(64)
  @Validate(HeroIdentifierExistsInCatalog)
  heroIdentifier!: string;

  /** Format the deck is built for. */
  @IsIn(['Classic Constructed', 'Blitz', 'Living Legend', 'Silver Age'])
  format!: TSupportedFormat;
}
