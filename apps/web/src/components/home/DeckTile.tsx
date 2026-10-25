import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ITrackedDeckListItem } from '../../api/decks';
import { Deckbox } from '../deckbox/Deckbox';
import { useDeleteDeckWithUndo } from '../../hooks/useDeleteDeckWithUndo';
import { resolveDeckMeta, type TDeckMeta } from './homeGroups';
import { UntrackPin } from './UntrackPin';
import { DeckStageBlock } from './DeckStageBlock';
import styles from './DeckTile.module.css';

interface IDeckTileProps {
  readonly deck: ITrackedDeckListItem;
}

interface IDeckMetaProps {
  readonly meta: TDeckMeta;
}

function DeckMeta({ meta }: IDeckMetaProps): React.ReactElement {
  const { t } = useTranslation();
  const text =
    meta.state === 'complete'
      ? t('home.metaComplete', { owned: meta.total, total: meta.total })
      : meta.state === 'incomplete'
        ? t('home.metaIncomplete', {
            missing: meta.missing,
            owned: meta.owned,
            total: meta.total,
          })
        : t('home.metaDraft');
  const stateClass =
    meta.state === 'complete'
      ? styles.metaComplete
      : meta.state === 'incomplete'
        ? styles.metaIncomplete
        : styles.metaDraft;

  return (
    <p className={`${styles.meta} ${stateClass}`} data-testid="deck-meta" data-state={meta.state}>
      <span>{text}</span>
    </p>
  );
}

export function DeckTile({ deck }: IDeckTileProps): React.ReactElement | null {
  const { t } = useTranslation();
  const deleteDeck = useDeleteDeckWithUndo();
  const [isRemoved, setIsRemoved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // The delete is recorded at once and the toast stays until the player's next action: the deck
  // leaves the list now and comes back only through "Desfazer" or "Excluídos recentemente".
  function handleUntrack(): void {
    setIsRemoved(true);
    setIsDeleting(true);
    void deleteDeck({ id: deck.id, name: deck.name }).then((deleted) => {
      if (!deleted) setIsRemoved(false);
      setIsDeleting(false);
    });
  }

  if (isRemoved) return null;

  const meta = resolveDeckMeta(deck);
  const readinessPct = meta.state === 'draft' ? null : (deck.latestSnapshot?.effectivePercent ?? null);

  return (
    <article className={styles.tile} aria-label={deck.name}>
      <Deckbox
        variant="deck"
        deckId={deck.id}
        deckName={deck.name}
        format={deck.format}
        status={deck.status}
        heroArt={deck.heroImageUrl}
        cards={[
          deck.representativeCards[0] ?? null,
          deck.representativeCards[1] ?? null,
          deck.representativeCards[2] ?? null,
        ]}
        readinessPct={readinessPct}
      />
      <DeckStageBlock deck={deck} />
      <DeckMeta meta={meta} />
      {deck.clearUpgradeCount > 0 && (
        <p className={styles.upgrades} data-testid="deck-upgrades">
          {t('home.upgradesSuggested', { count: deck.clearUpgradeCount })}
        </p>
      )}
      <UntrackPin onClick={handleUntrack} disabled={isDeleting} deckName={deck.name} />
    </article>
  );
}
