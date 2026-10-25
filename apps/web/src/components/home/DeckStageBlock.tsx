import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ITrackedDeckListItem } from '../../api/decks';
import { STATUS_KEY_MAP } from '../deck-detail/status-labels';
import { deckCauseLine, sizeProblemOf } from './deckVerdictLine';
import styles from './DeckStageBlock.module.css';
import tileStyles from './DeckTile.module.css';

interface IDeckStageBlockProps {
  readonly deck: ITrackedDeckListItem;
}

/**
 * What a home card says about the deck's state, top to bottom. With no rule problem it is the
 * stage chip, with the size when the deck is short. With a rule problem the red chip carries the
 * verdict only, a red line says why, and the stage drops to a grey line, so a problem never hides
 * behind the player's own label. A format the rules do not cover reads "Formato não conferido".
 */
export function DeckStageBlock({ deck }: IDeckStageBlockProps): React.ReactElement {
  const { t } = useTranslation();
  const stage = t(STATUS_KEY_MAP[deck.status]);
  const shortOf = sizeProblemOf(deck.legality.details);
  const size = shortOf
    ? t('home.deckSizeShort', { count: shortOf.count, target: shortOf.limit })
    : deck.deckSize === undefined
      ? null
      : t('home.deckSizeFull', { count: deck.deckSize });
  const stageLine = size === null ? t('home.stageLineOnly', { stage }) : t('home.stageLineSize', { stage, size });

  if (deck.legality.category === 'illegal') {
    const cause = deckCauseLine(deck.legality.details, t);
    return (
      <div className={styles.block}>
        <span className={`${styles.redChip} ${tileStyles.legalityIllegal}`} data-testid="legality-illegal">
          {t('deckDetail.verdictBlocked', { format: deck.format })}
        </span>
        {cause !== null && (
          <p className={styles.cause} data-testid="deck-cause">
            {cause}
          </p>
        )}
        <p className={styles.stageLine} data-testid="deck-stage-line">
          {stageLine}
        </p>
      </div>
    );
  }

  if (deck.legality.category === 'unchecked') {
    return (
      <div className={styles.block}>
        <span className={styles.greyChip} data-testid="deck-verdict">
          {t('decks.formatUnchecked')}
        </span>
        <p className={styles.stageLine} data-testid="deck-stage-line">
          {stageLine}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.block}>
      {shortOf ? (
        <span className={styles.stageChip} data-testid="deck-stage-chip">
          {t('home.stageChipShort', { stage, size })}
        </span>
      ) : (
        <>
          <span className={styles.stageChip} data-testid="deck-stage-chip">
            {stage}
          </span>
          {size !== null && (
            <span className={styles.size} data-testid="deck-size">
              {size}
            </span>
          )}
        </>
      )}
    </div>
  );
}
