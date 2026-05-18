import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * DTO for POST /tags.
 *
 * Only `name` is accepted from the request body.
 * `userId` is always derived from the JWT via @CurrentUser(), never from the body.
 *
 * Validation rules (R5):
 * - @IsString() — must be a string
 * - @MaxLength(24) — max 24 characters (matches the deck_tag.name varchar(24) column)
 * - @Matches regex — accent-friendly unicode letters/digits + a safe punctuation
 *   subset; rejects HTML-injection characters like < > & etc.
 */
export class CreateTagDto {
  @IsString()
  @MaxLength(24)
  @Matches(/^[\p{L}\p{N}\s\-_.,!?]+$/u, {
    message: 'name may only contain letters, numbers, spaces, and - _ . , ! ?',
  })
  name!: string;
}
