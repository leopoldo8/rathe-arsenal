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
  readonly sets: readonly string[];
  readonly group: TGroupBy;
}

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
  const setSelectId = useId();
  const groupControlId = useId();

  const allTypes = extractTypes(cards);
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

  // ---- Set select ----
  function handleSetChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = [...e.currentTarget.selectedOptions].map((o) => o.value);
    onChange({ ...value, sets: selected });
  }

  // ---- Grouping ----
  function handleGroupChange(group: TGroupBy): void {
    onChange({ ...value, group });
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
