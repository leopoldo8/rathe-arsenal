import { Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, FindOperator } from 'typeorm';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { CollectionReadService } from '../../collection/collection-read.service';
import { CardReplacementEntity } from '../../database/entities/card-replacement.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';
import { ReplacementsQueryService } from '../replacements-query.service';
import { ReplacementsService } from '../replacements.service';

const USER_ID = 'user-1';
const DECK_ID = 4;
const EMISSARY = 'emissary-of-tides-red';
const COAX = 'coax-a-commotion-red';

function record(status: CardReplacementEntity['status']): CardReplacementEntity {
  return {
    id: 'r1',
    userId: USER_ID,
    trackedDeckId: DECK_ID,
    slot: 'mainboard',
    originalCardIdentifier: EMISSARY,
    replacementCardIdentifier: COAX,
    quantity: 2,
    pickedFrom: 'very_close',
    status,
    createdAt: new Date('2026-10-04T10:00:00Z'),
    resolvedAt: status === 'active' ? null : new Date('2026-10-04T11:00:00Z'),
  } as CardReplacementEntity;
}

function build(options: {
  needed: number;
  recordStatus?: CardReplacementEntity['status'];
  ownedReplacement?: number;
  deckCards?: Array<{ id: number; cardIdentifier: string; quantity: number; slot: string }>;
}) {
  const manager = createMock<EntityManager>();
  let recordReads = 0;
  // The status the service writes is what its final read returns, as the database would.
  let writtenStatus: CardReplacementEntity['status'] | null = null;
  manager.update.mockImplementation((async (entity: unknown, _criteria: unknown, patch: { status?: CardReplacementEntity['status'] }) => {
    if (entity === CardReplacementEntity && patch.status) writtenStatus = patch.status;
    return { affected: 1 };
  }) as never);
  manager.findOne.mockImplementation((async (entity: unknown) => {
    if (entity === TrackedDeckEntity) {
      return { id: DECK_ID, userId: USER_ID, heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' };
    }
    if (entity === CardReplacementEntity) {
      recordReads += 1;
      // The last read happens after the status update, so it sees the closed record.
      return recordReads >= 3 && writtenStatus !== null ? record(writtenStatus) : record(options.recordStatus ?? 'active');
    }
    return null;
  }) as never);
  manager.find.mockResolvedValue(
    (options.deckCards ?? [
      { id: 1, cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
      { id: 2, cardIdentifier: COAX, quantity: 2, slot: 'mainboard' },
    ]).map((row) => ({ trackedDeckId: DECK_ID, ...row })) as never,
  );
  manager.create.mockImplementation(((_entity: unknown, values: object) => values) as never);
  manager.save.mockImplementation((async (value: object) => ({ ...value, id: 'r1', createdAt: new Date('2026-10-04T10:00:00Z') })) as never);

  const dataSource = createMock<DataSource>();
  (dataSource.transaction as jest.Mock).mockImplementation(async (callback: (m: EntityManager) => unknown) => callback(manager));
  const substitution = createMock<SubstitutionService>();
  substitution.computeReadinessWithExclusions.mockResolvedValue({
    breakdown: { notOwned: options.needed === 0 ? [] : [{ cardIdentifier: EMISSARY, slot: 'mainboard', quantity: options.needed }] },
  } as never);
  const swaps = createMock<SwapSuggestionQueryService>();
  swaps.loadReadinessInputs.mockResolvedValue({ excludedIdentifiers: new Set(), approvedIdentifiers: new Set() });
  const replacements = createMock<ReplacementsQueryService>();
  replacements.loadActive.mockResolvedValue([]);
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockResolvedValue(new Map(options.ownedReplacement ? [[COAX, options.ownedReplacement]] : []));

  return {
    service: new ReplacementsService(dataSource, substitution, swaps, replacements, collection),
    substitution,
    manager,
  };
}

const body = {
  originalCardIdentifier: EMISSARY,
  slot: 'mainboard',
  replacementCardIdentifier: COAX,
  pickedFrom: 'very_close' as const,
};

describe('ReplacementsService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function events(name: string): unknown[] {
    return logSpy.mock.calls.map(([entry]) => entry).filter((entry) => (entry as { event?: string }).event === name);
  }

  it('logs replacements.picked once per committed pick', async () => {
    // COAX x2 already in the deck, so the pick of two more would break the copy limit; one missing copy fits.
    const { service } = build({ needed: 1 });

    await service.pick(USER_ID, DECK_ID, body);

    expect(events('replacements.picked')).toEqual([
      {
        event: 'replacements.picked',
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        originalCardIdentifier: EMISSARY,
        replacementCardIdentifier: COAX,
        slot: 'mainboard',
        quantity: 1,
        pickedFrom: 'very_close',
        owned: false,
      },
    ]);

    // Three copies owned, two already in the deck: one free copy covers the one that is missing.
    logSpy.mockClear();
    await build({ needed: 1, ownedReplacement: 3 }).service.pick(USER_ID, DECK_ID, body);
    expect(events('replacements.picked')).toEqual([expect.objectContaining({ owned: true, quantity: 1 })]);

    logSpy.mockClear();
    const refused = build({ needed: 0 });
    await expect(refused.service.pick(USER_ID, DECK_ID, body)).rejects.toMatchObject({
      response: { code: 'NOTHING_TO_REPLACE' },
    });
    const illegal = build({ needed: 2 });
    await expect(illegal.service.pick(USER_ID, DECK_ID, body)).rejects.toMatchObject({
      response: { code: 'REPLACEMENT_ILLEGAL' },
    });
    expect(events('replacements.picked')).toEqual([]);
  });

  it('logs replacements.resolved once per committed resolution', async () => {
    const reverted = build({ needed: 0, recordStatus: 'active' });
    await reverted.service.resolve(USER_ID, 'r1', 'revert');
    const kept = build({ needed: 0, recordStatus: 'active' });
    await kept.service.resolve(USER_ID, 'r1', 'keep');

    expect(events('replacements.resolved')).toEqual([
      { event: 'replacements.resolved', userId: USER_ID, trackedDeckId: DECK_ID, replacementId: 'r1', status: 'reverted' },
      { event: 'replacements.resolved', userId: USER_ID, trackedDeckId: DECK_ID, replacementId: 'r1', status: 'kept' },
    ]);

    logSpy.mockClear();
    const closed = build({ needed: 0, recordStatus: 'removed' });
    await expect(closed.service.resolve(USER_ID, 'r1', 'keep')).rejects.toMatchObject({
      response: { code: 'REPLACEMENT_NOT_ACTIVE' },
    });
    expect(events('replacements.resolved')).toEqual([]);
  });

  describe('decisions at the service layer', () => {
    const writes = (manager: EntityManager) =>
      [manager.update, manager.insert, manager.delete, manager.save].flatMap((fn) => (fn as jest.Mock).mock.calls);

    it.each([
      ['a card not legal for the hero', { replacementCardIdentifier: 'a-good-clean-fight-red' }, 1],
      ['a card that would exceed the copy limit', {}, 2],
      ['the weapon slot', { slot: 'weapon' }, 1],
      ['the hero slot', { slot: 'hero' }, 1],
      ['the original itself', { replacementCardIdentifier: EMISSARY }, 1],
    ])('refuses %s as REPLACEMENT_ILLEGAL and writes nothing', async (_cause, overrides, needed) => {
      const { service, manager } = build({ needed });

      await expect(service.pick(USER_ID, DECK_ID, { ...body, ...overrides })).rejects.toMatchObject({
        response: { code: 'REPLACEMENT_ILLEGAL' },
      });

      expect(writes(manager)).toEqual([]);
    });

    it('retires only the original\'s pending and approved swaps for that slot, never a rejected one', async () => {
      const { service, manager } = build({ needed: 1 });

      await service.pick(USER_ID, DECK_ID, body);

      const call = (manager.update as jest.Mock).mock.calls.find(([entity]) => entity === SwapSuggestionEntity)!;
      const [, criteria, patch] = call as [unknown, { status: FindOperator<string[]>; cardIdentifier: string; slot: string; trackedDeckId: number }, unknown];
      expect(criteria.status.value).toEqual(['pending', 'approved']);
      expect(criteria).toEqual(
        expect.objectContaining({ trackedDeckId: DECK_ID, cardIdentifier: EMISSARY, slot: 'mainboard' }),
      );
      expect(patch).toEqual({ status: 'retired' });
    });

    const deckRows = (original: number | null, other: number | null) => [
      ...(original === null ? [] : [{ id: 1, cardIdentifier: EMISSARY, quantity: original, slot: 'mainboard' }]),
      ...(other === null ? [] : [{ id: 2, cardIdentifier: COAX, quantity: other, slot: 'mainboard' }]),
    ];

    it.each([
      ['deletes the original row at 0 and creates the replacement row', deckRows(2, null), 2, { deleted: 1, created: 2 }],
      ['reduces the original row and increases the replacement row', deckRows(3, 1), 2, { reduced: [1, 1], increased: [2, 3] }],
    ])('pick %s', async (_shape, rows, needed, expected) => {
      const { service, manager } = build({ needed, deckCards: rows });

      await service.pick(USER_ID, DECK_ID, body);

      const deleted = (manager.delete as jest.Mock).mock.calls.filter(([entity]) => entity === DeckCardEntity);
      const updated = (manager.update as jest.Mock).mock.calls.filter(([entity]) => entity === DeckCardEntity);
      const inserted = (manager.insert as jest.Mock).mock.calls.filter(([entity]) => entity === DeckCardEntity);
      if ('deleted' in expected) {
        expect(deleted).toEqual([[DeckCardEntity, { id: expected.deleted }]]);
        expect(inserted).toEqual([
          [DeckCardEntity, { trackedDeckId: DECK_ID, cardIdentifier: COAX, quantity: expected.created, slot: 'mainboard' }],
        ]);
        expect(updated).toEqual([]);
      } else {
        expect(deleted).toEqual([]);
        expect(inserted).toEqual([]);
        expect(updated).toEqual([
          [DeckCardEntity, { id: 1 }, { quantity: expected.reduced![1] }],
          [DeckCardEntity, { id: 2 }, { quantity: expected.increased![1] }],
        ]);
      }
    });

    it.each([
      ['deletes the replacement row at 0 and creates the original row', deckRows(null, 2), { deleted: 2, created: 2 }],
      ['reduces the replacement row and increases the original row', deckRows(1, 3), { reduced: 1, increased: 3 }],
    ])('revert %s', async (_shape, rows, expected) => {
      const { service, manager } = build({ needed: 0, recordStatus: 'active', deckCards: rows });

      await service.resolve(USER_ID, 'r1', 'revert');

      const deleted = (manager.delete as jest.Mock).mock.calls.filter(([entity]) => entity === DeckCardEntity);
      const updated = (manager.update as jest.Mock).mock.calls.filter(([entity]) => entity === DeckCardEntity);
      const inserted = (manager.insert as jest.Mock).mock.calls.filter(([entity]) => entity === DeckCardEntity);
      if ('deleted' in expected) {
        expect(deleted).toEqual([[DeckCardEntity, { id: expected.deleted }]]);
        expect(inserted).toEqual([
          [DeckCardEntity, { trackedDeckId: DECK_ID, cardIdentifier: EMISSARY, quantity: expected.created, slot: 'mainboard' }],
        ]);
        expect(updated).toEqual([]);
      } else {
        expect(deleted).toEqual([]);
        expect(inserted).toEqual([]);
        expect(updated).toEqual([
          [DeckCardEntity, { id: 2 }, { quantity: 1 }],
          [DeckCardEntity, { id: 1 }, { quantity: expected.increased }],
        ]);
      }
    });

    it('keep leaves every deck_card row alone', async () => {
      const { service, manager } = build({ needed: 0, recordStatus: 'active' });

      await service.resolve(USER_ID, 'r1', 'keep');

      expect(
        writes(manager).filter(([entity]) => entity === DeckCardEntity),
      ).toEqual([]);
    });
  });
});
