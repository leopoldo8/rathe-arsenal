import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { ApiError } from '../../lib/api-client';
import { useSwapBatch, useSwapMutation, useSwapsQuery } from '../../api/swaps';
import type { ISwapRow, TSwapAction, TSwapOutcome } from '../../api/swaps';
import { useToast } from '../../components/ui/Toast/useToast';
import { SwapsTabs } from '../../components/swaps/SwapsTabs';
import type { TTabValue } from '../../components/swaps/SwapsTabs';
import { SwapsFilters } from '../../components/swaps/SwapsFilters';
import type { ISwapsFilters } from '../../components/swaps/SwapsFilters.helpers';
import { SwapsRowList } from '../../components/swaps/SwapsRowList';
import { SwapsBulkBar } from '../../components/swaps/SwapsBulkBar';
import type { TResolvedSwap } from '../../components/swaps/SwapRow';
import type { IRejectSubmission } from '../../components/swaps/SwapRejectPanel';
import { BULK_MAX_ROWS, runBulk } from '../../components/swaps/swap-bulk';
import type { TBulkAction } from '../../components/swaps/swap-bulk';
import { applyFilters, computeTabCounts, deriveUniqueDecks, isVisibleSwap } from './-swaps.helpers';
import type { ISwapsSearch } from './-swaps.helpers';
import styles from './swaps.module.css';

const EMPTY_ROWS: readonly ISwapRow[] = [];

const BULK_DONE_KEYS = {
  approve: 'swaps.bulkDoneApproved',
  reject: 'swaps.bulkDoneRejected',
  reset: 'swaps.bulkDoneReset',
} as const;

const BULK_LABEL_KEYS = {
  approve: 'swaps.bulkLabelApproved',
  reject: 'swaps.bulkLabelRejected',
  reset: 'swaps.bulkLabelReset',
} as const;

export const Route = createFileRoute('/_auth/swaps')({
  component: SwapsPage,
  validateSearch: (search: Record<string, unknown>): ISwapsSearch => {
    const rawState = search.state as string | undefined;
    const validStates = ['pending', 'approved', 'rejected', 'all'] as const;
    const state = validStates.includes(rawState as (typeof validStates)[number])
      ? (rawState as ISwapsSearch['state'])
      : 'pending';

    const rawTier = search.tier;
    const tier: ReadonlyArray<1 | 2 | 3> = Array.isArray(rawTier)
      ? (rawTier.filter((t) => [1, 2, 3].includes(Number(t))).map(Number) as (1 | 2 | 3)[])
      : [];

    const rawDeck = search.deck;
    const deck: readonly string[] = Array.isArray(rawDeck)
      ? rawDeck.filter((d) => typeof d === 'string')
      : [];

    const rawHero = search.hero;
    const hero: readonly string[] = Array.isArray(rawHero)
      ? rawHero.filter((h) => typeof h === 'string')
      : [];

    const rawConfMin = Number(search.confidenceMin);
    const rawConfMax = Number(search.confidenceMax);
    const confidenceMin = isFinite(rawConfMin) ? Math.max(0, Math.min(100, rawConfMin)) : 0;
    const confidenceMax = isFinite(rawConfMax) ? Math.max(0, Math.min(100, rawConfMax)) : 100;

    return { state, tier, deck, hero, confidenceMin, confidenceMax };
  },
});

export function SwapsPage(): React.ReactElement {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { show } = useToast();

  const swapsQuery = useSwapsQuery();
  const swapMutation = useSwapMutation();
  const swapBatch = useSwapBatch();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [resolvedById, setResolvedById] = useState<ReadonlyMap<string, TResolvedSwap>>(
    new Map<string, TResolvedSwap>(),
  );
  const [bulkProgress, setBulkProgress] = useState<{
    readonly settled: number;
    readonly total: number;
  } | null>(null);

  const swapsData = swapsQuery.data;
  const allRows = useMemo<readonly ISwapRow[]>(
    () => (swapsData?.rows ?? EMPTY_ROWS).filter(isVisibleSwap),
    [swapsData],
  );

  const availableDecks = useMemo(() => deriveUniqueDecks(allRows), [allRows]);
  const availableHeroes = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.hero))).sort(),
    [allRows],
  );
  const tabCounts = useMemo(() => computeTabCounts(allRows), [allRows]);

  // A row acted on stays in the tab it was acted from until the tab changes or
  // the page remounts, so the confirmation has somewhere to render.
  const visibleRows = useMemo(
    () =>
      applyFilters(allRows, { ...search, state: 'all' }).filter(
        (row) => search.state === 'all' || row.status === search.state || resolvedById.has(row.id),
      ),
    [allRows, search, resolvedById],
  );

  const hasActiveFilters =
    search.tier.length > 0 ||
    search.deck.length > 0 ||
    search.hero.length > 0 ||
    search.confidenceMin !== 0 ||
    search.confidenceMax !== 100;

  function setActiveTab(tab: TTabValue): void {
    setSelectedIds(new Set<string>());
    setResolvedById(new Map<string, TResolvedSwap>());
    void navigate({
      search: {
        state: tab,
        tier: search.tier,
        deck: search.deck,
        hero: search.hero,
        confidenceMin: search.confidenceMin,
        confidenceMax: search.confidenceMax,
      },
    });
  }

  function setFilters(filters: ISwapsFilters): void {
    void navigate({
      search: {
        state: search.state,
        tier: filters.tier,
        deck: filters.deck,
        hero: filters.hero,
        confidenceMin: filters.confidenceMin,
        confidenceMax: filters.confidenceMax,
      },
    });
  }

  const handleToggleSelect = useCallback((id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < BULK_MAX_ROWS) next.add(id);
      return next;
    });
  }, []);

  const reportFailure = useCallback(
    (error: unknown): void => {
      const status = error instanceof ApiError ? error.status : null;
      const key =
        status === 409 ? 'swaps.conflictToast' : status === 404 ? 'swaps.notFoundToast' : 'swaps.errorToast';
      show({ kind: 'error', message: t(key) });
    },
    [show, t],
  );

  const act = useCallback(
    async (row: ISwapRow, action: TSwapAction): Promise<boolean> => {
      setBusyIds((prev) => new Set(prev).add(row.id));
      try {
        const result = await swapMutation.mutateAsync({ swapId: row.id, action });
        if (result.swap.status === 'retired') {
          show({ kind: 'info', message: t('swaps.retiredToast') });
        }
        return true;
      } catch (error) {
        reportFailure(error);
        return false;
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }
    },
    [swapMutation, reportFailure, show, t],
  );

  const markResolved = useCallback((id: string, resolved: TResolvedSwap): void => {
    setResolvedById((prev) => new Map(prev).set(id, resolved));
  }, []);

  const clearResolved = useCallback((id: string): void => {
    setResolvedById((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const rowHandlers = {
    onToggleSelect: handleToggleSelect,
    onApprove: async (row: ISwapRow): Promise<boolean> => {
      const ok = await act(row, { kind: 'approve' });
      if (ok) markResolved(row.id, 'approved');
      return ok;
    },
    onReject: async (row: ISwapRow, submission: IRejectSubmission): Promise<boolean> => {
      const ok = await act(row, { kind: 'reject', ...submission });
      if (ok) markResolved(row.id, 'rejected');
      return ok;
    },
    onRevert: (row: ISwapRow): Promise<boolean> => act(row, { kind: 'revert' }),
    onRestore: (row: ISwapRow): Promise<boolean> => act(row, { kind: 'restore' }),
    onUndo: async (row: ISwapRow, resolved: TResolvedSwap): Promise<boolean> => {
      const ok = await act(row, { kind: resolved === 'approved' ? 'revert' : 'restore' });
      if (ok) clearResolved(row.id);
      return ok;
    },
    onOutcome: (row: ISwapRow, outcome: TSwapOutcome): Promise<boolean> =>
      act(row, { kind: 'outcome', outcome }),
  };

  const isBulkRunning = bulkProgress !== null;

  async function handleBulkAction(action: TBulkAction): Promise<void> {
    if (isBulkRunning) return;
    const targets = allRows.filter((row) => selectedIds.has(row.id));
    setBulkProgress({ settled: 0, total: targets.length });

    const result = await runBulk(
      targets,
      action,
      (swapId, step) => swapBatch.perform({ swapId, action: step }),
      (settled, total) => setBulkProgress({ settled, total }),
    );
    swapBatch.finish();

    setBulkProgress(null);
    setSelectedIds(new Set(result.failedIds));

    if (result.failedIds.length > 0) {
      show({
        kind: 'error',
        message: t('swaps.bulkPartial', {
          done: result.succeeded,
          total: result.total - result.skipped,
          label: t(BULK_LABEL_KEYS[action]),
          failed: t('swaps.bulkFailed', { count: result.failedIds.length }),
        }),
      });
      return;
    }
    if (result.succeeded === 0) {
      show({ kind: 'success', message: t('swaps.bulkNothingToDo') });
      return;
    }
    show({ kind: 'success', message: t(BULK_DONE_KEYS[action], { count: result.succeeded }) });
  }

  const currentFilters: ISwapsFilters = {
    tier: search.tier,
    deck: search.deck,
    hero: search.hero,
    confidenceMin: search.confidenceMin,
    confidenceMax: search.confidenceMax,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>{t('swaps.heading')}</h1>
        <p className={styles.subtitle}>{t('swaps.subtitle')}</p>
      </div>

      <SwapsTabs value={search.state} counts={tabCounts} onChange={setActiveTab}>
        <SwapsFilters
          filters={currentFilters}
          availableDecks={availableDecks}
          availableHeroes={availableHeroes}
          onChange={setFilters}
        />
        <SwapsRowList
          rows={visibleRows}
          isLoading={swapsQuery.isLoading}
          isError={swapsQuery.isError}
          onRetry={() => void swapsQuery.refetch()}
          selectedIds={selectedIds}
          busyIds={busyIds}
          resolvedById={resolvedById}
          activeState={search.state}
          totalRowCount={allRows.length}
          hasActiveFilters={hasActiveFilters}
          onNavigateHome={() => void navigate({ to: '/' })}
          onNavigateApproved={() => setActiveTab('approved')}
          {...rowHandlers}
        />
      </SwapsTabs>

      <SwapsBulkBar
        selectedCount={selectedIds.size}
        isBulkRunning={isBulkRunning}
        progress={bulkProgress}
        onBulkAction={(action) => void handleBulkAction(action)}
        onClearSelection={() => setSelectedIds(new Set<string>())}
      />
    </div>
  );
}
