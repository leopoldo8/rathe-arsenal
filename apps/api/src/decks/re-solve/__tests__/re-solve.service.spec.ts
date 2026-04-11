import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ReSolveService } from '../re-solve.service';
import { RejectedSubstituteEntity } from '../../../database/entities/rejected-substitute.entity';
import { DeckReadinessSnapshotEntity } from '../../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../../auth/authz.service';
import { SubstitutionService } from '../../../substitution/substitution.service';

const USER_ID = 'user-aaa';
const OTHER_USER_ID = 'user-bbb';
const DECK_ID = 1;
const OTHER_DECK_ID = 2;

interface IMinimalReadiness {
  rawPercent: number;
  effectivePercent: number;
  path: 'A' | 'B' | 'C';
  fidelityPercent: number;
  breakdown: {
    exact: Array<{ cardIdentifier: string; quantity: number; slot: string }>;
    substituted: Array<{
      original: { cardIdentifier: string; quantity: number; slot: string };
      match: { tier: 1 | 2 };
    }>;
    missing: Array<{ cardIdentifier: string; quantity: number; slot: string }>;
  };
  substitutions: readonly unknown[];
  pitchCurve: {
    original: { red: number; yellow: number; blue: number; colorless: number };
    modified: { red: number; yellow: number; blue: number; colorless: number };
  };
}

function makeReadiness(
  overrides: Partial<IMinimalReadiness> = {},
): IMinimalReadiness {
  return {
    rawPercent: 80,
    effectivePercent: 95,
    path: 'B',
    fidelityPercent: 96,
    breakdown: {
      exact: [{ cardIdentifier: 'card-a', quantity: 40, slot: 'mainboard' }],
      substituted: [
        {
          original: { cardIdentifier: 'card-b', quantity: 1, slot: 'mainboard' },
          match: { tier: 1 },
        },
      ],
      missing: [],
    },
    substitutions: [],
    pitchCurve: {
      original: { red: 0, yellow: 0, blue: 0, colorless: 0 },
      modified: { red: 0, yellow: 0, blue: 0, colorless: 0 },
    },
    ...overrides,
  };
}

function makeSnapshot(
  readiness: IMinimalReadiness,
): DeckReadinessSnapshotEntity {
  return {
    id: 99,
    trackedDeckId: DECK_ID,
    rawPercent: readiness.rawPercent,
    effectivePercent: readiness.effectivePercent,
    breakdown: readiness.breakdown as unknown as Record<string, unknown>,
    substitutions: readiness.substitutions as unknown as Record<string, unknown>,
    computedAt: new Date(),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
  };
}

describe('ReSolveService', () => {
  let service: ReSolveService;
  let rejectionRepo: jest.Mocked<Repository<RejectedSubstituteEntity>>;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;

  beforeEach(async () => {
    rejectionRepo = createMock<Repository<RejectedSubstituteEntity>>();
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();

    // Default: authz passes. Individual tests override.
    authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);

    // Default deriveSnapshotFields impl — simple passthrough.
    (substitutionService.deriveSnapshotFields as jest.Mock).mockImplementation(
      (snap: DeckReadinessSnapshotEntity) => {
        const b = snap.breakdown as unknown as IMinimalReadiness['breakdown'];
        if (b.missing.length > 0) {
          return { path: 'C' as const, fidelityPercent: 70 };
        }
        if (b.substituted.length > 0) {
          return { path: 'B' as const, fidelityPercent: 96 };
        }
        return { path: 'A' as const, fidelityPercent: 100 };
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReSolveService,
        {
          provide: getRepositoryToken(RejectedSubstituteEntity),
          useValue: rejectionRepo,
        },
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
      ],
    }).compile();

    service = module.get<ReSolveService>(ReSolveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rejectSubstitute', () => {
    it('asserts ownership before touching any data', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await expect(
        service.rejectSubstitute(OTHER_USER_ID, DECK_ID, 'card-x'),
      ).rejects.toThrow(NotFoundException);
      expect(rejectionRepo.save).not.toHaveBeenCalled();
      expect(
        substitutionService.computeAndStoreReadiness,
      ).not.toHaveBeenCalled();
    });

    it('inserts a rejection row and persists a snapshot with the exclusion applied', async () => {
      // Arrange: a tier-2 fallback is available.
      const fallbackReadiness = makeReadiness({
        breakdown: {
          exact: [{ cardIdentifier: 'card-a', quantity: 40, slot: 'mainboard' }],
          substituted: [
            {
              original: { cardIdentifier: 'card-b', quantity: 1, slot: 'mainboard' },
              match: { tier: 2 },
            },
          ],
          missing: [],
        },
      });
      rejectionRepo.findOne.mockResolvedValue(null);
      rejectionRepo.find.mockResolvedValue([
        {
          id: 1,
          trackedDeckId: DECK_ID,
          cardIdentifier: 'rejected-tier1',
          rejectedAt: new Date(),
        } as RejectedSubstituteEntity,
      ]);
      rejectionRepo.create.mockReturnValue({
        trackedDeckId: DECK_ID,
        cardIdentifier: 'rejected-tier1',
      } as RejectedSubstituteEntity);
      rejectionRepo.save.mockResolvedValue({} as RejectedSubstituteEntity);

      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(fallbackReadiness),
      );
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        fallbackReadiness as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      const result = await service.rejectSubstitute(
        USER_ID,
        DECK_ID,
        'rejected-tier1',
      );

      // Assert
      expect(rejectionRepo.save).toHaveBeenCalledTimes(1);
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.any(Set),
      );
      const exclusionSet = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusionSet.has('rejected-tier1')).toBe(true);
      expect(result.effectivePercent).toBe(95);
      expect(result.rejectionCount).toBe(1);
    });

    it('is idempotent when the same identifier is rejected twice', async () => {
      // Arrange
      const existingRejection = {
        id: 7,
        trackedDeckId: DECK_ID,
        cardIdentifier: 'card-dup',
        rejectedAt: new Date(),
      } as RejectedSubstituteEntity;
      rejectionRepo.findOne.mockResolvedValue(existingRejection);
      rejectionRepo.find.mockResolvedValue([existingRejection]);

      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(makeReadiness()),
      );
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      await service.rejectSubstitute(USER_ID, DECK_ID, 'card-dup');

      // Assert
      expect(rejectionRepo.save).not.toHaveBeenCalled();
      expect(rejectionRepo.create).not.toHaveBeenCalled();
    });

    it('emits a curve warning when the rejection pushes a card from substituted to missing', async () => {
      // Arrange
      const withRejection = makeReadiness({
        effectivePercent: 90,
        breakdown: {
          exact: [{ cardIdentifier: 'card-a', quantity: 40, slot: 'mainboard' }],
          substituted: [],
          missing: [{ cardIdentifier: 'card-b', quantity: 1, slot: 'mainboard' }],
        },
      });
      const baseline = makeReadiness({
        breakdown: {
          exact: [{ cardIdentifier: 'card-a', quantity: 40, slot: 'mainboard' }],
          substituted: [
            {
              original: { cardIdentifier: 'card-b', quantity: 1, slot: 'mainboard' },
              match: { tier: 1 },
            },
          ],
          missing: [],
        },
      });
      rejectionRepo.findOne.mockResolvedValue(null);
      rejectionRepo.find.mockResolvedValue([
        {
          id: 1,
          trackedDeckId: DECK_ID,
          cardIdentifier: 'blocked-sub',
          rejectedAt: new Date(),
        } as RejectedSubstituteEntity,
      ]);
      rejectionRepo.create.mockReturnValue(
        {} as RejectedSubstituteEntity,
      );
      rejectionRepo.save.mockResolvedValue({} as RejectedSubstituteEntity);

      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(withRejection),
      );
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        baseline as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      const result = await service.rejectSubstitute(
        USER_ID,
        DECK_ID,
        'blocked-sub',
      );

      // Assert
      expect(result.curveWarnings).toContain('card-b');
    });

    it('cross-deck isolation: rejection in deck A does not affect deck B', async () => {
      // Arrange
      rejectionRepo.findOne.mockResolvedValue(null);
      // Only deck A has rejections; deck B never has any.
      rejectionRepo.find.mockImplementation(async (opts?: unknown) => {
        const where =
          (opts as { where?: { trackedDeckId?: number } })?.where ?? {};
        if (where.trackedDeckId === DECK_ID) {
          return [
            {
              id: 1,
              trackedDeckId: DECK_ID,
              cardIdentifier: 'card-r',
              rejectedAt: new Date(),
            } as RejectedSubstituteEntity,
          ];
        }
        return [];
      });
      rejectionRepo.create.mockReturnValue({} as RejectedSubstituteEntity);
      rejectionRepo.save.mockResolvedValue({} as RejectedSubstituteEntity);

      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(makeReadiness()),
      );
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      await service.rejectSubstitute(USER_ID, DECK_ID, 'card-r');

      // Assert: exclusions passed for deck A must be card-r.
      const exclusionsA = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusionsA.has('card-r')).toBe(true);

      // Now simulate a separate deck B call
      jest.clearAllMocks();
      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      rejectionRepo.findOne.mockResolvedValue(null);
      rejectionRepo.find.mockResolvedValue([]);
      rejectionRepo.create.mockReturnValue({} as RejectedSubstituteEntity);
      rejectionRepo.save.mockResolvedValue({} as RejectedSubstituteEntity);
      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(makeReadiness()),
      );
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      await service.rejectSubstitute(USER_ID, OTHER_DECK_ID, 'card-r');

      const exclusionsB = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusionsB.size).toBe(0);
    });
  });

  describe('resetRejections', () => {
    it('deletes all rejections and recomputes without exclusions', async () => {
      // Arrange
      rejectionRepo.delete.mockResolvedValue({ affected: 3, raw: [] });
      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(makeReadiness()),
      );

      // Act
      const result = await service.resetRejections(USER_ID, DECK_ID);

      // Assert
      expect(authzService.assertOwnsTrackedDeck).toHaveBeenCalledWith(
        USER_ID,
        DECK_ID,
      );
      expect(rejectionRepo.delete).toHaveBeenCalledWith({
        trackedDeckId: DECK_ID,
      });
      const exclusions = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusions.size).toBe(0);
      expect(result.rejectionCount).toBe(0);
      expect(result.curveWarnings).toEqual([]);
    });

    it('asserts ownership before deleting anything', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await expect(
        service.resetRejections(OTHER_USER_ID, DECK_ID),
      ).rejects.toThrow(NotFoundException);
      expect(rejectionRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('reSolveDryRun', () => {
    it('does not write to the rejections table or the snapshot table', async () => {
      // Arrange
      rejectionRepo.count.mockResolvedValue(0);
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      await service.reSolveDryRun(USER_ID, DECK_ID, ['card-x']);

      // Assert
      expect(rejectionRepo.save).not.toHaveBeenCalled();
      expect(rejectionRepo.create).not.toHaveBeenCalled();
      expect(rejectionRepo.delete).not.toHaveBeenCalled();
      expect(
        substitutionService.computeAndStoreReadiness,
      ).not.toHaveBeenCalled();
    });

    it('forwards the exclusion set to SubstitutionService', async () => {
      // Arrange
      rejectionRepo.count.mockResolvedValue(0);
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      await service.reSolveDryRun(USER_ID, DECK_ID, ['a', 'b', 'c']);

      // Assert
      const set = (
        substitutionService.computeReadinessWithExclusions as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(set.size).toBe(3);
      expect(set.has('a')).toBe(true);
      expect(set.has('b')).toBe(true);
      expect(set.has('c')).toBe(true);
    });

    it('asserts ownership before reading anything', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await expect(
        service.reSolveDryRun(OTHER_USER_ID, DECK_ID, ['card-x']),
      ).rejects.toThrow(NotFoundException);
      expect(
        substitutionService.computeReadinessWithExclusions,
      ).not.toHaveBeenCalled();
    });
  });
});
