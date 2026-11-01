import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { GLOSSARY_ORIGIN_KEY } from '../glossary/glossary-model';
import styles from './SharedDeckFooter.module.css';

interface ISharedGlossaryLinkProps {
  /** What the glossary's way back reads, when the page knows whose deck or list this is ("Voltar para a lista do Pedro"). */
  readonly glossaryBackLabel?: string | undefined;
}

/** The way into the glossary from a shared page; it remembers this page so the glossary can lead back. */
export function SharedGlossaryLink({ glossaryBackLabel }: ISharedGlossaryLinkProps): React.ReactElement {
  const { t } = useTranslation();
  const origin = {
    path: `${window.location.pathname}${window.location.search}`,
    ...(glossaryBackLabel === undefined ? {} : { label: glossaryBackLabel }),
  };
  return (
    <Link
      to="/termos"
      state={((previous: Record<string, unknown>) => ({ ...previous, [GLOSSARY_ORIGIN_KEY]: origin })) as never}
      className={styles.glossaryLink}
    >
      {t('glossary.sharedFootLink')}
    </Link>
  );
}
