import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { CardAliasEntity } from '../../database/entities';
import { CatalogService } from '../../catalog/catalog.service';
import {
  CardNameMatcherService,
  buildCandidateIdentifier,
  toKebabCase,
} from '../card-name-matcher.service';
import goldens from '../__fixtures__/card-name-matcher-goldens.json';

describe('CardNameMatcherService', () => {
  let service: CardNameMatcherService;
  let aliasRepo: jest.Mocked<Repository<CardAliasEntity>>;
  let catalogService: jest.Mocked<CatalogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardNameMatcherService,
        {
          provide: getRepositoryToken(CardAliasEntity),
          useValue: createMock<Repository<CardAliasEntity>>(),
        },
        {
          provide: CatalogService,
          useValue: createMock<CatalogService>(),
        },
      ],
    }).compile();

    service = module.get(CardNameMatcherService);
    aliasRepo = module.get(getRepositoryToken(CardAliasEntity));
    catalogService = module.get(CatalogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('match() — alias stage (Stage 1)', () => {
    it('returns alias result when alias exists and catalog confirms the target', async () => {
      // Arrange
      aliasRepo.findOne.mockResolvedValue({
        id: 1,
        sourceSlug: 'cupula-dt',
        rawName: 'Foo Bar Weird Name',
        cardIdentifier: 'some-alias-card',
        createdAt: new Date(),
        notes: null,
      });
      catalogService.getCard.mockReturnValue({
        cardIdentifier: 'some-alias-card',
      } as any);

      // Act
      const result = await service.match('cupula-dt', 'Foo Bar Weird Name');

      // Assert
      expect(result).toEqual([{
        cardIdentifier: 'some-alias-card',
        source: 'alias',
      }]);
      expect(aliasRepo.findOne).toHaveBeenCalledWith({
        where: { sourceSlug: 'cupula-dt', rawName: 'Foo Bar Weird Name' },
      });
    });

    it('returns null and logs warn when alias target is stale (not in catalog)', async () => {
      // Arrange
      const loggerWarnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      aliasRepo.findOne.mockResolvedValue({
        id: 1,
        sourceSlug: 'cupula-dt',
        rawName: 'Old Card Name',
        cardIdentifier: 'removed-card-identifier',
        createdAt: new Date(),
        notes: null,
      });
      catalogService.getCard.mockImplementation(() => {
        throw new CardNotFoundError('removed-card-identifier');
      });

      // Act
      const result = await service.match('cupula-dt', 'Old Card Name');

      // Assert
      expect(result).toEqual([]);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Stale alias: target cardIdentifier not in catalog',
        expect.objectContaining({
          tag: 'alias-target-missing',
          sourceSlug: 'cupula-dt',
          staleCardIdentifier: 'removed-card-identifier',
        }),
      );
    });

    it('alias takes priority over deterministic — returns alias even when deterministic would produce different identifier', async () => {
      // Arrange: alias overrides to a different card than deterministic would produce
      aliasRepo.findOne.mockResolvedValue({
        id: 1,
        sourceSlug: 'cupula-dt',
        rawName: 'Copper',
        cardIdentifier: 'silver', // different from what deterministic would produce ('copper')
        createdAt: new Date(),
        notes: null,
      });
      catalogService.getCard.mockReturnValue({ cardIdentifier: 'silver' } as any);

      // Act
      const result = await service.match('cupula-dt', 'Copper');

      // Assert
      expect(result).toEqual([{ cardIdentifier: 'silver', source: 'alias' }]);
      // Confirm getCard was called only once (alias validation, not deterministic)
      expect(catalogService.getCard).toHaveBeenCalledTimes(1);
      expect(catalogService.getCard).toHaveBeenCalledWith('silver');
    });
  });

  describe('match() — deterministic stage (Stage 2)', () => {
    beforeEach(() => {
      // No alias exists for these tests
      aliasRepo.findOne.mockResolvedValue(null);
    });

    it('matches a resource card by stripping leading quantity prefix', async () => {
      // Arrange
      catalogService.getCard.mockImplementation((id: string) => {
        if (id === 'copper') return { cardIdentifier: 'copper' } as any;
        throw new CardNotFoundError(id);
      });

      // Act
      const result = await service.match('cupula-dt', '5 Copper');

      // Assert
      expect(result).toEqual([{ cardIdentifier: 'copper', source: 'deterministic' }]);
    });

    it('matches a pitched card with Blue color label', async () => {
      // Arrange
      catalogService.getCard.mockImplementation((id: string) => {
        if (id === 'a-drop-in-the-ocean-blue') {
          return { cardIdentifier: 'a-drop-in-the-ocean-blue' } as any;
        }
        throw new CardNotFoundError(id);
      });

      // Act
      const result = await service.match('cupula-dt', 'A Drop in the Ocean (Blue)');

      // Assert
      expect(result).toEqual([{
        cardIdentifier: 'a-drop-in-the-ocean-blue',
        source: 'deterministic',
      }]);
    });

    it('matches a Cold Foil variant by stripping the suffix', async () => {
      // Arrange
      catalogService.getCard.mockImplementation((id: string) => {
        if (id === 'aether-crackers') {
          return { cardIdentifier: 'aether-crackers' } as any;
        }
        throw new CardNotFoundError(id);
      });

      // Act
      const result = await service.match('cupula-dt', 'Aether Crackers (Cold Foil)');

      // Assert
      expect(result).toEqual([{
        cardIdentifier: 'aether-crackers',
        source: 'deterministic',
      }]);
    });

    it('returns null and emits no throw when candidate is not in catalog', async () => {
      // Arrange
      catalogService.getCard.mockImplementation(() => {
        throw new CardNotFoundError('some-random-product-not-a-card');
      });

      // Act
      const result = await service.match('cupula-dt', 'Some Random Product Not a Card');

      // Assert
      expect(result).toEqual([]);
    });

    it('returns empty array for empty rawName', async () => {
      const result = await service.match('cupula-dt', '');
      expect(result).toEqual([]);
      expect(aliasRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns empty array for whitespace-only rawName', async () => {
      const result = await service.match('cupula-dt', '   ');
      expect(result).toEqual([]);
    });
  });

  describe('match() — error handling', () => {
    it('re-throws unexpected errors from catalogService.getCard (alias stage)', async () => {
      // Arrange
      aliasRepo.findOne.mockResolvedValue({
        id: 1,
        sourceSlug: 'cupula-dt',
        rawName: 'Some Card',
        cardIdentifier: 'some-card',
        createdAt: new Date(),
        notes: null,
      });
      const unexpectedError = new Error('DB connection lost');
      catalogService.getCard.mockImplementation(() => {
        throw unexpectedError;
      });

      // Act & Assert
      await expect(service.match('cupula-dt', 'Some Card')).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('re-throws unexpected errors from catalogService.getCard (deterministic stage)', async () => {
      // Arrange
      aliasRepo.findOne.mockResolvedValue(null);
      const unexpectedError = new Error('Catalog index corrupted');
      catalogService.getCard.mockImplementation(() => {
        throw unexpectedError;
      });

      // Act & Assert
      await expect(service.match('cupula-dt', 'Head Jab (Red)')).rejects.toThrow(
        'Catalog index corrupted',
      );
    });
  });
});

describe('buildCandidateIdentifier (pure function)', () => {
  it('strips leading quantity prefix from resource card', () => {
    expect(buildCandidateIdentifier('5 Copper')).toBe('copper');
  });

  it('strips leading multi-digit quantity prefix', () => {
    expect(buildCandidateIdentifier('12 Copper')).toBe('copper');
  });

  it('extracts Blue pitch color label', () => {
    expect(buildCandidateIdentifier('A Drop in the Ocean (Blue)')).toBe(
      'a-drop-in-the-ocean-blue',
    );
  });

  it('extracts Red pitch color label', () => {
    expect(buildCandidateIdentifier('Head Jab (Red)')).toBe('head-jab-red');
  });

  it('extracts Yellow pitch color label', () => {
    expect(buildCandidateIdentifier("Autumn's Touch (Yellow)")).toBe(
      'autumns-touch-yellow',
    );
  });

  it('strips Cold Foil suffix before applying kebab transform', () => {
    expect(buildCandidateIdentifier('Aether Crackers (Cold Foil)')).toBe(
      'aether-crackers',
    );
  });

  it('strips Rainbow Foil suffix', () => {
    expect(buildCandidateIdentifier('Aether Crackers (Rainbow Foil)')).toBe(
      'aether-crackers',
    );
  });

  it('strips plain Foil suffix', () => {
    expect(buildCandidateIdentifier('Aether Crackers (Foil)')).toBe(
      'aether-crackers',
    );
  });

  it('strips multiple parentheses: foil suffix then pitch color', () => {
    expect(buildCandidateIdentifier('Head Jab (Rainbow Foil) (Red)')).toBe(
      'head-jab-red',
    );
  });

  it('handles pitch-less card (equipment/hero) — no color label in name', () => {
    expect(buildCandidateIdentifier('Bravo')).toBe('bravo');
  });

  it('strips apostrophes from name', () => {
    expect(buildCandidateIdentifier("Autumn's Touch (Red)")).toBe(
      'autumns-touch-red',
    );
  });

  it('handles quantity prefix with pitched card', () => {
    expect(buildCandidateIdentifier('2 Head Jab (Red)')).toBe('head-jab-red');
  });

  it('returns null for empty string', () => {
    expect(buildCandidateIdentifier('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(buildCandidateIdentifier('   ')).toBeNull();
  });
});

describe('toKebabCase (pure function)', () => {
  it('lowercases the input', () => {
    expect(toKebabCase('HEAD JAB')).toBe('head-jab');
  });

  it('replaces spaces with hyphens', () => {
    expect(toKebabCase('A Drop in the Ocean')).toBe('a-drop-in-the-ocean');
  });

  it('strips commas', () => {
    expect(toKebabCase('10,000 Year Reunion')).toBe('10000-year-reunion');
  });

  it('strips apostrophes', () => {
    expect(toKebabCase("Autumn's Touch")).toBe('autumns-touch');
  });

  it('strips periods (including ellipsis)', () => {
    expect(toKebabCase('Argh... Smash!')).toBe('argh-smash');
  });

  it('strips exclamation marks', () => {
    expect(toKebabCase('Avast Ye!')).toBe('avast-ye');
  });

  it('preserves existing hyphens in the name', () => {
    expect(toKebabCase('Fact-Finding Mission')).toBe('fact-finding-mission');
  });

  it('collapses consecutive hyphens to one', () => {
    // e.g. "Foo  Bar" (double space) -> "foo-bar"
    expect(toKebabCase('Foo  Bar')).toBe('foo-bar');
  });

  it('strips colons', () => {
    expect(toKebabCase('Foo: Bar')).toBe('foo-bar');
  });
});

describe('goldens fixture regression', () => {
  // Uses the actual @rathe-arsenal/engine catalog in-process.
  // This test builds a real catalog index to validate the deterministic
  // transform produces identifiers that exist in the live data.
  let engine: typeof import('@rathe-arsenal/engine');

  beforeAll(async () => {
    engine = await import('@rathe-arsenal/engine');
  });

  for (const golden of goldens) {
    if (golden.expectedIdentifier === null) {
      it(`returns null for: ${golden.description}`, () => {
        const candidate = buildCandidateIdentifier(golden.rawName);
        // Either candidate is null (empty) or not in catalog
        if (candidate === null) {
          expect(candidate).toBeNull();
        } else {
          // candidate was produced but should not exist in catalog
          expect(() => engine.catalog.getCard(candidate)).toThrow(
            CardNotFoundError,
          );
        }
      });
    } else {
      it(`matches correctly: ${golden.description}`, () => {
        // Arrange
        const candidate = buildCandidateIdentifier(golden.rawName);

        // Assert transform
        expect(candidate).toBe(golden.expectedIdentifier);

        // Assert catalog lookup
        const card = engine.catalog.getCard(candidate!);
        expect(card.cardIdentifier).toBe(golden.expectedIdentifier);
      });
    }
  }
});
