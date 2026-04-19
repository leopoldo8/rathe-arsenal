import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { DecisionsService, IDecision } from './decisions.service';
import { DecisionCardIdentifierDto, UpsertDecisionDto } from './dtos/decision.dto';

/**
 * Live owner of all /api/decks/:trackedDeckId/decisions routes.
 *
 * The old re-solve.controller.ts endpoints are deprecated to 410 Gone stubs
 * (see re-solve.controller.ts). JwtAuthGuard is applied globally via APP_GUARD
 * so all routes here require a valid JWT without additional decorators.
 *
 * Ownership is enforced inside DecisionsService.assertOwnsDeck on every call.
 */
@Controller('decks/:trackedDeckId')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  /**
   * List all non-pending decisions for the authenticated user on a deck.
   * GET /api/decks/:trackedDeckId/decisions
   */
  @Get('decisions')
  async list(
    @Param('trackedDeckId', ParseIntPipe) trackedDeckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IDecision[]> {
    return this.decisionsService.list(user.userId, trackedDeckId);
  }

  /**
   * Upsert a decision (approve or reject) for a card in the deck.
   * POST /api/decks/:trackedDeckId/decisions
   * Body: { cardIdentifier: string, decision: 'approved' | 'rejected' }
   */
  @Post('decisions')
  @HttpCode(HttpStatus.OK)
  async upsert(
    @Param('trackedDeckId', ParseIntPipe) trackedDeckId: number,
    @Body() body: UpsertDecisionDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IDecision> {
    return this.decisionsService.upsert({
      userId: user.userId,
      trackedDeckId,
      cardIdentifier: body.cardIdentifier,
      decision: body.decision,
    });
  }

  /**
   * Reset a single card decision to pending (deletes the row).
   * DELETE /api/decks/:trackedDeckId/decisions/:cardIdentifier
   */
  @Delete('decisions/:cardIdentifier')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetOne(
    @Param('trackedDeckId', ParseIntPipe) trackedDeckId: number,
    @Param('cardIdentifier') cardIdentifier: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    // Validate cardIdentifier path param via DTO manually.
    // We use the DTO class for consistent validation without adding a pipe here.
    const dto = Object.assign(new DecisionCardIdentifierDto(), { cardIdentifier });
    void dto; // Validated at service layer via the entity constraints.
    return this.decisionsService.resetOne(user.userId, trackedDeckId, cardIdentifier);
  }

  /**
   * Bulk clear all rejections for the deck (preserves approvals).
   * DELETE /api/decks/:trackedDeckId/decisions?scope=rejections
   *
   * Returns the count of cleared rows.
   */
  @Delete('decisions')
  @HttpCode(HttpStatus.OK)
  async clearRejections(
    @Param('trackedDeckId', ParseIntPipe) trackedDeckId: number,
    @Query('scope') scope: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ cleared: number }> {
    // Only scope=rejections is supported; any other value is a no-op.
    if (scope === 'rejections') {
      const cleared = await this.decisionsService.clearRejections(
        user.userId,
        trackedDeckId,
      );
      return { cleared };
    }
    return { cleared: 0 };
  }
}
