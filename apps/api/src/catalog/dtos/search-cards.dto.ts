import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchCardsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export interface ISearchCardResult {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly classes: readonly string[];
  readonly types: readonly string[];
  readonly ownedQuantity: number;
  /**
   * LSS S3 image URLs for the card face (small + large WebP). Null when the
   * source catalog entry has no image code. Frontend renders the small URL
   * as a 52x72 row thumbnail; click opens the large URL in a fullscreen
   * lightbox. The `sources` mirror list from the catalog entry is dropped
   * here — the autocomplete falls back to <CardArt> on load failure rather
   * than cycling alternative URLs.
   */
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  /**
   * Formats in which this card is tournament-legal (from the engine catalog).
   * Serialized as plain strings so the web client stays engine-free.
   * Always present — empty array when no legal formats.
   */
  readonly legalFormats: readonly string[];
  /**
   * Hero identifiers for which this card is legal (hero-scope rule).
   * Empty array when the card has no hero restriction (legal for any hero).
   */
  readonly legalHeroes: readonly string[];
  /**
   * Formats from which this card is explicitly banned.
   * Always present — empty array when the card is not banned in any format.
   */
  readonly bannedFormats: readonly string[];
}

export interface ISearchCardsResponse {
  readonly results: readonly ISearchCardResult[];
}
