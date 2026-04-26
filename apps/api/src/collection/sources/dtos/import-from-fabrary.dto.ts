import { IsString, IsUrl } from 'class-validator';

export class ImportFromFabraryDto {
  /** Public Fabrary deck URL — `https://fabrary.net/decks/<ULID>`. */
  @IsString()
  @IsUrl({ require_protocol: true })
  url!: string;
}
