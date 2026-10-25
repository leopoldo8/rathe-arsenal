import { HttpException, HttpStatus } from '@nestjs/common';

export type TListsErrorCode =
  | 'CARD_LIST_NOT_FOUND'
  | 'DECK_NOT_FOUND'
  | 'LINE_ALREADY_SOLD'
  | 'LINE_NOT_SOLD'
  | 'RESTORE_NOT_FROM_SALE'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_REQUIRED'
  | 'SOLD_QUANTITY_TOO_HIGH'
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

export function lineAlreadySold(): HttpException {
  return listsError('LINE_ALREADY_SOLD', 'This line is already sold', HttpStatus.CONFLICT);
}

export function lineNotSold(): HttpException {
  return listsError('LINE_NOT_SOLD', 'This line is not sold', HttpStatus.CONFLICT);
}

export function sourceNotFound(): HttpException {
  return listsError('SOURCE_NOT_FOUND', 'Import not found', HttpStatus.NOT_FOUND);
}

export function sourceRequired(): HttpException {
  return listsError('SOURCE_REQUIRED', 'The card sits in more than one import: name the import', HttpStatus.BAD_REQUEST);
}

export function soldQuantityTooHigh(): HttpException {
  return listsError('SOLD_QUANTITY_TOO_HIGH', 'The line holds fewer copies than the sale names', HttpStatus.BAD_REQUEST);
}

export function restoreNotFromSale(): HttpException {
  return listsError('RESTORE_NOT_FROM_SALE', 'Only copies of the version the line was sold at, or with no version, can be put back', HttpStatus.BAD_REQUEST);
}
