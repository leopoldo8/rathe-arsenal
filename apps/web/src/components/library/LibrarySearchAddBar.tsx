import React, {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ISearchCardResult, useSearchCardsQuery } from '../../api/catalog';
import { useAddCardMutation } from '../../api/collection';
import { LIBRARY_QUERY_KEY } from '../../api/library';
import styles from './LibrarySearchAddBar.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ILibrarySearchAddBarProps {
  /** Ref forwarded to the underlying input so external callers can focus it
   * (e.g. LibraryEmptyState "Search and add a card" CTA). */
  readonly inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Called after a card is successfully added — parent may show a toast. */
  readonly onAdded?: (cardName: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LibrarySearchAddBar — ARIA combobox for searching catalog cards and adding
 * them to the user's collection from within the Library page.
 *
 * Keyboard interaction follows WAI-ARIA Authoring Practices combobox pattern.
 * On successful add, invalidates ['library'], ['decks'], and ['deck-detail']
 * queries so downstream caches update without the user needing to refresh.
 */
export function LibrarySearchAddBar({
  inputRef: externalInputRef,
  onAdded,
}: ILibrarySearchAddBarProps): React.ReactElement {
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

  const queryClient = useQueryClient();

  // Debounce the raw input — keeps server-side rate limit budget sane.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [inputValue]);

  const searchQuery = useSearchCardsQuery(debouncedQuery);
  const addCardMutation = useAddCardMutation();

  const results: readonly ISearchCardResult[] = searchQuery.data?.results ?? [];
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
      addCardMutation.mutate(
        { cardIdentifier: card.cardIdentifier, quantity: 1 },
        {
          onSuccess: () => {
            // Invalidate library + decks so both surfaces stay current.
            void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: ['decks'] });
            void queryClient.invalidateQueries({ queryKey: ['deck-detail'] });

            setIsOpen(true);
            inputRefToUse.current?.focus();
            onAdded?.(card.name);
          },
        },
      );
    },
    [addCardMutation, queryClient, inputRefToUse, onAdded],
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
        Search and add cards to your library
      </label>

      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-owns={listboxId}
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
          placeholder="Search card name..."
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
                  style={{ background: pitchToColor(card.pitch) }}
                  aria-hidden="true"
                />
                <span className={styles.optionName}>{card.name}</span>
                {classStr ? (
                  <span className={styles.optionClass}>{classStr}</span>
                ) : null}
                {card.ownedQuantity > 0 ? (
                  <span className={styles.ownedBadge} aria-label={`owned: ${card.ownedQuantity}`}>
                    owned: {card.ownedQuantity}
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
              No cards found for &ldquo;{debouncedQuery}&rdquo;
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* Mutation error */}
      {addCardMutation.isError ? (
        <div role="alert" className={styles.errorMsg}>
          Failed to add card. Please try again.
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pitchToColor(pitch: number | null): string {
  switch (pitch) {
    case 1:
      return 'var(--ra-pitch-red)';
    case 2:
      return 'var(--ra-pitch-yellow)';
    case 3:
      return 'var(--ra-pitch-blue)';
    default:
      return 'var(--ra-fg-muted)';
  }
}
