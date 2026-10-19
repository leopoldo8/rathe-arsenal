import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { DeckShareService } from '../deck-share.service';
import { ShareEventsService } from '../share-events.service';

function build(options: { displayName: string | null; affected: number; token?: string | null }) {
  const execute = jest.fn().mockResolvedValue({ affected: options.affected });
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute,
  };
  const decks = createMock<Repository<TrackedDeckEntity>>();
  decks.createQueryBuilder.mockReturnValue(queryBuilder as never);
  decks.findOneByOrFail.mockResolvedValue({
    shareToken: options.token ?? null,
    shareShowsContact: true,
  } as TrackedDeckEntity);
  const users = createMock<Repository<UserEntity>>();
  users.findOneByOrFail.mockResolvedValue({ displayName: options.displayName } as UserEntity);
  const events = createMock<ShareEventsService>();
  const config = createMock<ConfigService>();
  config.get.mockReturnValue('https://app.example');
  return { service: new DeckShareService(decks, users, events, config), events, queryBuilder };
}

describe('DeckShareService.enable', () => {
  it('refuses when the owner has no display name', async () => {
    const { service, events } = build({ displayName: null, affected: 1 });

    await expect(service.enable('user-1', 5)).rejects.toMatchObject({ status: 409 });
    expect(events.record).not.toHaveBeenCalled();
  });

  it('issues a token and records created exactly once', async () => {
    const { service, events } = build({ displayName: 'Rodrigo', affected: 1 });

    const result = await service.enable('user-1', 5);

    expect(result.url).toBe(`https://app.example/d/${result.token}`);
    expect(events.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'created', targetId: 5, ownerUserId: 'user-1' }),
    );
  });

  it('returns the existing token without recording when sharing is already on', async () => {
    const { service, events } = build({ displayName: 'Rodrigo', affected: 0, token: 'existing-token' });

    const result = await service.enable('user-1', 5);

    expect(result.token).toBe('existing-token');
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('DeckShareService state', () => {
  it('reports off as null url and token', async () => {
    const { service } = build({ displayName: 'Rodrigo', affected: 1 });

    expect(await service.getState('user-1', 5)).toEqual({ url: null, token: null, showContact: true });
  });

  it('clears the token on disable', async () => {
    const { service, queryBuilder } = build({ displayName: 'Rodrigo', affected: 1 });

    await service.disable('user-1', 5);

    expect(queryBuilder.set).toHaveBeenCalledWith(expect.objectContaining({ shareToken: null }));
  });
});
