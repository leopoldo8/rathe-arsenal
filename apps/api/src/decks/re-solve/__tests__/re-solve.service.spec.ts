import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { NotFoundException } from '@nestjs/common';
import { ReSolveService } from '../re-solve.service';
import { DeckReadinessSnapshotEntity } from '../../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../../auth/authz.service';
import { SubstitutionService } from '../../../substitution/substitution.service';
import { DecisionsService } from '../../decisions/decisions.service';

const USER_ID = 'user-aaa';
const OTHER_USER_ID = 'user-bbb';
const DECK_ID = 1;

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

describe('ReSolveService (deprecated, stubs)', () => {
  let service: ReSolveService;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let decisionsService: jest.Mocked<DecisionsService>;

  beforeEach(async () => {
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();
    decisionsService = createMock<DecisionsService>();

    // Default: authz passes. Individual tests override.
    authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
    decisionsService.loadExclusions.mockResolvedValue(new Set());
    decisionsService.countRejected.mockResolvedValue(0);
    decisionsService.clearRejections.mockResolvedValue(0);

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
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: DecisionsService, useValue: decisionsService },
      ],
    }).compile();

    service = module.get<ReSolveService>(ReSolveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rejectSubstitute (deprecated endpoint)', () => {
    it('asserts ownership before touching any data', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await expect(
        service.rejectSubstitute(OTHER_USER_ID, DECK_ID, 'card-x'),
      ).rejects.toThrow(NotFoundException);
      expect(decisionsService.upsert).not.toHaveBeenCalled();
      expect(
        substitutionService.computeAndStoreReadiness,
      ).not.toHaveBeenCalled();
    });

    it('upserts a rejected decision and persists a snapshot', async () => {
      // Arrange
      const readiness = makeReadiness();
      decisionsService.upsert.mockResolvedValue({
        cardIdentifier: 'rejected-card',
        decision: 'rejected',
      });
      decisionsService.loadExclusions.mockResolvedValue(new Set(['rejected-card']));
      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        makeSnapshot(readiness),
      );
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        readiness as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      const result = await service.rejectSubstitute(USER_ID, DECK_ID, 'rejected-card');

      // Assert
      expect(decisionsService.upsert).toHaveBeenCalledWith({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        cardIdentifier: 'rejected-card',
        decision: 'rejected',
      });
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.any(Set),
      );
      // rejectionCount = exclusions.size
      expect(result.rejectionCount).toBe(1);
    });
  });

  describe('resetRejections (deprecated endpoint)', () => {
    it('clears all rejections and recomputes without exclusions', async () => {
      // Arrange
      decisionsService.clearRejections.mockResolvedValue(3);
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
      expect(decisionsService.clearRejections).toHaveBeenCalledWith(USER_ID, DECK_ID);
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
      expect(decisionsService.clearRejections).not.toHaveBeenCalled();
    });
  });

  describe('reSolveDryRun', () => {
    it('does not write to the decisions table or the snapshot table', async () => {
      // Arrange
      decisionsService.countRejected.mockResolvedValue(0);
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      await service.reSolveDryRun(USER_ID, DECK_ID, ['card-x']);

      // Assert
      expect(decisionsService.upsert).not.toHaveBeenCalled();
      expect(
        substitutionService.computeAndStoreReadiness,
      ).not.toHaveBeenCalled();
    });

    it('uses decisionsService.countRejected for persistedCount (U9 bug fix)', async () => {
      // Arrange: 2 persisted rejections in substitute_decision.
      decisionsService.countRejected.mockResolvedValue(2);
      substitutionService.computeReadinessWithExclusions.mockResolvedValue(
        makeReadiness() as unknown as Awaited<
          ReturnType<SubstitutionService['computeReadinessWithExclusions']>
        >,
      );

      // Act
      const result = await service.reSolveDryRun(USER_ID, DECK_ID, ['card-x']);

      // Assert: rejectionCount comes from decisionsService, not a dropped table.
      expect(decisionsService.countRejected).toHaveBeenCalledWith(DECK_ID);
      expect(result.rejectionCount).toBe(2);
    });

    it('forwards the exclusion set to SubstitutionService', async () => {
      // Arrange
      decisionsService.countRejected.mockResolvedValue(0);
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
