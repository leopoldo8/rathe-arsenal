import { BadRequestException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { ExecutionContext } from '@nestjs/common';
import { AuthzService } from '../../authz.service';
import { OwnsTrackedDeckGuard } from '../owns-tracked-deck.guard';

function contextFor(params: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'user-1' }, params }) }),
  } as unknown as ExecutionContext;
}

describe('OwnsTrackedDeckGuard', () => {
  it.each(['abc', '1.5', '', 'NaN'])('answers 400 for the deck id %p without touching the database', async (deckId) => {
    const authz = createMock<AuthzService>();

    await expect(new OwnsTrackedDeckGuard(authz).canActivate(contextFor({ deckId }))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(authz.assertOwnsTrackedDeck).not.toHaveBeenCalled();
  });

  it('checks ownership of an integer deck id, from either param name', async () => {
    const authz = createMock<AuthzService>();
    const guard = new OwnsTrackedDeckGuard(authz);

    await expect(guard.canActivate(contextFor({ deckId: '12' }))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor({ trackedDeckId: '13' }))).resolves.toBe(true);

    expect(authz.assertOwnsTrackedDeck).toHaveBeenNthCalledWith(1, 'user-1', 12);
    expect(authz.assertOwnsTrackedDeck).toHaveBeenNthCalledWith(2, 'user-1', 13);
  });
});
