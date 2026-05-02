/**
 * Non-component helpers and constants for the library route.
 *
 * Extracted so that `library.tsx` stays component-only and Fast Refresh
 * works without warnings. The leading `-` makes TanStack Router ignore
 * this file as a route (only `.tsx` files matching the route pattern are
 * picked up; `-` follows the project convention for non-route files in
 * this directory — see e.g. the `__tests__/` files using the same prefix).
 *
 * Consumers:
 *  - `library.tsx` (route component)
 *  - `add-cards.index.tsx`, `add-cards.fabrary.tsx`, `library-csv-sources.tsx`
 *    (all import `DEFAULT_LIBRARY_SEARCH`)
 */

import type { ILibraryFiltersValue } from '../../components/library/LibraryFilterRail';
import type { ILibraryCard } from '../../api/library';
import { CARD_SIZE_DEFAULT } from '../../components/library/LibraryFilterRail';
import { snapCardSize } from '../../components/library/LibraryFilterRail.constants';

// ---------------------------------------------------------------------------
// Search param types
// ---------------------------------------------------------------------------

const VALID_PITCHES = ['red', 'yellow', 'blue', 'colorless'] as const;
const VALID_GROUPS = ['type', 'pitch', 'set', 'flat'] as const;

type TPitchValue = (typeof VALID_PITCHES)[number];

export type TGroupValue = (typeof VALID_GROUPS)[number];

export interface TLibrarySearch {
  readonly pitches: readonly TPitchValue[];
  readonly types: readonly string[];
  readonly classes: readonly string[];
  readonly talents: readonly string[];
  readonly sets: readonly string[];
  readonly group: TGroupValue;
  readonly cardSize: number;
}

// ---------------------------------------------------------------------------
// Default search
// ---------------------------------------------------------------------------

export const DEFAULT_LIBRARY_SEARCH: TLibrarySearch = {
  pitches: [],
  types: [],
  classes: [],
  talents: [],
  sets: [],
  group: 'type',
  cardSize: CARD_SIZE_DEFAULT,
};

// ---------------------------------------------------------------------------
// validateLibrarySearch
// ---------------------------------------------------------------------------

function clampCardSize(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return snapCardSize(n);
}

export function validateLibrarySearch(raw: Record<string, unknown>): TLibrarySearch {
  const pitches = Array.isArray(raw.pitches)
    ? raw.pitches.filter((p): p is TPitchValue =>
        VALID_PITCHES.includes(p as TPitchValue),
      )
    : [];

  const types = Array.isArray(raw.types)
    ? raw.types.filter((t): t is string => typeof t === 'string')
    : [];

  const classes = Array.isArray(raw.classes)
    ? raw.classes.filter((c): c is string => typeof c === 'string')
    : [];

  const talents = Array.isArray(raw.talents)
    ? raw.talents.filter((t): t is string => typeof t === 'string')
    : [];

  const sets = Array.isArray(raw.sets)
    ? raw.sets.filter((s): s is string => typeof s === 'string')
    : [];

  const group: TGroupValue = VALID_GROUPS.includes(raw.group as TGroupValue)
    ? (raw.group as TGroupValue)
    : 'type';

  const cardSize =
    raw.cardSize === undefined ? CARD_SIZE_DEFAULT : clampCardSize(raw.cardSize);

  return { pitches, types, classes, talents, sets, group, cardSize };
}

// ---------------------------------------------------------------------------
// Filter logic
// ---------------------------------------------------------------------------

function pitchNumber(pitch: TPitchValue): number | null {
  if (pitch === 'red') return 1;
  if (pitch === 'yellow') return 2;
  if (pitch === 'blue') return 3;
  return null;
}

export function applyFilters(
  cards: readonly ILibraryCard[],
  query: string,
  filters: ILibraryFiltersValue,
): readonly ILibraryCard[] {
  let result: readonly ILibraryCard[] = cards;

  const trimmed = query.trim().toLowerCase();
  if (trimmed.length >= 2) {
    result = result.filter((c) => c.name.toLowerCase().includes(trimmed));
  }

  if (filters.pitches.length > 0) {
    const targetPitches = new Set(filters.pitches.map(pitchNumber));
    result = result.filter((c) => targetPitches.has(c.pitch));
  }

  if (filters.types.length > 0) {
    const targetTypes = new Set(filters.types.map((t) => t.toLowerCase()));
    result = result.filter((c) =>
      c.types.some((t) => targetTypes.has(t.toLowerCase())),
    );
  }

  if (filters.classes.length > 0) {
    const targetClasses = new Set(filters.classes.map((c) => c.toLowerCase()));
    result = result.filter((c) =>
      c.classes.some((cls) => targetClasses.has(cls.toLowerCase())),
    );
  }

  if (filters.talents.length > 0) {
    const targetTalents = new Set(filters.talents.map((t) => t.toLowerCase()));
    result = result.filter((c) =>
      c.talents.some((t) => targetTalents.has(t.toLowerCase())),
    );
  }

  if (filters.sets.length > 0) {
    const targetSets = new Set(filters.sets);
    result = result.filter((c) => c.sets.some((s) => targetSets.has(s)));
  }

  return result;
}
