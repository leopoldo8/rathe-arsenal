import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ImportDecksRequestDto {
  /** Any text that holds a Fabrary deck link: the link alone, or a whole pasted message. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;

  /**
   * Whether the player owns the deck's cards. Required, with no default: a friend's deck must never
   * fill the importer's collection without an answer.
   */
  // The raw value: implicit conversion would turn the text 'yes' into true, an answer nobody gave.
  @Transform(({ obj }) => (obj as { ownsCards?: unknown }).ownsCards)
  @IsBoolean()
  ownsCards!: boolean;
}

export class PreviewDeckRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text!: string;
}
