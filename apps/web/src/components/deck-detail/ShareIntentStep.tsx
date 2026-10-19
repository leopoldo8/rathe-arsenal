import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IDeckShareState, TShareIntent } from '../../api/shared-decks';
import styles from './ShareFlow.module.css';

interface IShareIntentStepProps {
  readonly links: IDeckShareState | undefined;
  readonly missingCount: number;
  readonly onChoose: (intent: TShareIntent) => void;
}

/** Second step: what the link is for. Each option says in one line what the visitor will see. */
export function ShareIntentStep({ links, missingCount, onChoose }: IShareIntentStepProps): React.ReactElement {
  const { t } = useTranslation();
  const nothingMissing = missingCount === 0;

  return (
    <>
      <button type="button" className={styles.option} onClick={() => onChoose('deck')} data-testid="share-intent-deck">
        <span className={styles.optionHead}>
          <span className={styles.optionTitle}>{t('sharing.dialog.intent.deck.title')}</span>
          {links?.deck != null && <span className={styles.active}>{t('sharing.dialog.intent.active')}</span>}
        </span>
        <span className={styles.optionBody}>{t('sharing.dialog.intent.deck.body')}</span>
      </button>
      <button
        type="button"
        className={styles.option}
        disabled={nothingMissing}
        onClick={() => onChoose('missing')}
        data-testid="share-intent-missing"
      >
        <span className={styles.optionHead}>
          <span className={styles.optionTitle}>{t('sharing.dialog.intent.missing.title')}</span>
          {links?.missing != null && <span className={styles.active}>{t('sharing.dialog.intent.active')}</span>}
        </span>
        <span className={styles.optionBody}>
          {nothingMissing
            ? t('sharing.dialog.intent.missing.none')
            : t('sharing.dialog.intent.missing.body', { count: missingCount })}
        </span>
      </button>
    </>
  );
}
