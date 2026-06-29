import { useTranslation } from 'react-i18next';
import styles from './MarkOwnedButton.module.css';

interface IMarkOwnedButtonProps {
  readonly cardIdentifier: string;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isPending: boolean;
  readonly pendingCard: string | null;
}

/**
 * MarkOwnedButton — "I own this" affordance for the not-owned list.
 *
 * Disables globally while any mark-owned mutation is in flight, and shows
 * a loading label specifically for the card being processed.
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
    >
      {isThisCardPending ? t('decks.markOwnedSaving') : t('decks.markOwned')}
    </button>
  );
}
