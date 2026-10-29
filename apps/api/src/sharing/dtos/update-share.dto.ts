import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { DECK_SHARE_INTENTS, TDeckShareIntent } from '../../database/entities/share-link.entity';

export class EnableShareDto {
  @IsIn(DECK_SHARE_INTENTS)
  intent!: TDeckShareIntent;
}

export class UpdateShareDto {
  @IsBoolean()
  showContact!: boolean;
}

export class EnableListShareDto {
  @IsOptional()
  @IsIn(['want', 'sell'])
  intent?: 'want' | 'sell';
}
