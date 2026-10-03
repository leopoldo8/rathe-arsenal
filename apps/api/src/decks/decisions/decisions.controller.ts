import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SWAPS_MIGRATION_PAYLOAD } from '../../swaps/legacy-routes-gone';

/**
 * 410 Gone stubs for the retired `/api/decks/:trackedDeckId/decisions`
 * routes, kept so a stale browser tab gets a clear signal instead of a 404.
 */
@Controller('decks/:trackedDeckId/decisions')
export class DecisionsController {
  @Get()
  @HttpCode(HttpStatus.GONE)
  list(@Res() res: Response): void {
    res.status(HttpStatus.GONE).json(SWAPS_MIGRATION_PAYLOAD);
  }

  @Post()
  @HttpCode(HttpStatus.GONE)
  upsert(@Res() res: Response): void {
    res.status(HttpStatus.GONE).json(SWAPS_MIGRATION_PAYLOAD);
  }

  @Delete()
  @HttpCode(HttpStatus.GONE)
  clearRejections(@Res() res: Response): void {
    res.status(HttpStatus.GONE).json(SWAPS_MIGRATION_PAYLOAD);
  }

  @Delete(':cardIdentifier')
  @HttpCode(HttpStatus.GONE)
  resetOne(@Res() res: Response): void {
    res.status(HttpStatus.GONE).json(SWAPS_MIGRATION_PAYLOAD);
  }
}
