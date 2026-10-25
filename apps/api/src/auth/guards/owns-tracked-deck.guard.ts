import { BadRequestException, CanActivate, ExecutionContext, Injectable, Optional, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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

const INCLUDES_DELETED_DECK_KEY = 'includesDeletedDeck';

/** Marks a route that acts on a deleted deck too (restore, permanent delete); every other owner route answers 404 for it. */
export const IncludesDeletedDeck = (): MethodDecorator => SetMetadata(INCLUDES_DELETED_DECK_KEY, true);

@Injectable()
export class OwnsTrackedDeckGuard implements CanActivate {
  constructor(
    private readonly authzService: AuthzService,
    @Optional() private readonly reflector?: Reflector,
  ) {}

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

    const includesDeleted =
      this.reflector?.getAllAndOverride<boolean>(INCLUDES_DELETED_DECK_KEY, [context.getHandler(), context.getClass()]) ?? false;
    if (includesDeleted) {
      await this.authzService.assertOwnsTrackedDeckInAnyState(user.userId, trackedDeckId);
    } else {
      await this.authzService.assertOwnsTrackedDeck(user.userId, trackedDeckId);
    }

    return true;
  }
}
