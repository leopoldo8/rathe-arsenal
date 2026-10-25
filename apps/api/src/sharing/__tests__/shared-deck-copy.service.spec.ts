import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SharedDeckCopyService } from '../shared-deck-copy.service';
import { SharedDeckReplacements, TActiveReplacement } from '../shared-deck-replacements';
import { SharedDeckLookup } from '../shared-deck-lookup';

const DECK = {
  id: 11,
  name: 'My deck',
  hero: 'Some Hero',
  heroIdentifier: 'some-hero',
  format: 'cc',
} as TrackedDeckEntity;

const pick = (overrides: Partial<TActiveReplacement>): TActiveReplacement => ({
  slot: 'mainboard',
  originalCardIdentifier: 'swing-big',
  replacementCardIdentifier: 'runner-runner',
  quantity: 2,
  side: 'deck',
  ...overrides,
});

function build(options: {
  live: boolean;
  readinessFails?: boolean;
  rows?: Partial<DeckCardEntity>[];
  replacements?: TActiveReplacement[];
}) {
  const lookup = createMock<SharedDeckLookup>();
  lookup.findLive.mockImplementation(async (_token, intent) =>
    options.live && intent === 'deck'
      ? { link: { intent: 'deck' } as ShareLinkEntity & { intent: 'deck' }, deck: DECK, owner: { id: 'owner-1' } as UserEntity }
      : null,
  );
  const substitution = createMock<SubstitutionService>();
  if (options.readinessFails) substitution.computeAndStoreReadiness.mockRejectedValue(new Error('boom'));
  const manager = createMock<EntityManager>();
  manager.create.mockImplementation(((_entity: unknown, data: object) => data) as never);
  manager.save.mockResolvedValue({ id: 99 } as never);
  const dataSource = createMock<DataSource>();
  dataSource.transaction.mockImplementation((async (work: (m: EntityManager) => unknown) => work(manager)) as never);
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue((options.rows ?? [{ cardIdentifier: 'card-a', quantity: 3, slot: 'mainboard' }]) as DeckCardEntity[]);
  const replacements = createMock<SharedDeckReplacements>();
  replacements.active.mockResolvedValue(options.replacements ?? []);
  return {
    service: new SharedDeckCopyService(lookup, substitution, dataSource, deckCards, replacements),
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
      expect.objectContaining({ userId: 'visitor-1', status: 'idea', fabraryUlid: null, name: 'My deck' }),
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

  it('the original variant rebuilds the cards before the replacements', async () => {
    const rows = [
      { cardIdentifier: 'swing-big', quantity: 1, inventoryQuantity: 0, slot: 'mainboard' },
      { cardIdentifier: 'runner-runner', quantity: 2, inventoryQuantity: 0, slot: 'mainboard' },
      { cardIdentifier: 'wrecker-romp', quantity: 3, inventoryQuantity: 0, slot: 'mainboard' },
    ];
    const { service, manager } = build({ live: true, rows, replacements: [pick({})] });

    await service.copy('live', 'visitor-1', 'original');

    // Two of the three Swing Big were swapped: the copy holds all three again and no Runner Runner from that pick.
    expect(manager.insert).toHaveBeenCalledWith(DeckCardEntity, [
      { trackedDeckId: 99, cardIdentifier: 'swing-big', quantity: 3, inventoryQuantity: 0, slot: 'mainboard' },
      { trackedDeckId: 99, cardIdentifier: 'wrecker-romp', quantity: 3, inventoryQuantity: 0, slot: 'mainboard' },
    ]);
  });

  it('the original variant restores the inventory quantity of a pick made on the inventory side', async () => {
    const rows = [
      { cardIdentifier: 'swing-big', quantity: 3, inventoryQuantity: 0, slot: 'mainboard' },
      { cardIdentifier: 'runner-runner', quantity: 0, inventoryQuantity: 1, slot: 'mainboard' },
    ];
    const { service, manager } = build({ live: true, rows, replacements: [pick({ quantity: 1, side: 'inventory' })] });

    await service.copy('live', 'visitor-1', 'original');

    expect(manager.insert).toHaveBeenCalledWith(DeckCardEntity, [
      { trackedDeckId: 99, cardIdentifier: 'swing-big', quantity: 3, inventoryQuantity: 1, slot: 'mainboard' },
    ]);
  });

  it('as_built copies the deck as it stands, replacements included', async () => {
    const rows = [
      { cardIdentifier: 'swing-big', quantity: 1, inventoryQuantity: 0, slot: 'mainboard' },
      { cardIdentifier: 'runner-runner', quantity: 2, inventoryQuantity: 0, slot: 'mainboard' },
    ];
    const { service, manager } = build({ live: true, rows, replacements: [pick({})] });

    await service.copy('live', 'visitor-1', 'as_built');

    expect(manager.insert).toHaveBeenCalledWith(DeckCardEntity, [
      { trackedDeckId: 99, cardIdentifier: 'swing-big', quantity: 1, inventoryQuantity: 0, slot: 'mainboard' },
      { trackedDeckId: 99, cardIdentifier: 'runner-runner', quantity: 2, inventoryQuantity: 0, slot: 'mainboard' },
    ]);
  });

  it('asks for a variant when the deck has active replacements, and writes nothing without one', async () => {
    const { service, manager } = build({ live: true, replacements: [pick({})] });

    await expect(service.copy('live', 'visitor-1')).rejects.toMatchObject({ status: 400 });
    expect(manager.save).not.toHaveBeenCalled();
  });
});
