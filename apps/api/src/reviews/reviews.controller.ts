import { Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SWAPS_MIGRATION_PAYLOAD } from '../swaps/legacy-routes-gone';

/**
 * 410 Gone stubs for the retired `/api/reviews` routes, kept so a stale
 * browser tab gets a clear signal instead of a 404. Delete once no client
 * on the old API surface can still be open.
 */
@Controller('reviews')
export class ReviewsController {
  @Get()
  @HttpCode(HttpStatus.GONE)
  list(@Res() res: Response): void {
    res.status(HttpStatus.GONE).json(SWAPS_MIGRATION_PAYLOAD);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.GONE)
  bulk(@Res() res: Response): void {
    res.status(HttpStatus.GONE).json(SWAPS_MIGRATION_PAYLOAD);
  }
}
