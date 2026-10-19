import { createMock } from '@golevelup/ts-jest';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ShareReferralService } from '../share-referral.service';
import { CardListEntity } from '../../database/entities/card-list.entity';
import { SharedDeckLookup } from '../shared-deck-lookup';
import { SharedListLookup } from '../shared-list-lookup';

function noList(): SharedListLookup {
  const lookup = createMock<SharedListLookup>();
  lookup.findLive.mockResolvedValue(null);
  return lookup;
}

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
    const result = await new ShareReferralService(liveWith('deck'), noList()).resolve('token');

    expect(result).toEqual({ ownerUserId: 'owner-1', targetKind: 'deck', targetId: 9, intent: 'deck', via: 'deck' });
  });

  it('attributes a missing-cards link to the want channel', async () => {
    const result = await new ShareReferralService(liveWith('missing'), noList()).resolve('token');

    expect(result).toMatchObject({ intent: 'missing', via: 'want' });
  });

  it('returns null for a dead token', async () => {
    const lookup = createMock<SharedDeckLookup>();
    lookup.findLive.mockResolvedValue(null);

    expect(await new ShareReferralService(lookup, noList()).resolve('token')).toBeNull();
  });

  it('returns null instead of throwing when the lookup fails', async () => {
    const lookup = createMock<SharedDeckLookup>();
    lookup.findLive.mockRejectedValue(new Error('db down'));

    expect(await new ShareReferralService(lookup, noList()).resolve('token')).toBeNull();
  });

  describe.each<['want' | 'sell']>([['want'], ['sell']])('a live %s list link', (intent) => {
    function listFlow() {
      const decks = createMock<SharedDeckLookup>();
      decks.findLive.mockResolvedValue(null);
      const lists = createMock<SharedListLookup>();
      lists.findLive.mockResolvedValue({
        link: { id: 2, intent } as ShareLinkEntity & { intent: 'want' | 'sell' },
        list: { id: 4, kind: intent } as CardListEntity,
        owner: { id: 'owner-2' } as UserEntity,
      });
      return new ShareReferralService(decks, lists);
    }

    it('attributes the sign-up to its owner through the list intent', async () => {
      expect(await listFlow().resolve('token')).toEqual({
        ownerUserId: 'owner-2',
        targetKind: 'list',
        targetId: 4,
        intent,
        via: intent,
      });
    });
  });

  it('prefers a deck link and never asks the list lookup', async () => {
    const lists = createMock<SharedListLookup>();

    await new ShareReferralService(liveWith('deck'), lists).resolve('token');

    expect(lists.findLive).not.toHaveBeenCalled();
  });
});
