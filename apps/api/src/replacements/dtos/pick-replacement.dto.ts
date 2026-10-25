import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import {
  REPLACEMENT_PICK_ORIGINS,
  REPLACEMENT_SIDES,
  TReplacementPickOrigin,
  TReplacementSide,
} from '../../database/entities/card-replacement.entity';

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

  /** Copies to move, 1 to the copies still needed; omitted, every copy still needed. */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  /** Which side of the deck the copies come from; omitted, the deck. */
  @IsOptional()
  @IsIn(REPLACEMENT_SIDES)
  side?: TReplacementSide;
}
