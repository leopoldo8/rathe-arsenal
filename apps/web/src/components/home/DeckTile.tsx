import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ITrackedDeckListItem } from '../../api/decks';
import { Deckbox } from '../deckbox/Deckbox';
import { useToast } from '../ui/Toast/useToast';
import { resolveDeckMeta, type TDeckMeta } from './homeGroups';
import { UntrackPin } from './UntrackPin';
import styles from './DeckTile.module.css';

const UNTRACK_UNDO_WINDOW_MS = 4800;

interface IDeckTileProps {
  readonly deck: ITrackedDeckListItem;
  readonly onUntrack: (deckId: number) => void;
  readonly isUntracking: boolean;
}

interface IDeckMetaProps {
  readonly meta: TDeckMeta;
  readonly isIllegal: boolean;
}

function DeckMeta({ meta, isIllegal }: IDeckMetaProps): React.ReactElement {
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
      {isIllegal && (
        <span
          className={styles.legalityIllegal}
          data-testid="legality-illegal"
          aria-label={t('home.legalityNotLegalLabel')}
          title={t('home.legalityIllegalTitle')}
        >
          ✗
        </span>
      )}
    </p>
  );
}

export function DeckTile({
  deck,
  onUntrack,
  isUntracking,
}: IDeckTileProps): React.ReactElement | null {
  const { t } = useTranslation();
  const { show } = useToast();
  const [isOptimisticallyRemoved, setIsOptimisticallyRemoved] = useState(false);
  const untrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (untrackTimerRef.current !== null) clearTimeout(untrackTimerRef.current);
    };
  }, []);

  function handleUntrack(): void {
    setIsOptimisticallyRemoved(true);
    untrackTimerRef.current = setTimeout(() => {
      untrackTimerRef.current = null;
      onUntrack(deck.id);
    }, UNTRACK_UNDO_WINDOW_MS);

    show({
      kind: 'info',
      message: t('home.untrackToastMsg', { deckName: deck.name }),
      action: {
        label: t('home.undoUntrack'),
        onClick: () => {
          if (untrackTimerRef.current !== null) {
            clearTimeout(untrackTimerRef.current);
            untrackTimerRef.current = null;
          }
          setIsOptimisticallyRemoved(false);
        },
      },
    });
  }

  if (isOptimisticallyRemoved) return null;

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
      <DeckMeta meta={meta} isIllegal={deck.legality.category === 'illegal'} />
      <UntrackPin onClick={handleUntrack} disabled={isUntracking} deckName={deck.name} />
    </article>
  );
}
