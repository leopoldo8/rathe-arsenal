import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ILegalityReasonDetail } from '../../api/decks';
import { sizeProblemOf } from '../home/deckVerdictLine';
import { resolveTypeGroup, type IDeckListItem } from './deckListModel';
import type { TCardGroupId } from '../../lib/card-groups';
import styles from './DeckSizeLine.module.css';

interface IDeckSizeLineProps {
  readonly items: readonly IDeckListItem[];
  readonly legalityDetails: readonly ILegalityReasonDetail[] | undefined;
}

const LOADOUT_GROUPS: ReadonlySet<TCardGroupId> = new Set(['hero', 'weapon', 'equipment']);

/** How many cards the deck holds and how many more it needs; nothing when the deck is not short. */
export function DeckSizeLine({ items, legalityDetails }: IDeckSizeLineProps): React.ReactElement | null {
  const { t } = useTranslation();
  const deckSize = items
    .filter((item) => !LOADOUT_GROUPS.has(resolveTypeGroup(item.entry)))
    .reduce((sum, item) => sum + item.quantity, 0);
  const shortOf = sizeProblemOf(legalityDetails ?? []);
  if (shortOf === null || deckSize >= shortOf.limit) return null;

  return (
    <p className={styles.line} data-testid="deck-size-line">
      {t('deckDetail.editorDeckSizeShort', { count: deckSize, target: shortOf.limit, missing: shortOf.limit - deckSize })}
    </p>
  );
}
