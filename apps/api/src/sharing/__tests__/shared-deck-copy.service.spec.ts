import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SharedDeckCopyService } from '../shared-deck-copy.service';
import { SharedDeckLookup } from '../shared-deck-lookup';

const DECK = {
  id: 11,
  name: 'My deck',
  hero: 'Some Hero',
  heroIdentifier: 'some-hero',
  format: 'cc',
  shareToken: 'live',
} as TrackedDeckEntity;

function build(options: { live: boolean; readinessFails?: boolean }) {
  const lookup = createMock<SharedDeckLookup>();
  lookup.findLive.mockResolvedValue(options.live ? { deck: DECK, owner: { id: 'owner-1' } as UserEntity } : null);
  const substitution = createMock<SubstitutionService>();
  if (options.readinessFails) substitution.computeAndStoreReadiness.mockRejectedValue(new Error('boom'));
  const manager = createMock<EntityManager>();
  manager.create.mockImplementation(((_entity: unknown, data: object) => data) as never);
  manager.save.mockResolvedValue({ id: 99 } as never);
  const dataSource = createMock<DataSource>();
  dataSource.transaction.mockImplementation((async (work: (m: EntityManager) => unknown) => work(manager)) as never);
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue([{ cardIdentifier: 'card-a', quantity: 3, slot: 'mainboard' }] as DeckCardEntity[]);
  return {
    service: new SharedDeckCopyService(lookup, substitution, dataSource, deckCards),
    manager,
    substitution,
  };
}

describe('SharedDeckCopyService.copy', () => {
  it('creates an unshared idea deck for the visitor with every card', async () => {
    const { service, manager, substitution } = build({ live: true });

    const result = await service.copy('live', 'visitor-1');

    expect(result).toEqual({ deckId: 99 });
    expect(manager.create).toHaveBeenCalledWith(
      TrackedDeckEntity,
      expect.objectContaining({ userId: 'visitor-1', status: 'idea', shareToken: null, fabraryUlid: null, name: 'My deck' }),
    );
    expect(manager.insert).toHaveBeenCalledWith(DeckCardEntity, [
      { trackedDeckId: 99, cardIdentifier: 'card-a', quantity: 3, slot: 'mainboard' },
    ]);
    expect(substitution.computeAndStoreReadiness).toHaveBeenCalledWith(99, 'visitor-1');
  });

  it('still answers when the readiness snapshot fails', async () => {
    const { service } = build({ live: true, readinessFails: true });

    await expect(service.copy('live', 'visitor-1')).resolves.toEqual({ deckId: 99 });
  });

  it('answers 404 for a dead token without writing', async () => {
    const { service, manager } = build({ live: false });

    await expect(service.copy('dead', 'visitor-1')).rejects.toMatchObject({ status: 404 });
    expect(manager.save).not.toHaveBeenCalled();
  });
});
