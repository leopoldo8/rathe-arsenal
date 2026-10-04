import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { useSearchCardsQuery, type ISearchCardResult } from '../../api/catalog';
import { CardName, CardThumb } from './CardFace';
import styles from './CardScanner.module.css';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

interface INameSearchSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onPick: (card: ISearchCardResult) => void;
}

export function NameSearchSheet({ open, onClose, onPick }: INameSearchSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
    }
  }, [open]);

  const search = useSearchCardsQuery(debounced);
  const results = search.data?.results ?? [];
  const showResults = debounced.length >= MIN_QUERY;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <div className={styles.sheetHeader}>
            <Dialog.Title className={styles.sheetTitle}>{t('scanner.searchTitle')}</Dialog.Title>
            <Dialog.Close className={styles.secondaryButton}>{t('scanner.searchClose')}</Dialog.Close>
          </div>
          <label className={styles.searchLabel} htmlFor={inputId}>
            {t('decks.cardNameLabel')}
          </label>
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            className={styles.searchInput}
            placeholder={t('decks.cardNamePlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {!showResults && <p className={styles.searchHint}>{t('decks.startTypingHint')}</p>}
          {showResults && search.isSuccess && results.length === 0 && (
            <p className={styles.searchHint}>{t('decks.noCardsMatchQuery', { query: debounced })}</p>
          )}
          {showResults && results.length > 0 && (
            <ul className={styles.searchResults} aria-label={t('decks.searchResultsAria')}>
              {results.map((card) => (
                <li key={card.cardIdentifier}>
                  <button type="button" className={styles.faceOption} onClick={() => onPick(card)}>
                    <CardThumb
                      card={{
                        cardIdentifier: card.cardIdentifier,
                        name: card.name,
                        pitch: card.pitch,
                        imageSmall: card.imageUrl?.small ?? null,
                      }}
                    />
                    <CardName
                      card={{ cardIdentifier: card.cardIdentifier, name: card.name, pitch: card.pitch, imageSmall: null }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
