import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthzService } from '../authz.service';
import { ICurrentUser } from '../dtos/current-user.dto';

/**
 * Method-level guard that verifies the authenticated user owns the
 * tracked deck referenced in route params. Looks for `trackedDeckId`
 * or `deckId` in the route parameters.
 *
 * Usage:
 *   @UseGuards(OwnsTrackedDeckGuard)
 *   @Get(':trackedDeckId/readiness')
 */
/** tracked_deck.id is a serial int4; anything outside this range would reach Postgres as an overflow (500). */
const MIN_DECK_ID = 1;
const MAX_DECK_ID = 2_147_483_647;

@Injectable()
export class OwnsTrackedDeckGuard implements CanActivate {
  constructor(private readonly authzService: AuthzService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: ICurrentUser = request.user;
    const params = request.params;

    const rawDeckId = String(params.trackedDeckId ?? params.deckId);

    // Guards run before the route's pipes, so a malformed id would otherwise reach the database as NaN.
    const trackedDeckId = Number(rawDeckId);
    if (!/^\d+$/.test(rawDeckId) || trackedDeckId < MIN_DECK_ID || trackedDeckId > MAX_DECK_ID) {
      throw new BadRequestException('Deck id must be an integer between 1 and 2147483647');
    }

    await this.authzService.assertOwnsTrackedDeck(user.userId, trackedDeckId);

    return true;
  }
}
