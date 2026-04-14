import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { IScrapedVariant } from './types/scraped-variant';
import { parsePriceCents, parseQuantity, isUnavailablePrice } from './utils/price-stock-parsers';

/**
 * cheerio v1.x exposes element types via domhandler, which is not always
 * resolvable from tsconfigs that restrict `types` to ["node","jest"].
 * Declaring a single `any` alias here with one eslint-disable avoids
 * repeating the suppression comment on every private method signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TCheerioNode = any;

type TCheerioAPI = ReturnType<typeof cheerio.load>;

/**
 * Parses a Sbrauble card detail page HTML into structured variant records.
 *
 * Responsibilities:
 * - Load HTML with cheerio and locate each `.table-cards-row`.
 * - Extract edition, condition, finish, stock, and price from each row.
 * - Filter out rows where quantity = 0 or price is unavailable.
 * - Return an array of IScrapedVariant (pure, no database writes).
 *
 * This service MUST NOT apply LISTING_PATH_REGEX. Detail page URLs are already
 * validated at write time (via store_stock.productUrl), so no path validation
 * is needed here. See plan "Institutional Learnings" section.
 */
@Injectable()
export class SbraubleDetailParserService {
  private readonly logger = new Logger(SbraubleDetailParserService.name);

  /**
   * Parses the HTML body of a card detail page and returns all valid variants.
   *
   * Rows are excluded when:
   * - Price is unavailable ("Sob consulta", "Indisponível", etc.)
   * - Quantity is zero (stock is "Esgotado" or parsed as 0)
   *
   * Throws ScraperError(PRICE_UNPARSEABLE) if a non-empty, non-unavailable
   * price string cannot be parsed as BRL currency.
   * Throws ScraperError(PARSE_FAILED) if a stock string is unrecognized.
   *
   * Returns an empty array when no `.table-cards-row` elements are found
   * (e.g., malformed HTML) and logs a warning.
   */
  parseDetailPage(html: string): IScrapedVariant[] {
    const $ = cheerio.load(html);
    const rows = $('.table-cards-row');

    if (rows.length === 0) {
      this.logger.warn({ msg: 'No .table-cards-row elements found in detail page HTML' });
      return [];
    }

    const variants: IScrapedVariant[] = [];

    rows.each((_i, el) => {
      const variant = this.parseRow($, el);
      if (variant !== null) {
        variants.push(variant);
      }
    });

    return variants;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parses a single `.table-cards-row` element into an IScrapedVariant.
   *
   * Returns null when the row should be excluded (zero stock or unavailable price).
   * Throws ScraperError for unrecognized price or stock formats.
   */
  private parseRow($: TCheerioAPI, el: TCheerioNode): IScrapedVariant | null {
    const edition = $(el).find('span.siglaEdicao').text().trim();

    // Extract condition: the text content of the quality cell, stripping child elements.
    // The condition cell contains a text node (e.g., "\n            NM\n            ")
    // followed by a .tooltip child. We extract only the direct text nodes.
    const conditionCell = $(el).find('.table-cards-body-cell.text-center');
    const rawCondition = conditionCell
      .contents()
      .filter((_i: number, node: TCheerioNode) => node.type === 'text')
      .text()
      .trim();

    // Finish: check if extras cell contains "Foil". Anything else (e.g. "-") → non-foil.
    const extrasText = $(el).find('.card-extras').text().trim();
    const finish: 'non-foil' | 'foil' = extrasText.toLowerCase().includes('foil')
      ? 'foil'
      : 'non-foil';

    // Price: text from .card-preco, excluding .title-mobile child text.
    const rawPrice = this.extractPriceText($, el);

    // Filter out unavailable prices first (no ScraperError thrown)
    if (isUnavailablePrice(rawPrice)) {
      return null;
    }

    // Stock: find the cell labeled "Estoque" and extract its text node.
    const rawStock = this.extractStockText($, el);

    const quantity = parseQuantity(rawStock);

    // Filter out zero-stock rows
    if (quantity === 0) {
      return null;
    }

    const priceCents = parsePriceCents(rawPrice);

    return {
      edition,
      condition: rawCondition,
      finish,
      priceCents,
      quantity,
    };
  }

  /**
   * Extracts the raw stock text from the stock cell.
   * Finds the cell that contains a .title-mobile div with text "Estoque",
   * then returns the direct text node content (excluding .title-mobile text).
   */
  private extractStockText($: TCheerioAPI, el: TCheerioNode): string {
    let stockText = '';

    $(el)
      .find('.table-cards-body-cell.tooltip-item')
      .each((_i: number, cell: TCheerioNode) => {
        const titleMobile = $(cell).find('.title-mobile').text().trim();
        if (titleMobile === 'Estoque') {
          stockText = $(cell)
            .contents()
            .filter((_i2: number, node: TCheerioNode) => node.type === 'text')
            .text()
            .trim();
        }
      });

    return stockText;
  }

  /**
   * Extracts the raw price text from the .card-preco cell.
   * The cell contains a .title-mobile child and a direct text node with the price.
   * Only the direct text nodes are returned (ignoring .title-mobile text).
   */
  private extractPriceText($: TCheerioAPI, el: TCheerioNode): string {
    const priceCell = $(el).find('.card-preco');

    return priceCell
      .contents()
      .filter((_i: number, node: TCheerioNode) => node.type === 'text')
      .text()
      .trim();
  }
}
