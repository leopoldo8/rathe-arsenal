import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useUntrackDeckMutation } from '../../api/decks';
import { useToast } from '../ui/Toast/useToast';
import styles from './DeckOverflowMenu.module.css';

interface IDeckOverflowMenuProps {
  readonly deckId: number;
  readonly className?: string | undefined;
}

export function DeckOverflowMenu({ deckId, className }: IDeckOverflowMenuProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const untrackMutation = useUntrackDeckMutation();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function handleUntrack(): void {
    setOpen(false);
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
  );
}
