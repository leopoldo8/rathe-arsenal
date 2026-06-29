/**
 * HeroDropdown — searchable combobox for selecting a deck hero in Edit mode.
 *
 * Consumes `useHeroesQuery()` from the catalog API (U17 endpoint:
 * GET /catalog/heroes). Filters the hero list by name as the user types.
 * Emits the selected hero's `cardIdentifier` (the catalog cardIdentifier).
 *
 * IMPORTANT: This component does NOT import `@rathe-arsenal/engine` or
 * `@flesh-and-blood/cards`. Hero data comes exclusively from the API.
 */
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHeroesQuery, type IHeroListItem } from '../../api/catalog';
import { isHeroLegalForFormat } from '../../lib/hero-legality';
import styles from './HeroDropdown.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_FILTER_LENGTH = 1;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IHeroDropdownProps {
  /**
   * Currently selected hero cardIdentifier. Null when no hero is selected.
   */
  readonly value: string | null;
  /**
   * Called when the user selects a hero. Emits the hero's cardIdentifier.
   * Pass null when the user clears the selection.
   */
  readonly onChange: (heroIdentifier: string | null) => void;
  /** Label text shown above the combobox. Defaults to the localized "Hero" label. */
  readonly label?: string;
  /**
   * When set to a concrete format (e.g. "Silver Age"), heroes not legal in
   * that format are removed from the selectable list, and an already-selected
   * hero that is illegal renders an error state. Empty string means no
   * constraint (every hero is selectable).
   */
  readonly filterFormat?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * HeroDropdown — searchable hero picker for the deck Edit mode.
 */
export function HeroDropdown({
  value,
  onChange,
  label,
  filterFormat = '',
}: IHeroDropdownProps): React.ReactElement {
  const { t } = useTranslation();
  const heroesQuery = useHeroesQuery();
  const heroesRaw = heroesQuery.data?.heroes;
  const heroes = useMemo<readonly IHeroListItem[]>(
    () => heroesRaw ?? [],
    [heroesRaw],
  );

  const labelText = label ?? t('decks.heroLabel');

  const [inputValue, setInputValue] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const labelId = useId();
  const optionIdPrefix = useId();

  // Resolve the display name for the currently selected hero
  const selectedHero = useMemo(
    () => (value ? heroes.find((h) => h.cardIdentifier === value) ?? null : null),
    [value, heroes],
  );

  // Whether the currently selected hero is illegal in the active format.
  // Drives the error state on the selected display.
  const isSelectedIllegal =
    selectedHero !== null && !isHeroLegalForFormat(selectedHero, filterFormat);

  // Filter heroes by the active format first, then by the typed name.
  const filteredHeroes = useMemo<readonly IHeroListItem[]>(() => {
    const byFormat = heroes.filter((h) => isHeroLegalForFormat(h, filterFormat));
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed.length < MIN_FILTER_LENGTH) return byFormat;
    return byFormat.filter((h) => h.name.toLowerCase().includes(trimmed));
  }, [heroes, inputValue, filterFormat]);

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(filteredHeroes.length > 0 ? 0 : -1);
  }, [filteredHeroes]);

  // Click outside closes the dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (!rootRef.current) return;
      if (e.target instanceof Node && rootRef.current.contains(e.target)) return;
      setIsOpen(false);
      setInputValue('');
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (hero: IHeroListItem) => {
      onChange(hero.cardIdentifier);
      setIsOpen(false);
      setInputValue('');
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setInputValue('');
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (filteredHeroes.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % filteredHeroes.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      if (filteredHeroes.length === 0) return;
      setActiveIndex((prev) =>
        prev <= 0 ? filteredHeroes.length - 1 : prev - 1,
      );
      return;
    }
    if (e.key === 'Enter') {
      if (!isOpen || activeIndex < 0 || activeIndex >= filteredHeroes.length) return;
      e.preventDefault();
      const hero = filteredHeroes[activeIndex];
      if (hero) handleSelect(hero);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setInputValue('');
      return;
    }
  };

  const activeDescendantId =
    isOpen && activeIndex >= 0 && activeIndex < filteredHeroes.length
      ? `${optionIdPrefix}-${activeIndex}`
      : undefined;

  // When a hero is selected, show the selected display rather than the combobox
  if (value !== null && selectedHero !== null && !isOpen) {
    return (
      <div className={styles.root} data-testid="hero-dropdown">
        <span id={labelId} className={styles.label}>
          {labelText}
        </span>
        <div
          className={
            isSelectedIllegal
              ? `${styles.selectedDisplay} ${styles.selectedDisplayError}`
              : styles.selectedDisplay
          }
          data-testid="hero-dropdown-selected"
          aria-invalid={isSelectedIllegal || undefined}
          role="button"
          tabIndex={0}
          aria-label={t('decks.selectedHeroAria', { name: selectedHero.name })}
          onClick={() => {
            setIsOpen(true);
            setInputValue('');
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsOpen(true);
              setInputValue('');
              setTimeout(() => inputRef.current?.focus(), 0);
            }
          }}
        >
          <span className={styles.selectedName}>{selectedHero.name}</span>
          <button
            type="button"
            className={styles.clearBtn}
            aria-label={t('decks.clearHeroAria')}
            data-testid="hero-dropdown-clear"
            onClick={handleClear}
          >
            &#x2715;
          </button>
        </div>
        {isSelectedIllegal ? (
          <p
            className={styles.fieldError}
            role="alert"
            data-testid="hero-dropdown-format-error"
          >
            {t('decks.heroNotLegal', { name: selectedHero.name, format: filterFormat })}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={styles.root} data-testid="hero-dropdown">
      <span id={labelId} className={styles.label}>
        {labelText}
      </span>

      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-owns={listboxId}
        aria-haspopup="listbox"
        className={styles.comboboxWrapper}
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
          data-testid="hero-dropdown-input"
          placeholder={
            heroesQuery.isLoading
              ? t('decks.loadingHeroes')
              : value
                ? selectedHero?.name ?? t('decks.selectHero')
                : t('decks.searchHero')
          }
          value={inputValue}
          className={styles.input}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {heroesQuery.isFetching ? (
          <span className={styles.spinner} aria-hidden="true">
            ...
          </span>
        ) : null}
      </div>

      {isOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className={styles.listbox}
          data-testid="hero-dropdown-listbox"
        >
          {filteredHeroes.map((hero, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={hero.cardIdentifier}
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-selected={isActive}
                data-testid={`hero-option-${hero.cardIdentifier}`}
                className={isActive ? `${styles.option} ${styles.optionActive}` : styles.option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(hero)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className={styles.optionName}>{hero.name}</span>
                {hero.young ? (
                  <span className={styles.optionMeta}>young</span>
                ) : null}
              </li>
            );
          })}
          {filteredHeroes.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className={styles.optionEmpty}
              data-testid="hero-dropdown-empty"
            >
              {t('decks.noHeroesFound')}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
