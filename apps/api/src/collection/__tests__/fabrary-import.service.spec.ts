/**
 * Unit tests for FabraryImportService — the third add-cards path.
 *
 * Covers the pure aggregation helper (deck → resolved rows) and the
 * service entry point with mocked transport, repositories and side-
 * effect services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  FabraryImportService,
  aggregateAsResolvedRows,
} from '../sources/fabrary-import.service';
import { FabraryService } from '../../fabrary/fabrary.service';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import {
  FabraryImportError,
  EFabraryErrorCode,
} from '../../fabrary/errors';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';

const VALID_URL = 'https://fabrary.net/decks/01HTESTABCDEFGHJKMNPQRSTVW';
const USER_ID = 'user-fab-import-1';

function buildDeck(overrides: Partial<IDeckImportDto> = {}): IDeckImportDto {
  return {
    ulid: '01HTESTABCDEFGHJKMNPQRSTVW',
    name: 'Kayo Brute Bash',
    format: 'classic-constructed',
    hero: { cardIdentifier: 'kayo', name: 'Kayo' },
    mainboard: [
      { cardIdentifier: 'wild-ride-red', quantity: 3, slot: 'mainboard' },
      { cardIdentifier: 'bare-fangs-red', quantity: 3, slot: 'mainboard' },
    ],
    equipment: [
      { cardIdentifier: 'hide-tanner', quantity: 1, slot: 'equipment' },
    ],
    weapons: [
      { cardIdentifier: 'savage-sash', quantity: 1, slot: 'weapon' },
    ],
    inventory: [],
    ...overrides,
  };
}

describe('aggregateAsResolvedRows', () => {
  it('flattens hero + mainboard + equipment + weapons into one list', () => {
    const rows = aggregateAsResolvedRows(buildDeck());
    expect(rows).toHaveLength(5);
    const ids = rows.map((r) => r.cardIdentifier);
    expect(ids).toContain('kayo');
    expect(ids).toContain('wild-ride-red');
    expect(ids).toContain('hide-tanner');
    expect(ids).toContain('savage-sash');
  });

  it('hero is counted as quantity 1', () => {
    const rows = aggregateAsResolvedRows(buildDeck());
    const hero = rows.find((r) => r.cardIdentifier === 'kayo');
    expect(hero?.quantity).toBe(1);
  });

  it('sums quantities when the same identifier appears in two slots', () => {
    const deck = buildDeck({
      mainboard: [
        { cardIdentifier: 'shared', quantity: 2, slot: 'mainboard' },
      ],
      equipment: [
        { cardIdentifier: 'shared', quantity: 1, slot: 'equipment' },
      ],
    });
    const rows = aggregateAsResolvedRows(deck);
    const shared = rows.find((r) => r.cardIdentifier === 'shared');
    expect(shared?.quantity).toBe(3);
  });

  it('skips zero-quantity entries defensively', () => {
    const deck = buildDeck({
      mainboard: [
        { cardIdentifier: 'wild-ride-red', quantity: 0, slot: 'mainboard' },
      ],
      equipment: [],
      weapons: [],
    });
    const rows = aggregateAsResolvedRows(deck);
    const wild = rows.find((r) => r.cardIdentifier === 'wild-ride-red');
    expect(wild).toBeUndefined();
    // hero still counted
    expect(rows.find((r) => r.cardIdentifier === 'kayo')).toBeDefined();
  });

  it('assigns sequential row numbers starting at 1', () => {
    const rows = aggregateAsResolvedRows(buildDeck());
    expect(rows[0]?.rowNumber).toBe(1);
    expect(rows[1]?.rowNumber).toBe(2);
    expect(rows.every((r, i) => r.rowNumber === i + 1)).toBe(true);
  });

  it('includes inventory cards (Fabrary "Inventory" section) in the resolved rows', () => {
    const deck = buildDeck({
      mainboard: [],
      equipment: [],
      weapons: [],
      inventory: [
        { cardIdentifier: 'cast-bones-red', quantity: 3, slot: 'mainboard' },
      ],
    });
    const rows = aggregateAsResolvedRows(deck);
    const castBones = rows.find((r) => r.cardIdentifier === 'cast-bones-red');
    expect(castBones?.quantity).toBe(3);
  });

  it('sums deck and inventory quantities for a card held in both', () => {
    const deck = buildDeck({
      mainboard: [
        { cardIdentifier: 'reckless-swing-blue', quantity: 1, slot: 'mainboard' },
      ],
      equipment: [],
      weapons: [],
      inventory: [
        { cardIdentifier: 'reckless-swing-blue', quantity: 1, slot: 'mainboard' },
      ],
    });
    const rows = aggregateAsResolvedRows(deck);
    const reckless = rows.find((r) => r.cardIdentifier === 'reckless-swing-blue');
    expect(reckless?.quantity).toBe(2);
  });
});

describe('FabraryImportService', () => {
  let service: FabraryImportService;
  let fabraryService: jest.Mocked<FabraryService>;
  let csvSourceRepo: jest.Mocked<Repository<CsvSourceEntity>>;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let decisionsService: jest.Mocked<DecisionsService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    fabraryService = createMock<FabraryService>();
    csvSourceRepo = createMock<Repository<CsvSourceEntity>>();
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    decisionsService = createMock<DecisionsService>();
    substitutionService = createMock<SubstitutionService>();

    manager = createMock<EntityManager>();
    // create returns the entity it was called with so the saved row picks
    // up an id later in the test.
    manager.create.mockImplementation((_entity, payload) => payload as never);
    manager.save.mockImplementation(
      async (_entity, value) => {
        // Simulate Postgres assigning a uuid for the source row.
        if (Array.isArray(value)) return value as never;
        if ('kind' in (value as object) && (value as { kind?: string }).kind === 'csv') {
          return { ...(value as object), id: 'fab-source-uuid-1' } as never;
        }
        return value as never;
      },
    );

    dataSource = createMock<DataSource>();
    // DataSource.transaction has multiple overloads; cast to the simplest
    // single-arg form for the mock.
    (dataSource.transaction as unknown as jest.Mock).mockImplementation(
      async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    );

    trackedDeckRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FabraryImportService,
        { provide: FabraryService, useValue: fabraryService },
        { provide: getRepositoryToken(CsvSourceEntity), useValue: csvSourceRepo },
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
        },
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: DecisionsService, useValue: decisionsService },
        { provide: SubstitutionService, useValue: substitutionService },
      ],
    }).compile();

    service = module.get(FabraryImportService);
  });

  it('throws BadRequest for an obviously invalid URL', async () => {
    await expect(
      service.importFromUrl(USER_ID, 'not a url'),
    ).rejects.toThrow(BadRequestException);
    expect(fabraryService.fetchDeck).not.toHaveBeenCalled();
  });

  it('translates Fabrary INVALID_PAYLOAD into BadRequest', async () => {
    fabraryService.fetchDeck.mockRejectedValue(
      new FabraryImportError(EFabraryErrorCode.INVALID_PAYLOAD, 'bad'),
    );
    await expect(service.importFromUrl(USER_ID, VALID_URL)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty deck (no importable cards)', async () => {
    fabraryService.fetchDeck.mockResolvedValue(
      buildDeck({
        hero: { cardIdentifier: '', name: '' },
        mainboard: [],
        equipment: [],
        weapons: [],
      }),
    );
    await expect(service.importFromUrl(USER_ID, VALID_URL)).rejects.toThrow(
      'no importable cards',
    );
  });

  it('on happy path persists a csv source + collection cards and returns counts', async () => {
    fabraryService.fetchDeck.mockResolvedValue(buildDeck());

    const result = await service.importFromUrl(USER_ID, VALID_URL);

    expect(result).toEqual({
      sourceId: 'fab-source-uuid-1',
      cardCount: 1 + 3 + 3 + 1 + 1, // hero + 2x3 + equipment + weapon
      uniqueCardCount: 5,
      deckName: 'Kayo Brute Bash',
      format: 'classic-constructed',
    });

    // The transaction created a CsvSourceEntity with the Fabrary URL stamped.
    const sourceCall = manager.save.mock.calls.find(
      (call) =>
        typeof call[1] === 'object' &&
        !Array.isArray(call[1]) &&
        (call[1] as { kind?: string }).kind === 'csv',
    );
    expect(sourceCall).toBeDefined();
    const persisted = sourceCall?.[1] as Partial<CsvSourceEntity>;
    expect(persisted.userId).toBe(USER_ID);
    expect(persisted.sourceUrl).toBe(VALID_URL);
    expect(persisted.label).toBe('Fabrary: Kayo Brute Bash');
    expect(persisted.active).toBe(true);
  });
});
