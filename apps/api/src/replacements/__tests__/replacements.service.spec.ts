import { Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager } from 'typeorm';
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

function build(options: { needed: number; recordStatus?: CardReplacementEntity['status'] }) {
  const manager = createMock<EntityManager>();
  let recordReads = 0;
  manager.findOne.mockImplementation((async (entity: unknown) => {
    if (entity === TrackedDeckEntity) {
      return { id: DECK_ID, userId: USER_ID, heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' };
    }
    if (entity === CardReplacementEntity) {
      recordReads += 1;
      // The last read happens after the status update, so it sees the closed record.
      return recordReads >= 3 && options.recordStatus === 'active' ? record('kept') : record(options.recordStatus ?? 'active');
    }
    return null;
  }) as never);
  manager.find.mockResolvedValue([
    { id: 1, trackedDeckId: DECK_ID, cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
    { id: 2, trackedDeckId: DECK_ID, cardIdentifier: COAX, quantity: 2, slot: 'mainboard' },
  ] as never);
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
  collection.loadOwned.mockResolvedValue(new Map());

  return { service: new ReplacementsService(dataSource, substitution, swaps, replacements, collection), substitution };
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

    expect(events('replacements.resolved')).toHaveLength(2);
    expect(events('replacements.resolved')[0]).toEqual({
      event: 'replacements.resolved',
      userId: USER_ID,
      trackedDeckId: DECK_ID,
      replacementId: 'r1',
      status: 'kept',
    });

    logSpy.mockClear();
    const closed = build({ needed: 0, recordStatus: 'removed' });
    await expect(closed.service.resolve(USER_ID, 'r1', 'keep')).rejects.toMatchObject({
      response: { code: 'REPLACEMENT_NOT_ACTIVE' },
    });
    expect(events('replacements.resolved')).toEqual([]);
  });
});
