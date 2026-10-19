import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SharedDeckFooter.module.css';

interface ISharedDeckFooterProps {
  /** The "this page is not indexed" note belongs to the deck page, not the dead-link page. */
  readonly showRobotsNote?: boolean;
}

/** LSS fan-content disclaimer (it already ends with the copyright line), required on every page that shows card art. */
export function SharedDeckFooter({ showRobotsNote = true }: ISharedDeckFooterProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer} data-testid="shared-deck-footer">
      <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
      {showRobotsNote && <p className={styles.note}>{t('sharing.page.robotsNote')}</p>}
    </footer>
  );
}
