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
@Injectable()
export class OwnsTrackedDeckGuard implements CanActivate {
  constructor(private readonly authzService: AuthzService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: ICurrentUser = request.user;
    const params = request.params;

    const rawDeckId = String(params.trackedDeckId ?? params.deckId);

    // Guards run before the route's pipes, so a malformed id would otherwise reach the database as NaN.
    if (!/^\d+$/.test(rawDeckId)) {
      throw new BadRequestException('Deck id must be an integer');
    }
    const trackedDeckId = Number(rawDeckId);

    await this.authzService.assertOwnsTrackedDeck(user.userId, trackedDeckId);

    return true;
  }
}
