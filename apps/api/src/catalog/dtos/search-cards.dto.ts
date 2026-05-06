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
}

export interface ISearchCardsResponse {
  readonly results: readonly ISearchCardResult[];
}
