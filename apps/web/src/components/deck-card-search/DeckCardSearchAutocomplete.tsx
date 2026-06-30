import React, {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ISearchCardResult, useSearchCardsQuery } from '../../api/catalog';
import type { TDeckSlot } from './SlotPicker';
import styles from './DeckCardSearchAutocomplete.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

/** Stable empty array used as fallback for search results to avoid a new reference each render. */
const EMPTY_RESULTS: readonly ISearchCardResult[] = [];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { TDeckSlot };

export interface IDeckCardSearchAutocompleteProps {
  /**
   * Called when the user selects a card from the dropdown.
   * Receives the full `ISearchCardResult` (including the U17 legality fields).
   * The deck slot is a property of the card type and is derived by the
   * caller, not chosen here.
   */
  readonly onPick: (card: ISearchCardResult) => void;

  /**
   * Placeholder text for the search input. Defaults to "Search card name...".
   */
  readonly placeholder?: string;

  /**
   * Label for the search input. Defaults to "Search cards".
   */
  readonly label?: string;

  /**
   * Ref forwarded to the underlying input so external callers can focus it.
   */
  readonly inputRef?: React.RefObject<HTMLInputElement | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DeckCardSearchAutocomplete — reusable WAI-ARIA combobox for searching
 * catalog cards, parameterized via `onPick(card)`. Manages search query,
 * debounce (250ms), keyboard navigation, ARIA combobox semantics, and
 * EMPTY_RESULTS stable ref.
 *
 * No internal mutation — callers supply the `onPick` callback and decide
 * what to do with the selected card (add to collection, add to deck, etc.).
 * The deck slot is a property of the card type (a Weapon goes to `weapon`,
 * an Equipment to `equipment`, etc.) and is derived by the caller from
 * `card.types`, never chosen by the user.
 *
 * Keyboard interaction follows WAI-ARIA Authoring Practices combobox pattern:
 * ArrowDown/Up navigate options, Enter selects, Escape closes the dropdown
 * (preserving the typed text).
 */
export function DeckCardSearchAutocomplete({
  onPick,
  placeholder,
  label,
  inputRef: externalInputRef,
}: IDeckCardSearchAutocompleteProps): React.ReactElement {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('decks.searchCardsLabel');
  const resolvedPlaceholder = placeholder ?? t('decks.searchCardsPlaceholder');
  const [inputValue, setInputValue] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRefToUse = externalInputRef ?? internalInputRef;
  const listboxRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const listboxId = useId();
  const labelId = useId();
  const optionIdPrefix = useId();

  // Debounce the raw input — keeps server-side rate limit budget sane.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [inputValue]);

  const searchQuery = useSearchCardsQuery(debouncedQuery);

  // Memoized so the `useEffect` below receives a stable reference and only
  // resets the highlight when the result set actually changes.
  const results = useMemo<readonly ISearchCardResult[]>(
    () => searchQuery.data?.results ?? EMPTY_RESULTS,
    [searchQuery.data],
  );
  const hasQueryLength = debouncedQuery.length >= MIN_QUERY_LENGTH;
  const showEmptyResults =
    hasQueryLength && searchQuery.isSuccess && !searchQuery.isFetching && results.length === 0;

  // Reset highlight when result set changes.
  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Click-outside closes listbox.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!rootRef.current) return;
      if (event.target instanceof Node && rootRef.current.contains(event.target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (card: ISearchCardResult) => {
      onPick(card);
      inputRefToUse.current?.focus();
    },
    [onPick, inputRefToUse],
  );

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (results.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (results.length === 0) return;
      setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      if (!isOpen || activeIndex < 0 || activeIndex >= results.length) return;
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) handleSelect(selected);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      // Closes the dropdown but preserves the typed text.
      setIsOpen(false);
      return;
    }
  };

  const activeDescendantId =
    isOpen && activeIndex >= 0 && activeIndex < results.length
      ? `${optionIdPrefix}-${activeIndex}`
      : undefined;

  return (
    <div ref={rootRef} className={styles.root}>
      <label id={labelId} htmlFor={`${labelId}-input`} className={styles.label}>
        {resolvedLabel}
      </label>

      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        className={styles.comboboxWrapper}
      >
        <input
          ref={inputRefToUse}
          id={`${labelId}-input`}
          type="text"
          role="searchbox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          aria-labelledby={labelId}
          value={inputValue}
          placeholder={resolvedPlaceholder}
          className={styles.input}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {searchQuery.isFetching && hasQueryLength ? (
          <span className={styles.spinner} aria-hidden="true">
            ...
          </span>
        ) : null}
      </div>

      {/* Listbox dropdown */}
      {isOpen && hasQueryLength ? (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className={styles.listbox}
        >
          {results.map((card, index) => {
            const isActive = index === activeIndex;
            const classStr = card.classes[0] ?? '';
            return (
              <li
                key={card.cardIdentifier}
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-selected={isActive}
                className={isActive ? `${styles.option} ${styles.optionActive}` : styles.option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(card)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span
                  className={styles.pitchDot}
                  data-pitch={card.pitch ?? 'colorless'}
                  aria-hidden="true"
                />
                <span className={styles.optionName}>{card.name}</span>
                {classStr ? (
                  <span className={styles.optionClass}>{classStr}</span>
                ) : null}
                {card.ownedQuantity > 0 ? (
                  <span className={styles.ownedBadge} aria-label={t('decks.ownedBadgeAria', { count: card.ownedQuantity })}>
                    {t('decks.ownedBadge', { count: card.ownedQuantity })}
                  </span>
                ) : null}
              </li>
            );
          })}
          {showEmptyResults ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className={styles.optionEmpty}
            >
              {t('decks.noCardsFound', { query: debouncedQuery })}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
