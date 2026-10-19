import { createMock } from '@golevelup/ts-jest';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ShareReferralService } from '../share-referral.service';
import { SharedDeckLookup } from '../shared-deck-lookup';

describe('ShareReferralService.resolve', () => {
  function liveWith(intent: 'deck' | 'missing') {
    const lookup = createMock<SharedDeckLookup>();
    lookup.findLive.mockResolvedValue({
      link: { id: 1, intent } as ShareLinkEntity & { intent: 'deck' | 'missing' },
      deck: { id: 9 } as TrackedDeckEntity,
      owner: { id: 'owner-1' } as UserEntity,
    });
    return lookup;
  }

  it('maps a live deck link to its owner and target', async () => {
    const result = await new ShareReferralService(liveWith('deck')).resolve('token');

    expect(result).toEqual({ ownerUserId: 'owner-1', targetKind: 'deck', targetId: 9, intent: 'deck', via: 'deck' });
  });

  it('attributes a missing-cards link to the want channel', async () => {
    const result = await new ShareReferralService(liveWith('missing')).resolve('token');

    expect(result).toMatchObject({ intent: 'missing', via: 'want' });
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
