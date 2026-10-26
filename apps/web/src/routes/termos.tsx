import React, { useEffect, useState } from 'react';
import { createFileRoute, Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { SharedTopBar } from '../components/shared-deck/SharedTopBar';
import { glossaryEntries, readGlossaryOrigin, searchGlossary } from '../components/glossary/glossary-model';
import styles from './termos.module.css';

interface ITermosSearch {
  readonly q?: string | undefined;
}

// Public route, like the shared pages: the LSS notice at the foot is what keeps it open to anyone.
export const Route = createFileRoute('/termos')({
  validateSearch: (search: Record<string, unknown>): ITermosSearch => ({
    q: typeof search['q'] === 'string' && search['q'] !== '' ? search['q'] : undefined,
  }),
  component: TermosRoute,
});

function TermosRoute(): React.ReactElement {
  const { q } = Route.useSearch();
  return <TermosPage initialQuery={q ?? ''} />;
}

interface ITermosPageProps {
  readonly initialQuery?: string;
}

function scrollToWord(hash: string): void {
  if (hash === '') return;
  document.getElementById(hash)?.scrollIntoView?.({ block: 'start' });
}

/** "Termos do jogo": every word of the glossary with its sentence, searchable, readable without an account. */
export function TermosPage({ initialQuery = '' }: ITermosPageProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const location = useRouterState({ select: (state) => state.location });
  const origin = readGlossaryOrigin(location.state);
  const hash = (location.hash ?? '').replace(/^#/, '');

  const entries = glossaryEntries(t, i18n.language);
  const found = searchGlossary(entries, query);
  const noMatch = query.trim() !== '' && found.length === 0;
  const shown = noMatch ? entries : found;
  const backPath = origin?.path ?? (user === null ? '/' : '/home');

  useEffect(() => {
    scrollToWord(hash);
  }, [hash]);

  return (
    <div className={styles.page}>
      <SharedTopBar shareToken={null} isSignedIn={user !== null} offerSignUp={false} />
      <main className={styles.main}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={backPath as any} className={styles.back} data-testid="glossary-back">
          <span aria-hidden="true">‹ </span>
          {t('glossary.page.back')}
        </Link>
        <h1 className={styles.title}>{t('glossary.page.title')}</h1>
        <p className={styles.lead}>{t('glossary.page.lead')}</p>

        <div className={styles.search}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            aria-label={t('glossary.page.searchLabel')}
            placeholder={t('glossary.page.searchLabel')}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>

        {origin?.label !== undefined && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Link to={origin.path as any} className={styles.backToList} data-testid="glossary-back-to-list">
            {origin.label}
          </Link>
        )}

        {noMatch && (
          <p className={styles.noMatch} role="status" data-testid="glossary-no-match">
            {t('glossary.page.noMatch', { query: query.trim() })}
          </p>
        )}

        <dl className={styles.list}>
          {shown.map((entry) => (
            <div key={entry.id} id={entry.id} className={styles.entry} data-testid="glossary-entry">
              <dt className={styles.word}>{entry.word}</dt>
              <dd className={styles.sentence}>{entry.sentence}</dd>
            </div>
          ))}
        </dl>
      </main>
      <footer className={styles.footer} data-testid="shared-deck-footer">
        <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={'/about' as any} className={styles.about}>
          {t('about.footerLinkLabel')}
        </Link>
      </footer>
    </div>
  );
}
