import React, { useCallback, useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useLibraryQuery } from '../../api/library';
import type { ILibraryCard } from '../../api/library';
import { LibraryStatsBar } from '../../components/library/LibraryStatsBar';
import { LibraryFilterRail } from '../../components/library/LibraryFilterRail';
import type {
  ILibraryFiltersValue,
  TGroupBy,
} from '../../components/library/LibraryFilterRail';
import {
  CARD_SIZE_DEFAULT,
  snapCardSize,
} from '../../components/library/LibraryFilterRail';
import { LibraryFilterDrawer } from '../../components/library/LibraryFilterDrawer';
import { LibraryGrid } from '../../components/library/LibraryGrid';
import { LibraryEmptyState } from '../../components/library/LibraryEmptyState';
import { RecentlyAddedBanner } from '../../components/library/RecentlyAddedBanner';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { Button } from '../../components/ui/Button/Button';
import styles from './library.module.css';

// ---------------------------------------------------------------------------
// Route search param schema
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

  const cardSize =
    raw.cardSize === undefined ? CARD_SIZE_DEFAULT : clampCardSize(raw.cardSize);

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

// ---------------------------------------------------------------------------
// Inner page component
// ---------------------------------------------------------------------------

interface ILibraryPageInnerProps {
  readonly initialSearch?: TLibrarySearch;
}

export function LibraryPageInner({
  initialSearch = DEFAULT_LIBRARY_SEARCH,
}: ILibraryPageInnerProps): React.ReactElement {
  const libraryQuery = useLibraryQuery();
  const navigate = useNavigate();

  // Local search query — not URL-synced to avoid one URL replace per
  // keystroke. Filters are URL-synced so a copied link reproduces the
  // browse state, but the in-page search is intentionally ephemeral.
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterState, setFilterState] = useState<TLibrarySearch>(initialSearch);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      void navigate({ to: '/library', search: nextSearch, replace: true });
    },
    [navigate],
  );

  const data = libraryQuery.data;
  const allCards = useMemo(() => data?.cards ?? [], [data]);
  const stats = data?.stats;
  const setNames = data?.setNames ?? {};

  const filteredCards = useMemo(
    () => applyFilters(allCards, searchQuery, filters),
    [allCards, searchQuery, filters],
  );

  const activeFilterCount =
    filters.pitches.length +
    filters.classes.length +
    filters.talents.length +
    filters.sets.length +
    (searchQuery.trim().length >= 2 ? 1 : 0);

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

  // ---- Empty ----
  if (allCards.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p className={styles.eyebrow}>Your collection</p>
          <h1 className={styles.title}>Library</h1>
        </header>
        <LibraryEmptyState />
      </div>
    );
  }

  // ---- Populated ----

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowNum}>{stats?.uniqueCount ?? 0}</span>{' '}
            unique
            <span className={styles.eyebrowSep} aria-hidden="true">
              ·
            </span>
            <span className={styles.eyebrowNum}>{stats?.totalCopies ?? 0}</span>{' '}
            copies
          </p>
          <h1 className={styles.title}>Library</h1>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.filtersButton}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open filters"
          >
            Filters
            {activeFilterCount > 0 && (
              <span className={styles.filtersButtonCount}>{activeFilterCount}</span>
            )}
          </button>
          <Link to="/add-cards" className={styles.addCardsLink}>
            <span aria-hidden="true">→</span> Add cards
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.railSlot}>
          <LibraryFilterRail
            cards={allCards}
            value={filters}
            onChange={handleFiltersChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            matchingCount={filteredCards.length}
            setNames={setNames}
          />
        </div>

        <div className={styles.gridArea}>
          <RecentlyAddedBanner />
          {stats && <LibraryStatsBar stats={stats} />}
          <div className={styles.gridRow}>
            {filteredCards.length === 0 ? (
              <div className={styles.noResults} role="status">
                <p className={styles.noResultsTitle}>No cards match this combination.</p>
                <button
                  type="button"
                  className={styles.noResultsClear}
                  onClick={() => {
                    setSearchQuery('');
                    handleFiltersChange({
                      ...filters,
                      pitches: [],
                      classes: [],
                      talents: [],
                      sets: [],
                    });
                  }}
                >
                  Clear filters
                </button>
              </div>
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
      </div>

      <LibraryFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cards={allCards}
        value={filters}
        onChange={handleFiltersChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        matchingCount={filteredCards.length}
        setNames={setNames}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

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
      <div className={styles.skeletonHeader}>
        <Skeleton width="120px" height="14px" aria-label="Loading eyebrow" />
        <Skeleton width="200px" height="36px" aria-label="Loading title" />
      </div>
      <div className={styles.skeletonLayout}>
        <div className={styles.skeletonRail}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRailSection}>
              <Skeleton width="80px" height="11px" aria-label="Loading filter label" />
              <Skeleton width="100%" height="32px" aria-label="Loading filter input" />
            </div>
          ))}
        </div>
        <div className={styles.skeletonGrid}>
          <Skeleton width="100%" height="52px" aria-label="Loading stats" />
          <div className={styles.skeletonGridCells}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={styles.skeletonCell}>
                <Skeleton width="100%" height="160px" aria-label="Loading card" />
                <Skeleton width="80%" height="12px" aria-label="Loading card name" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
