import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { cardListNotFound } from './lists-errors';

const MAX_INT32 = 2_147_483_647;

/** An id past the int4 range can match no row; without this check it reaches Postgres as an overflow (500). */
@Injectable()
export class ParseInt32IdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^\d+$/.test(value)) throw new BadRequestException('Id must be an integer');
    const id = Number(value);
    if (id < 1 || id > MAX_INT32) throw cardListNotFound();
    return id;
  }
}
