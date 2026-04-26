import React, { useCallback, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useLibraryQuery } from '../../api/library';
import type { ILibraryCard } from '../../api/library';
import { LibrarySearchAddBar } from '../../components/library/LibrarySearchAddBar';
import { LibraryStatsBar } from '../../components/library/LibraryStatsBar';
import { LibraryFilters } from '../../components/library/LibraryFilters';
import type { ILibraryFiltersValue, TGroupBy } from '../../components/library/LibraryFilters';
import { CARD_SIZE_DEFAULT, snapCardSize } from '../../components/library/LibraryFilters';
import { LibraryGrid } from '../../components/library/LibraryGrid';
import { LibraryEmptyState } from '../../components/library/LibraryEmptyState';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { Button } from '../../components/ui/Button/Button';
import styles from './library.module.css';

// ---------------------------------------------------------------------------
// Route search param schema (plain validation — no zod dependency)
// ---------------------------------------------------------------------------

const VALID_PITCHES = ['red', 'yellow', 'blue', 'colorless'] as const;
const VALID_GROUPS = ['type', 'pitch', 'set', 'flat'] as const;

type TPitchValue = (typeof VALID_PITCHES)[number];
type TGroupValue = (typeof VALID_GROUPS)[number];

export interface TLibrarySearch {
  readonly pitches: readonly TPitchValue[];
  readonly types: readonly string[];
  readonly classes: readonly string[];
  readonly talents: readonly string[];
  readonly sets: readonly string[];
  readonly group: TGroupValue;
  readonly cardSize: number;
}

function clampCardSize(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return snapCardSize(n);
}

function validateLibrarySearch(raw: Record<string, unknown>): TLibrarySearch {
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

  const cardSize = raw.cardSize === undefined ? CARD_SIZE_DEFAULT : clampCardSize(raw.cardSize);

  return { pitches, types, classes, talents, sets, group, cardSize };
}

export const DEFAULT_LIBRARY_SEARCH: TLibrarySearch = {
  pitches: [],
  types: [],
  classes: [],
  talents: [],
  sets: [],
  group: 'type',
  cardSize: CARD_SIZE_DEFAULT,
};

export const Route = createFileRoute('/_auth/library')({
  validateSearch: validateLibrarySearch,
  component: LibraryPage,
});

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

  // Name search filter
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length >= 2) {
    result = result.filter((c) => c.name.toLowerCase().includes(trimmed));
  }

  // Pitch filter
  if (filters.pitches.length > 0) {
    const targetPitches = new Set(filters.pitches.map(pitchNumber));
    result = result.filter((c) => targetPitches.has(c.pitch));
  }

  // Type filter
  if (filters.types.length > 0) {
    const targetTypes = new Set(filters.types.map((t) => t.toLowerCase()));
    result = result.filter((c) =>
      c.types.some((t) => targetTypes.has(t.toLowerCase())),
    );
  }

  // Class filter
  if (filters.classes.length > 0) {
    const targetClasses = new Set(filters.classes.map((c) => c.toLowerCase()));
    result = result.filter((c) =>
      c.classes.some((cls) => targetClasses.has(cls.toLowerCase())),
    );
  }

  // Talent filter
  if (filters.talents.length > 0) {
    const targetTalents = new Set(filters.talents.map((t) => t.toLowerCase()));
    result = result.filter((c) =>
      c.talents.some((t) => targetTalents.has(t.toLowerCase())),
    );
  }

  // Set filter
  if (filters.sets.length > 0) {
    const targetSets = new Set(filters.sets);
    result = result.filter((c) => c.sets.some((s) => targetSets.has(s)));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Inner page component — accepts filters as a prop for testability
// ---------------------------------------------------------------------------

interface ILibraryPageInnerProps {
  readonly initialSearch?: TLibrarySearch;
}

/**
 * LibraryPageInner — the rendered content of the library page.
 *
 * Separated from LibraryPage so it can be tested without a live
 * TanStack Router context. Route.useSearch() stays in LibraryPage
 * (the route component); LibraryPageInner receives search state as a prop.
 *
 * Exported for testing.
 */
export function LibraryPageInner({
  initialSearch = DEFAULT_LIBRARY_SEARCH,
}: ILibraryPageInnerProps): React.ReactElement {
  const libraryQuery = useLibraryQuery();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Local search query — not URL-synced to avoid churn per keystroke.
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [filterState, setFilterState] = useState<TLibrarySearch>(initialSearch);

  const filters: ILibraryFiltersValue = {
    pitches: (filterState.pitches ?? []) as ILibraryFiltersValue['pitches'],
    types: filterState.types ?? [],
    classes: filterState.classes ?? [],
    talents: filterState.talents ?? [],
    sets: filterState.sets ?? [],
    group: (filterState.group ?? 'type') as TGroupBy,
    cardSize: filterState.cardSize ?? CARD_SIZE_DEFAULT,
  };

  const handleFiltersChange = useCallback(
    (next: ILibraryFiltersValue) => {
      const nextSearch: TLibrarySearch = {
        pitches: [...next.pitches],
        types: [...next.types],
        classes: [...next.classes],
        talents: [...next.talents],
        sets: [...next.sets],
        group: next.group,
        cardSize: next.cardSize,
      };
      setFilterState(nextSearch);
      void navigate({
        to: '/library',
        search: nextSearch,
        replace: true,
      });
    },
    [navigate],
  );

  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  // ---- Loading ----
  if (libraryQuery.isLoading) {
    return <LibrarySkeleton />;
  }

  // ---- Error ----
  if (libraryQuery.isError) {
    return (
      <section role="alert" className={styles.errorSection}>
        <h2 className={styles.errorHeading}>Something went wrong loading your library</h2>
        <p className={styles.errorMessage}>{(libraryQuery.error as Error).message}</p>
        <Button variant="secondary" size="sm" onClick={() => libraryQuery.refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  const data = libraryQuery.data;
  const allCards = data?.cards ?? [];
  const stats = data?.stats;
  const setNames = data?.setNames ?? {};

  // ---- Empty ----
  if (allCards.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.searchRow}>
          <LibrarySearchAddBar inputRef={searchInputRef} />
        </div>
        {stats && <LibraryStatsBar stats={stats} />}
        <LibraryEmptyState onFocusSearch={handleFocusSearch} />
      </div>
    );
  }

  // ---- Populated ----
  const filteredCards = applyFilters(allCards, searchQuery, filters);

  return (
    <div className={styles.page}>
      {/* Search bar */}
      <div className={styles.searchRow}>
        <LibrarySearchAddBar
          inputRef={searchInputRef}
          onAdded={() => {
            setSearchQuery('');
          }}
        />
      </div>

      {/* Sticky stats bar */}
      {stats && <LibraryStatsBar stats={stats} />}

      {/* Filters */}
      <div className={styles.filtersRow}>
        <LibraryFilters cards={allCards} value={filters} onChange={handleFiltersChange} setNames={setNames} />
      </div>

      {/* Grid or filtered empty state */}
      <div className={styles.gridRow}>
        {filteredCards.length === 0 ? (
          <p className={styles.noResults}>No cards match the current filters.</p>
        ) : (
          <LibraryGrid
            cards={filteredCards}
            group={filters.group}
            setNames={setNames}
            cardSize={filters.cardSize}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route component — thin wrapper that reads URL search and delegates
// ---------------------------------------------------------------------------

/**
 * LibraryPage — TanStack Router route component.
 * Reads URL search params and passes them as initialSearch to LibraryPageInner.
 * This split lets tests render LibraryPageInner directly with mocked state.
 */
export function LibraryPage(): React.ReactElement {
  const search = Route.useSearch();
  return <LibraryPageInner initialSearch={search} />;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LibrarySkeleton(): React.ReactElement {
  return (
    <section aria-busy="true" aria-live="polite" className={styles.skeleton}>
      {/* Search bar skeleton */}
      <div className={styles.skeletonSearch}>
        <Skeleton width="100%" height="40px" aria-label="Loading search bar" />
      </div>

      {/* Stats bar skeleton */}
      <div className={styles.skeletonStats}>
        <Skeleton width="100%" height="52px" aria-label="Loading stats" />
      </div>

      {/* Grid skeleton */}
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className={styles.skeletonCell}>
            <Skeleton width="100%" height="100px" aria-label="Loading card" />
            <Skeleton width="80%" height="12px" aria-label="Loading card name" />
          </div>
        ))}
      </div>
    </section>
  );
}
