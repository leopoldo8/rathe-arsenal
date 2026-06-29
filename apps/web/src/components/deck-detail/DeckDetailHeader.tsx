import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { DeckNameInline } from './DeckNameInline';
import { TagChipRow } from './TagChipRow';
import { StatusDropdown } from './StatusDropdown';
import { DiscardChangesConfirm } from './DiscardChangesConfirm';
import { SaveCascadeConfirmModal } from './SaveCascadeConfirmModal';
import type { TDeckStatus } from '../../api/decks';
import type { ITagResponse } from '../../api/tags';
import { useUntrackDeckMutation, usePutDeckMutation, type IPutDeckBody } from '../../api/decks';
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
   * Whether the composition draft has unsaved changes (from useCompositionDraft).
   * Controls whether Cancel shows DiscardChangesConfirm.
   */
  readonly isDirty?: boolean;
  /**
   * Count of unsaved changes (from useCompositionDraft.changeCount).
   * Used in DiscardChangesConfirm heading.
   */
  readonly changeCount?: number;
  /**
   * Count of cards that may be illegal in the current format (from useCascadeCheck).
   * Used to check before Save. 0 = no warning. N > 5 = SaveCascadeConfirmModal.
   */
  readonly cascadeCheckCount?: number;
  /**
   * The PUT body to send on Save (built by caller from compositionDraft).
   */
  readonly saveDraftPayload?: IPutDeckBody | undefined;
  /**
   * Called after a successful Save so the route can clear localStorage + exit Edit.
   */
  readonly onSaveSuccess?: (() => void) | undefined;
  /**
   * Called when the user confirms discarding changes (Cancel → Discard, or
   * nav-away → Discard). Route clears localStorage + exits Edit.
   */
  readonly onConfirmDiscard?: (() => void) | undefined;
  /**
   * Ref pointing to the Edit-toggle button; passed to DraftRestoreModal
   * so focus returns there after restore/discard.
   */
  readonly editButtonRef?: React.RefObject<HTMLButtonElement | null> | undefined;
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
 *   - Edit button (view mode) / Cancel + Save buttons (edit mode)
 *   - ⋯ overflow menu with "Untrack" action
 *
 * Save flow (U13):
 *  1. Check cascadeCheckCount > 5 → SaveCascadeConfirmModal.
 *  2. Else → usePutDeckMutation immediately.
 *  3. Success → onSaveSuccess() (caller clears localStorage + exits Edit).
 *  4. 5xx/network → re-enable buttons, show inline error, draft preserved.
 *
 * Cancel flow (U13):
 *  - isDirty → DiscardChangesConfirm → Discard → onConfirmDiscard().
 *  - Clean → navigate to view immediately.
 */
export function DeckDetailHeader({
  deckId,
  deckName,
  status,
  tags,
  mode,
  onEnterEdit,
  isDirty = false,
  changeCount = 0,
  cascadeCheckCount = 0,
  saveDraftPayload,
  onSaveSuccess,
  onConfirmDiscard,
  editButtonRef,
}: IDeckDetailHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const untrackMutation = useUntrackDeckMutation();
  const putMutation = usePutDeckMutation(deckId);

  // Always create a fallback ref; use the provided one if available.
  const _fallbackEditBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const editBtnRef = editButtonRef ?? _fallbackEditBtnRef;

  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const overflowRef = React.useRef<HTMLDivElement>(null);

  // Modal visibility state
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [cascadeConfirmOpen, setCascadeConfirmOpen] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // In-flight guard — disables Cancel + Save while PUT is pending (R19).
  const isSaving = putMutation.isPending;

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
          message: t('decks.untrackFailedToast', { message: (err as Error).message }),
        });
      },
    });
  }

  // ---- Save flow ----

  function executeSave(): void {
    if (!saveDraftPayload) return;
    setSaveError(null);
    putMutation.mutate(saveDraftPayload, {
      onSuccess: () => {
        onSaveSuccess?.();
      },
      onError: () => {
        // R19a: inline error adjacent to Save; draft preserved in localStorage.
        setSaveError(t('decks.saveFailed'));
      },
    });
  }

  function handleSaveClick(): void {
    if (isSaving) return;
    if (cascadeCheckCount > 5) {
      // R21: gate Save with cascade confirm
      setCascadeConfirmOpen(true);
    } else {
      executeSave();
    }
  }

  function handleCascadeConfirm(): void {
    setCascadeConfirmOpen(false);
    executeSave();
  }

  function handleCascadeCancel(): void {
    setCascadeConfirmOpen(false);
  }

  // ---- Cancel flow ----

  function handleCancelClick(): void {
    if (isSaving) return;
    if (isDirty) {
      setDiscardOpen(true);
    } else {
      // Clean — exit immediately without confirm.
      void navigate({ to: '/decks/$deckId', params: { deckId: String(deckId) }, search: { edit: undefined } });
    }
  }

  function handleKeepEditing(): void {
    setDiscardOpen(false);
  }

  function handleConfirmDiscard(): void {
    setDiscardOpen(false);
    onConfirmDiscard?.();
  }

  return (
    <>
      <div className={styles.header} data-testid="deck-detail-header">
        {/* ---- Breadcrumb ---- */}
        <Link to="/home" search={{ tag: [] }} className={styles.breadcrumb} aria-label={t('decks.backToDecksAria')}>
          {t('decks.backToDecksLabel')}
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
                /* Edit mode: Cancel + Save buttons + inline error */
                <>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    aria-label={t('decks.cancelEditAria')}
                    data-testid="deck-detail-cancel-btn"
                    onClick={handleCancelClick}
                    disabled={isSaving}
                  >
                    {t('decks.cancel')}
                  </button>
                  <div className={styles.saveWrapper}>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      aria-label={t('decks.saveDeckAria')}
                      data-testid="deck-detail-save-btn"
                      onClick={handleSaveClick}
                      disabled={isSaving}
                    >
                      {isSaving ? t('decks.saving') : t('decks.save')}
                    </button>
                    {saveError != null && (
                      <span
                        className={styles.saveError}
                        role="alert"
                        data-testid="deck-detail-save-error"
                      >
                        {saveError}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                /* View mode: Edit button */
                <button
                  ref={editBtnRef}
                  type="button"
                  className={styles.editBtn}
                  aria-label={t('decks.editDeckAria')}
                  data-testid="deck-detail-edit-btn"
                  onClick={onEnterEdit}
                >
                  {t('decks.edit')}
                </button>
              )}

              {/* ⋯ overflow menu */}
              <div className={styles.overflow} ref={overflowRef}>
                <button
                  type="button"
                  className={styles.overflowTrigger}
                  aria-label={t('decks.moreDeckActionsAria')}
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
                    aria-label={t('decks.deckActionsMenuAria')}
                    data-testid="deck-detail-overflow-menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.overflowItem}
                      onClick={handleUntrack}
                      disabled={untrackMutation.isPending}
                      aria-label={t('decks.untrackThisDeckAria')}
                      data-testid="deck-detail-untrack-btn"
                    >
                      {untrackMutation.isPending ? t('decks.removing') : t('decks.untrack')}
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

      {/* DiscardChangesConfirm — shown on dirty Cancel or nav-away */}
      <DiscardChangesConfirm
        open={discardOpen}
        changeCount={changeCount}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleConfirmDiscard}
      />

      {/* SaveCascadeConfirmModal — shown when N > 5 illegal cards */}
      <SaveCascadeConfirmModal
        open={cascadeConfirmOpen}
        illegalCount={cascadeCheckCount}
        onConfirm={handleCascadeConfirm}
        onCancel={handleCascadeCancel}
      />
    </>
  );
}
