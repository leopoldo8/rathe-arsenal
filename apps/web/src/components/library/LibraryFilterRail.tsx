import React, { useEffect, useId, useMemo, useState } from 'react';
import type { ILibraryCard } from '../../api/library';
import styles from './LibraryFilterRail.module.css';

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
  readonly cardSize: number;
}

/**
 * Allowed card-size thresholds — single source of truth for the slider,
 * the route validator, the snap helper and the size-label lookup.
 */
export const CARD_SIZE_STEPS: readonly number[] = Object.freeze([
  80, 120, 160, 200, 240,
]);
export const CARD_SIZE_MIN = CARD_SIZE_STEPS[0]!;
export const CARD_SIZE_MAX = CARD_SIZE_STEPS[CARD_SIZE_STEPS.length - 1]!;
export const CARD_SIZE_DEFAULT = 120;
export const CARD_SIZE_LABELS: Readonly<Record<number, string>> = Object.freeze({
  80: 'Small',
  120: 'Medium',
  160: 'Large',
  200: 'X-Large',
  240: 'Max',
});

export function snapCardSize(value: number): number {
  if (!Number.isFinite(value)) return CARD_SIZE_DEFAULT;
  let best = CARD_SIZE_STEPS[0]!;
  let bestDistance = Math.abs(value - best);
  for (const step of CARD_SIZE_STEPS) {
    const distance = Math.abs(value - step);
    if (distance < bestDistance) {
      best = step;
      bestDistance = distance;
    }
  }
  return best;
}

interface ILibraryFilterRailProps {
  readonly cards: readonly ILibraryCard[];
  readonly value: ILibraryFiltersValue;
  readonly onChange: (value: ILibraryFiltersValue) => void;
  readonly searchQuery: string;
  readonly onSearchChange: (next: string) => void;
  /** Total cards matching the active query+filters — drives the chip below search. */
  readonly matchingCount: number;
  /** Set code → release name map. Optional. */
  readonly setNames?: Readonly<Record<string, string>>;
  /** When true, the rail renders inside a drawer (no sticky positioning). */
  readonly variant?: 'rail' | 'drawer';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PITCH_OPTIONS: ReadonlyArray<{
  readonly value: TPitch;
  readonly label: string;
  readonly glyph: string;
  readonly tone: 'red' | 'yellow' | 'blue' | 'colorless';
}> = [
  { value: 'red', label: 'Red', glyph: 'I', tone: 'red' },
  { value: 'yellow', label: 'Yellow', glyph: 'II', tone: 'yellow' },
  { value: 'blue', label: 'Blue', glyph: 'III', tone: 'blue' },
  { value: 'colorless', label: 'Colorless', glyph: '◇', tone: 'colorless' },
];

const GROUP_OPTIONS: ReadonlyArray<{ readonly value: TGroupBy; readonly label: string }> = [
  { value: 'type', label: 'Type' },
  { value: 'pitch', label: 'Pitch' },
  { value: 'set', label: 'Set' },
  { value: 'flat', label: 'Flat' },
];

// ---------------------------------------------------------------------------
// Helpers — compute per-option counts so the toggle rows reveal collection
// shape at a glance without forcing the user to apply a filter to discover it.
// ---------------------------------------------------------------------------

function countsByDimension(
  cards: readonly ILibraryCard[],
  pick: (card: ILibraryCard) => readonly string[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const value of pick(card)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function entriesSortedAlpha(map: ReadonlyMap<string, number>): ReadonlyArray<readonly [string, number]> {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryFilterRail({
  cards,
  value,
  onChange,
  searchQuery,
  onSearchChange,
  matchingCount,
  setNames,
  variant = 'rail',
}: ILibraryFilterRailProps): React.ReactElement {
  const searchId = useId();
  const sizeSliderId = useId();

  const classCounts = useMemo(
    () => countsByDimension(cards, (c) => c.classes),
    [cards],
  );
  const talentCounts = useMemo(
    () => countsByDimension(cards, (c) => c.talents),
    [cards],
  );
  const setCounts = useMemo(
    () => countsByDimension(cards, (c) => c.sets),
    [cards],
  );

  const allClasses = useMemo(() => entriesSortedAlpha(classCounts), [classCounts]);
  const allTalents = useMemo(() => entriesSortedAlpha(talentCounts), [talentCounts]);
  const allSets = useMemo(() => entriesSortedAlpha(setCounts), [setCounts]);

  const activeFilterCount =
    value.pitches.length +
    value.classes.length +
    value.talents.length +
    value.sets.length +
    (searchQuery.trim().length >= 2 ? 1 : 0);

  function togglePitch(pitch: TPitch): void {
    const next = value.pitches.includes(pitch)
      ? value.pitches.filter((p) => p !== pitch)
      : [...value.pitches, pitch];
    onChange({ ...value, pitches: next });
  }

  function toggleString(field: 'classes' | 'talents' | 'sets', candidate: string): void {
    const current = value[field];
    const next = current.includes(candidate)
      ? current.filter((c) => c !== candidate)
      : [...current, candidate];
    onChange({ ...value, [field]: next });
  }

  function clearAll(): void {
    onSearchChange('');
    onChange({
      ...value,
      pitches: [],
      classes: [],
      talents: [],
      sets: [],
    });
  }

  function handleSizeChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = Number(e.currentTarget.value);
    const next = snapCardSize(raw);
    if (next !== value.cardSize) {
      onChange({ ...value, cardSize: next });
    }
  }

  return (
    <aside
      className={`${styles.rail} ${variant === 'drawer' ? styles['rail--drawer'] : ''}`}
      aria-label="Library filters"
    >
      <div className={styles.rail__inner}>
        {/* Search */}
        <section className={styles.section} aria-labelledby={`${searchId}-label`}>
          <label className={styles.label} htmlFor={searchId} id={`${searchId}-label`}>
            Search
          </label>
          <input
            id={searchId}
            type="search"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search your collection"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.currentTarget.value)}
            className={styles.searchInput}
            aria-label="Search the cards in your library by name"
          />
          {searchQuery.trim().length >= 2 && (
            <p className={styles.matchingChip} aria-live="polite">
              Matching: <span className={styles.matchingNum}>{matchingCount}</span>
            </p>
          )}
        </section>

        {/* Pitch */}
        <section className={styles.section} aria-labelledby="ra-rail-pitch">
          <h3 className={styles.label} id="ra-rail-pitch">
            <span className={styles.diamond} aria-hidden="true">◆</span> Pitch
          </h3>
          <div className={styles.pitchRow} role="group" aria-labelledby="ra-rail-pitch">
            {PITCH_OPTIONS.map((opt) => {
              const checked = value.pitches.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className={`${styles.pitchPill} ${styles[`pitchPill--${opt.tone}`]} ${checked ? styles['pitchPill--on'] : ''}`}
                  onClick={() => togglePitch(opt.value)}
                  aria-label={`${opt.label} pitch — ${checked ? 'remove from filter' : 'add to filter'}`}
                >
                  <span className={styles.pitchPip} aria-hidden="true">
                    {opt.glyph}
                  </span>
                  <span className={styles.pitchLabel}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Class */}
        <ToggleSection
          headingId="ra-rail-class"
          label="Class"
          options={allClasses}
          selected={value.classes}
          onToggle={(c) => toggleString('classes', c)}
          emptyHint="No classes in your collection yet."
        />

        {/* Talent */}
        <ToggleSection
          headingId="ra-rail-talent"
          label="Talent"
          options={allTalents}
          selected={value.talents}
          onToggle={(t) => toggleString('talents', t)}
          emptyHint="None of your cards carry a talent yet."
        />

        {/* Set */}
        <ToggleSection
          headingId="ra-rail-set"
          label="Set"
          options={allSets}
          selected={value.sets}
          onToggle={(s) => toggleString('sets', s)}
          emptyHint="No sets in your collection yet."
          formatLabel={(code) => {
            const name = setNames?.[code];
            return name ? (
              <>
                <span className={styles.setCode}>{code}</span>
                <span className={styles.setName}>{name}</span>
              </>
            ) : (
              <span className={styles.setCode}>{code}</span>
            );
          }}
          dense
        />

        {/* Card size slider */}
        <section className={styles.section} aria-labelledby={`${sizeSliderId}-label`}>
          <h3 className={styles.label} id={`${sizeSliderId}-label`}>
            <span className={styles.diamond} aria-hidden="true">◆</span> Card size
          </h3>
          <div className={styles.sliderRow}>
            <input
              id={sizeSliderId}
              type="range"
              className={styles.slider}
              min={CARD_SIZE_MIN}
              max={CARD_SIZE_MAX}
              step={CARD_SIZE_STEPS[1]! - CARD_SIZE_STEPS[0]!}
              list={`${sizeSliderId}-ticks`}
              value={value.cardSize}
              onChange={handleSizeChange}
              aria-label="Card size in pixels"
              aria-valuemin={CARD_SIZE_MIN}
              aria-valuemax={CARD_SIZE_MAX}
              aria-valuenow={value.cardSize}
            />
            <datalist id={`${sizeSliderId}-ticks`}>
              {CARD_SIZE_STEPS.map((step) => (
                <option key={step} value={step} />
              ))}
            </datalist>
          </div>
          <p className={styles.sliderValue} aria-hidden="true">
            <span className={styles.sliderLabel}>
              {CARD_SIZE_LABELS[value.cardSize] ?? 'Custom'}
            </span>
            <span className={styles.sliderUnit}>{value.cardSize}px</span>
          </p>
        </section>

        {/* Group by */}
        <section className={styles.section} aria-labelledby="ra-rail-group">
          <h3 className={styles.label} id="ra-rail-group">
            <span className={styles.diamond} aria-hidden="true">◆</span> Group by
          </h3>
          <div
            className={styles.segmentControl}
            role="radiogroup"
            aria-labelledby="ra-rail-group"
          >
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={value.group === opt.value}
                className={`${styles.segmentBtn} ${value.group === opt.value ? styles['segmentBtn--active'] : ''}`}
                onClick={() => onChange({ ...value, group: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Footer — clear all */}
        {activeFilterCount > 0 && (
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            Clear all filters
            <span className={styles.clearAllCount} aria-hidden="true">
              ({activeFilterCount})
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface IToggleSectionProps {
  readonly headingId: string;
  readonly label: string;
  readonly options: ReadonlyArray<readonly [string, number]>;
  readonly selected: readonly string[];
  readonly onToggle: (value: string) => void;
  readonly emptyHint: string;
  readonly formatLabel?: (value: string) => React.ReactNode;
  readonly dense?: boolean;
}

/**
 * Renders a collapsible filter section. Class / Talent / Set lists can grow
 * past 50 entries each; collapsing by default keeps the rail compact and
 * stops one filter dimension from pushing the others out of view.
 *
 * Open/closed rules:
 *  - Default: collapsed.
 *  - Auto-opens whenever the user adds a selection — they shouldn't have
 *    to keep the section expanded just to see what's active.
 *  - Stays open after manual interaction (the user controls it from there).
 *
 * The toggle rows live in a real <ul> rendered only when expanded — so
 * keyboard tab order and screen-reader navigation skip the collapsed
 * lists entirely (no `aria-hidden` patchwork).
 */
function ToggleSection({
  headingId,
  label,
  options,
  selected,
  onToggle,
  emptyHint,
  formatLabel,
  dense = false,
}: IToggleSectionProps): React.ReactElement {
  const panelId = useId();
  const [open, setOpen] = useState(selected.length > 0);
  const lastSelectedSize = React.useRef(selected.length);

  // Auto-open when the user just added a selection (e.g. via the chips
  // in the future, or by URL load). Avoid auto-closing on removal — the
  // user might still be looking at the list to add another option.
  useEffect(() => {
    if (selected.length > lastSelectedSize.current) {
      setOpen(true);
    }
    lastSelectedSize.current = selected.length;
  }, [selected.length]);

  // Compact summary shown in the accordion header. Stays terse so the
  // unique empty-state copy lives in the panel body and isn't duplicated.
  const summary =
    options.length === 0
      ? '—'
      : selected.length > 0
        ? `${selected.length} of ${options.length}`
        : `${options.length}`;

  return (
    <section className={styles.section}>
      <h3 className={styles.accordionHeading} id={headingId}>
        <button
          type="button"
          className={styles.accordionTrigger}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.label}>
            <span className={styles.diamond} aria-hidden="true">◆</span> {label}
          </span>
          <span className={styles.accordionSummary}>
            <span
              className={
                selected.length > 0
                  ? styles.accordionSummaryActive
                  : styles.accordionSummaryIdle
              }
            >
              {summary}
            </span>
            <span
              className={`${styles.accordionChevron} ${open ? styles['accordionChevron--open'] : ''}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        className={`${styles.accordionPanel} ${open ? styles['accordionPanel--open'] : ''}`}
        hidden={!open}
      >
        {options.length === 0 ? (
          <p className={styles.emptyHint}>{emptyHint}</p>
        ) : (
          <ul
            className={`${styles.toggleList} ${dense ? styles['toggleList--dense'] : ''}`}
            role="group"
            aria-labelledby={headingId}
          >
            {options.map(([opt, count]) => {
              const checked = selected.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    className={`${styles.toggleRow} ${checked ? styles['toggleRow--on'] : ''}`}
                    onClick={() => onToggle(opt)}
                  >
                    <span className={styles.toggleMarker} aria-hidden="true">
                      {checked ? '◆' : '◇'}
                    </span>
                    <span className={styles.toggleLabel}>
                      {formatLabel ? formatLabel(opt) : opt}
                    </span>
                    <span className={styles.toggleCount} aria-hidden="true">
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
