import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Deprecation stub for the old re-solve endpoints. All three endpoints now
 * return 410 Gone with a structured payload pointing to the replacement routes.
 *
 * Kept so that open frontend tabs (or clients still on the old API surface)
 * receive a clear 410 instead of a 500 or 404 — tab-safety during the
 * single-commit atomic deploy.
 *
 * Delete this file in Plan C once the deprecation window is closed.
 */
@Controller('decks/:deckId')
export class ReSolveController {
  private readonly deprecationPayload = {
    code: 'DEPRECATED' as const,
    migration: 'use /api/decks/:trackedDeckId/decisions',
  };

  @Post('reject-substitute')
  @HttpCode(HttpStatus.GONE)
  rejectSubstitute(
    @Param('deckId', ParseIntPipe) _deckId: number,
    @Res() res: Response,
  ): void {
    res.status(HttpStatus.GONE).json(this.deprecationPayload);
  }

  @Post('reset-rejections')
  @HttpCode(HttpStatus.GONE)
  resetRejections(
    @Param('deckId', ParseIntPipe) _deckId: number,
    @Res() res: Response,
  ): void {
    res.status(HttpStatus.GONE).json(this.deprecationPayload);
  }

  @Post('re-solve')
  @HttpCode(HttpStatus.GONE)
  reSolve(
    @Param('deckId', ParseIntPipe) _deckId: number,
    @Res() res: Response,
  ): void {
    res.status(HttpStatus.GONE).json(this.deprecationPayload);
  }
}
