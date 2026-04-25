import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Request body for `PATCH /api/collection/sources/:id`.
 * Both fields are optional; sending either or both is valid.
 */
export class PatchSourceDto {
  /**
   * Set to `false` to deactivate this source (exclude its cards from
   * library totals and readiness computations).
   */
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /**
   * Human-readable label. Must be non-empty when supplied.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;
}
