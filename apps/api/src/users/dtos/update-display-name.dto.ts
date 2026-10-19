import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;

export class UpdateDisplayNameDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(DISPLAY_NAME_MIN_LENGTH, DISPLAY_NAME_MAX_LENGTH)
  displayName!: string;
}
