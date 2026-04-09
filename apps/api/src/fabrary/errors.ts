export enum EFabraryErrorCode {
  INVALID_URL = 'INVALID_URL',
  INVALID_ULID = 'INVALID_ULID',
  FETCH_FAILED = 'FETCH_FAILED',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  UNKNOWN_CARD = 'UNKNOWN_CARD',
  CREDENTIAL_EXPIRED = 'CREDENTIAL_EXPIRED',
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
