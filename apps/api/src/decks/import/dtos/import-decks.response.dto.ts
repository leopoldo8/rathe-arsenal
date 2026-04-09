export interface IImportedDeck {
  readonly trackedDeckId: number;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly readinessSnapshot: {
    rawPercent: number;
    effectivePercent: number;
  } | null;
}

export interface ISkippedUrl {
  readonly url: string;
  readonly reason: 'DUPLICATE_IN_REQUEST' | 'ALREADY_TRACKED';
}

export interface IImportError {
  readonly url: string;
  readonly code: string;
  readonly message: string;
}

export interface IImportDecksResponse {
  readonly imported: IImportedDeck[];
  readonly skipped: ISkippedUrl[];
  readonly errors: IImportError[];
}
