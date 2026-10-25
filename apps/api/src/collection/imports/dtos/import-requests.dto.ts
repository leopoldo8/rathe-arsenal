import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IMPORT_KINDS, TImportKind } from '../../../database/entities/csv-source.entity';
import { PENDING_REASONS, TPendingReason } from '../../../database/entities/import-pending-line.entity';
import { CONDITION_VALUES, EDITION_VALUES, FINISH_VALUES, ICopyVersion } from '../../versions/copy-version';
import { MAX_IMPORT_ROWS } from '../../reader/import-table';

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_QUANTITY = 20;

/** Body of `POST /api/collection/imports/read` when the text is pasted rather than uploaded. */
export class ReadImportDto {
  @IsOptional()
  @IsString()
  text?: string;
}

/** The parts of a version a request names; the rest stay "Não sei". */
export class VersionPartsDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  printingCode?: string;

  @IsOptional()
  @IsIn(EDITION_VALUES)
  edition?: ICopyVersion['edition'];

  @IsOptional()
  @IsIn(FINISH_VALUES)
  finish?: ICopyVersion['finish'];

  @IsOptional()
  @IsIn(CONDITION_VALUES)
  condition?: ICopyVersion['condition'];
}

export class ReadyLineDto extends VersionPartsDto {
  @IsString()
  @MaxLength(200)
  cardIdentifier!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_IMPORT_QUANTITY)
  quantity!: number;
}

export class PendingLineDto {
  @IsInt()
  @Min(1)
  lineNumber!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  originalText!: string;

  @IsIn(PENDING_REASONS)
  reason!: TPendingReason;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  suggestedCardIdentifier?: string;
}

/** Body of `POST /api/collection/imports`. */
export class CreateImportDto {
  @IsIn(IMPORT_KINDS)
  kind!: TImportKind;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ReadyLineDto)
  ready!: ReadyLineDto[];

  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => PendingLineDto)
  pending!: PendingLineDto[];

  /** Applied to ready lines that carry no version of their own ("Sem foil · NM"). */
  @IsOptional()
  @ValidateNested()
  @Type(() => VersionPartsDto)
  defaultVersion?: VersionPartsDto;

  /** The file's name, kept as the import's original filename. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  /** Sent after the player agreed to add a file that was already imported. */
  @IsOptional()
  @IsIn(['separate'])
  duplicateStrategy?: 'separate';
}

/** Body of `PATCH /api/collection/pending/:id`. */
export class ResolvePendingDto extends VersionPartsDto {
  @IsString()
  @MaxLength(200)
  cardIdentifier!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_IMPORT_QUANTITY)
  quantity!: number;
}

export interface IImportedSource {
  readonly id: string;
  readonly kind: TImportKind;
  readonly label: string;
  readonly cardCount: number;
  readonly copies: number;
}

export interface ICreateImportResponse {
  readonly source: IImportedSource;
  readonly pendingCount: number;
}
