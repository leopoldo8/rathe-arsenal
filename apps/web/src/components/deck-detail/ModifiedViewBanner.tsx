import { useTranslation } from 'react-i18next';
import styles from './ModifiedViewBanner.module.css';

interface IModifiedViewBannerProps {
  /**
   * Count of rejected substitutions for this deck.
   * The banner renders when this is > 0.
   */
  readonly rejectedCount: number;
  /**
   * Invoked when the user clicks "Clear rejections". The parent restores every
   * rejected swap of the deck, one call each, leaving approvals alone.
   */
  readonly onClearRejections: () => void;
  /**
   * True when the clear-rejections mutation is in flight.
   */
  readonly isClearing: boolean;
}

/**
 * ModifiedViewBanner — deck-level warning when any substitution is rejected.
 *
 * Renders at the top of Column B when rejectedCount > 0.
 * "Clear rejections" sends every rejected swap back to pending (R26).
 *
 * Uses role="status" so screen readers announce changes when
 * the banner appears or disappears.
 */
export function ModifiedViewBanner({
  rejectedCount,
  onClearRejections,
  isClearing,
}: IModifiedViewBannerProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div role="status" className={styles.banner}>
      <div className={styles.banner__message}>
        <strong className={styles.banner__strong}>{t('decks.modifiedView')}</strong>{' '}
        {t('decks.rejectedSwaps', { count: rejectedCount })}
      </div>
      <button
        type="button"
        className={styles.banner__action}
        onClick={onClearRejections}
        disabled={isClearing}
        aria-busy={isClearing}
      >
        {isClearing ? t('decks.clearingRejections') : t('decks.clearRejections')}
      </button>
    </div>
  );
}
