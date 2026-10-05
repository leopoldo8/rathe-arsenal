import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const ALTERNATIVES_QUERY_MIN_LENGTH = 2;
export const ALTERNATIVES_QUERY_MAX_LENGTH = 50;

export class AlternativesQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  cardIdentifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  slot!: string;

  /** Name search; counted after trimming, so `"  a  "` is one character. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(ALTERNATIVES_QUERY_MIN_LENGTH)
  @MaxLength(ALTERNATIVES_QUERY_MAX_LENGTH)
  q?: string;
}
