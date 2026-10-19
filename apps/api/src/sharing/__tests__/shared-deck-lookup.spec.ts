import { createMock } from '@golevelup/ts-jest';
import { IsNull, Repository } from 'typeorm';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SharedDeckLookup } from '../shared-deck-lookup';

const LIVE_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

describe('SharedDeckLookup.findLive', () => {
  let repo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let lookup: SharedDeckLookup;

  beforeEach(() => {
    repo = createMock<Repository<TrackedDeckEntity>>();
    lookup = new SharedDeckLookup(repo);
  });

  it('rejects a malformed token without querying', async () => {
    const result = await lookup.findLive('../etc/passwd');

    expect(result).toBeNull();
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('queries by token and requires an owner who is not soft-deleted', async () => {
    repo.findOne.mockResolvedValue(null);

    await lookup.findLive(LIVE_TOKEN);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { shareToken: LIVE_TOKEN, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
  });

  it('returns the deck and its owner when the token is live', async () => {
    const owner = { id: 'owner-1', displayName: 'Rodrigo' } as UserEntity;
    const deck = { id: 7, shareToken: LIVE_TOKEN, user: owner } as TrackedDeckEntity;
    repo.findOne.mockResolvedValue(deck);

    const result = await lookup.findLive(LIVE_TOKEN);

    expect(result).toEqual({ deck, owner });
  });

  it('returns null when no live deck holds the token', async () => {
    repo.findOne.mockResolvedValue(null);

    expect(await lookup.findLive(LIVE_TOKEN)).toBeNull();
  });
});
