import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/**
 * Maximum number of cards a user can exclude in a single re-solve
 * dry-run request. Prevents CPU exhaustion via massive exclusion
 * arrays; the realistic upper bound for any FaB deck is well under
 * this limit.
 */
export const MAX_EXCLUSIONS = 100;

/**
 * Maximum length of a card identifier string. Matches the varchar(100)
 * column on `rejected_substitute.cardIdentifier`.
 */
export const MAX_CARD_IDENTIFIER_LENGTH = 100;

export class ReSolveDto {
  @IsArray()
  @ArrayMaxSize(MAX_EXCLUSIONS)
  @IsString({ each: true })
  @MaxLength(MAX_CARD_IDENTIFIER_LENGTH, { each: true })
  excludedCardIdentifiers!: string[];
}
