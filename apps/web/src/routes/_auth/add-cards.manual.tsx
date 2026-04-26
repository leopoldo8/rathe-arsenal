import React, { useEffect, useId, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchCardsQuery } from '../../api/catalog';
import type { ISearchCardResult } from '../../api/catalog';
import { useAddCardMutation } from '../../api/collection';
import { LIBRARY_QUERY_KEY } from '../../api/library';
import styles from './add-cards.manual.module.css';

export const Route = createFileRoute('/_auth/add-cards/manual')({
  component: AddCardsManualPage,
});

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const QTY_MIN = 1;
const QTY_MAX = 3;

function AddCardsManualPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  // Counter incremented on every successful add. The result row reads
  // this via key changes to reset its local qty stepper back to 1 — no
  // toast, no banner, no redirect. The catalog query invalidates on
  // success too, so each row's "Owned: N" updates as the natural
  // confirmation that the add went through.
  const [addsCommitted, setAddsCommitted] = useState(0);
  const inputId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const search = useSearchCardsQuery(debounced);
  const addMutation = useAddCardMutation();

  const results = search.data?.results ?? [];
  const showResults = debounced.length >= MIN_QUERY;
  const isEmptyResult =
    showResults && search.isSuccess && !search.isFetching && results.length === 0;

  function handleAdd(card: ISearchCardResult, qty: number): void {
    addMutation.mutate(
      { cardIdentifier: card.cardIdentifier, quantity: qty },
      {
        onSuccess: () => {
          setAddsCommitted((n) => n + 1);
          queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
        },
      },
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.subviewHeader}>
        <Link to="/add-cards" className={styles.back}>
          <span aria-hidden="true">←</span> Add cards
        </Link>
        <p className={styles.eyebrow}>
          <span className={styles.numeral} aria-hidden="true">I</span> Manual
        </p>
        <h1 className={styles.title}>Search the catalog</h1>
        <p className={styles.subtitle}>
          Type a card name. Pick a quantity (1–3) and add it to your library.
        </p>
      </header>

      <div className={styles.searchBox}>
        <label className={styles.label} htmlFor={inputId}>
          Card name
        </label>
        <input
          id={inputId}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          placeholder="Type a card name (min 2 chars)"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className={styles.input}
        />
      </div>

      {/* States — order matters for clarity. */}
      {!showResults && (
        <p className={styles.emptyHint}>
          Start typing to search the catalog.
        </p>
      )}

      {isEmptyResult && (
        <p className={styles.emptyHint}>No cards match &ldquo;{debounced}&rdquo;.</p>
      )}

      {showResults && results.length > 0 && (
        <ul className={styles.results} aria-label="Search results">
          {results.map((card) => (
            <ResultRow
              // `addsCommitted` is folded into the row key so each row
              // remounts after a successful add — that resets the local
              // qty stepper back to 1 without leaking add-time state
              // into the row's render.
              key={`${card.cardIdentifier}-${addsCommitted}`}
              card={card}
              onAdd={handleAdd}
              isPending={addMutation.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface IResultRowProps {
  readonly card: ISearchCardResult;
  readonly onAdd: (card: ISearchCardResult, qty: number) => void;
  readonly isPending: boolean;
}

function ResultRow({ card, onAdd, isPending }: IResultRowProps): React.ReactElement {
  const [qty, setQty] = useState(1);
  const pitchLabel =
    card.pitch === 1 ? 'Red' : card.pitch === 2 ? 'Yellow' : card.pitch === 3 ? 'Blue' : 'Colorless';
  const pitchTone =
    card.pitch === 1 ? 'red' : card.pitch === 2 ? 'yellow' : card.pitch === 3 ? 'blue' : 'colorless';
  const primaryType = card.types[0] ?? '—';
  const className = card.classes.join(', ') || 'Generic';

  function bump(delta: number): void {
    const next = Math.max(QTY_MIN, Math.min(QTY_MAX, qty + delta));
    setQty(next);
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span
          className={`${styles.pitchBadge} ${styles[`pitchBadge--${pitchTone}`]}`}
          aria-label={`${pitchLabel} pitch`}
        >
          {card.pitch ?? '◇'}
        </span>
        <div className={styles.rowText}>
          <p className={styles.rowName}>{card.name}</p>
          <p className={styles.rowMeta}>
            <span>{className}</span>
            <span className={styles.rowSep} aria-hidden="true">·</span>
            <span>{primaryType}</span>
            {card.ownedQuantity > 0 && (
              <>
                <span className={styles.rowSep} aria-hidden="true">·</span>
                <span className={styles.ownedTag}>
                  Owned: <strong>{card.ownedQuantity}</strong>
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className={styles.rowActions}>
        <div
          className={styles.stepper}
          role="group"
          aria-label={`Quantity for ${card.name}`}
        >
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => bump(-1)}
            disabled={qty <= QTY_MIN}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className={styles.stepValue} aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className={styles.stepBtn}
            onClick={() => bump(+1)}
            disabled={qty >= QTY_MAX}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => onAdd(card, qty)}
          disabled={isPending}
        >
          Add
        </button>
      </div>
    </li>
  );
}
