import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  ISearchCardResult,
  useSearchCardsQuery,
} from '../api/catalog';
import { useAddCardMutation } from '../api/collection';

const DEBOUNCE_MS = 250;
const CONFIRMATION_DISMISS_MS = 2500;
const MIN_QUERY_LENGTH = 2;

interface IConfirmation {
  readonly name: string;
  readonly newQuantity: number;
}

interface ICardAutocompleteProps {
  readonly label?: string;
  readonly placeholder?: string;
}

/**
 * ARIA combobox that lets authenticated users search the catalog and add
 * cards to their collection without leaving the current page. Keyboard
 * interactions match the WAI-ARIA Authoring Practices combobox pattern
 * (listbox popup, single-select, inline autocomplete NOT enabled).
 *
 * The component does NOT clear the input after add so users can re-select
 * the same card for rapid quantity bumps. The listbox stays open across
 * successful mutations to support multi-add.
 */
export function CardAutocomplete({
  label = 'Add cards to your collection',
  placeholder = 'Search card name...',
}: ICardAutocompleteProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [confirmation, setConfirmation] = useState<IConfirmation | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const listboxId = useId();
  const labelId = useId();
  const optionIdPrefix = useId();

  // Manual 250ms debounce on the raw input — the query hook only fires once
  // the user stops typing, which keeps the server-side rate limit budget sane.
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
  const showEmptyState =
    hasQueryLength &&
    searchQuery.isSuccess &&
    !searchQuery.isFetching &&
    results.length === 0;

  // Reset highlight when the result set changes so the highlight never
  // points past the end of the list.
  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Auto-dismiss the inline confirmation pill after 2.5s.
  useEffect(() => {
    if (!confirmation) return;
    const handle = setTimeout(() => setConfirmation(null), CONFIRMATION_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [confirmation]);

  // Click-outside closes the listbox without clearing the input value.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!rootRef.current) return;
      if (event.target instanceof Node && rootRef.current.contains(event.target)) {
        return;
      }
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
          onSuccess: (data) => {
            setConfirmation({ name: card.name, newQuantity: data.newQuantity });
            // Keep input populated and listbox open for multi-add.
            setIsOpen(true);
            inputRef.current?.focus();
          },
        },
      );
    },
    [addCardMutation],
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
      if (!isOpen || activeIndex < 0 || activeIndex >= results.length) {
        return;
      }
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        handleSelect(selected);
      }
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
    <div
      ref={rootRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      <label id={labelId} htmlFor={`${labelId}-input`} style={{ fontWeight: 600 }}>
        {label}
      </label>

      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-owns={listboxId}
        aria-haspopup="listbox"
        style={{ position: 'relative' }}
      >
        <input
          ref={inputRef}
          id={`${labelId}-input`}
          type="text"
          role="searchbox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          aria-labelledby={labelId}
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery.isFetching && hasQueryLength ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '0.75rem',
              color: '#718096',
            }}
          >
            ...
          </span>
        ) : null}
      </div>

      {isOpen && hasQueryLength ? (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '0.25rem 0',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            background: '#fff',
            maxHeight: '16rem',
            overflowY: 'auto',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          {results.map((card, index) => {
            const isActive = index === activeIndex;
            const pitchColor = pitchToColor(card.pitch);
            const classLabel = card.classes[0] ?? '';
            return (
              <li
                key={card.cardIdentifier}
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  // Prevent input blur before click fires.
                  e.preventDefault();
                }}
                onClick={() => handleSelect(card)}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  background: isActive ? '#edf2f7' : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '0.75rem',
                    height: '0.75rem',
                    borderRadius: '50%',
                    background: pitchColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{card.name}</span>
                {classLabel ? (
                  <span style={{ fontSize: '0.75rem', color: '#718096' }}>{classLabel}</span>
                ) : null}
                {card.ownedQuantity > 0 ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#2f855a',
                      background: '#f0fff4',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '10px',
                    }}
                  >
                    owned: {card.ownedQuantity}
                  </span>
                ) : null}
              </li>
            );
          })}
          {showEmptyState ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              style={{ padding: '0.5rem 0.75rem', color: '#718096', fontStyle: 'italic' }}
            >
              No cards found for "{debouncedQuery}"
            </li>
          ) : null}
        </ul>
      ) : null}

      {confirmation ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: '0.875rem',
            color: '#22543d',
            background: '#f0fff4',
            border: '1px solid #9ae6b4',
            borderRadius: '4px',
            padding: '0.375rem 0.625rem',
            alignSelf: 'flex-start',
          }}
        >
          Added {confirmation.name} (now in collection: {confirmation.newQuantity})
        </div>
      ) : null}

      {addCardMutation.isError ? (
        <div
          role="alert"
          style={{
            fontSize: '0.875rem',
            color: '#822727',
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '4px',
            padding: '0.375rem 0.625rem',
            alignSelf: 'flex-start',
          }}
        >
          Failed to add card. Please try again.
        </div>
      ) : null}
    </div>
  );
}

function pitchToColor(pitch: number | null): string {
  switch (pitch) {
    case 1:
      return '#e53e3e';
    case 2:
      return '#d69e2e';
    case 3:
      return '#3182ce';
    default:
      return '#a0aec0';
  }
}
