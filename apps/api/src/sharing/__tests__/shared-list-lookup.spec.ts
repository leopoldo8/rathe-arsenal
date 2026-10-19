import { createMock } from '@golevelup/ts-jest';
import { IsNull, Repository } from 'typeorm';
import { CardListEntity } from '../../database/entities/card-list.entity';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SharedListLookup } from '../shared-list-lookup';

const LIVE_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

describe('SharedListLookup.findLive', () => {
  let links: jest.Mocked<Repository<ShareLinkEntity>>;
  let lists: jest.Mocked<Repository<CardListEntity>>;
  let lookup: SharedListLookup;

  const linkRow = (intent: string) => ({ id: 3, token: LIVE_TOKEN, targetId: 7, intent }) as ShareLinkEntity;

  beforeEach(() => {
    links = createMock<Repository<ShareLinkEntity>>();
    lists = createMock<Repository<CardListEntity>>();
    lookup = new SharedListLookup(links, lists);
  });

  it('rejects a malformed token without querying', async () => {
    expect(await lookup.findLive('../etc/passwd')).toBeNull();
    expect(links.findOne).not.toHaveBeenCalled();
  });

  it('matches the token among list links and requires an owner who is not soft-deleted', async () => {
    links.findOne.mockResolvedValue(linkRow('want'));
    lists.findOne.mockResolvedValue(null);

    await lookup.findLive(LIVE_TOKEN);

    expect(links.findOne).toHaveBeenCalledWith({ where: { token: LIVE_TOKEN, targetKind: 'list' } });
    expect(lists.findOne).toHaveBeenCalledWith({
      where: { id: 7, user: { deletedAt: IsNull() } },
      relations: { user: true },
    });
  });

  it('returns the link, the list and its owner when the token is live', async () => {
    const owner = { id: 'owner-1' } as UserEntity;
    const list = { id: 7, kind: 'sell', user: owner } as CardListEntity;
    const link = linkRow('sell');
    links.findOne.mockResolvedValue(link);
    lists.findOne.mockResolvedValue(list);

    expect(await lookup.findLive(LIVE_TOKEN)).toEqual({ link, list, owner });
  });

  it('returns null when no list link holds the token', async () => {
    links.findOne.mockResolvedValue(null);

    expect(await lookup.findLive(LIVE_TOKEN)).toBeNull();
  });

  it('returns null for a deck intent', async () => {
    links.findOne.mockResolvedValue(linkRow('deck'));

    expect(await lookup.findLive(LIVE_TOKEN)).toBeNull();
    expect(lists.findOne).not.toHaveBeenCalled();
  });

  it('returns null when the list kind no longer matches the link intent', async () => {
    links.findOne.mockResolvedValue(linkRow('want'));
    lists.findOne.mockResolvedValue({ id: 7, kind: 'sell', user: {} } as CardListEntity);

    expect(await lookup.findLive(LIVE_TOKEN)).toBeNull();
  });
});
