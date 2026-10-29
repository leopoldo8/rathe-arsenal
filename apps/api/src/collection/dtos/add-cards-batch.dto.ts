import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EDITION_VALUES, FINISH_VALUES, ICopyVersion } from '../versions/copy-version';

export const MAX_BATCH_ITEMS = 200;
export const MAX_BATCH_ITEM_QUANTITY = 20;

export class AddCardsBatchItemDto {
  @IsString()
  cardIdentifier!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_BATCH_ITEM_QUANTITY)
  quantity!: number;

  /** The collector code a scan read; the version parts left out are "Não sei". */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  printingCode?: string;

  @IsOptional()
  @IsIn(EDITION_VALUES)
  edition?: ICopyVersion['edition'];

  @IsOptional()
  @IsIn(FINISH_VALUES)
  finish?: ICopyVersion['finish'];
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
