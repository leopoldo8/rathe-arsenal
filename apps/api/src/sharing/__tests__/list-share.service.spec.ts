import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CardListEntity } from '../../database/entities/card-list.entity';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ListShareService } from '../list-share.service';
import { ShareEventsService } from '../share-events.service';

interface IBuildOptions {
  displayName?: string | null;
  inserted?: boolean;
  list?: Partial<CardListEntity> | null;
  existing?: Partial<ShareLinkEntity> | null;
  affected?: number;
}

function build(options: IBuildOptions = {}) {
  const lists = createMock<Repository<CardListEntity>>();
  lists.findOneBy.mockResolvedValue(
    options.list === null ? null : ({ id: 5, kind: 'sell', ...options.list } as CardListEntity),
  );
  const users = createMock<Repository<UserEntity>>();
  users.findOneByOrFail.mockResolvedValue({
    displayName: options.displayName === undefined ? 'Rodrigo' : options.displayName,
  } as UserEntity);
  const links = createMock<Repository<ShareLinkEntity>>();
  links.query.mockResolvedValue(
    options.inserted === false ? [] : [{ token: 'issued-token', intent: options.list?.kind ?? 'sell', showsContact: true }],
  );
  links.findOneByOrFail.mockResolvedValue(
    (options.existing ?? { token: 'existing-token', intent: 'sell', showsContact: false }) as ShareLinkEntity,
  );
  links.findOneBy.mockResolvedValue((options.existing ?? null) as ShareLinkEntity | null);
  links.update.mockResolvedValue({ affected: options.affected ?? 1 } as never);
  const events = createMock<ShareEventsService>();
  const config = createMock<ConfigService>();
  config.get.mockReturnValue('https://app.example');
  return { service: new ListShareService(lists, users, links, events, config), events, links };
}

describe('ListShareService.enable', () => {
  it('answers 404 for a list the caller does not own', async () => {
    const { service, events } = build({ list: null });

    await expect(service.enable('user-1', 5)).rejects.toMatchObject({ status: 404 });
    expect(events.record).not.toHaveBeenCalled();
  });

  it('refuses when the owner has no display name', async () => {
    const { service, events } = build({ displayName: null });

    await expect(service.enable('user-1', 5)).rejects.toMatchObject({ status: 409 });
    expect(events.record).not.toHaveBeenCalled();
  });

  it('issues a link with the list kind as intent and records created once', async () => {
    const { service, events } = build({ list: { kind: 'want' } });

    const result = await service.enable('user-1', 5);

    expect(result).toEqual({
      intent: 'want',
      url: 'https://app.example/l/issued-token',
      token: 'issued-token',
      showContact: true,
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'created', targetKind: 'list', targetId: 5, intent: 'want', ownerUserId: 'user-1' }),
    );
  });

  it('returns the existing token without recording when the link is already on', async () => {
    const { service, events } = build({ inserted: false });

    const result = await service.enable('user-1', 5);

    expect(result).toMatchObject({ token: 'existing-token', showContact: false });
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('ListShareService state', () => {
  it('reports a list with no link as null', async () => {
    const { service } = build();

    expect(await service.getState('user-1', 5)).toBeNull();
  });

  it('reports the live link', async () => {
    const { service } = build({ existing: { token: 'live-token', intent: 'want', showsContact: true } });

    expect(await service.getState('user-1', 5)).toMatchObject({ intent: 'want', token: 'live-token', showContact: true });
  });

  it('deletes only the list link the caller owns', async () => {
    const { service, links } = build();

    await service.disable('user-1', 5);

    expect(links.delete).toHaveBeenCalledWith({ targetKind: 'list', targetId: 5, ownerUserId: 'user-1' });
  });

  it('answers 404 when the contact switch is changed on a link that is off', async () => {
    const { service } = build({ affected: 0 });

    await expect(service.setShowContact('user-1', 5, false)).rejects.toMatchObject({ status: 404 });
  });
});
