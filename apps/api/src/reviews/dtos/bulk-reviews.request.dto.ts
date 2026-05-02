import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
  registerDecorator,
  ValidationArguments,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Custom cross-field validator: exactly one of decision or reset must be set
// ---------------------------------------------------------------------------

/**
 * Class-validator decorator. Fails when BOTH `decision` and `reset` are
 * present on the parent object, preventing ambiguous "upsert and reset"
 * operations.
 *
 * Applied to the `reset` field. When `decision` is also defined, `reset`
 * is rejected. The "at least one must be present" rule is enforced by the
 * `@ValidateIf` on the `decision` field.
 */
function IsAbsentWhenDecisionPresent(): PropertyDecorator {
  return function (target: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isAbsentWhenDecisionPresent',
      target: (target as { constructor: new (...args: unknown[]) => unknown }).constructor,
      propertyName: String(propertyName),
      options: {
        message:
          '"reset" must be absent when "decision" is provided — an operation may have "decision" or "reset=true", not both',
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const obj = args.object as { decision?: string };
          // Fail only when decision is present AND reset is also set.
          return !(obj.decision !== undefined && value !== undefined);
        },
        defaultMessage(): string {
          return '"reset" must be absent when "decision" is provided';
        },
      },
    });
  };
}

/**
 * Represents a single operation in a bulk review request.
 *
 * Exactly one of `decision` or `reset` must be present:
 * - `decision`: upsert the decision for the card ('APPROVED' or 'REJECTED').
 * - `reset`: true to reset the card's decision to pending (delete the row).
 *
 * Validation rules enforced at the DTO layer:
 * - `decision` is required when `reset` is not `true` (via @ValidateIf).
 * - `reset` must be absent when `decision` is provided (via @IsAbsentWhenDecisionPresent).
 */
export class BulkReviewOperationDto {
  /**
   * The integer primary key of the tracked deck. Matches `TrackedDeckEntity.id`.
   */
  @IsInt({ message: 'trackedDeckId must be an integer' })
  @IsPositive({ message: 'trackedDeckId must be a positive integer' })
  @Type(() => Number)
  trackedDeckId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/^[\w\-:()'.,&\s]+$/, {
    message:
      'cardIdentifier contains invalid characters — only word characters, spaces, and common punctuation are allowed',
  })
  cardIdentifier!: string;

  /**
   * Present for upsert operations. Absent when `reset` is true.
   * Required when `reset` is not true (ValidateIf ensures it must be provided).
   */
  @ValidateIf((o: BulkReviewOperationDto) => o.reset !== true)
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'], {
    message: "decision must be 'APPROVED' or 'REJECTED'",
  })
  decision?: 'APPROVED' | 'REJECTED';

  /**
   * Present for reset operations. Must be exactly `true`.
   * Must be absent when `decision` is provided (IsAbsentWhenDecisionPresent enforces this).
   */
  @IsOptional()
  @IsBoolean()
  @IsAbsentWhenDecisionPresent()
  reset?: true;
}

/**
 * Request body for `POST /api/reviews/bulk`.
 *
 * Validation:
 * - `operations` must be a non-empty array.
 * - Requests exceeding 200 items are rejected at the controller layer with
 *   HTTP 413 `TOO_MANY_OPERATIONS` (not at the DTO layer, per plan §U6).
 */
export class BulkReviewsRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'operations must contain at least 1 item' })
  @ValidateNested({ each: true })
  @Type(() => BulkReviewOperationDto)
  operations!: BulkReviewOperationDto[];
}
