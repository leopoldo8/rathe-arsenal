import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdoptRecommendationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  cutCardIdentifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  cutSlot!: string;
}
