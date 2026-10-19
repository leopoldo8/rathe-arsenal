import { createMock } from '@golevelup/ts-jest';
import { IsNull, Repository } from 'typeorm';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SharedDeckLookup } from '../shared-deck-lookup';

const LIVE_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

describe('SharedDeckLookup.findLive', () => {
  let links: jest.Mocked<Repository<ShareLinkEntity>>;
  let decks: jest.Mocked<Repository<TrackedDeckEntity>>;
  let lookup: SharedDeckLookup;

  const linkRow = (intent: string) => ({ id: 3, token: LIVE_TOKEN, targetId: 7, intent }) as ShareLinkEntity;

  beforeEach(() => {
    links = createMock<Repository<ShareLinkEntity>>();
    decks = createMock<Repository<TrackedDeckEntity>>();
    lookup = new SharedDeckLookup(links, decks);
  });

  it('rejects a malformed token without querying', async () => {
    const result = await lookup.findLive('../etc/passwd');

    expect(result).toBeNull();
    expect(links.findOne).not.toHaveBeenCalled();
  });

  it('matches the token in share_link and requires an owner who is not soft-deleted', async () => {
    links.findOne.mockResolvedValue(linkRow('deck'));
    decks.findOne.mockResolvedValue(null);

    await lookup.findLive(LIVE_TOKEN);

    expect(links.findOne).toHaveBeenCalledWith({ where: { token: LIVE_TOKEN, targetKind: 'deck' } });
    expect(decks.findOne).toHaveBeenCalledWith({
      where: { id: 7, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
  });

  it('returns the link, the deck and its owner when the token is live', async () => {
    const owner = { id: 'owner-1', displayName: 'Rodrigo' } as UserEntity;
    const deck = { id: 7, user: owner } as TrackedDeckEntity;
    const link = linkRow('missing');
    links.findOne.mockResolvedValue(link);
    decks.findOne.mockResolvedValue(deck);

    expect(await lookup.findLive(LIVE_TOKEN)).toEqual({ link, deck, owner });
  });

  it('returns null when no link holds the token', async () => {
    links.findOne.mockResolvedValue(null);

    expect(await lookup.findLive(LIVE_TOKEN)).toBeNull();
  });

  it('returns null for a link whose intent does not match the one asked for', async () => {
    links.findOne.mockResolvedValue(linkRow('deck'));

    expect(await lookup.findLive(LIVE_TOKEN, 'missing')).toBeNull();
    expect(decks.findOne).not.toHaveBeenCalled();
  });

  it('returns null for an intent that is not a deck intent', async () => {
    links.findOne.mockResolvedValue(linkRow('want'));

    expect(await lookup.findLive(LIVE_TOKEN)).toBeNull();
  });
});
