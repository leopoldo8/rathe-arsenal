import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

export const SHARE_CLOSING_LINE_MAX_LENGTH = 140;

export class UpdateShareClosingLineDto {
  // The raw value, so implicit conversion cannot turn a number into text.
  @Transform(({ obj }: { obj: { text?: unknown } }) => obj.text)
  @IsString()
  @MaxLength(SHARE_CLOSING_LINE_MAX_LENGTH)
  text!: string;
}
