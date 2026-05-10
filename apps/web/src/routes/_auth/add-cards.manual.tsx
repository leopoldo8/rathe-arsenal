import React, { useEffect, useId, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useSearchCardsQuery } from '../../api/catalog';
import type { ISearchCardResult } from '../../api/catalog';
import { useAddCardMutation } from '../../api/collection';
import { CardLightbox } from '../../components/card-art/CardLightbox';
import { CardArt } from '../../components/card-art/CardArt';
import styles from './add-cards.manual.module.css';

export const Route = createFileRoute('/_auth/add-cards/manual')({
  component: AddCardsManualPage,
});

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const QTY_MIN = 1;
const QTY_MAX = 3;

interface ILightboxState {
  readonly imageUrl: string;
  readonly name: string;
}

function AddCardsManualPage(): React.ReactElement {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  // Counter incremented on every successful add. The result row reads
  // this via key changes to reset its local qty stepper back to 1 — no
  // toast, no banner, no redirect. The catalog + library queries are
  // invalidated by `useAddCardMutation`'s onSuccess so each row's
  // "Owned: N" updates as the natural confirmation that the add went
  // through.
  const [addsCommitted, setAddsCommitted] = useState(0);
  const [lightbox, setLightbox] = useState<ILightboxState | null>(null);
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
              onOpenLightbox={(payload) => setLightbox(payload)}
            />
          ))}
        </ul>
      )}

      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

interface IResultRowProps {
  readonly card: ISearchCardResult;
  readonly onAdd: (card: ISearchCardResult, qty: number) => void;
  readonly isPending: boolean;
  readonly onOpenLightbox: (state: ILightboxState) => void;
}

function ResultRow({
  card,
  onAdd,
  isPending,
  onOpenLightbox,
}: IResultRowProps): React.ReactElement {
  const [qty, setQty] = useState(1);
  const [thumbFailed, setThumbFailed] = useState(false);
  const primaryType = card.types[0] ?? '—';
  const className = card.classes.join(', ') || 'Generic';

  // Pitch ◆ pip — tonalized by pitch value. Heroes/weapons/equipment
  // are pitch-less and render no diamond (absence is the signal).
  const pitchToneClass = resolvePitchToneClass(card.pitch);

  function bump(delta: number): void {
    const next = Math.max(QTY_MIN, Math.min(QTY_MAX, qty + delta));
    setQty(next);
  }

  function handleThumbClick(): void {
    if (!card.imageUrl) return;
    onOpenLightbox({ imageUrl: card.imageUrl.large, name: card.name });
  }

  const showThumbImage =
    card.imageUrl !== null && card.imageUrl.small.length > 0 && !thumbFailed;

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <button
          type="button"
          className={styles.thumb}
          onClick={handleThumbClick}
          disabled={!card.imageUrl}
          aria-label={card.imageUrl ? `Preview ${card.name}` : `${card.name} (no preview)`}
        >
          {showThumbImage ? (
            <img
              src={card.imageUrl!.small}
              alt=""
              loading="lazy"
              decoding="async"
              className={styles.thumbImage}
              onError={() => setThumbFailed(true)}
            />
          ) : (
            // Fallback to <CardArt> SVG placeholder. Same fallback chain
            // used in BreakdownSections / ReviewsRow.
            <CardArt
              name={card.name}
              pitch={
                card.pitch === 1 || card.pitch === 2 || card.pitch === 3
                  ? card.pitch
                  : null
              }
              cost={null}
              type={primaryType}
              missing={false}
              size="xs"
              imageUrl={null}
            />
          )}
        </button>
        <div className={styles.rowText}>
          <p className={styles.rowName}>
            {pitchToneClass !== null && (
              <span
                className={`${styles.pitchPip} ${styles[pitchToneClass]}`}
                aria-label={`${pitchLabelFor(card.pitch)} pitch`}
              >
                &#9670;
              </span>
            )}
            {card.name}
          </p>
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the CSS-module class name for the pitch ◆ pip, or null when
 * the card is pitch-less (no diamond rendered). The diamond uses the
 * brand's existing decorative-diamond vocabulary — see `.impeccable.md`.
 */
function resolvePitchToneClass(
  pitch: number | null,
): 'pitchPipRed' | 'pitchPipYellow' | 'pitchPipBlue' | null {
  if (pitch === 1) return 'pitchPipRed';
  if (pitch === 2) return 'pitchPipYellow';
  if (pitch === 3) return 'pitchPipBlue';
  return null;
}

function pitchLabelFor(pitch: number | null): string {
  if (pitch === 1) return 'Red';
  if (pitch === 2) return 'Yellow';
  if (pitch === 3) return 'Blue';
  return 'No';
}
