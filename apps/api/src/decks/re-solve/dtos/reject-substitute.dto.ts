import { IsString, MaxLength } from 'class-validator';
import { MAX_CARD_IDENTIFIER_LENGTH } from './re-solve.dto';

export class RejectSubstituteDto {
  @IsString()
  @MaxLength(MAX_CARD_IDENTIFIER_LENGTH)
  cardIdentifier!: string;
}
