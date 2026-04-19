import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Card identifier validation: covers observed FaB identifier format
 * (letters, digits, spaces, and common punctuation). Rejects path-traversal
 * sequences, NUL bytes, and SQL-injection-style payloads.
 *
 * Max length of 128 matches the substitute_decision.cardIdentifier column.
 */
export class DecisionCardIdentifierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/^[\w\-:()'.,&\s]+$/, {
    message:
      'cardIdentifier contains invalid characters — only word characters, spaces, and common punctuation are allowed',
  })
  cardIdentifier!: string;
}

/**
 * Body DTO for POST /decks/:trackedDeckId/decisions.
 * `decision='pending'` is intentionally excluded: pending is implicit (no row).
 */
export class UpsertDecisionDto extends DecisionCardIdentifierDto {
  @IsString()
  @IsIn(['approved', 'rejected'], {
    message: "decision must be 'approved' or 'rejected'",
  })
  decision!: 'approved' | 'rejected';
}
