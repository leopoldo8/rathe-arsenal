import React, { useId } from 'react';
import type { ILibraryCard } from '../../api/library';
import styles from './LibraryFilters.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TPitch = 'red' | 'yellow' | 'blue' | 'colorless';
export type TGroupBy = 'type' | 'pitch' | 'set' | 'flat';

export interface ILibraryFiltersValue {
  readonly pitches: readonly TPitch[];
  readonly types: readonly string[];
  readonly classes: readonly string[];
  readonly talents: readonly string[];
  readonly sets: readonly string[];
  readonly group: TGroupBy;
  /** Card width in pixels for the grid cells. */
  readonly cardSize: number;
}

/** Range constants for the card-size slider — also enforced by the URL parser. */
export const CARD_SIZE_MIN = 80;
export const CARD_SIZE_MAX = 240;
export const CARD_SIZE_DEFAULT = 120;

interface ILibraryFiltersProps {
  readonly cards: readonly ILibraryCard[];
  readonly value: ILibraryFiltersValue;
  readonly onChange: (value: ILibraryFiltersValue) => void;
  /**
   * Map of set code → release name (e.g. `{ WTR: 'Welcome to Rathe' }`).
   * Optional — when omitted, the filter shows bare codes.
   */
  readonly setNames?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PITCH_OPTIONS: Array<{ value: TPitch; label: string }> = [
  { value: 'red', label: 'R — Red' },
  { value: 'yellow', label: 'Y — Yellow' },
  { value: 'blue', label: 'B — Blue' },
  { value: 'colorless', label: '— Colorless' },
];

const GROUP_OPTIONS: Array<{ value: TGroupBy; label: string }> = [
  { value: 'type', label: 'Type' },
  { value: 'pitch', label: 'Pitch' },
  { value: 'set', label: 'Set' },
  { value: 'flat', label: 'Flat' },
];

function extractTypes(cards: readonly ILibraryCard[]): string[] {
  const typeSet = new Set<string>();
  for (const card of cards) {
    for (const t of card.types) {
      if (t) typeSet.add(t);
    }
  }
  return [...typeSet].sort();
}

function extractClasses(cards: readonly ILibraryCard[]): string[] {
  const classSet = new Set<string>();
  for (const card of cards) {
    for (const c of card.classes) {
      if (c) classSet.add(c);
    }
  }
  return [...classSet].sort();
}

/**
 * Mirrors the `Talent` enum from `@flesh-and-blood/types`. Listed
 * statically here so the dropdown is always populated — the talent set is
 * a stable LSS contract, and a user whose collection has no talented cards
 * (e.g. a pure Brute deck) still gets a meaningful filter affordance.
 */
const FAB_TALENTS: readonly string[] = Object.freeze([
  'Chaos',
  'Draconic',
  'Earth',
  'Elemental',
  'Ice',
  'Light',
  'Lightning',
  'Mystic',
  'Revered',
  'Reviled',
  'Royal',
  'Shadow',
]);

function extractTalents(cards: readonly ILibraryCard[]): string[] {
  // Union of (all talents in the loaded collection) and the static FAB
  // talent enum. Loaded talents win on case (some catalog rows ship
  // lowercased like 'lightning'); the static set fills any gaps.
  const seen = new Set<string>();
  for (const card of cards) {
    for (const t of card.talents) {
      if (t) seen.add(t);
    }
  }
  for (const t of FAB_TALENTS) seen.add(t);
  return [...seen].sort((a, b) => a.localeCompare(b));
}

function extractSets(cards: readonly ILibraryCard[]): string[] {
  const setSet = new Set<string>();
  for (const card of cards) {
    for (const s of card.sets) {
      if (s) setSet.add(s);
    }
  }
  return [...setSet].sort();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LibraryFilters — pitch checkboxes, type + set multi-selects, and a
 * grouping segmented control. All filter state is lifted to the parent
 * (the Library route) and stored in URL search params.
 */
function formatSetOption(code: string, names?: Readonly<Record<string, string>>): string {
  const name = names?.[code];
  return name ? `${code} · ${name}` : code;
}

export function LibraryFilters({
  cards,
  value,
  onChange,
  setNames,
}: ILibraryFiltersProps): React.ReactElement {
  const pitchGroupId = useId();
  const typeSelectId = useId();
  const classSelectId = useId();
  const talentSelectId = useId();
  const setSelectId = useId();
  const groupControlId = useId();
  const sizeSliderId = useId();

  const allTypes = extractTypes(cards);
  const allClasses = extractClasses(cards);
  const allTalents = extractTalents(cards);
  const allSets = extractSets(cards);

  // ---- Pitch toggles ----
  function handlePitchChange(pitch: TPitch, checked: boolean): void {
    const next = checked
      ? [...value.pitches, pitch]
      : value.pitches.filter((p) => p !== pitch);
    onChange({ ...value, pitches: next });
  }

  // ---- Type select ----
  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = [...e.currentTarget.selectedOptions].map((o) => o.value);
    onChange({ ...value, types: selected });
  }

  // ---- Class select ----
  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = [...e.currentTarget.selectedOptions].map((o) => o.value);
    onChange({ ...value, classes: selected });
  }

  // ---- Talent select ----
  function handleTalentChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = [...e.currentTarget.selectedOptions].map((o) => o.value);
    onChange({ ...value, talents: selected });
  }

  // ---- Set select ----
  function handleSetChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = [...e.currentTarget.selectedOptions].map((o) => o.value);
    onChange({ ...value, sets: selected });
  }

  // ---- Grouping ----
  function handleGroupChange(group: TGroupBy): void {
    onChange({ ...value, group });
  }

  // ---- Size slider ----
  function handleSizeChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const next = Number(e.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange({ ...value, cardSize: next });
    }
  }

  return (
    <div className={styles.container} role="group" aria-label="Library filters">
      {/* Pitch checkboxes */}
      <fieldset className={styles.fieldset} id={pitchGroupId}>
        <legend className={styles.legend}>Pitch</legend>
        <div className={styles.checkboxRow}>
          {PITCH_OPTIONS.map(({ value: pitchValue, label }) => (
            <label key={pitchValue} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={value.pitches.includes(pitchValue)}
                onChange={(e) => handlePitchChange(pitchValue, e.currentTarget.checked)}
                aria-label={label}
              />
              <span className={styles.checkboxText}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Type multi-select */}
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel} htmlFor={typeSelectId}>
          Type
        </label>
        <select
          id={typeSelectId}
          className={styles.select}
          multiple
          size={3}
          value={[...value.types]}
          onChange={handleTypeChange}
          aria-label="Filter by card type"
        >
          {allTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {value.types.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => onChange({ ...value, types: [] })}
            aria-label="Clear type filter"
          >
            Clear
          </button>
        )}
      </div>

      {/* Class multi-select */}
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel} htmlFor={classSelectId}>
          Class
        </label>
        <select
          id={classSelectId}
          className={styles.select}
          multiple
          size={3}
          value={[...value.classes]}
          onChange={handleClassChange}
          aria-label="Filter by card class"
        >
          {allClasses.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        {value.classes.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => onChange({ ...value, classes: [] })}
            aria-label="Clear class filter"
          >
            Clear
          </button>
        )}
      </div>

      {/* Talent multi-select */}
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel} htmlFor={talentSelectId}>
          Talent
        </label>
        <select
          id={talentSelectId}
          className={styles.select}
          multiple
          size={3}
          value={[...value.talents]}
          onChange={handleTalentChange}
          aria-label="Filter by card talent"
        >
          {allTalents.map((talent) => (
            <option key={talent} value={talent}>
              {talent}
            </option>
          ))}
        </select>
        {value.talents.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => onChange({ ...value, talents: [] })}
            aria-label="Clear talent filter"
          >
            Clear
          </button>
        )}
      </div>

      {/* Set multi-select */}
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel} htmlFor={setSelectId}>
          Set
        </label>
        <select
          id={setSelectId}
          className={styles.select}
          multiple
          size={3}
          value={[...value.sets]}
          onChange={handleSetChange}
          aria-label="Filter by set"
        >
          {allSets.map((set) => (
            <option key={set} value={set}>
              {formatSetOption(set, setNames)}
            </option>
          ))}
        </select>
        {value.sets.length > 0 && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => onChange({ ...value, sets: [] })}
            aria-label="Clear set filter"
          >
            Clear
          </button>
        )}
      </div>

      {/* Card-size slider */}
      <div className={styles.sliderGroup}>
        <label className={styles.selectLabel} htmlFor={sizeSliderId}>
          Card size
        </label>
        <input
          id={sizeSliderId}
          type="range"
          className={styles.slider}
          min={CARD_SIZE_MIN}
          max={CARD_SIZE_MAX}
          step={4}
          value={value.cardSize}
          onChange={handleSizeChange}
          aria-label="Card size in pixels"
          aria-valuemin={CARD_SIZE_MIN}
          aria-valuemax={CARD_SIZE_MAX}
          aria-valuenow={value.cardSize}
        />
        <span className={styles.sliderValue} aria-hidden="true">
          {value.cardSize}px
        </span>
      </div>

      {/* Grouping segmented control */}
      <div className={styles.segmentGroup} role="group" aria-labelledby={groupControlId}>
        <span id={groupControlId} className={styles.segmentLabel}>
          Group by
        </span>
        <div className={styles.segmentControl}>
          {GROUP_OPTIONS.map(({ value: groupValue, label }) => (
            <button
              key={groupValue}
              type="button"
              className={
                value.group === groupValue
                  ? `${styles.segmentBtn} ${styles.segmentBtnActive}`
                  : styles.segmentBtn
              }
              aria-pressed={value.group === groupValue}
              onClick={() => handleGroupChange(groupValue)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
