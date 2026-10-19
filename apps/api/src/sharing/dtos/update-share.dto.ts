import { IsBoolean, IsIn } from 'class-validator';
import { DECK_SHARE_INTENTS, TDeckShareIntent } from '../../database/entities/share-link.entity';

export class EnableShareDto {
  @IsIn(DECK_SHARE_INTENTS)
  intent!: TDeckShareIntent;
}

export class UpdateShareDto {
  @IsBoolean()
  showContact!: boolean;
}
