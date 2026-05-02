import React, { useId } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { IReviewsFilters } from './ReviewsFilters.helpers';
import { DEFAULT_FILTERS } from './ReviewsFilters.helpers';
import styles from './ReviewsFilters.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IReviewsFiltersProps {
  readonly filters: IReviewsFilters;
  readonly availableDecks: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly availableHeroes: readonly string[];
  readonly onChange: (next: IReviewsFilters) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReviewsFilters — Radix Popover-based filter chips for the Reviews page.
 *
 * Each filter chip opens a Popover with the relevant controls:
 *  - Tier: multi-select checkboxes (1, 2, 3)
 *  - Deck: multi-select checkbox list of the user's tracked decks
 *  - Hero: multi-select checkbox list of heroes appearing in results
 *  - Confidence: dual-bound range (min/max)
 *
 * All filter changes write to URL via the parent's `onChange` handler.
 */
export function ReviewsFilters({
  filters,
  availableDecks,
  availableHeroes,
  onChange,
}: IReviewsFiltersProps): React.ReactElement {
  const tierCount = filters.tier.length;
  const deckCount = filters.deck.length;
  const heroCount = filters.hero.length;
  const hasConfidence =
    filters.confidenceMin !== DEFAULT_FILTERS.confidenceMin ||
    filters.confidenceMax !== DEFAULT_FILTERS.confidenceMax;

  const activeCount = tierCount + deckCount + heroCount + (hasConfidence ? 1 : 0);

  function clearAll(): void {
    onChange(DEFAULT_FILTERS);
  }

  return (
    <div className={styles.bar} role="group" aria-label="Filters">
      <span className={styles.label}>Filters</span>

      {/* Tier filter */}
      <TierFilter
        value={filters.tier}
        onChange={(tier) => onChange({ ...filters, tier })}
      />

      {/* Deck filter */}
      {availableDecks.length > 0 && (
        <DeckFilter
          value={filters.deck}
          decks={availableDecks}
          onChange={(deck) => onChange({ ...filters, deck })}
        />
      )}

      {/* Hero filter */}
      {availableHeroes.length > 0 && (
        <HeroFilter
          value={filters.hero}
          heroes={availableHeroes}
          onChange={(hero) => onChange({ ...filters, hero })}
        />
      )}

      {/* Confidence filter */}
      <ConfidenceFilter
        min={filters.confidenceMin}
        max={filters.confidenceMax}
        onChange={(confidenceMin, confidenceMax) =>
          onChange({ ...filters, confidenceMin, confidenceMax })
        }
      />

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={clearAll}
          aria-label={`Clear all ${activeCount} active filters`}
        >
          Clear ({activeCount})
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier filter
// ---------------------------------------------------------------------------

interface ITierFilterProps {
  readonly value: ReadonlyArray<1 | 2 | 3>;
  readonly onChange: (next: ReadonlyArray<1 | 2 | 3>) => void;
}

function TierFilter({ value, onChange }: ITierFilterProps): React.ReactElement {
  const active = value.length > 0;

  function toggle(tier: 1 | 2 | 3): void {
    const next = value.includes(tier)
      ? value.filter((t) => t !== tier)
      : [...value, tier];
    onChange(next as ReadonlyArray<1 | 2 | 3>);
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`${styles.chip} ${active ? styles['chip--active'] : ''}`}
          aria-pressed={active}
        >
          Tier{active ? ` (${value.join(', ')})` : ''}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popoverContent} align="start" sideOffset={6}>
          <p className={styles.popoverLabel}>Tier</p>
          {([1, 2, 3] as const).map((tier) => (
            <CheckboxItem
              key={tier}
              label={`Tier ${tier}`}
              checked={value.includes(tier)}
              onChange={() => toggle(tier)}
            />
          ))}
          <Popover.Arrow className={styles.popoverArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// Deck filter
// ---------------------------------------------------------------------------

interface IDeckFilterProps {
  readonly value: readonly string[];
  readonly decks: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly onChange: (next: readonly string[]) => void;
}

function DeckFilter({ value, decks, onChange }: IDeckFilterProps): React.ReactElement {
  const active = value.length > 0;

  function toggle(id: string): void {
    const next = value.includes(id) ? value.filter((d) => d !== id) : [...value, id];
    onChange(next);
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`${styles.chip} ${active ? styles['chip--active'] : ''}`}
          aria-pressed={active}
        >
          Deck{active ? ` (${value.length})` : ''}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popoverContent} align="start" sideOffset={6}>
          <p className={styles.popoverLabel}>Deck</p>
          {decks.map((deck) => (
            <CheckboxItem
              key={deck.id}
              label={deck.name}
              checked={value.includes(deck.id)}
              onChange={() => toggle(deck.id)}
            />
          ))}
          <Popover.Arrow className={styles.popoverArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// Hero filter
// ---------------------------------------------------------------------------

interface IHeroFilterProps {
  readonly value: readonly string[];
  readonly heroes: readonly string[];
  readonly onChange: (next: readonly string[]) => void;
}

function HeroFilter({ value, heroes, onChange }: IHeroFilterProps): React.ReactElement {
  const active = value.length > 0;

  function toggle(hero: string): void {
    const next = value.includes(hero)
      ? value.filter((h) => h !== hero)
      : [...value, hero];
    onChange(next);
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`${styles.chip} ${active ? styles['chip--active'] : ''}`}
          aria-pressed={active}
        >
          Hero{active ? ` (${value.length})` : ''}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popoverContent} align="start" sideOffset={6}>
          <p className={styles.popoverLabel}>Hero</p>
          {heroes.map((hero) => (
            <CheckboxItem
              key={hero}
              label={hero}
              checked={value.includes(hero)}
              onChange={() => toggle(hero)}
            />
          ))}
          <Popover.Arrow className={styles.popoverArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// Confidence filter
// ---------------------------------------------------------------------------

interface IConfidenceFilterProps {
  readonly min: number;
  readonly max: number;
  readonly onChange: (min: number, max: number) => void;
}

function ConfidenceFilter({ min, max, onChange }: IConfidenceFilterProps): React.ReactElement {
  const minId = useId();
  const maxId = useId();
  const isDefault = min === 0 && max === 100;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`${styles.chip} ${!isDefault ? styles['chip--active'] : ''}`}
          aria-pressed={!isDefault}
        >
          Confidence{!isDefault ? ` (${min}–${max})` : ''}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popoverContent} align="start" sideOffset={6}>
          <p className={styles.popoverLabel}>Confidence range</p>
          <div className={styles.rangeRow}>
            <label htmlFor={minId} className={styles.rangeLabel}>
              Min
            </label>
            <input
              id={minId}
              type="range"
              min={0}
              max={100}
              value={min}
              onChange={(e) => {
                const next = Number(e.target.value);
                onChange(Math.min(next, max), max);
              }}
              className={styles.rangeInput}
            />
            <span className={styles.rangeValue}>{min}</span>
          </div>
          <div className={styles.rangeRow}>
            <label htmlFor={maxId} className={styles.rangeLabel}>
              Max
            </label>
            <input
              id={maxId}
              type="range"
              min={0}
              max={100}
              value={max}
              onChange={(e) => {
                const next = Number(e.target.value);
                onChange(min, Math.max(next, min));
              }}
              className={styles.rangeInput}
            />
            <span className={styles.rangeValue}>{max}</span>
          </div>
          <Popover.Arrow className={styles.popoverArrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// Shared CheckboxItem sub-component
// ---------------------------------------------------------------------------

interface ICheckboxItemProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
}

function CheckboxItem({ label, checked, onChange }: ICheckboxItemProps): React.ReactElement {
  const id = useId();
  return (
    <label htmlFor={id} className={styles.checkboxItem}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={styles.checkboxInput}
      />
      <span className={styles.checkboxLabel}>{label}</span>
    </label>
  );
}
