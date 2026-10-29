import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedDeckLegality } from '../../api/shared-decks';
import {
  describeOtherFormat,
  describeRule,
  describeSize,
  describeWayToPlay,
  ruleDetailsOf,
  sizeDetailOf,
} from './sharedLegalityModel';
import styles from './SharedLegalityBlock.module.css';

interface ISharedLegalityBlockProps {
  readonly format: string;
  readonly legality: ISharedDeckLegality;
}

export function SharedLegalityBlock({ format, legality }: ISharedLegalityBlockProps): React.ReactElement | null {
  const { t, i18n } = useTranslation();
  const [tapped, setTapped] = useState<string | null>(null);
  if (legality.category === 'unchecked') return null;

  const playable = legality.category === 'legal';
  const size = sizeDetailOf(legality.details);
  const problems = [...(size === undefined ? [] : [describeSize(size, t)]), ...ruleDetailsOf(legality.details).map((detail) => describeRule(detail, t))];
  const wayToPlay = playable ? null : describeWayToPlay(format, legality.details, t, i18n.language);
  const result = legality.otherFormats.find((other) => other.format === tapped);

  return (
    <section className={styles.block} aria-label={t('sharing.legality.aria')}>
      <div className={playable ? styles.playable : styles.blocked} data-testid="shared-own-format-verdict">
        <p className={styles.title}>{t(playable ? 'sharing.legality.canPlay' : 'sharing.legality.cannotPlayYet', { format })}</p>
        {problems.length > 0 && (
          <ul className={styles.problems}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {wayToPlay !== null && <p className={styles.way}>{wayToPlay}</p>}
      </div>

      <p className={styles.checkLabel}>{t('sharing.legality.checkOther')}</p>
      <div className={styles.chips}>
        {legality.otherFormats.map((other) => (
          <button
            key={other.format}
            type="button"
            className={styles.chip}
            aria-pressed={tapped === other.format}
            onClick={() => setTapped((current) => (current === other.format ? null : other.format))}
          >
            {other.format}
          </button>
        ))}
      </div>
      {result !== undefined && (
        <div className={styles.result} aria-live="polite">
          <p className={styles.tapped}>{t('sharing.legality.tapped', { format: result.format })}</p>
          <p className={result.category === 'legal' ? styles.resultLegal : styles.resultIllegal}>
            {describeOtherFormat(result, legality.heroYoung, t, i18n.language)}
          </p>
        </div>
      )}
    </section>
  );
}
