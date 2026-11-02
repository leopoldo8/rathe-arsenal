export enum EFabraryErrorCode {
  INVALID_URL = 'INVALID_URL',
  INVALID_ULID = 'INVALID_ULID',
  FETCH_FAILED = 'FETCH_FAILED',
  /** Fabrary answered, but with something we could not read as a deck. */
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  /** Fabrary refused the deck: it does not exist or it is private. */
  DECK_UNAVAILABLE = 'DECK_UNAVAILABLE',
  UNKNOWN_CARD = 'UNKNOWN_CARD',
  /** AppSync rejected our API key, most likely because Fabrary rotated it. */
  API_KEY_REJECTED = 'API_KEY_REJECTED',
}

export class FabraryImportError extends Error {
  constructor(
    public readonly code: EFabraryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FabraryImportError';
  }
}
