import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CONDITIONS, TCondition } from '../../database/entities/card-list-line.entity';
import { LIST_KINDS, TListKind } from '../../database/entities/card-list.entity';

const MAX_INT32 = 2_147_483_647;
const MAX_MULTIPLIER = 50;
const NAME_MAX = 80;
const NOTES_MAX = 1000;
const MAX_LINE_QUANTITY = 20;

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateListDto {
  @IsIn(LIST_KINDS)
  kind!: TListKind;

  @Transform(trim)
  @IsString()
  @Length(1, NAME_MAX)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  fromDeckId?: number;
}

export class UpdateListDto {
  @ValidateIf((dto: UpdateListDto) => dto.name !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, NAME_MAX)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX)
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  totalPriceCents?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MULTIPLIER)
  priceMultiplier?: number | null;
}

export class AddLineDto {
  @IsString()
  @IsNotEmpty()
  cardIdentifier!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  printing?: string | null;

  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: TCondition | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  priceCents?: number | null;
}

export class UpdateLineDto {
  @ValidateIf((dto: UpdateLineDto) => dto.quantity !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity?: number;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  printing?: string | null;

  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: TCondition | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  priceCents?: number | null;

  @ValidateIf((dto: UpdateLineDto) => dto.sold !== undefined)
  @IsBoolean()
  sold?: boolean;
}
