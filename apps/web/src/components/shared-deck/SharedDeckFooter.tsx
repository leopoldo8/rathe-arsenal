import React from 'react';
import { SharedGlossaryLink } from './SharedGlossaryLink';
import { useTranslation } from 'react-i18next';
import styles from './SharedDeckFooter.module.css';

interface ISharedDeckFooterProps {
  readonly note?: string;
  /** What the glossary's way back reads, when the page knows whose deck or list this is ("Voltar para a lista do Pedro"). */
  readonly glossaryBackLabel?: string;
  /** Aligns the text with the page's container and leaves the glossary link to the page body. */
  readonly contained?: boolean;
}

/** LSS fan-content disclaimer (it already ends with the copyright line), required on every page that shows card art. */
export function SharedDeckFooter({ note, glossaryBackLabel, contained = false }: ISharedDeckFooterProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <footer className={contained ? `${styles.footer} ${styles.footerContained}` : styles.footer} data-testid="shared-deck-footer">
      <div className={contained ? styles.contained : undefined}>
        <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
        {note !== undefined && <p>{note}</p>}
        {!contained && (
          <p>
            <SharedGlossaryLink glossaryBackLabel={glossaryBackLabel} />
          </p>
        )}
      </div>
    </footer>
  );
}
