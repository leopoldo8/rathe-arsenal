import { useTranslation } from 'react-i18next';
import styles from './MarkOwnedButton.module.css';

interface IMarkOwnedButtonProps {
  readonly cardIdentifier: string;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isPending: boolean;
  readonly pendingCard: string | null;
}

/**
 * Disables globally while any mark-owned mutation is in flight; only the card
 * being processed reads as saving.
 */
export function MarkOwnedButton({
  cardIdentifier,
  onMarkOwned,
  isPending,
  pendingCard,
}: IMarkOwnedButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const isThisCardPending = isPending && pendingCard === cardIdentifier;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>): void {
    e.stopPropagation();
    onMarkOwned(cardIdentifier);
  }

  return (
    <button
      type="button"
      className={[
        styles.btn,
        isThisCardPending ? styles['btn--saving'] : '',
        isPending && !isThisCardPending ? styles['btn--muted'] : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isThisCardPending}
      aria-label={t('decks.markOwned')}
      title={isThisCardPending ? t('decks.markOwnedSaving') : t('decks.markOwned')}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.3 8.2 7.2 10l3.5-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
