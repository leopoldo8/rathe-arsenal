import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type {
  IExactMatchUploadResponse,
  IPartialOverlapUploadResponse,
  ICreatedUploadResponse,
  IUpdatedUploadResponse,
  IReplacedUploadResponse,
  ICsvDelta,
  ISkippedCsvRow,
} from '../../api/csv-sources';
import styles from './UploadResolveModal.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The resolved response variants that require user interaction or additional
 * info. `created | updated | replaced` with skipped rows, `exact-match`, or
 * `partial-overlap`.
 */
export type TResolveModalVariant =
  | (ICreatedUploadResponse | IUpdatedUploadResponse | IReplacedUploadResponse)
  | IExactMatchUploadResponse
  | IPartialOverlapUploadResponse;

interface IUploadResolveModalProps {
  readonly open: boolean;
  readonly response: TResolveModalVariant;
  readonly onClose: () => void;
  /** Called with the action to re-fire the upload with. */
  readonly onAction: (
    action: 'separate' | 'replace' | 'update' | 'cancel',
    targetSourceId?: string,
  ) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SkipReasonLabel({ reason }: { reason: ISkippedCsvRow['reason'] }): React.ReactElement {
  const labels: Record<ISkippedCsvRow['reason'], string> = {
    'no-match': 'Card not found in catalog',
    'ambiguous': 'Multiple cards match — no set column to disambiguate',
    'invalid-quantity': 'Invalid quantity (must be a positive integer)',
    'empty-name': 'Empty card name',
  };
  return <>{labels[reason]}</>;
}

function DeltaTable({ delta }: { delta: ICsvDelta }): React.ReactElement {
  const rows = [
    { label: 'New cards', count: delta.added.length, sign: '+', cls: styles.deltaAdded },
    { label: 'Increased', count: delta.increased.length, sign: '+', cls: styles.deltaAdded },
    { label: 'Decreased', count: delta.decreased.length, sign: '-', cls: styles.deltaRemoved },
    { label: 'Removed', count: delta.removed.length, sign: '-', cls: styles.deltaRemoved },
  ].filter((r) => r.count > 0);

  if (rows.length === 0) {
    return <p className={styles.deltaEmpty}>No changes detected.</p>;
  }

  return (
    <table className={styles.deltaTable} aria-label="Change summary">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className={styles.deltaLabel}>{row.label}</td>
            <td className={`${styles.deltaCount} ${row.cls}`}>
              {row.sign} {row.count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Variant: created/updated/replaced with skipped rows
// ---------------------------------------------------------------------------

function SkippedRowsVariant({
  response,
  onClose,
}: {
  response: ICreatedUploadResponse | IUpdatedUploadResponse | IReplacedUploadResponse;
  onClose: () => void;
}): React.ReactElement {
  const { skippedRows } = response;

  return (
    <>
      <Dialog.Title className={styles.title}>
        {skippedRows.length} row{skippedRows.length !== 1 ? 's' : ''} could not be matched
      </Dialog.Title>
      <Dialog.Description className={styles.description}>
        The import completed, but the following rows could not be resolved to catalog cards.
      </Dialog.Description>

      <div className={styles.skippedList} role="list" aria-label="Unresolved rows">
        {skippedRows.map((row) => (
          <div key={row.rowNumber} className={styles.skippedRow} role="listitem">
            <span className={styles.skippedRowNum}>Row {row.rowNumber}</span>
            <span className={styles.skippedName}>{row.name || '(empty)'}</span>
            <span className={styles.skippedReason}>
              <SkipReasonLabel reason={row.reason} />
            </span>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.btnPrimary} onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Variant: exact-match
// ---------------------------------------------------------------------------

function ExactMatchVariant({
  response,
  onClose,
  onAction,
}: {
  response: IExactMatchUploadResponse;
  onClose: () => void;
  onAction: IUploadResolveModalProps['onAction'];
}): React.ReactElement {
  return (
    <>
      <Dialog.Title className={styles.title}>
        This file is already imported
      </Dialog.Title>
      <Dialog.Description className={styles.description}>
        You already have a source with the same cards. What would you like to do?
      </Dialog.Description>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnTertiary}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onAction('replace', response.existingSourceId)}
        >
          Replace existing
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => onAction('separate', undefined)}
        >
          Import as separate copy
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Variant: partial-overlap
// ---------------------------------------------------------------------------

function PartialOverlapVariant({
  response,
  onClose,
  onAction,
}: {
  response: IPartialOverlapUploadResponse;
  onClose: () => void;
  onAction: IUploadResolveModalProps['onAction'];
}): React.ReactElement {
  const label = response.existingLabel ?? 'existing source';

  return (
    <>
      <Dialog.Title className={styles.title}>
        Update existing source?
      </Dialog.Title>
      <Dialog.Description className={styles.description}>
        This looks like an updated version of &ldquo;{label}&rdquo;.
      </Dialog.Description>

      <DeltaTable delta={response.delta} />

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnTertiary}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onAction('replace', response.existingSourceId)}
        >
          Replace with new
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onAction('separate', undefined)}
        >
          Import as separate copy
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => onAction('update', response.existingSourceId)}
        >
          Update existing
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * UploadResolveModal — shown after a CSV upload returns a result that requires
 * user choice or displays skipped-row diagnostics.
 *
 * Three variants:
 * - `created | updated | replaced` with skipped rows → skipped-rows list + Close
 * - `exact-match` → offer Replace / Separate / Cancel
 * - `partial-overlap` → show delta + offer Update / Replace / Separate / Cancel
 */
export function UploadResolveModal({
  open,
  response,
  onClose,
  onAction,
}: IUploadResolveModalProps): React.ReactElement {
  const kind = response.kind;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          aria-describedby={undefined}
        >
          {(kind === 'created' || kind === 'updated' || kind === 'replaced') ? (
            <SkippedRowsVariant
              response={response as ICreatedUploadResponse | IUpdatedUploadResponse | IReplacedUploadResponse}
              onClose={onClose}
            />
          ) : kind === 'exact-match' ? (
            <ExactMatchVariant
              response={response as IExactMatchUploadResponse}
              onClose={onClose}
              onAction={onAction}
            />
          ) : (
            <PartialOverlapVariant
              response={response as IPartialOverlapUploadResponse}
              onClose={onClose}
              onAction={onAction}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
