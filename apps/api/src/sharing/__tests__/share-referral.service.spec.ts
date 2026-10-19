import { createMock } from '@golevelup/ts-jest';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ShareReferralService } from '../share-referral.service';
import { SharedDeckLookup } from '../shared-deck-lookup';

describe('ShareReferralService.resolve', () => {
  it('maps a live deck link to its owner and target', async () => {
    const lookup = createMock<SharedDeckLookup>();
    lookup.findLive.mockResolvedValue({
      deck: { id: 9 } as TrackedDeckEntity,
      owner: { id: 'owner-1' } as UserEntity,
    });

    const result = await new ShareReferralService(lookup).resolve('token');

    expect(result).toEqual({ ownerUserId: 'owner-1', targetKind: 'deck', targetId: 9, via: 'deck' });
  });

  it('returns null for a dead token', async () => {
    const lookup = createMock<SharedDeckLookup>();
    lookup.findLive.mockResolvedValue(null);

    expect(await new ShareReferralService(lookup).resolve('token')).toBeNull();
  });

  it('returns null instead of throwing when the lookup fails', async () => {
    const lookup = createMock<SharedDeckLookup>();
    lookup.findLive.mockRejectedValue(new Error('db down'));

    expect(await new ShareReferralService(lookup).resolve('token')).toBeNull();
  });
});
