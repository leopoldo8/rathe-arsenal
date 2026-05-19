import React, { useState, useCallback, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  IBreakdown,
  IDeckDetailResponse,
  useDeckDetailQuery,
  useMarkOwnedMutation,
  deckDetailQueryKey,
} from '../../api/deck-detail';
import {
  useDecideSubstitutionMutation,
  useResetDecisionsMutation,
  useClearDeckRejectionsMutation,
} from '../../api/decisions';
import { useVariantFetchMutation } from '../../api/variant-fetch';
import { useToast } from '../../components/ui/Toast/useToast';
import { DeckDetailSkeleton } from '../../components/deck-detail/DeckDetailSkeleton';
import { DeckDetailEmptyState } from '../../components/deck-detail/DeckDetailEmptyState';
import { DeckDetailLayout } from '../../components/deck-detail/DeckDetailLayout';
import { DeckDetailHeader } from '../../components/deck-detail/DeckDetailHeader';
import { DeckDetailSidebar } from '../../components/deck-detail/DeckDetailSidebar';
import { DeckCanvas } from '../../components/deck-detail/DeckCanvas';
import { DraftRestoreModal } from '../../components/deck-detail/DraftRestoreModal';
import { useCompositionDraft, readStoredDraft } from '../../hooks/useCompositionDraft';
import { useCascadeCheck } from '../../hooks/useCascadeCheck';
import { useNavigationAwayGuard } from '../../hooks/useNavigationAwayGuard';
import { DiscardChangesConfirm } from '../../components/deck-detail/DiscardChangesConfirm';
import type { ITagResponse } from '../../api/tags';
import styles from './decks.$deckId.module.css';

// ---------------------------------------------------------------------------
// Search param validation (U12: adds `edit` param)
// ---------------------------------------------------------------------------

function validateDeckDetailSearch(raw: Record<string, unknown>): { edit: '1' | undefined } {
  return {
    edit: raw.edit === '1' ? '1' : undefined,
  };
}

export const Route = createFileRoute('/_auth/decks/$deckId')({
  component: DeckDetailPage,
  validateSearch: validateDeckDetailSearch,
});

function countNotOwnedCards(breakdown: IBreakdown): number {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  return notOwned.reduce((sum, entry) => sum + entry.quantity, 0);
}

/**
 * Sum the total quantity of cards covered (exact matches + substituted matches).
 * Used to display the "X/Y cartas" count in the sidebar readiness block.
 */
function countProvisionedCards(breakdown: IBreakdown): number {
  const exactTotal = breakdown.exact.reduce((sum, entry) => sum + entry.quantity, 0);
  const substitutedTotal = breakdown.substituted.reduce(
    (sum, entry) => sum + entry.original.quantity,
    0,
  );
  return exactTotal + substitutedTotal;
}

function DeckDetailPage(): React.ReactElement {
  const { deckId } = Route.useParams();
  const { edit } = Route.useSearch();
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();

  // Derive current mode from ?edit=1 search param
  const mode = edit === '1' ? 'edit' : 'view';

  function handleEnterEdit(): void {
    void navigate({ to: '/decks/$deckId', params: { deckId }, search: { edit: '1' } });
  }

  function handleExitEdit(): void {
    void navigate({ to: '/decks/$deckId', params: { deckId }, search: { edit: undefined } });
  }

  // pollingStartedAt tracks when variant fetch polling began (epoch ms).
  // undefined means polling is inactive. Passed to useDeckDetailQuery to
  // enable dynamic refetchInterval and enforce the 5-minute safety timeout.
  const [pollingStartedAt, setPollingStartedAt] = useState<number | undefined>(
    undefined,
  );

  const detailQuery = useDeckDetailQuery(deckId, pollingStartedAt);
  const markOwnedMutation = useMarkOwnedMutation(deckId);
  const decideMutation = useDecideSubstitutionMutation(deckId, { showToast });
  const resetDecisionMutation = useResetDecisionsMutation(deckId, { showToast });
  const clearRejectionsMutation = useClearDeckRejectionsMutation(deckId);
  const variantFetchMutation = useVariantFetchMutation(deckId);

  // Stable callback passed to ShoppingPanel so that it can notify the page
  // when polling begins or ends. The page updates pollingStartedAt which
  // flows back into useDeckDetailQuery to control refetchInterval.
  const handlePollingChange = useCallback(
    (startedAt: number | undefined) => {
      setPollingStartedAt(startedAt);
    },
    [],
  );

  const handleFetchVariants = useCallback(() => {
    variantFetchMutation.mutate();
  }, [variantFetchMutation]);

  // Retry handler for ShoppingLine error state: invalidates the deck-detail
  // query so TanStack re-fetches fresh data. Toast notification of the failure
  // is the host's responsibility — ShoppingLine stays portal-free.
  const handleShoppingLineRetry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
    showToast({
      kind: 'error',
      message: 'Retrying shopping line…',
    });
  }, [queryClient, deckId, showToast]);

  const isCooldownActive =
    variantFetchMutation.isSuccess &&
    variantFetchMutation.data?.status === 'already_fresh';

  if (detailQuery.isLoading) {
    return <DeckDetailSkeleton />;
  }

  if (detailQuery.isError) {
    return (
      <div>
        <p className={styles.errorMsg}>
          Failed to load deck: {(detailQuery.error as Error).message}
        </p>
        <button
          type="button"
          className={styles.retryBtn}
          onClick={() => void detailQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const deck = detailQuery.data;

  if (deck == null) {
    return <DeckDetailEmptyState kind="not-found" />;
  }

  // Allow editing even if latestSnapshot is null (R22: scratch deck with 0 cards)
  const snapshot = deck.latestSnapshot;

  // Build the tags structure expected by DeckDetailHeader.
  // deck.tags is readonly string[] (display names only from v2 U7).
  // TagChipRow expects ITagResponse[] (with id + name).
  // Because the API only returns tag names (not IDs) on the detail response,
  // we synthesise lightweight objects using the index as a stable key.
  const tagsForHeader: ITagResponse[] = (deck.tags ?? []).map((name, idx) => ({
    id: idx,
    name,
    createdAt: '',
  }));

  if (snapshot == null && mode === 'view') {
    return <DeckDetailEmptyState kind="computing" />;
  }

  return (
    <DeckDetailPageWithData
      deck={deck}
      deckId={deckId}
      mode={mode}
      tagsForHeader={tagsForHeader}
      snapshot={snapshot}
      onEnterEdit={handleEnterEdit}
      onExitEdit={handleExitEdit}
      onMarkOwned={(cardIdentifier) => {
        markOwnedMutation.mutate(cardIdentifier, {
          onError: (err) => {
            showToast({
              kind: 'error',
              message: `Failed to mark card: ${(err as Error).message}`,
              retry: () => markOwnedMutation.mutate(cardIdentifier),
            });
          },
        });
      }}
      isMarkingOwned={markOwnedMutation.isPending}
      pendingCard={markOwnedMutation.isPending ? (markOwnedMutation.variables ?? null) : null}
      onApproveSubstitute={(substituteIdentifier) => {
        decideMutation.mutate({ cardIdentifier: substituteIdentifier, decision: 'approved' });
      }}
      onRejectSubstitute={(substituteIdentifier) => {
        decideMutation.mutate({ cardIdentifier: substituteIdentifier, decision: 'rejected' });
      }}
      onResetSubstitute={(substituteIdentifier) => {
        resetDecisionMutation.mutate(substituteIdentifier);
      }}
      pendingSubstituteId={
        decideMutation.isPending
          ? (decideMutation.variables?.cardIdentifier ?? null)
          : resetDecisionMutation.isPending
            ? (resetDecisionMutation.variables ?? null)
            : null
      }
      onClearRejections={() => {
        clearRejectionsMutation.mutate(undefined, {
          onError: (err) => {
            showToast({
              kind: 'error',
              message: `Failed to clear rejections: ${(err as Error).message}`,
              retry: () => clearRejectionsMutation.mutate(undefined),
            });
          },
        });
      }}
      isClearingRejections={clearRejectionsMutation.isPending}
      onFetchVariants={handleFetchVariants}
      fetchMutationStatus={variantFetchMutation.status}
      isCooldownActive={isCooldownActive}
      onPollingChange={handlePollingChange}
      onShoppingRetry={handleShoppingLineRetry}
    />
  );
}

// ---------------------------------------------------------------------------
// DeckDetailPageWithData — sub-component that can safely call edit-mode hooks
// (useCompositionDraft, useCascadeCheck) because it always renders with data.
// ---------------------------------------------------------------------------

interface IDeckDetailPageWithDataProps {
  readonly deck: IDeckDetailResponse;
  readonly deckId: string;
  readonly mode: 'view' | 'edit';
  readonly tagsForHeader: ITagResponse[];
  readonly snapshot: IDeckDetailResponse['latestSnapshot'];
  readonly onEnterEdit: () => void;
  readonly onExitEdit: () => void;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onApproveSubstitute: (id: string) => void;
  readonly onRejectSubstitute: (id: string) => void;
  readonly onResetSubstitute: (id: string) => void;
  readonly pendingSubstituteId: string | null;
  readonly onClearRejections: () => void;
  readonly isClearingRejections: boolean;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: string;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;
}

/**
 * DeckDetailPageWithData — renders after data is confirmed loaded.
 * Calls Edit-mode hooks (useCompositionDraft, useCascadeCheck) unconditionally.
 * Mounts DraftRestoreModal + NavigationAwayGuard (U13).
 */
function DeckDetailPageWithData({
  deck,
  deckId,
  mode,
  tagsForHeader,
  snapshot,
  onEnterEdit,
  onExitEdit,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onApproveSubstitute,
  onRejectSubstitute,
  onResetSubstitute,
  pendingSubstituteId,
  onClearRejections,
  isClearingRejections,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
}: IDeckDetailPageWithDataProps): React.ReactElement {
  const navigate = useNavigate();

  // Ref to the Edit button for DraftRestoreModal focus return.
  const editBtnRef = useRef<HTMLButtonElement | null>(null);

  // Build initial payload for the composition draft from the current deck state.
  const draftInitialPayload = React.useMemo(() => {
    if (!snapshot) {
      return {
        cards: [],
        heroIdentifier: deck.heroIdentifier ?? null,
        format: deck.format,
      };
    }
    const allCards = [
      ...snapshot.breakdown.exact,
      ...(snapshot.breakdown.notOwned ?? snapshot.breakdown.missing),
    ].map((entry) => ({
      cardIdentifier: entry.cardIdentifier,
      name: entry.name,
      quantity: entry.quantity,
      slot: entry.slot,
      pitch: entry.pitch,
      cost: entry.cost ?? null,
      type: entry.type,
      imageUrl: entry.imageUrl
        ? { small: entry.imageUrl.small, large: entry.imageUrl.large }
        : null,
      legalFormats: [],
      legalHeroes: [],
      bannedFormats: [],
    }));
    return {
      cards: allCards,
      heroIdentifier: deck.heroIdentifier ?? null,
      format: deck.format,
    };
  }, [snapshot, deck.heroIdentifier, deck.format]);

  const compositionDraft = useCompositionDraft(deckId, draftInitialPayload);
  const cascadeCheck = useCascadeCheck(compositionDraft.draft);

  // ---------------------------------------------------------------------------
  // Draft restore modal (U13) — check localStorage on Edit entry
  // ---------------------------------------------------------------------------

  // Track whether we've already checked localStorage for this Edit session
  // to avoid showing the restore modal repeatedly.
  const draftCheckDoneRef = useRef(false);
  const [restoreModalOpen, setRestoreModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'edit') {
      // Reset so we check again next time Edit is entered.
      draftCheckDoneRef.current = false;
      return;
    }
    if (draftCheckDoneRef.current) return;
    draftCheckDoneRef.current = true;

    const stored = readStoredDraft(deckId);
    if (stored != null) {
      setRestoreModalOpen(true);
    }
  }, [mode, deckId]);

  function handleRestoreDraft(): void {
    setRestoreModalOpen(false);
    const stored = readStoredDraft(deckId);
    if (stored == null) return;
    // applyDraft reconstructs the ICompositionDraft from the stored payload.
    // The stored payload only has cardIdentifier + quantity + slot; we need
    // to merge with the initial payload to get name/pitch/cost/type/imageUrl.
    const initialCardMap = new Map(
      draftInitialPayload.cards.map((c) => [`${c.cardIdentifier}::${c.slot}`, c]),
    );
    compositionDraft.applyDraft({
      heroIdentifier: stored.heroIdentifier,
      format: stored.format,
      cards: stored.cards.map((sc) => {
        const initial = initialCardMap.get(`${sc.cardIdentifier}::${sc.slot}`);
        return {
          cardIdentifier: sc.cardIdentifier,
          name: initial?.name ?? sc.cardIdentifier,
          quantity: sc.quantity,
          slot: sc.slot,
          pitch: initial?.pitch ?? null,
          cost: initial?.cost ?? null,
          type: initial?.type ?? 'unknown',
          imageUrl: initial?.imageUrl ?? null,
          legalFormats: initial?.legalFormats ?? [],
          legalHeroes: initial?.legalHeroes ?? [],
          bannedFormats: initial?.bannedFormats ?? [],
        };
      }),
    });
  }

  function handleDiscardDraft(): void {
    setRestoreModalOpen(false);
    compositionDraft.clearPersistedDraft();
    compositionDraft.reset();
  }

  // ---------------------------------------------------------------------------
  // Navigation-away guard (U13) — DiscardChangesConfirm for nav events
  // ---------------------------------------------------------------------------

  const [navGuardDiscardOpen, setNavGuardDiscardOpen] = React.useState(false);
  // Store blocker proceed/stay callbacks when the guard fires.
  const navGuardCallbacksRef = useRef<{ proceed: () => void; stay: () => void } | null>(null);

  useNavigationAwayGuard({
    isDirty: compositionDraft.isDirty,
    isEditMode: mode === 'edit',
    onBlock: (proceed, stay) => {
      navGuardCallbacksRef.current = { proceed, stay };
      setNavGuardDiscardOpen(true);
    },
  });

  function handleNavGuardKeepEditing(): void {
    setNavGuardDiscardOpen(false);
    navGuardCallbacksRef.current?.stay();
    navGuardCallbacksRef.current = null;
  }

  function handleNavGuardDiscard(): void {
    setNavGuardDiscardOpen(false);
    compositionDraft.clearPersistedDraft();
    navGuardCallbacksRef.current?.proceed();
    navGuardCallbacksRef.current = null;
  }

  // ---------------------------------------------------------------------------
  // Save + Cancel handlers passed to DeckDetailHeader
  // ---------------------------------------------------------------------------

  const saveDraftPayload = React.useMemo(() => ({
    cards: compositionDraft.draft.cards.map((c) => ({
      cardIdentifier: c.cardIdentifier,
      quantity: c.quantity,
    })),
    heroIdentifier: compositionDraft.draft.heroIdentifier,
    format: compositionDraft.draft.format,
  }), [compositionDraft.draft]);

  function handleSaveSuccess(): void {
    compositionDraft.clearPersistedDraft();
    void navigate({
      to: '/decks/$deckId',
      params: { deckId },
      search: { edit: undefined },
    });
  }

  function handleConfirmDiscard(): void {
    compositionDraft.clearPersistedDraft();
    compositionDraft.reset();
    onExitEdit();
  }

  const isPathC = snapshot?.path === 'C';

  return (
    <>
      <DeckDetailLayout
        header={
          <DeckDetailHeader
            deckId={deck.id}
            deckName={deck.name}
            status={deck.status}
            tags={tagsForHeader}
            mode={mode}
            onEnterEdit={onEnterEdit}
            isDirty={compositionDraft.isDirty}
            changeCount={compositionDraft.changeCount}
            cascadeCheckCount={cascadeCheck.count}
            saveDraftPayload={saveDraftPayload}
            onSaveSuccess={handleSaveSuccess}
            onConfirmDiscard={handleConfirmDiscard}
            editButtonRef={editBtnRef}
          />
        }
        sidebar={
          <DeckDetailSidebar
            heroIdentifier={deck.heroIdentifier ?? null}
            heroName={null}
            heroLegacy={deck.hero}
            format={deck.format}
            legality={deck.legality}
            fabraryUlid={deck.fabraryUlid ?? null}
            status={deck.status}
            effectivePercent={snapshot?.effectivePercent ?? 0}
            rawPercent={snapshot?.rawPercent ?? 0}
            provisionedCards={snapshot ? countProvisionedCards(snapshot.breakdown) : 0}
            totalCards={deck.totalCards}
            shoppingData={deck.shoppingLine ?? null}
            onFetchVariants={onFetchVariants}
            fetchMutationStatus={fetchMutationStatus as import('../../components/ShoppingLine').TVariantFetchMutationStatus}
            isCooldownActive={isCooldownActive}
            onPollingChange={onPollingChange}
            onShoppingRetry={onShoppingRetry}
            mode={mode}
            compositionDraft={compositionDraft.draft}
            cascadeCheck={cascadeCheck}
            onRemoveIllegalCards={compositionDraft.removeIllegalCards}
            onSetHero={compositionDraft.setHero}
            onSetFormat={compositionDraft.setFormat}
          />
        }
        canvas={
          <>
            {/* Path C banner — only in view mode */}
            {mode === 'view' && isPathC && snapshot && (
              <div role="status" className={styles.pathCBanner}>
                <div className={styles.pathCBanner__eyebrow}>
                  APPROXIMATION
                </div>
                <strong className={styles.pathCBanner__strong}>
                  Closest playable version.
                </strong>{' '}
                This deck is missing{' '}
                {countNotOwnedCards(snapshot.breakdown)}{' '}
                {countNotOwnedCards(snapshot.breakdown) === 1
                  ? 'card'
                  : 'cards'}
                . You&rsquo;re currently at{' '}
                {(Math.round(snapshot.fidelityPercent * 10) / 10).toFixed(1)}%
                fidelity.
              </div>
            )}
            <DeckCanvas
              mode={mode}
              breakdown={snapshot?.breakdown ?? { exact: [], substituted: [], missing: [], notOwned: [] }}
              decisions={deck.decisions}
              rejectedCount={deck.rejectedCount}
              onMarkOwned={onMarkOwned}
              isMarkingOwned={isMarkingOwned}
              pendingCard={pendingCard}
              onApproveSubstitute={onApproveSubstitute}
              onRejectSubstitute={onRejectSubstitute}
              onResetSubstitute={onResetSubstitute}
              pendingSubstituteId={pendingSubstituteId}
              onClearRejections={onClearRejections}
              isClearingRejections={isClearingRejections}
              compositionDraft={compositionDraft.draft}
              cascadeCheck={cascadeCheck}
              onAddCard={compositionDraft.addCard}
              onUpdateQuantity={compositionDraft.updateQuantity}
              onRemoveCard={compositionDraft.removeCard}
              onRemoveIllegalCards={compositionDraft.removeIllegalCards}
              onSetHero={compositionDraft.setHero}
              onSetFormat={compositionDraft.setFormat}
            />
          </>
        }
      />

      {/* DraftRestoreModal — shown on Edit entry when a stored draft exists */}
      <DraftRestoreModal
        open={restoreModalOpen}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
        returnFocusRef={editBtnRef}
      />

      {/* DiscardChangesConfirm — shown when nav-away guard fires */}
      <DiscardChangesConfirm
        open={navGuardDiscardOpen}
        changeCount={compositionDraft.changeCount}
        onKeepEditing={handleNavGuardKeepEditing}
        onDiscard={handleNavGuardDiscard}
      />
    </>
  );
}
