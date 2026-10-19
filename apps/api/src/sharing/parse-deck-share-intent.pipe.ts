import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { DECK_SHARE_INTENTS, TDeckShareIntent } from '../database/entities/share-link.entity';

@Injectable()
export class ParseDeckShareIntentPipe implements PipeTransform<string, TDeckShareIntent> {
  transform(value: string): TDeckShareIntent {
    const intent = DECK_SHARE_INTENTS.find((candidate) => candidate === value);
    if (!intent) throw new BadRequestException('Unknown share intent');
    return intent;
  }
}
