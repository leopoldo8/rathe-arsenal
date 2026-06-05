import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { SbraubleDetailParserService } from '../sbrauble-detail-parser.service';
import { EScraperErrorCode, ScraperError } from '../errors/scraper.errors';
import { IScrapedVariant } from '../types/scraped-variant';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(__dirname, '../__fixtures__');

function loadFixtureString(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('SbraubleDetailParserService', () => {
  let service: SbraubleDetailParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SbraubleDetailParserService],
    }).compile();

    service = module.get<SbraubleDetailParserService>(SbraubleDetailParserService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path: parse fixture with 3 variants
  // -------------------------------------------------------------------------

  describe('happy path: cupula-dt-detail-page fixture', () => {
    let variants: IScrapedVariant[];

    beforeEach(() => {
      const html = loadFixtureString('cupula-dt-detail-page.html');
      variants = service.parseDetailPage(html);
    });

    it('should return exactly 3 in-stock variants', () => {
      expect(variants).toHaveLength(3);
    });

    it('should parse edition codes correctly (HVY, U-MON, U-MON)', () => {
      expect(variants[0]?.edition).toBe('HVY');
      expect(variants[1]?.edition).toBe('U-MON');
      expect(variants[2]?.edition).toBe('U-MON');
    });

    it('should parse conditions correctly (all NM)', () => {
      expect(variants[0]?.condition).toBe('NM');
      expect(variants[1]?.condition).toBe('NM');
      expect(variants[2]?.condition).toBe('NM');
    });

    it('should parse finish correctly (non-foil, non-foil, foil)', () => {
      expect(variants[0]?.finish).toBe('non-foil');
      expect(variants[1]?.finish).toBe('non-foil');
      expect(variants[2]?.finish).toBe('foil');
    });

    it('should parse prices correctly in cents (20, 20, 200)', () => {
      // R$ 0,20 → 20 cents
      expect(variants[0]?.priceCents).toBe(20);
      // R$ 0,20 → 20 cents
      expect(variants[1]?.priceCents).toBe(20);
      // R$ 2,00 → 200 cents
      expect(variants[2]?.priceCents).toBe(200);
    });

    it('should parse quantities correctly (72, 39, 2)', () => {
      expect(variants[0]?.quantity).toBe(72);
      expect(variants[1]?.quantity).toBe(39);
      expect(variants[2]?.quantity).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: zero in-stock variants returns empty array
  // -------------------------------------------------------------------------

  describe('zero in-stock variants', () => {
    it('should return empty array when all rows have quantity = 0', () => {
      // Arrange: build HTML with one row that has "Esgotado" stock
      const html = `
        <div class="table-cards-row">
          <div class="icones-foto-edicao"><span class='siglaEdicao'>HVY</span></div>
          <div class="table-cards-body-cell tooltip-item text-center">
            <div class="title-mobile">Qualidade</div>
            NM
            <div class="tooltip">Near Mint (NM)</div>
          </div>
          <div class="table-cards-body-cell tooltip-item card-extras">
            <div class="title-mobile">Extras</div>
            <div style="display:inline-flex;">-</div>
          </div>
          <div class="table-cards-body-cell tooltip-item">
            <div class="title-mobile">Estoque</div>
            Esgotado
          </div>
          <div class="table-cards-body-cell card-preco">
            <div class="title-mobile">Preço</div>
            R$ 0,20
          </div>
        </div>
      `;

      // Act
      const variants = service.parseDetailPage(html);

      // Assert
      expect(variants).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: "Sob consulta" and "Esgotado" rows are excluded
  // -------------------------------------------------------------------------

  describe('unavailable price rows excluded', () => {
    it('should exclude rows with "Sob consulta" price', () => {
      // Arrange: two rows — one valid, one with "Sob consulta"
      const html = `
        <div class="table-cards-row">
          <div class="icones-foto-edicao"><span class='siglaEdicao'>HVY</span></div>
          <div class="table-cards-body-cell tooltip-item text-center">
            <div class="title-mobile">Qualidade</div>
            NM
            <div class="tooltip">Near Mint (NM)</div>
          </div>
          <div class="table-cards-body-cell tooltip-item card-extras">
            <div class="title-mobile">Extras</div>
            <div style="display:inline-flex;">-</div>
          </div>
          <div class="table-cards-body-cell tooltip-item">
            <div class="title-mobile">Estoque</div>
            5 unid.
          </div>
          <div class="table-cards-body-cell card-preco">
            <div class="title-mobile">Preço</div>
            R$ 1,00
          </div>
        </div>
        <div class="table-cards-row">
          <div class="icones-foto-edicao"><span class='siglaEdicao'>U-MON</span></div>
          <div class="table-cards-body-cell tooltip-item text-center">
            <div class="title-mobile">Qualidade</div>
            LP
            <div class="tooltip">Lightly Played (LP)</div>
          </div>
          <div class="table-cards-body-cell tooltip-item card-extras">
            <div class="title-mobile">Extras</div>
            <div style="display:inline-flex;">-</div>
          </div>
          <div class="table-cards-body-cell tooltip-item">
            <div class="title-mobile">Estoque</div>
            Esgotado
          </div>
          <div class="table-cards-body-cell card-preco">
            <div class="title-mobile">Preço</div>
            Sob consulta
          </div>
        </div>
      `;

      // Act
      const variants = service.parseDetailPage(html);

      // Assert — only the valid row is returned
      expect(variants).toHaveLength(1);
      expect(variants[0]?.edition).toBe('HVY');
    });

    it('should exclude rows with "Esgotado" stock even when price is valid', () => {
      // Arrange: single row with valid price but esgotado stock
      const html = `
        <div class="table-cards-row">
          <div class="icones-foto-edicao"><span class='siglaEdicao'>HVY</span></div>
          <div class="table-cards-body-cell tooltip-item text-center">
            <div class="title-mobile">Qualidade</div>
            NM
            <div class="tooltip">Near Mint (NM)</div>
          </div>
          <div class="table-cards-body-cell tooltip-item card-extras">
            <div class="title-mobile">Extras</div>
            <div style="display:inline-flex;">-</div>
          </div>
          <div class="table-cards-body-cell tooltip-item">
            <div class="title-mobile">Estoque</div>
            Esgotado
          </div>
          <div class="table-cards-body-cell card-preco">
            <div class="title-mobile">Preço</div>
            R$ 0,50
          </div>
        </div>
      `;

      // Act
      const variants = service.parseDetailPage(html);

      // Assert
      expect(variants).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: unknown condition parsed as-is
  // -------------------------------------------------------------------------

  describe('unknown condition', () => {
    it('should parse unknown condition "HP" as-is without error', () => {
      // Arrange
      const html = `
        <div class="table-cards-row">
          <div class="icones-foto-edicao"><span class='siglaEdicao'>HVY</span></div>
          <div class="table-cards-body-cell tooltip-item text-center">
            <div class="title-mobile">Qualidade</div>
            HP
            <div class="tooltip">Heavily Played (HP)</div>
          </div>
          <div class="table-cards-body-cell tooltip-item card-extras">
            <div class="title-mobile">Extras</div>
            <div style="display:inline-flex;">-</div>
          </div>
          <div class="table-cards-body-cell tooltip-item">
            <div class="title-mobile">Estoque</div>
            3 unid.
          </div>
          <div class="table-cards-body-cell card-preco">
            <div class="title-mobile">Preço</div>
            R$ 0,10
          </div>
        </div>
      `;

      // Act
      const variants = service.parseDetailPage(html);

      // Assert
      expect(variants).toHaveLength(1);
      expect(variants[0]?.condition).toBe('HP');
    });
  });

  // -------------------------------------------------------------------------
  // Error: a page with no .table-cards-row table at all is a block/challenge
  // page, not an out-of-stock card. It must throw so the worker marks the card
  // failed instead of recording a false "no price" success.
  // -------------------------------------------------------------------------

  describe('blocked / malformed HTML (no table)', () => {
    it('should throw DETAIL_PAGE_BLOCKED_OR_EMPTY when no .table-cards-row elements are found', () => {
      const html = '<html><body><div class="some-other-element">nothing here</div></body></html>';

      expect(() => service.parseDetailPage(html)).toThrow(ScraperError);
      try {
        service.parseDetailPage(html);
      } catch (err) {
        expect((err as ScraperError).code).toBe(EScraperErrorCode.DETAIL_PAGE_BLOCKED_OR_EMPTY);
      }
    });

    it('should throw DETAIL_PAGE_BLOCKED_OR_EMPTY for a completely empty HTML string', () => {
      expect(() => service.parseDetailPage('')).toThrow(ScraperError);
      try {
        service.parseDetailPage('');
      } catch (err) {
        expect((err as ScraperError).code).toBe(EScraperErrorCode.DETAIL_PAGE_BLOCKED_OR_EMPTY);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Error: unparseable price throws ScraperError
  // -------------------------------------------------------------------------

  describe('unparseable price', () => {
    it('should throw ScraperError(PRICE_UNPARSEABLE) for a non-empty unrecognized price string', () => {
      // Arrange: row with a price that is not "Sob consulta" but also not a valid BRL format
      const html = `
        <div class="table-cards-row">
          <div class="icones-foto-edicao"><span class='siglaEdicao'>HVY</span></div>
          <div class="table-cards-body-cell tooltip-item text-center">
            <div class="title-mobile">Qualidade</div>
            NM
            <div class="tooltip">Near Mint (NM)</div>
          </div>
          <div class="table-cards-body-cell tooltip-item card-extras">
            <div class="title-mobile">Extras</div>
            <div style="display:inline-flex;">-</div>
          </div>
          <div class="table-cards-body-cell tooltip-item">
            <div class="title-mobile">Estoque</div>
            5 unid.
          </div>
          <div class="table-cards-body-cell card-preco">
            <div class="title-mobile">Preço</div>
            INVALID_PRICE_FORMAT
          </div>
        </div>
      `;

      // Act & Assert
      expect(() => service.parseDetailPage(html)).toThrow(ScraperError);
      expect(() => service.parseDetailPage(html)).toThrow(
        expect.objectContaining({ code: EScraperErrorCode.PRICE_UNPARSEABLE }),
      );
    });
  });
});
