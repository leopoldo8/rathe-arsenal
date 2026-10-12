import React from 'react';
import { Link } from '@tanstack/react-router';
import styles from './DeckChip.module.css';

function DeckIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function DeckChip({ deckId, name }: { readonly deckId: number; readonly name: string }): React.ReactElement {
  return (
    <Link to="/decks/$deckId" params={{ deckId: String(deckId) }} search={{ edit: undefined }} className={styles.chip} data-testid="deck-chip">
      <DeckIcon />
      <span>{name}</span>
    </Link>
  );
}
