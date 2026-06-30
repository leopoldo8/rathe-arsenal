import { useTranslation } from 'react-i18next';
import styles from './readiness-header.module.css';

interface IReadinessHeaderProps {
  readonly effectivePercent: number;
  readonly rawPercent: number;
  readonly fabraryUlid: string;
  readonly deckName: string;
  readonly hero: string;
  readonly format: string;
}

function getReadinessTier(percent: number): 'high' | 'mid' | 'low' {
  if (percent >= 80) return 'high';
  if (percent >= 50) return 'mid';
  return 'low';
}

export function ReadinessHeader({
  effectivePercent,
  rawPercent,
  fabraryUlid,
  deckName,
  hero,
  format,
}: IReadinessHeaderProps) {
  const { t } = useTranslation();
  const fabraryUrl = `https://fabrary.com/decks/${fabraryUlid}`;

  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.deckName}>{deckName}</h1>
      </div>
      <div className={styles.deckMeta}>
        {hero} -- {format}
      </div>
      <div className={styles.readinessRow}>
        <span
          className={styles.readinessDisplay}
          data-tier={getReadinessTier(effectivePercent)}
        >
          {effectivePercent.toFixed(1)}%
        </span>
        <span className={styles.readinessSubline}>
          {t('decks.effectiveReadinessSubline', { raw: rawPercent.toFixed(1) })}
        </span>
      </div>
      <a
        href={fabraryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.fabraryLink}
      >
        {t('decks.viewOnFabrary')}
      </a>
    </div>
  );
}
