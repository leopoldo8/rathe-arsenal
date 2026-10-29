import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GLOSSARY_ORIGIN_KEY } from '../glossary/glossary-model';
import styles from './SharedDeckFooter.module.css';

interface ISharedDeckFooterProps {
  readonly note?: string;
  /** What the glossary's way back reads, when the page knows whose deck or list this is ("Voltar para a lista do Pedro"). */
  readonly glossaryBackLabel?: string;
}

/** LSS fan-content disclaimer (it already ends with the copyright line), required on every page that shows card art. */
export function SharedDeckFooter({ note, glossaryBackLabel }: ISharedDeckFooterProps): React.ReactElement {
  const { t } = useTranslation();
  const origin = {
    path: `${window.location.pathname}${window.location.search}`,
    ...(glossaryBackLabel === undefined ? {} : { label: glossaryBackLabel }),
  };
  return (
    <footer className={styles.footer} data-testid="shared-deck-footer">
      <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
      {note !== undefined && <p>{note}</p>}
      <p>
        <Link
          to="/termos"
          state={((previous: Record<string, unknown>) => ({ ...previous, [GLOSSARY_ORIGIN_KEY]: origin })) as never}
          className={styles.glossaryLink}
        >
          {t('glossary.sharedFootLink')}
        </Link>
      </p>
    </footer>
  );
}
