import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TSupportedFormat } from '@rathe-arsenal/engine';

export const DECK_NOTES_MAX_LENGTH = 2000;

/**
 * Input DTO for `PATCH /decks/:deckId` — partially updates deck metadata.
 *
 * All fields are optional and independent. Missing fields are left unchanged.
 * The request is valid even when the body is empty (no-op update).
 *
 * Constraints:
 * - `status` must be one of the five lifecycle labels; 'archived' and other
 *   values are rejected by class-validator before reaching the service.
 * - `name` is capped at 120 characters — chosen to fit typical deck names
 *   plus annotation room. `TrackedDeckEntity.name` has no DB-level length
 *   constraint, so this DTO is the sole enforcement layer.
 * - `format` is metadata only: changing it never touches the card list.
 * - `notes` is free text capped at 2000 characters; `null` clears it.
 * - `addTagIds` / `removeTagIds` are bounded at 50 per request to prevent
 *   accidental bulk operations from a buggy client.
 */
export class UpdateDeckMetaDto {
  @IsOptional()
  @IsIn(['idea', 'building', 'ready', 'active', 'retired'])
  status?: 'idea' | 'building' | 'ready' | 'active' | 'retired';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(['Classic Constructed', 'Blitz', 'Living Legend', 'Silver Age'])
  format?: TSupportedFormat;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(DECK_NOTES_MAX_LENGTH)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  addTagIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  removeTagIds?: number[];
}
