import { HttpException, HttpStatus } from '@nestjs/common';

export type TListsErrorCode =
  | 'CARD_LIST_NOT_FOUND'
  | 'DECK_NOT_FOUND'
  | 'SELL_ONLY_FIELD'
  | 'UNKNOWN_CARD'
  | 'UNKNOWN_PRINTING';

function listsError(code: TListsErrorCode, message: string, status: HttpStatus): HttpException {
  return new HttpException({ code, message }, status);
}

export function cardListNotFound(): HttpException {
  return listsError('CARD_LIST_NOT_FOUND', 'Card list not found', HttpStatus.NOT_FOUND);
}

export function deckNotFound(): HttpException {
  return listsError('DECK_NOT_FOUND', 'Deck not found', HttpStatus.NOT_FOUND);
}

export function sellOnlyField(): HttpException {
  return listsError('SELL_ONLY_FIELD', 'This field exists only on sell lists', HttpStatus.BAD_REQUEST);
}

export function unknownCard(): HttpException {
  return listsError('UNKNOWN_CARD', 'Unknown card', HttpStatus.BAD_REQUEST);
}

export function unknownPrinting(): HttpException {
  return listsError('UNKNOWN_PRINTING', 'That printing does not belong to this card', HttpStatus.BAD_REQUEST);
}
