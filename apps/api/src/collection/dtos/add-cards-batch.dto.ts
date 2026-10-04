import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_BATCH_ITEMS = 200;
export const MAX_BATCH_ITEM_QUANTITY = 20;

export class AddCardsBatchItemDto {
  @IsString()
  cardIdentifier!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_BATCH_ITEM_QUANTITY)
  quantity!: number;
}

export class AddCardsBatchRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AddCardsBatchItemDto)
  items!: AddCardsBatchItemDto[];
}

export interface IAddCardsBatchResult {
  readonly cardIdentifier: string;
  readonly newQuantity: number;
  readonly capped: boolean;
}

export interface IAddCardsBatchResponse {
  readonly results: readonly IAddCardsBatchResult[];
  readonly recomputedDeckCount: number;
}
