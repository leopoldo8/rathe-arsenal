import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SourcesService } from '../sources/sources.service';

const USER_ID = 'user-uuid-test-001';
const SOURCE_ID = 'csv-source-uuid-001';

function buildManualSource(
  overrides: Partial<CsvSourceEntity> = {},
): CsvSourceEntity {
  return {
    id: SOURCE_ID,
    userId: USER_ID,
    kind: 'manual',
    label: 'Manual entries',
    originalFilename: null,
    sourceUrl: null,
    contentHash: null,
    cardCount: null,
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    user: {} as CsvSourceEntity['user'],
    ...overrides,
  };
}

describe('SourcesService', () => {
  let service: SourcesService;
  let csvSourceRepo: jest.Mocked<Repository<CsvSourceEntity>>;

  beforeEach(async () => {
    csvSourceRepo = createMock<Repository<CsvSourceEntity>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        {
          provide: getRepositoryToken(CsvSourceEntity),
          useValue: csvSourceRepo,
        },
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: createMock<Repository<CollectionCardEntity>>(),
        },
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: createMock<Repository<TrackedDeckEntity>>(),
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: createMock<Repository<DeckReadinessSnapshotEntity>>(),
        },
        {
          provide: DataSource,
          useValue: createMock<DataSource>(),
        },
        {
          provide: DecisionsService,
          useValue: createMock<DecisionsService>(),
        },
        {
          provide: SubstitutionService,
          useValue: createMock<SubstitutionService>(),
        },
      ],
    }).compile();

    service = module.get<SourcesService>(SourcesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureManualSource', () => {
    it('returns existing manual source when one already exists', async () => {
      // Arrange
      const existing = buildManualSource();
      csvSourceRepo.findOne.mockResolvedValue(existing);

      // Act
      const result = await service.ensureManualSource(USER_ID);

      // Assert
      expect(result.id).toBe(SOURCE_ID);
      expect(result.kind).toBe('manual');
      // Save was NOT called — we returned the existing row.
      expect(csvSourceRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new manual source when none exists', async () => {
      // Arrange — first findOne returns null (no existing row).
      const created = buildManualSource();
      csvSourceRepo.findOne.mockResolvedValue(null);
      csvSourceRepo.create.mockReturnValue(created);
      csvSourceRepo.save.mockResolvedValue(created);

      // Act
      const result = await service.ensureManualSource(USER_ID);

      // Assert
      expect(csvSourceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          kind: 'manual',
          label: 'Manual entries',
          active: true,
        }),
      );
      expect(csvSourceRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(SOURCE_ID);
    });

    it('is idempotent: two sequential calls return the same source id with only one DB write', async () => {
      // Arrange — first call: no row; subsequent: row exists.
      const created = buildManualSource();
      csvSourceRepo.findOne
        .mockResolvedValueOnce(null)     // First call: no existing row.
        .mockResolvedValue(created);     // Subsequent calls: row exists.
      csvSourceRepo.create.mockReturnValue(created);
      csvSourceRepo.save.mockResolvedValue(created);

      // Act
      const first = await service.ensureManualSource(USER_ID);
      const second = await service.ensureManualSource(USER_ID);

      // Assert: both calls return the same source id.
      expect(first.id).toBe(SOURCE_ID);
      expect(second.id).toBe(SOURCE_ID);

      // Save called exactly once (only on the first call).
      expect(csvSourceRepo.save).toHaveBeenCalledTimes(1);
    });

    it('re-reads the row on unique-constraint violation (concurrent insert race)', async () => {
      // Arrange — simulate a concurrent insert: findOne returns null, save
      // throws a pg unique-constraint error (code 23505), then findOne
      // returns the row inserted by the concurrent caller.
      const created = buildManualSource();
      const uniqueViolationError = Object.assign(new Error('unique violation'), {
        code: '23505',
      });

      csvSourceRepo.findOne
        .mockResolvedValueOnce(null)    // Initial check: no row.
        .mockResolvedValue(created);    // Re-read after constraint error.
      csvSourceRepo.create.mockReturnValue(created);
      csvSourceRepo.save.mockRejectedValueOnce(uniqueViolationError);

      // Act
      const result = await service.ensureManualSource(USER_ID);

      // Assert: service recovered and returned the existing row.
      expect(result.id).toBe(SOURCE_ID);
      // findOne called twice: initial check + recovery re-read.
      expect(csvSourceRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('re-throws non-constraint errors from save', async () => {
      // Arrange
      const unexpectedError = Object.assign(new Error('connection lost'), {
        code: '08006',
      });
      csvSourceRepo.findOne.mockResolvedValue(null);
      csvSourceRepo.create.mockReturnValue(buildManualSource());
      csvSourceRepo.save.mockRejectedValueOnce(unexpectedError);

      // Act & Assert
      await expect(service.ensureManualSource(USER_ID)).rejects.toThrow(
        'connection lost',
      );
    });
  });
});
