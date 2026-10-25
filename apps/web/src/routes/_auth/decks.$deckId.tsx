import React, { useCallback, useRef } from 'react';
import { createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  IDeckDetailResponse,
  useDeckDetailQuery,
  useMarkOwnedMutation,
  deckDetailQueryKey,
} from '../../api/deck-detail';
import { useToast } from '../../components/ui/Toast/useToast';
import { DeckDetailSkeleton } from '../../components/deck-detail/DeckDetailSkeleton';
import { DeckDetailEmptyState } from '../../components/deck-detail/DeckDetailEmptyState';
import { DeckDetailLayout } from '../../components/deck-detail/DeckDetailLayout';
import { DeckDetailHeader } from '../../components/deck-detail/DeckDetailHeader';
import { DeckDetailSidebar } from '../../components/deck-detail/DeckDetailSidebar';
import { DeckDetailView } from '../../components/deck-detail/DeckDetailView';
import { DeckCanvas } from '../../components/deck-detail/DeckCanvas';
import { DraftRestoreModal } from '../../components/deck-detail/DraftRestoreModal';
import { inventoryOf, useCompositionDraft, readStoredDraft } from '../../hooks/useCompositionDraft';
import { buildDraftInitialPayload, isJustCreatedState } from './-deck-detail-draft';
import { cascadeFromLegality, computeDraftLegality, toDeckLegality } from '../../lib/draft-legality';
import { summariseDeck } from '../../components/deck-detail/deckDetailModel';
import { useHeroesQuery } from '../../api/catalog';
import { useNavigationAwayGuard } from '../../hooks/useNavigationAwayGuard';
import { DiscardChangesConfirm } from '../../components/deck-detail/DiscardChangesConfirm';
import { useTagsQuery, type ITagResponse } from '../../api/tags';
import { resolveDeckTags } from '../../components/deck-edit/deckEditModel';
import styles from './decks.$deckId.module.css';
import { validateDeckDetailSearch } from './-deck-detail-search';


export const Route = createFileRoute('/_auth/decks/$deckId')({
  component: DeckDetailPage,
  validateSearch: validateDeckDetailSearch,
});

function DeckDetailPage(): React.ReactElement {
  const { deckId } = Route.useParams();
  const { edit } = Route.useSearch();
  const navigate = useNavigate();
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Derive current mode from ?edit=1 search param
  const mode = edit === 1 ? 'edit' : 'view';

  function handleOpenMetadataEdit(): void {
    void navigate({ to: '/decks/$deckId/edit', params: { deckId } });
  }

  function handleEnterEdit(): void {
    void navigate({ to: '/decks/$deckId', params: { deckId }, search: { edit: 1 } });
  }

  function handleExitEdit(): void {
    void navigate({ to: '/decks/$deckId', params: { deckId }, search: { edit: undefined } });
  }

  const detailQuery = useDeckDetailQuery(deckId);
  const tagsQuery = useTagsQuery();
  const markOwnedMutation = useMarkOwnedMutation(deckId);

  // Retry handler for ShoppingLine error state: invalidates the deck-detail
  // query so TanStack re-fetches fresh data. Toast notification of the failure
  // is the host's responsibility — ShoppingLine stays portal-free.
  const handleShoppingLineRetry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
    showToast({
      kind: 'error',
      message: t('decks.retryShoppingLineToast'),
    });
  }, [queryClient, deckId, showToast, t]);

  if (detailQuery.isLoading) {
    return <DeckDetailSkeleton />;
  }

  if (detailQuery.isError) {
    return (
      <div>
        <p className={styles.errorMsg}>
          {t('decks.failedToLoadDeck', { error: (detailQuery.error as Error).message })}
        </p>
        <button
          type="button"
          className={styles.retryBtn}
          onClick={() => void detailQuery.refetch()}
        >
          {t('decks.retry')}
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

  // The detail response carries tag names only; resolve real ids from the user's tag list.
  const tagsForHeader: ITagResponse[] = resolveDeckTags(deck.tags ?? [], tagsQuery.data?.tags ?? []);

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
      onOpenMetadataEdit={handleOpenMetadataEdit}
      onExitEdit={handleExitEdit}
      onMarkOwned={(cardIdentifier) => {
        markOwnedMutation.mutate(cardIdentifier, {
          onError: (err) => {
            showToast({
              kind: 'error',
              message: t('decks.failedToMarkCard', { error: (err as Error).message }),
              retry: () => markOwnedMutation.mutate(cardIdentifier),
            });
          },
        });
      }}
      isMarkingOwned={markOwnedMutation.isPending}
      pendingCard={markOwnedMutation.isPending ? (markOwnedMutation.variables ?? null) : null}
      onShoppingRetry={handleShoppingLineRetry}
    />
  );
}

// ---------------------------------------------------------------------------
// DeckDetailPageWithData — sub-component that can safely call edit-mode hooks
// (useCompositionDraft, the draft's verdict) because it always renders with data.
// ---------------------------------------------------------------------------

interface IDeckDetailPageWithDataProps {
  readonly deck: IDeckDetailResponse;
  readonly deckId: string;
  readonly mode: 'view' | 'edit';
  readonly tagsForHeader: ITagResponse[];
  readonly snapshot: IDeckDetailResponse['latestSnapshot'];
  readonly onEnterEdit: () => void;
  readonly onOpenMetadataEdit: () => void;
  readonly onExitEdit: () => void;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onShoppingRetry: () => void;
}

/**
 * DeckDetailPageWithData — renders after data is confirmed loaded.
 * Calls Edit-mode hooks (useCompositionDraft, the draft's verdict) unconditionally.
 * Mounts DraftRestoreModal + NavigationAwayGuard (U13).
 */
function DeckDetailPageWithData({
  deck,
  deckId,
  mode,
  tagsForHeader,
  snapshot,
  onEnterEdit,
  onOpenMetadataEdit,
  onExitEdit,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onShoppingRetry,
}: IDeckDetailPageWithDataProps): React.ReactElement {
  const navigate = useNavigate();

  // Ref to the Edit button for DraftRestoreModal focus return.
  const editBtnRef = useRef<HTMLButtonElement | null>(null);

  const draftInitialPayload = React.useMemo(
    () => buildDraftInitialPayload({ heroIdentifier: deck.heroIdentifier, format: deck.format }, snapshot),
    [snapshot, deck.heroIdentifier, deck.format],
  );

  const compositionDraft = useCompositionDraft(deckId, draftInitialPayload);

  // Resolve the draft hero's `Hero` enum (e.g. "Kayo") from the heroes catalog.
  // The cascade check matches each card's `legalHeroes` (enum values) against
  // this — comparing against the raw heroIdentifier (a cardIdentifier) would
  // flag every hero-restricted card as illegal. Also drives the live hero name
  // shown in the sidebar while editing.
  const heroesQuery = useHeroesQuery();
  const draftHeroCard = React.useMemo(
    () =>
      compositionDraft.draft.heroIdentifier
        ? heroesQuery.data?.heroes.find(
            (h) => h.cardIdentifier === compositionDraft.draft.heroIdentifier,
          ) ?? null
        : null,
    [compositionDraft.draft.heroIdentifier, heroesQuery.data],
  );

  // The verdict is the engine's own, run on the draft in the browser: what the player sees while
  // editing is never the saved verdict.
  const draftLegality = React.useMemo(
    () => computeDraftLegality(compositionDraft.draft, draftHeroCard),
    [compositionDraft.draft, draftHeroCard],
  );
  const cascadeCheck = React.useMemo(() => cascadeFromLegality(draftLegality), [draftLegality]);

  const justCreated = useRouterState({ select: (state) => isJustCreatedState(state.location.state) });
  const discardEmptyNewDeck = justCreated && deck.totalCards === 0;
  const missingCount = React.useMemo(
    () =>
      snapshot === null
        ? 0
        : summariseDeck({ pct: snapshot.effectivePercent, breakdown: snapshot.breakdown, replacements: deck.replacements })
            .missingCards,
    [snapshot, deck.replacements],
  );

  // In Edit mode the sidebar must reflect the LIVE draft hero/format, not the
  // last-saved deck values, so switching the hero updates the displayed name.
  const isEditing = mode === 'edit';
  const sidebarHeroIdentifier = isEditing
    ? compositionDraft.draft.heroIdentifier
    : deck.heroIdentifier ?? null;
  const sidebarHeroName = isEditing
    ? draftHeroCard?.name ?? deck.hero
    : deck.hero;
  const sidebarFormat = isEditing ? compositionDraft.draft.format : deck.format;

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
          inventoryQuantity: sc.inventoryQuantity,
          slot: sc.slot,
          pitch: initial?.pitch ?? null,
          cost: initial?.cost ?? null,
          type: initial?.type ?? 'unknown',
          imageUrl: initial?.imageUrl ?? null,
          legalFormats: initial?.legalFormats ?? [],
          legalHeroes: initial?.legalHeroes ?? [],
          bannedFormats: initial?.bannedFormats ?? [],
          ...(initial?.restrictedFormats === undefined ? {} : { restrictedFormats: initial.restrictedFormats }),
          ...(initial?.legalOverrides === undefined ? {} : { legalOverrides: initial.legalOverrides }),
          ...(initial?.specializations === undefined ? {} : { specializations: initial.specializations }),
          ...(initial?.legendary === undefined ? {} : { legendary: initial.legendary }),
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

  const navGuard = useNavigationAwayGuard({
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
      inventoryQuantity: inventoryOf(c),
      // `other` is a frontend-only fallback for unknown stored slot strings;
      // the backend enum allows only the four real deck slots.
      slot: (c.slot === 'other' ? 'mainboard' : c.slot) as
        | 'mainboard' | 'equipment' | 'weapon' | 'hero',
    })),
    heroIdentifier: compositionDraft.draft.heroIdentifier,
    format: compositionDraft.draft.format,
  }), [compositionDraft.draft]);

  function handleSaveSuccess(): void {
    compositionDraft.clearPersistedDraft();
    // Same reason as handleConfirmDiscard: the save just completed, but the
    // composition draft's `isDirty` won't flip false until the next deck
    // detail refetch lands. Bypass the guard so the post-save navigation
    // doesn't open a spurious DiscardChangesConfirm.
    navGuard.bypassNext();
    void navigate({
      to: '/decks/$deckId',
      params: { deckId },
      search: { edit: undefined },
    });
  }

  function handleConfirmDiscard(): void {
    compositionDraft.clearPersistedDraft();
    compositionDraft.reset();
    // The header's Cancel modal already collected consent — bypass the
    // nav-away guard so it does not fire a second DiscardChangesConfirm
    // as soon as `onExitEdit` triggers the post-confirm navigation.
    navGuard.bypassNext();
    if (!discardEmptyNewDeck) onExitEdit();
  }

  const shoppingData = deck.shoppingLine ?? null;

  return (
    <>
      {mode === 'view' && snapshot != null ? (
        <DeckDetailView
          deck={deck}
          snapshot={snapshot}
          tags={tagsForHeader}
          shoppingData={shoppingData}
          onEdit={onOpenMetadataEdit}
          onEditCards={onEnterEdit}
          onMarkOwned={onMarkOwned}
          isMarkingOwned={isMarkingOwned}
          pendingCard={pendingCard}
          onShoppingRetry={onShoppingRetry}
        />
      ) : (
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
              editor={{ format: compositionDraft.draft.format, legality: draftLegality, missingCount }}
              discardOnCancel={discardEmptyNewDeck}
              editButtonRef={editBtnRef}
            />
          }
          sidebar={
            <DeckDetailSidebar
              heroIdentifier={sidebarHeroIdentifier}
              heroName={null}
              heroLegacy={sidebarHeroName}
              format={sidebarFormat}
              legality={isEditing && draftLegality !== null ? toDeckLegality(draftLegality) : deck.legality}
              fabraryUlid={deck.fabraryUlid ?? null}
              shoppingData={shoppingData}
              onShoppingRetry={onShoppingRetry}
              mode={mode}
              compositionDraft={compositionDraft.draft}
              cascadeCheck={cascadeCheck}
              onRemoveIllegalCards={compositionDraft.removeIllegalCards}
              onSetHero={compositionDraft.setHero}
            />
          }
          canvas={
            <DeckCanvas
              compositionDraft={compositionDraft.draft}
              cascadeCheck={cascadeCheck}
              legality={draftLegality}
              heroName={draftHeroCard?.name ?? deck.hero}
              onAddCard={compositionDraft.addCard}
              onUpdateQuantity={compositionDraft.updateQuantity}
              onUpdateInventoryQuantity={compositionDraft.updateInventoryQuantity}
              onMoveCopies={compositionDraft.moveCopies}
              onRemoveCard={compositionDraft.removeCard}
              onRemoveIllegalCards={compositionDraft.removeIllegalCards}
              onSetHero={compositionDraft.setHero}
            />
          }
        />
      )}

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
