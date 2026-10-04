import React from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteDeckDialog } from '../deck-edit/DeleteDeckDialog';
import styles from './DeckOverflowMenu.module.css';

interface IDeckOverflowMenuProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly className?: string | undefined;
}

export function DeckOverflowMenu({ deckId, deckName, className }: IDeckOverflowMenuProps): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function handleDelete(): void {
    setOpen(false);
    setConfirmOpen(true);
  }

  return (
    <div className={[styles.overflow, className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={t('decks.moreDeckActionsAria')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="deck-detail-overflow-btn"
      >
        <span aria-hidden="true">&#8943;</span>
      </button>
      {open && (
        <div
          className={styles.menu}
          role="menu"
          aria-label={t('decks.deckActionsMenuAria')}
          data-testid="deck-detail-overflow-menu"
        >
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={handleDelete}
            aria-label={t('decks.untrackThisDeckAria')}
            data-testid="deck-detail-untrack-btn"
          >
            {t('decks.untrack')}
          </button>
        </div>
      )}
      <DeleteDeckDialog deckId={deckId} deckName={deckName} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </div>
  );
}
