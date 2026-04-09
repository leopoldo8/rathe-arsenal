import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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

    const trackedDeckId = Number(params.trackedDeckId ?? params.deckId);

    await this.authzService.assertOwnsTrackedDeck(user.userId, trackedDeckId);

    return true;
  }
}
