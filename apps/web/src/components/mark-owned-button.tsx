import styles from './mark-owned-button.module.css';

interface IMarkOwnedButtonProps {
  readonly cardIdentifier: string;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isPending: boolean;
  readonly pendingCard: string | null;
}

export function MarkOwnedButton({
  cardIdentifier,
  onMarkOwned,
  isPending,
  pendingCard,
}: IMarkOwnedButtonProps) {
  const isThisCardPending = isPending && pendingCard === cardIdentifier;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onMarkOwned(cardIdentifier);
      }}
      disabled={isPending}
      className={styles.btn}
      data-pending={isPending ? 'true' : undefined}
      data-this-pending={isThisCardPending ? 'true' : undefined}
    >
      {isThisCardPending ? 'Saving...' : 'I own this'}
    </button>
  );
}
