import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { DeckNameInline } from './DeckNameInline';
import { TagChipRow } from './TagChipRow';
import { StatusDropdown } from './StatusDropdown';
import type { TDeckStatus } from '../../api/decks';
import type { ITagResponse } from '../../api/tags';
import { useUntrackDeckMutation } from '../../api/decks';
import { useToast } from '../ui/Toast/useToast';
import styles from './DeckDetailHeader.module.css';

interface IDeckDetailHeaderProps {
  /** Numeric deck ID used by PATCH mutations. */
  readonly deckId: number;
  /** Current deck name — passed to DeckNameInline. */
  readonly deckName: string;
  /** Current status — passed to StatusDropdown. */
  readonly status: TDeckStatus;
  /** Current tags — passed to TagChipRow. */
  readonly tags: readonly ITagResponse[];
  /**
   * Render mode: 'view' passes through to DeckNameInline (name is clickable
   * and opens inline edit). U12 will pass 'edit' to lock the name as static.
   */
  readonly mode: 'view' | 'edit';
  /**
   * Called when the user clicks the Edit button. Navigates to ?edit=1.
   * Optional for backward compat (U11 tests pass no callbacks).
   */
  readonly onEnterEdit?: (() => void) | undefined;
  /**
   * Called when the user clicks Cancel in Edit mode. Navigates back to View.
   * Optional for backward compat.
   */
  readonly onExitEdit?: (() => void) | undefined;
  /**
   * Count of cards that may be illegal in the current format (from useCascadeCheck).
   * Used to check before Save. 0 = no warning.
   */
  readonly cascadeCheckCount?: number;
}

/**
 * DeckDetailHeader — full-width header strip composing U8 components.
 *
 * Left side:
 *   - Breadcrumb link "← Decks" → /home
 *   - DeckNameInline (h1 role via SR-only heading inside the button)
 *   - TagChipRow below the name
 *
 * Right side (action bar):
 *   - StatusDropdown
 *   - Edit button (⊘ placeholder — U12 wires the ?edit=1 toggle)
 *   - ⋯ overflow menu with "Untrack" action
 *
 * The Edit button is a stub in U11 (renders disabled with the label "Edit").
 * U12 will replace it with the actual toggle.
 */
export function DeckDetailHeader({
  deckId,
  deckName,
  status,
  tags,
  mode,
  onEnterEdit,
  onExitEdit,
  cascadeCheckCount = 0,
}: IDeckDetailHeaderProps): React.ReactElement {
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const untrackMutation = useUntrackDeckMutation();

  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const overflowRef = React.useRef<HTMLDivElement>(null);

  // Close overflow on click-outside
  React.useEffect(() => {
    if (!overflowOpen) return;
    function handleOutside(e: MouseEvent): void {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [overflowOpen]);

  function handleUntrack(): void {
    setOverflowOpen(false);
    untrackMutation.mutate(deckId, {
      onSuccess: () => {
        void navigate({ to: '/home', search: { tag: [] } });
      },
      onError: (err) => {
        showToast({
          kind: 'error',
          message: `Failed to untrack deck: ${(err as Error).message}`,
        });
      },
    });
  }

  return (
    <div className={styles.header} data-testid="deck-detail-header">
      {/* ---- Breadcrumb ---- */}
      <Link to="/home" search={{ tag: [] }} className={styles.breadcrumb} aria-label="Back to Decks">
        <span aria-hidden="true">&#8592;</span> Decks
      </Link>

      {/* ---- Title + tags row ---- */}
      <div className={styles.titleArea}>
        <div className={styles.titleRow}>
          <div className={styles.titleName}>
            <DeckNameInline deckId={deckId} name={deckName} mode={mode} />
          </div>

          {/* ---- Action bar ---- */}
          <div className={styles.actionBar} data-testid="deck-detail-action-bar">
            <StatusDropdown deckId={deckId} currentStatus={status} />

            {mode === 'edit' ? (
              /* Edit mode: Cancel + Save buttons */
              <>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  aria-label="Cancel editing and return to view"
                  data-testid="deck-detail-cancel-btn"
                  onClick={onExitEdit}
                >
                  Cancel
                </button>
                {/* Save button — U13 wires the actual mutation.
                    For U12 this checks the cascade count and logs a placeholder.
                    U13 will replace the console.log with the real modal/mutation. */}
                <button
                  type="button"
                  className={styles.saveBtn}
                  aria-label="Save deck composition"
                  data-testid="deck-detail-save-btn"
                  onClick={() => {
                    // U13-STUB: if cascadeCheckCount > 5, show SaveCascadeConfirmModal
                    // U13-STUB: wire usePutDeckMutation on Save
                    void cascadeCheckCount; // referenced to satisfy TS; U13 uses this
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              /* View mode: Edit button */
              <button
                type="button"
                className={styles.editBtn}
                aria-label="Edit deck composition"
                data-testid="deck-detail-edit-btn"
                onClick={onEnterEdit}
              >
                Edit
              </button>
            )}

            {/* ⋯ overflow menu */}
            <div className={styles.overflow} ref={overflowRef}>
              <button
                type="button"
                className={styles.overflowTrigger}
                aria-label="More deck actions"
                aria-expanded={overflowOpen}
                aria-haspopup="menu"
                onClick={() => setOverflowOpen((prev) => !prev)}
                data-testid="deck-detail-overflow-btn"
              >
                <span aria-hidden="true">&#8943;</span>
              </button>
              {overflowOpen && (
                <div
                  className={styles.overflowMenu}
                  role="menu"
                  aria-label="Deck actions"
                  data-testid="deck-detail-overflow-menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.overflowItem}
                    onClick={handleUntrack}
                    disabled={untrackMutation.isPending}
                    aria-label="Untrack this deck"
                    data-testid="deck-detail-untrack-btn"
                  >
                    {untrackMutation.isPending ? 'Removing…' : 'Untrack'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags row below the name */}
        <TagChipRow deckId={deckId} tags={tags} />
      </div>
    </div>
  );
}
