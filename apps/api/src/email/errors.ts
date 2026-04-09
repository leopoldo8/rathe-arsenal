export enum EEmailErrorCode {
  RateLimited = 'RATE_LIMITED',
  InvalidRecipient = 'INVALID_RECIPIENT',
  Network = 'NETWORK',
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: EEmailErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}
