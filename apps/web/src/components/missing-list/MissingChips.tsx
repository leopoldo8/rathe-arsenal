import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IMissingLine, IMissingSummary } from '../../api/missing-list';
import { chipCount, visibleChips, type TChip } from './missingListModel';
import styles from './MissingChips.module.css';

interface IMissingChipsProps {
  readonly summary: IMissingSummary;
  readonly lines: readonly IMissingLine[];
  readonly active: TChip;
  readonly onSelect: (chip: TChip) => void;
}

const LABEL_KEY: Readonly<Record<TChip, string>> = {
  buy: 'missingList.chipBuy',
  lacks: 'missingList.chipLacks',
  offSite: 'missingList.chipOffSite',
  owned: 'missingList.chipOwned',
  standIn: 'missingList.chipStandIn',
  noPrice: 'missingList.chipNoPrice',
  lookingUp: 'missingList.chipLookingUp',
};

/** The deck's copies by where they stand, each a filter over the rows below. */
export function MissingChips({ summary, lines, active, onSelect }: IMissingChipsProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('missingList.chipsAria')} className={styles.chips} data-testid="missing-chips">
      {visibleChips(lines).map((chip) => (
        <button
          key={chip}
          type="button"
          className={chip === active ? `${styles.chip} ${styles.active}` : styles.chip}
          aria-pressed={chip === active}
          onClick={() => onSelect(chip)}
        >
          {t(LABEL_KEY[chip])} <span className={styles.count}>{chipCount(chip, summary, lines)}</span>
        </button>
      ))}
    </div>
  );
}
