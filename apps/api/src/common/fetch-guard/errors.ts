export enum EFetchGuardErrorCode {
  HostDenied = 'HOST_DENIED',
  RedirectDenied = 'REDIRECT_DENIED',
  TooManyRedirects = 'TOO_MANY_REDIRECTS',
  SizeExceeded = 'SIZE_EXCEEDED',
  Timeout = 'TIMEOUT',
  InvalidUrl = 'INVALID_URL',
  NetworkError = 'NETWORK_ERROR',
}

export class FetchGuardError extends Error {
  constructor(
    public readonly code: EFetchGuardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FetchGuardError';
  }
}
