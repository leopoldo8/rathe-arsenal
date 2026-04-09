import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class ImportDecksRequestDto {
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  urls!: string[];

  @IsOptional()
  @IsBoolean()
  seedInventory?: boolean;
}
