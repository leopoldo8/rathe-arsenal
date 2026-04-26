import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { CatalogService } from '../../catalog/catalog.service';
import { CsvParserService, computeContentHash } from '../csv/csv-parser.service';
import { IResolvedCsvRow } from '../csv/csv.types';
import { ICatalogCard } from '@rathe-arsenal/engine';

// ---------------------------------------------------------------------------
// Test catalog helpers
// ---------------------------------------------------------------------------

function buildCatalogCard(
  overrides: Partial<ICatalogCard> & { cardIdentifier: string; name: string },
): ICatalogCard {
  return {
    pitch: null,
    power: null,
    defense: null,
    cost: null,
    classes: [],
    talents: [],
    types: [],
    keywords: [],
    subtypes: [],
    legalHeroes: [],
    sets: [],
    imageUrl: null,
    ...overrides,
  };
}

// A set of catalog cards used by multiple test cases.
const CATALOG_CARDS: readonly ICatalogCard[] = [
  buildCatalogCard({ cardIdentifier: 'absorb-in-aether-red', name: 'Absorb in Aether', pitch: 1 }),
  buildCatalogCard({ cardIdentifier: 'absorb-in-aether-yellow', name: 'Absorb in Aether', pitch: 2 }),
  buildCatalogCard({ cardIdentifier: 'absorb-in-aether-blue', name: 'Absorb in Aether', pitch: 3 }),
  buildCatalogCard({ cardIdentifier: 'command-and-conquer', name: 'Command and Conquer', pitch: 1 }),
  buildCatalogCard({ cardIdentifier: 'enlightened-strike', name: 'Enlightened Strike', pitch: 1 }),
  buildCatalogCard({ cardIdentifier: 'razor-reflex-red', name: 'Razor Reflex', pitch: 1 }),
  buildCatalogCard({ cardIdentifier: 'razor-reflex-yellow', name: 'Razor Reflex', pitch: 2 }),
  buildCatalogCard({ cardIdentifier: 'razor-reflex-blue', name: 'Razor Reflex', pitch: 3 }),
  buildCatalogCard({ cardIdentifier: 'aether-dart-red', name: 'Aether Dart', pitch: 1 }),
  // Multi-pitch action used by the Fabrary-suffix test cases.
  buildCatalogCard({ cardIdentifier: 'bare-fangs-red', name: 'Bare Fangs', pitch: 1 }),
  buildCatalogCard({ cardIdentifier: 'bare-fangs-yellow', name: 'Bare Fangs', pitch: 2 }),
  buildCatalogCard({ cardIdentifier: 'bare-fangs-blue', name: 'Bare Fangs', pitch: 3 }),
  // Single-pitch action that Fabrary still exports with a "(red)" suffix.
  buildCatalogCard({ cardIdentifier: 'cast-bones-red', name: 'Cast Bones', pitch: 1 }),
  // Equipment: no pitch, exported without suffix.
  buildCatalogCard({ cardIdentifier: 'hide-tanner', name: 'Hide Tanner', pitch: null }),
];

// Raw card data used for set disambiguation (via getRawCard).
const RAW_CARDS: Record<string, { setIdentifiers?: string[] }> = {
  'absorb-in-aether-red': { setIdentifiers: ['ARC015', 'CRU064'] },
  'absorb-in-aether-yellow': { setIdentifiers: ['ARC016'] },
  'absorb-in-aether-blue': { setIdentifiers: ['ARC017'] },
};

function buildCatalogService(): jest.Mocked<CatalogService> {
  const mock = createMock<CatalogService>();
  mock.getCards.mockReturnValue(CATALOG_CARDS);
  mock.getRawCard.mockImplementation((id: string) => RAW_CARDS[id] ?? {});
  // Index by identifier so the pitch-suffix path can look up a card's pitch.
  const byIdentifier = new Map<string, ICatalogCard>(
    CATALOG_CARDS.map((c) => [c.cardIdentifier, c]),
  );
  mock.getCard.mockImplementation((id: string) => {
    const card = byIdentifier.get(id);
    if (!card) throw new Error(`Test catalog: unknown card ${id}`);
    return card;
  });
  return mock;
}

// ---------------------------------------------------------------------------
// Helpers to build CSV buffers
// ---------------------------------------------------------------------------

function csvBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Module setup
// ---------------------------------------------------------------------------

describe('CsvParserService', () => {
  let service: CsvParserService;
  let catalogService: jest.Mocked<CatalogService>;

  beforeEach(async () => {
    // Reset the module-level name index cache between tests.
    jest.resetModules();

    catalogService = buildCatalogService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvParserService,
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    service = module.get<CsvParserService>(CsvParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy paths
  // -------------------------------------------------------------------------

  describe('happy path: basic resolution', () => {
    it('resolves 10 unique rows to 10 cards with 0 skipped', () => {
      // Arrange: 3 unique cards × repeated rows = 10 data rows.
      const csv = csvBuffer(
        'Name,Quantity\n' +
          'Command and Conquer,1\n' +
          'Enlightened Strike,2\n' +
          'Command and Conquer,3\n' +
          'Enlightened Strike,1\n' +
          'Command and Conquer,2\n' +
          'Enlightened Strike,3\n' +
          'Command and Conquer,1\n' +
          'Enlightened Strike,1\n' +
          'Command and Conquer,2\n' +
          'Enlightened Strike,1\n',
      );

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.resolved).toHaveLength(10);
      expect(result.skipped).toHaveLength(0);
    });

    it('resolves a card that exists under exactly one identifier', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\nCommand and Conquer,3\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.resolved).toHaveLength(1);
      const [row] = result.resolved;
      expect(row?.cardIdentifier).toBe('command-and-conquer');
      expect(row?.quantity).toBe(3);
      expect(result.skipped).toHaveLength(0);
    });

    it('is case-insensitive for card names', () => {
      // Arrange: name in CSV uses different casing from catalog.
      const csv = csvBuffer('Name,Quantity\ncommand and conquer,2\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.resolved).toHaveLength(1);
      const [row] = result.resolved;
      expect(row?.cardIdentifier).toBe('command-and-conquer');
    });

    it('uses the set column to disambiguate a multi-pitch card (narrow to one identifier)', () => {
      // Arrange: override getRawCard so ARC only appears on the red variant.
      catalogService.getRawCard.mockImplementation((id: string) => {
        const overrides: Record<string, { setIdentifiers: string[] }> = {
          'absorb-in-aether-red': { setIdentifiers: ['ARC015'] },
          'absorb-in-aether-yellow': { setIdentifiers: ['WTR016'] },
          'absorb-in-aether-blue': { setIdentifiers: ['WTR017'] },
        };
        return overrides[id] ?? {};
      });

      const csv = csvBuffer('Name,Quantity,Set\nAbsorb in Aether,2,ARC\n');

      // Act
      const result = service.parse(csv);

      // Assert: the ARC set narrows to exactly one identifier.
      expect(result.resolved).toHaveLength(1);
      const [row] = result.resolved;
      expect(row?.cardIdentifier).toBe('absorb-in-aether-red');
      expect(result.skipped).toHaveLength(0);
    });

    it('handles column aliases: "Card Name", "Qty", "Set Code"', () => {
      // Arrange
      const csv = csvBuffer('Card Name,Qty,Set Code\nCommand and Conquer,1,WTR\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.resolved).toHaveLength(1);
      const [row] = result.resolved;
      expect(row?.cardIdentifier).toBe('command-and-conquer');
    });

    it('handles "Count" as a quantity alias', () => {
      // Arrange
      const csv = csvBuffer('name,Count\nCommand and Conquer,5\n');

      // Act
      const result = service.parse(csv);

      // Assert
      const [row] = result.resolved;
      expect(row?.quantity).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge case: empty / header-only CSV', () => {
    it('returns empty resolved and skipped arrays for an empty CSV (no rows)', () => {
      // Arrange: only a header row, no data.
      const csv = csvBuffer('Name,Quantity\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.resolved).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });

    it('throws INVALID_CSV for a completely empty buffer (no header, no rows)', () => {
      // Arrange: a completely empty buffer has no header, so papaparse
      // reports errors. A valid "empty" CSV always has at least a header row.
      const csv = csvBuffer('');

      // Act & Assert: empty buffer → INVALID_CSV (malformed, no header).
      expect(() => service.parse(csv)).toThrow(BadRequestException);
    });
  });

  describe('edge case: ambiguous card (multi-pitch, no set column)', () => {
    it('skips a card with multiple identifiers when no set column is present', () => {
      // Arrange: "Absorb in Aether" maps to 3 identifiers; no set column.
      const csv = csvBuffer('Name,Quantity\nAbsorb in Aether,1\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('ambiguous');
      expect(skipped?.name).toBe('Absorb in Aether');
      expect(result.resolved).toHaveLength(0);
    });

    it('skips a card with multiple identifiers when set column is present but still ambiguous', () => {
      // Arrange: override getRawCard so set column matches all 3 variants.
      catalogService.getRawCard.mockReturnValue({ setIdentifiers: ['ARC015'] });

      const csv = csvBuffer('Name,Quantity,Set\nAbsorb in Aether,1,ARC\n');

      // Act
      const result = service.parse(csv);

      // Assert: all 3 variants have ARC → still ambiguous.
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('ambiguous');
    });
  });

  describe('edge case: unknown card name', () => {
    it('skips a row with a name not found in the catalog', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\nNonexistent Card XYZ,1\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('no-match');
      expect(skipped?.name).toBe('Nonexistent Card XYZ');
      expect(result.resolved).toHaveLength(0);
    });
  });

  describe('edge case: invalid quantity', () => {
    it('skips a row with quantity = 0', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\nCommand and Conquer,0\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('invalid-quantity');
    });

    it('skips a row with a negative quantity', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\nCommand and Conquer,-2\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('invalid-quantity');
    });

    it('skips a row with a non-numeric quantity', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\nCommand and Conquer,abc\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('invalid-quantity');
    });

    it('skips a row with an empty quantity', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\nCommand and Conquer,\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('invalid-quantity');
    });
  });

  describe('edge case: empty name', () => {
    it('skips a row with an empty name', () => {
      // Arrange
      const csv = csvBuffer('Name,Quantity\n,3\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('empty-name');
    });

    it('skips a row where the name is only whitespace', () => {
      // Arrange: papaparse preserves whitespace in cell values.
      const csv = csvBuffer('Name,Quantity\n   ,2\n');

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.skipped).toHaveLength(1);
      const [skipped] = result.skipped;
      expect(skipped?.reason).toBe('empty-name');
    });
  });

  describe('edge case: malformed CSV', () => {
    it('throws BadRequestException(INVALID_CSV) for a CSV with unclosed quotes', () => {
      // Arrange: papaparse error on malformed input.
      const csv = csvBuffer('Name,Quantity\n"Unclosed Quote,1\n');

      // Act & Assert
      expect(() => service.parse(csv)).toThrow(BadRequestException);
      expect(() => service.parse(csv)).toThrow('INVALID_CSV');
    });
  });

  describe('edge case: row count limit', () => {
    it('throws BadRequestException(CSV_TOO_MANY_ROWS) when row count exceeds 5 000', () => {
      // Arrange: build a CSV with 5 001 data rows.
      const header = 'Name,Quantity\n';
      const row = 'Command and Conquer,1\n';
      const csv = csvBuffer(header + row.repeat(5_001));

      // Act & Assert
      expect(() => service.parse(csv)).toThrow(BadRequestException);
      expect(() => service.parse(csv)).toThrow('CSV_TOO_MANY_ROWS');
    });

    it('does NOT throw for exactly 5 000 rows (boundary)', () => {
      // Arrange
      const header = 'Name,Quantity\n';
      const row = 'Command and Conquer,1\n';
      const csv = csvBuffer(header + row.repeat(5_000));

      // Act — should not throw.
      expect(() => service.parse(csv)).not.toThrow();
    });
  });

  describe('mixed valid and invalid rows', () => {
    it('resolves valid rows and collects skipped rows in the same parse', () => {
      // Arrange: 3 valid, 1 unknown, 1 zero-qty.
      const csv = csvBuffer(
        'Name,Quantity\n' +
          'Command and Conquer,1\n' +
          'NonexistentCard,2\n' +
          'Enlightened Strike,3\n' +
          'Command and Conquer,0\n' +
          'Aether Dart,2\n',
      );

      // Act
      const result = service.parse(csv);

      // Assert
      expect(result.resolved).toHaveLength(3);
      expect(result.skipped).toHaveLength(2);

      const skipReasons = result.skipped.map((s) => s.reason);
      expect(skipReasons).toContain('no-match');
      expect(skipReasons).toContain('invalid-quantity');
    });
  });

  describe('row numbers in output', () => {
    it('assigns correct 1-based row numbers (accounting for header)', () => {
      // Arrange: 2 data rows; row numbers should be 2 and 3.
      const csv = csvBuffer('Name,Quantity\nCommand and Conquer,1\nNope,1\n');

      // Act
      const result = service.parse(csv);

      // Assert
      const [resolved] = result.resolved;
      const [skipped] = result.skipped;
      expect(resolved?.rowNumber).toBe(2);
      expect(skipped?.rowNumber).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Pitch suffix resolution — Fabrary export format
  //
  // Fabrary (and similar exporters) appends "(red|yellow|blue)" to the name
  // for any card that has a pitch value. Cards without pitch (equipment,
  // weapons, hero) export without a suffix. The parser recognises the suffix,
  // strips it from the name, and filters candidates by `card.pitch`
  // (red=1, yellow=2, blue=3). Falls through to the existing set-disambiguator
  // and ambiguous skip when the suffix is absent.
  // -------------------------------------------------------------------------

  describe('pitch suffix resolution (Fabrary export format)', () => {
    it('resolves "Bare Fangs (red)" to bare-fangs-red', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs (red),3\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0]?.cardIdentifier).toBe('bare-fangs-red');
      expect(result.resolved[0]?.quantity).toBe(3);
    });

    it('resolves "Bare Fangs (yellow)" to bare-fangs-yellow', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs (yellow),3\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved[0]?.cardIdentifier).toBe('bare-fangs-yellow');
    });

    it('resolves "Bare Fangs (blue)" to bare-fangs-blue', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs (blue),2\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved[0]?.cardIdentifier).toBe('bare-fangs-blue');
    });

    it('is case-insensitive on the suffix: "Bare Fangs (RED)" still resolves to red', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs (RED),1\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved[0]?.cardIdentifier).toBe('bare-fangs-red');
    });

    it('tolerates whitespace around the suffix: "Bare Fangs  (red)" resolves correctly', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs  (red)  ,1\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved[0]?.cardIdentifier).toBe('bare-fangs-red');
    });

    it('resolves single-pitch cards that still carry the suffix: "Cast Bones (red)" → cast-bones-red', () => {
      const csv = csvBuffer('Name,Quantity\nCast Bones (red),3\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved[0]?.cardIdentifier).toBe('cast-bones-red');
    });

    it('resolves equipment without suffix: "Hide Tanner" → hide-tanner', () => {
      const csv = csvBuffer('Name,Quantity\nHide Tanner,1\n');
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved[0]?.cardIdentifier).toBe('hide-tanner');
    });

    it('treats invalid colour suffix as part of the name → no-match', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs (purple),1\n');
      const result = service.parse(csv);
      expect(result.resolved).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]?.reason).toBe('no-match');
    });

    it('preserves prior behaviour: multi-pitch without suffix or set → ambiguous', () => {
      const csv = csvBuffer('Name,Quantity\nBare Fangs,1\n');
      const result = service.parse(csv);
      expect(result.resolved).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]?.reason).toBe('ambiguous');
    });

    it('mixed Fabrary-style deck: equipment + single-pitch + multi-pitch all resolve', () => {
      const csv = csvBuffer(
        'Name,Quantity\n' +
          'Hide Tanner,1\n' +
          'Cast Bones (red),3\n' +
          'Bare Fangs (red),3\n' +
          'Bare Fangs (yellow),3\n' +
          'Bare Fangs (blue),2\n',
      );
      const result = service.parse(csv);
      expect(result.skipped).toEqual([]);
      expect(result.resolved.map((r) => r.cardIdentifier)).toEqual([
        'hide-tanner',
        'cast-bones-red',
        'bare-fangs-red',
        'bare-fangs-yellow',
        'bare-fangs-blue',
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// computeContentHash (pure helper — no DI needed)
// ---------------------------------------------------------------------------

describe('computeContentHash', () => {
  const makeRow = (cardIdentifier: string, quantity: number, rowNumber = 1): IResolvedCsvRow => ({
    rowNumber,
    cardIdentifier,
    quantity,
  });

  it('produces the same hash regardless of row order (order-invariant)', () => {
    // Arrange: same logical content, different order.
    const setA: IResolvedCsvRow[] = [
      makeRow('card-a', 2),
      makeRow('card-b', 1),
      makeRow('card-c', 3),
    ];
    const setB: IResolvedCsvRow[] = [
      makeRow('card-c', 3),
      makeRow('card-a', 2),
      makeRow('card-b', 1),
    ];

    // Act
    const hashA = computeContentHash(setA);
    const hashB = computeContentHash(setB);

    // Assert
    expect(hashA).toBe(hashB);
  });

  it('produces different hashes for different card sets', () => {
    // Arrange
    const set1: IResolvedCsvRow[] = [makeRow('card-a', 1), makeRow('card-b', 2)];
    const set2: IResolvedCsvRow[] = [makeRow('card-a', 1), makeRow('card-c', 2)];

    // Act
    const hash1 = computeContentHash(set1);
    const hash2 = computeContentHash(set2);

    // Assert
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes when quantities differ', () => {
    // Arrange
    const set1: IResolvedCsvRow[] = [makeRow('card-a', 1)];
    const set2: IResolvedCsvRow[] = [makeRow('card-a', 2)];

    // Act
    const hash1 = computeContentHash(set1);
    const hash2 = computeContentHash(set2);

    // Assert
    expect(hash1).not.toBe(hash2);
  });

  it('returns a consistent hex SHA-256 string (64 chars)', () => {
    // Arrange
    const rows: IResolvedCsvRow[] = [makeRow('card-a', 3)];

    // Act
    const hash = computeContentHash(rows);

    // Assert
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash across two calls with identical input', () => {
    // Arrange
    const rows: IResolvedCsvRow[] = [makeRow('card-a', 2), makeRow('card-b', 1)];

    // Act
    const h1 = computeContentHash(rows);
    const h2 = computeContentHash(rows);

    // Assert
    expect(h1).toBe(h2);
  });

  it('handles an empty array without throwing', () => {
    // Arrange
    const rows: IResolvedCsvRow[] = [];

    // Act
    const hash = computeContentHash(rows);

    // Assert: should produce a valid SHA-256 of an empty string.
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is not affected by rowNumber (same cards, different rowNumber → same hash)', () => {
    // Arrange: rowNumber is irrelevant for hashing — only cardIdentifier and
    // quantity are serialised.
    const set1: IResolvedCsvRow[] = [makeRow('card-a', 1, 2), makeRow('card-b', 2, 3)];
    const set2: IResolvedCsvRow[] = [makeRow('card-a', 1, 99), makeRow('card-b', 2, 100)];

    // Act
    const h1 = computeContentHash(set1);
    const h2 = computeContentHash(set2);

    // Assert
    expect(h1).toBe(h2);
  });
});
