import {
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/**
 * The five action values that control how an uploaded CSV is resolved.
 *
 * - `auto`     — parse + detect; returns 'created', 'exact-match', or 'partial-overlap'.
 * - `separate` — skip detection; always create a new source.
 * - `replace`  — cascade-delete the target source and create a new one. Requires `targetSourceId`.
 * - `update`   — keep the source id; diff and apply row changes. Requires `targetSourceId`.
 * - `cancel`   — no-op; used for UI modal symmetry.
 */
export const CSV_UPLOAD_ACTIONS = ['auto', 'separate', 'replace', 'update', 'cancel'] as const;
export type TCsvUploadAction = (typeof CSV_UPLOAD_ACTIONS)[number];

/**
 * Body fields parsed from a `multipart/form-data` request.
 * The `file` field is NOT part of this DTO — it is bound via `@UploadedFile()`.
 */
export class UploadCsvRequestDto {
  /**
   * How to resolve the upload against existing sources.
   * Defaults to `'auto'` when omitted (transform handled in the controller).
   */
  @IsOptional()
  @IsEnum(CSV_UPLOAD_ACTIONS)
  action?: TCsvUploadAction;

  /**
   * The source to replace or update. Required when `action='replace'` or
   * `action='update'`. Validated at the service layer (returns 400
   * `MISSING_TARGET_SOURCE` if absent when required).
   */
  @IsOptional()
  @ValidateIf((o: UploadCsvRequestDto) => o.targetSourceId !== undefined)
  @IsUUID()
  targetSourceId?: string;
}
