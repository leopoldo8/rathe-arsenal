import { ICsvDelta, ISkippedCsvRow } from '../csv.types';

/**
 * Discriminated union representing every possible outcome of a CSV upload.
 *
 * - `created`        — a new source was inserted (action='auto' + 'new', or action='separate').
 * - `updated`        — an existing source's rows were diffed and applied (action='update').
 * - `replaced`       — the target source was cascade-deleted and a new one was created (action='replace').
 * - `exact-match`    — the incoming content hash matched an existing source; no writes occurred.
 * - `partial-overlap`— the incoming set overlaps an existing source above the Jaccard threshold; no writes occurred.
 * - `cancelled`      — action='cancel' was specified; no-op.
 */
export type IUploadCsvResponse =
  | ICreatedResponse
  | IUpdatedResponse
  | IReplacedResponse
  | IExactMatchResponse
  | IPartialOverlapResponse
  | ICancelledResponse;

export interface ICreatedResponse {
  readonly kind: 'created';
  readonly sourceId: string;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IUpdatedResponse {
  readonly kind: 'updated';
  readonly sourceId: string;
  readonly cardCount: number;
  readonly delta: ICsvDelta;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IReplacedResponse {
  readonly kind: 'replaced';
  readonly sourceId: string;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IExactMatchResponse {
  readonly kind: 'exact-match';
  readonly existingSourceId: string;
  readonly existingLabel: string | null;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IPartialOverlapResponse {
  readonly kind: 'partial-overlap';
  readonly existingSourceId: string;
  readonly existingLabel: string | null;
  readonly similarityScore: number;
  readonly delta: ICsvDelta;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface ICancelledResponse {
  readonly kind: 'cancelled';
}
