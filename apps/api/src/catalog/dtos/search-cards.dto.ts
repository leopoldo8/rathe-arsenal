import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchCardsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

export interface ISearchCardResult {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly classes: readonly string[];
  readonly types: readonly string[];
  readonly ownedQuantity: number;
}

export interface ISearchCardsResponse {
  readonly results: readonly ISearchCardResult[];
}
