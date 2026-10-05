import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { REPLACEMENT_PICK_ORIGINS, TReplacementPickOrigin } from '../../database/entities/card-replacement.entity';

export class PickReplacementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  originalCardIdentifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  slot!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  replacementCardIdentifier!: string;

  @IsIn(REPLACEMENT_PICK_ORIGINS)
  pickedFrom!: TReplacementPickOrigin;
}
