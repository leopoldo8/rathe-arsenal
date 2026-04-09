import { IsInt, IsString, Min } from 'class-validator';

export class MarkOwnedRequestDto {
  @IsInt()
  @Min(1)
  deckId!: number;

  @IsString()
  cardIdentifier!: string;
}
