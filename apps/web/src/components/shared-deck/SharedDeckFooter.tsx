import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SharedDeckFooter.module.css';

/** LSS fan-content disclaimer (it already ends with the copyright line), required on every page that shows card art. */
export function SharedDeckFooter({ note }: { readonly note?: string }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer} data-testid="shared-deck-footer">
      <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
      {note !== undefined && <p>{note}</p>}
    </footer>
  );
}
