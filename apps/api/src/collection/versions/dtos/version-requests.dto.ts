import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CONDITION_VALUES, EDITION_VALUES, FINISH_VALUES, ICopyVersion } from '../copy-version';

/** A full version, every part present; `''` is "Não sei". */
export class CopyVersionDto implements ICopyVersion {
  @IsString()
  @MaxLength(32)
  printingCode!: string;

  @IsIn(EDITION_VALUES)
  edition!: ICopyVersion['edition'];

  @IsIn(FINISH_VALUES)
  finish!: ICopyVersion['finish'];

  @IsIn(CONDITION_VALUES)
  condition!: ICopyVersion['condition'];
}

/** Body of `PATCH /api/collection/sources/:id/versions`: the parts to mark, at least one filled. */
export class MarkSourceVersionsDto {
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

/** Body of `PATCH /api/collection/cards/:cardIdentifier/versions`. */
export class MoveCopiesDto {
  @ValidateNested()
  @Type(() => CopyVersionDto)
  from!: CopyVersionDto;

  @ValidateNested()
  @Type(() => CopyVersionDto)
  to!: CopyVersionDto;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export interface ICopiesByVersion extends ICopyVersion {
  readonly quantity: number;
}

export interface ICardCopiesResponse {
  readonly cardIdentifier: string;
  readonly versions: readonly ICopiesByVersion[];
}

export interface IMarkSourceVersionsResponse {
  readonly applied: number;
  readonly skipped: readonly string[];
}

export interface ISourceCopy extends ICopiesByVersion {
  readonly cardIdentifier: string;
  readonly name: string;
  /** 1 to 3, or null for a card with no pitch. */
  readonly pitch: number | null;
}

export interface ISourceCopiesResponse {
  readonly copies: number;
  readonly withoutVersion: number;
  readonly items: readonly ISourceCopy[];
}
