import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IDeckLegality } from '../../api/decks';
import { deckCauseLine } from '../home/deckVerdictLine';
import styles from './DeckCauseLine.module.css';

export function DeckCauseLine({ legality }: { readonly legality: IDeckLegality }): React.ReactElement | null {
  const { t } = useTranslation();
  const cause = legality.category === 'illegal' ? deckCauseLine(legality.details, t) : null;
  if (cause === null) return null;
  return (
    <p className={styles.cause} data-testid="deck-cause">
      {cause}
    </p>
  );
}
