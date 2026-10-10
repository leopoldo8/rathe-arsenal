import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DismissRecommendationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  cardIdentifier!: string;
}
