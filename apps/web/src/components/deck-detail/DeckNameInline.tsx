import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatchDeckMutation } from '../../api/decks';
import styles from './DeckNameInline.module.css';

interface IDeckNameInlineProps {
  /** The deck whose name is being displayed/edited. */
  readonly deckId: number;
  /** The current deck name. */
  readonly name: string;
  /**
   * View mode: renders an interactive button that opens inline editing on
   * click/Enter/Space. The document outline contribution is preserved via a
   * visually-hidden `<h1>` inside the button.
   *
   * Edit mode: renders a static `<h1>` with no interactive affordance — the
   * click handler is unmounted, tab order skips it, screen readers see a
   * plain heading (not a button).
   */
  readonly mode: 'view' | 'edit';
}

/**
 * DeckNameInline — inline-editable deck name for the detail header.
 *
 * View mode:
 *   Renders `<button aria-label="Edit deck name — currently {name}">`. Inside:
 *   - SR-only `<h1>` for document outline (screen readers announce heading).
 *   - Visible `<span aria-hidden>` with the same text.
 *   Click / Enter / Space → inline `<input aria-label="Deck name">` focused
 *   via requestAnimationFrame. Blur / Enter commits via usePatchDeckMutation.
 *   Empty blur restores without PATCH. Escape cancels + restores.
 *
 * Edit mode (e.g. ?edit=1 from U11):
 *   Renders a static `<h1>`. No button role, no click handler, tab-skipped.
 */
export function DeckNameInline({
  deckId,
  name,
  mode,
}: IDeckNameInlineProps): React.ReactElement {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputId = useId();

  const patchMutation = usePatchDeckMutation(deckId);

  // Sync external name prop changes (e.g. invalidation-driven refetch)
  // when not currently editing.
  useEffect(() => {
    if (!isEditing) {
      setDraft(name);
    }
  }, [name, isEditing]);

  function openEdit(): void {
    setDraft(name);
    setIsEditing(true);
    // Focus via rAF — same pattern as DeleteAccountModal.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commitEdit(): void {
    const trimmed = draft.trim();
    if (trimmed === '') {
      // Empty — restore without PATCH
      cancelEdit();
      return;
    }
    if (trimmed === name) {
      // No change — no PATCH
      setIsEditing(false);
      requestAnimationFrame(() => displayButtonRef.current?.focus());
      return;
    }
    patchMutation.mutate(
      { name: trimmed },
      {
        onSettled: () => {
          setIsEditing(false);
          requestAnimationFrame(() => displayButtonRef.current?.focus());
        },
      },
    );
  }

  function cancelEdit(): void {
    setDraft(name);
    setIsEditing(false);
    requestAnimationFrame(() => displayButtonRef.current?.focus());
  }

  // ---- Edit mode (static heading, no interactivity) ----
  if (mode === 'edit') {
    return (
      <h1 className={styles.staticHeading} tabIndex={-1}>
        {name}
      </h1>
    );
  }

  // ---- View mode — inline input active ----
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        id={inputId}
        className={styles.inlineInput}
        aria-label={t('decks.deckNameLabel')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        }}
      />
    );
  }

  // ---- View mode — display button ----
  return (
    <button
      ref={displayButtonRef}
      type="button"
      className={styles.displayButton}
      aria-label={t('decks.editDeckNameAria', { name })}
      onClick={openEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEdit();
        }
      }}
    >
      {/*
        SR-only <h1> preserves the document heading outline so assistive
        tech can navigate to the heading even though the visible element is
        a button.
      */}
      <span className={styles.srOnly}>
        <h1>{name}</h1>
      </span>
      {/* aria-hidden sibling carries the visible text */}
      <span aria-hidden="true" className={styles.visibleName}>
        {name}
      </span>
    </button>
  );
}
