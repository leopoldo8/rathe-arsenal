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
      style={{
        cursor: isPending ? 'not-allowed' : 'pointer',
        background: isThisCardPending ? '#ccc' : '#38a169',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        opacity: isPending && !isThisCardPending ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {isThisCardPending ? 'Saving...' : 'I own this'}
    </button>
  );
}
