/**
 * Re-exports the bulk review response types from `DecisionsService`.
 *
 * `IBulkReviewFailure` and `IBulkUpsertResult` are defined in
 * `DecisionsService` (the canonical source for these types) to avoid a
 * circular import: `DecisionsService` → `reviews/dtos` → back to
 * `DecisionsService`. Controller and spec files can import from this file
 * for convenience.
 */
export type {
  IBulkReviewFailure,
  IBulkUpsertResult,
} from '../../decks/decisions/decisions.service';
