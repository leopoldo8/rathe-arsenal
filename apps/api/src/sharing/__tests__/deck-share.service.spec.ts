import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { DeckShareService } from '../deck-share.service';
import { ShareEventsService } from '../share-events.service';

interface IBuildOptions {
  displayName?: string | null;
  inserted?: boolean;
  existing?: Partial<ShareLinkEntity> | null;
  rows?: Partial<ShareLinkEntity>[];
  affected?: number;
}

function build(options: IBuildOptions = {}) {
  const decks = createMock<Repository<TrackedDeckEntity>>();
  decks.findOneByOrFail.mockResolvedValue({ id: 5 } as TrackedDeckEntity);
  const users = createMock<Repository<UserEntity>>();
  users.findOneByOrFail.mockResolvedValue({ displayName: options.displayName === undefined ? 'Rodrigo' : options.displayName } as UserEntity);
  const links = createMock<Repository<ShareLinkEntity>>();
  links.query.mockResolvedValue(options.inserted === false ? [] : [{ token: 'issued-token', showsContact: true }]);
  links.findOneByOrFail.mockResolvedValue((options.existing ?? { token: 'existing-token', showsContact: false }) as ShareLinkEntity);
  links.find.mockResolvedValue((options.rows ?? []) as ShareLinkEntity[]);
  links.update.mockResolvedValue({ affected: options.affected ?? 1 } as never);
  const events = createMock<ShareEventsService>();
  const config = createMock<ConfigService>();
  config.get.mockReturnValue('https://app.example');
  return { service: new DeckShareService(decks, users, links, events, config), events, links };
}

describe('DeckShareService.enable', () => {
  it('refuses when the owner has no display name', async () => {
    const { service, events } = build({ displayName: null });

    await expect(service.enable('user-1', 5, 'deck')).rejects.toMatchObject({ status: 409 });
    expect(events.record).not.toHaveBeenCalled();
  });

  it('issues a link and records created with its intent exactly once', async () => {
    const { service, events } = build();

    const result = await service.enable('user-1', 5, 'missing');

    expect(result).toEqual({
      intent: 'missing',
      url: 'https://app.example/d/issued-token',
      token: 'issued-token',
      showContact: true,
    });
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'created', targetId: 5, intent: 'missing', ownerUserId: 'user-1' }),
    );
  });

  it('returns the existing token without recording when the link is already on', async () => {
    const { service, events } = build({ inserted: false });

    const result = await service.enable('user-1', 5, 'deck');

    expect(result).toMatchObject({ token: 'existing-token', showContact: false });
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('DeckShareService state', () => {
  it('reports both intents off as null', async () => {
    const { service } = build();

    expect(await service.getState('user-1', 5)).toEqual({ deck: null, missing: null });
  });

  it('reports each intent with its own token', async () => {
    const { service } = build({
      rows: [
        { intent: 'deck', token: 'deck-token', showsContact: true },
        { intent: 'missing', token: 'missing-token', showsContact: false },
      ],
    });

    const state = await service.getState('user-1', 5);

    expect(state.deck).toMatchObject({ token: 'deck-token', showContact: true });
    expect(state.missing).toMatchObject({ token: 'missing-token', showContact: false });
  });

  it('deletes only the link of that intent that the caller owns', async () => {
    const { service, links } = build();

    await service.disable('user-1', 5, 'missing');

    expect(links.delete).toHaveBeenCalledWith({
      targetKind: 'deck',
      targetId: 5,
      ownerUserId: 'user-1',
      intent: 'missing',
    });
  });

  it('answers 404 when the contact switch is changed on a link that is off', async () => {
    const { service } = build({ affected: 0 });

    await expect(service.setShowContact('user-1', 5, 'deck', false)).rejects.toMatchObject({ status: 404 });
  });
});
