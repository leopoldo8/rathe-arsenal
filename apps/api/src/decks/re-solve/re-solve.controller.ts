import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { RejectSubstituteDto } from './dtos/reject-substitute.dto';
import { ReSolveDto } from './dtos/re-solve.dto';
import { IReSolveResult, ReSolveService } from './re-solve.service';

// TODO(U1): apply @Throttle() once @nestjs/throttler lands in U1.
@Controller('decks/:deckId')
export class ReSolveController {
  constructor(private readonly reSolveService: ReSolveService) {}

  /**
   * Reject a single substitute and persist the rejection. Returns the
   * updated readiness snapshot with the rejection applied.
   */
  @Post('reject-substitute')
  @HttpCode(HttpStatus.OK)
  async rejectSubstitute(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() body: RejectSubstituteDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IReSolveResult> {
    return this.reSolveService.rejectSubstitute(
      user.userId,
      deckId,
      body.cardIdentifier,
    );
  }

  /**
   * Delete all persisted rejections for the deck and return a fresh
   * no-exclusion readiness snapshot.
   */
  @Post('reset-rejections')
  @HttpCode(HttpStatus.OK)
  async resetRejections(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IReSolveResult> {
    return this.reSolveService.resetRejections(user.userId, deckId);
  }

  /**
   * Dry-run re-solve: preview a readiness result with a caller-
   * supplied exclusion set without writing anything to the database.
   * Used by the test result screen (U6).
   */
  @Post('re-solve')
  @HttpCode(HttpStatus.OK)
  async reSolve(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() body: ReSolveDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IReSolveResult> {
    return this.reSolveService.reSolveDryRun(
      user.userId,
      deckId,
      body.excludedCardIdentifiers,
    );
  }
}
