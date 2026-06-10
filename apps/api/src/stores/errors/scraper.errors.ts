export enum EScraperErrorCode {
  /**
   * HTML parser could not extract one or more required fields from the page.
   * The raw text is included in the error message.
   */
  PARSE_FAILED = 'PARSE_FAILED',

  /**
   * The first page of the listing returned zero products.
   * Ingestion records this as a zero-product run (not a hard error).
   */
  LISTING_EMPTY = 'LISTING_EMPTY',

  /**
   * A price string did not match the expected BRL format and could not be
   * converted to cents. Raw text is included in the error message.
   */
  PRICE_UNPARSEABLE = 'PRICE_UNPARSEABLE',

  /**
   * More than 100 pages were requested without hitting an empty page.
   * Guard against infinite-loop pagination bugs or unexpected site behavior.
   */
  PAGINATION_RUNAWAY = 'PAGINATION_RUNAWAY',

  /**
   * A product URL extracted from the HTML resolves to a host or protocol that
   * is not on the allow-list. The row is dropped (warn log), but if every row
   * on a page triggers this the page is effectively empty.
   */
  URL_OUT_OF_ALLOW_LIST = 'URL_OUT_OF_ALLOW_LIST',

  /**
   * store.listingPath did not match the required whitelist regex.
   * The scrape run is aborted before the first HTTP request is made.
   */
  INVALID_STORE_LISTING_PATH = 'INVALID_STORE_LISTING_PATH',

  /**
   * A card detail page contained no `.table-cards-row` table at all. A real
   * detail page always renders that table (even when every variant is sold
   * out), so its total absence means the response was a block/challenge page
   * or otherwise malformed — NOT a card that is legitimately out of stock.
   * The card fetch is marked failed rather than silently recorded as a
   * successful "no price" result.
   */
  DETAIL_PAGE_BLOCKED_OR_EMPTY = 'DETAIL_PAGE_BLOCKED_OR_EMPTY',

  /**
   * A request to the Firecrawl /scrape API failed (non-2xx status, non-JSON
   * body, or a response missing the expected `data.rawHtml` field). Surfaced
   * as a per-card failure so the job reports an honest error.
   */
  FIRECRAWL_REQUEST_FAILED = 'FIRECRAWL_REQUEST_FAILED',
}

export class ScraperError extends Error {
  constructor(
    public readonly code: EScraperErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}
