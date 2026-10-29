/**
 * DeckCanvas — the composition-edit canvas of the deck detail page (`?edit=1`).
 *
 * View mode is DeckDetailView; this file keeps the edit body plus the slot
 * helpers it and its tests share.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FORMAT_RULES, type IDeckLegalityResult, type TSupportedFormat } from '@rathe-arsenal/engine/legality';
import { CardLightbox } from '../card-art/CardLightbox';
import { EditableCardRow } from './EditableCardRow';
import { LoadoutRow } from './LoadoutRow';
import { RulesBar, RulesChecklistSheet } from './RulesChecklistSheet';
import { focusCardRow } from './focusCardRow';
import { buildRulesChecklist } from './rulesChecklistModel';
import { copyInfoFor, copySplitFor } from '../../lib/draft-legality';
import { HeroDropdown } from './HeroDropdown';
import { CascadeWarningPanelBanner } from './CascadeWarningPanel';
import { DeckCardSearchAutocomplete } from '../deck-card-search/DeckCardSearchAutocomplete';
import { inventoryOf, type ICompositionDraft, type IDraftCard, type TCopySide, type TDraftSlot } from '../../hooks/useCompositionDraft';
import type { ICascadeCheckResult } from '../../hooks/useCascadeCheck';
import type { ISearchCardResult } from '../../api/catalog';

// Import slot icons — vite-plugin-svgr `?react` suffix converts to React components
import SlotMainboardIcon from '../../assets/icons/slot-mainboard.svg?react';
import SlotHeroIcon from '../../assets/icons/slot-hero.svg?react';
import SlotWeaponIcon from '../../assets/icons/slot-weapon.svg?react';
import SlotEquipmentIcon from '../../assets/icons/slot-equipment.svg?react';
import styles from './DeckCanvas.module.css';

/**
 * Slot groups used to section the editable card list.
 */
export type TSlotGroup = 'mainboard' | 'hero' | 'weapon' | 'equipment' | 'other';

/**
 * SlotIcon — renders the correct SVG slot icon based on the slot group.
 * Used in both View and Edit modes.
 */
export function SlotIcon({
  group,
  className,
}: {
  group: TSlotGroup;
  className?: string | undefined;
}): React.ReactElement {
  const iconProps = {
    className: className ?? styles.slotIcon,
    width: 14,
    height: 14,
    'aria-hidden': true as const,
  };
  switch (group) {
    case 'hero':
      return <SlotHeroIcon {...iconProps} />;
    case 'weapon':
      return <SlotWeaponIcon {...iconProps} />;
    case 'equipment':
      return <SlotEquipmentIcon {...iconProps} />;
    default:
      return <SlotMainboardIcon {...iconProps} />;
  }
}

// ---------------------------------------------------------------------------
// DeckCanvas public interface
// ---------------------------------------------------------------------------

interface IDeckCanvasProps {
  readonly compositionDraft?: ICompositionDraft;
  readonly cascadeCheck?: ICascadeCheckResult;
  /** The engine's verdict on the draft; null while the draft's hero is still loading. */
  readonly legality?: IDeckLegalityResult | null;
  readonly heroName?: string | null;
  readonly onAddCard?: (card: ISearchCardResult) => void;
  readonly onUpdateQuantity?: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  readonly onUpdateInventoryQuantity?: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  readonly onMoveCopies?: (cardIdentifier: string, slot: TDraftSlot, from: TCopySide, count: number) => void;
  readonly onRemoveCard?: (cardIdentifier: string, slot: TDraftSlot) => void;
  readonly onRemoveIllegalCards?: (ids: ReadonlySet<string>) => void;
  readonly onSetHero?: (heroIdentifier: string | null) => void;
  /** The deck's id when the player has the Tutor, so the checklist can ask it. */
  readonly tutorDeckId?: number | undefined;
}

export function DeckCanvas(props: IDeckCanvasProps): React.ReactElement {
  return (
    <EditBody
      compositionDraft={props.compositionDraft}
      cascadeCheck={props.cascadeCheck}
      legality={props.legality ?? null}
      heroName={props.heroName ?? null}
      onAddCard={props.onAddCard}
      onUpdateQuantity={props.onUpdateQuantity}
      onUpdateInventoryQuantity={props.onUpdateInventoryQuantity}
      onMoveCopies={props.onMoveCopies}
      onRemoveCard={props.onRemoveCard}
      onRemoveIllegalCards={props.onRemoveIllegalCards}
      onSetHero={props.onSetHero}
      tutorDeckId={props.tutorDeckId}
    />
  );
}

// ---------------------------------------------------------------------------
// EditBody
// ---------------------------------------------------------------------------

interface IEditBodyProps {
  readonly compositionDraft: ICompositionDraft | undefined;
  readonly cascadeCheck: ICascadeCheckResult | undefined;
  readonly legality: IDeckLegalityResult | null;
  readonly heroName: string | null;
  readonly onAddCard: ((card: ISearchCardResult) => void) | undefined;
  readonly onUpdateQuantity: ((cardIdentifier: string, slot: TDraftSlot, quantity: number) => void) | undefined;
  readonly onUpdateInventoryQuantity: ((cardIdentifier: string, slot: TDraftSlot, quantity: number) => void) | undefined;
  readonly onMoveCopies: ((cardIdentifier: string, slot: TDraftSlot, from: TCopySide, count: number) => void) | undefined;
  readonly onRemoveCard: ((cardIdentifier: string, slot: TDraftSlot) => void) | undefined;
  readonly onRemoveIllegalCards: ((ids: ReadonlySet<string>) => void) | undefined;
  readonly onSetHero: ((heroIdentifier: string | null) => void) | undefined;
  readonly tutorDeckId: number | undefined;
}

const LOADOUT_SLOTS: readonly TSlotGroup[] = ['hero', 'weapon', 'equipment'];
const DECK_SLOTS: readonly TSlotGroup[] = ['mainboard', 'other'];

/**
 * EditBody — the editable canvas for deck composition editing.
 *
 * Top to bottom: hero picker, the cards the engine flags, card search, the hero, weapon and
 * equipment, the deck rows with their copy limits, and last the rules bar that opens the checklist.
 */
function EditBody({
  compositionDraft,
  cascadeCheck,
  legality,
  heroName,
  onAddCard,
  onUpdateQuantity,
  onUpdateInventoryQuantity,
  onMoveCopies,
  onRemoveCard,
  onRemoveIllegalCards,
  onSetHero,
  tutorDeckId,
}: IEditBodyProps): React.ReactElement {
  const { t } = useTranslation();
  const autocompleteRef = React.useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editLightbox, setEditLightbox] = React.useState<{
    readonly imageUrl: string;
    readonly sources: readonly string[];
    readonly name: string;
  } | null>(null);

  const checklist = React.useMemo(
    () =>
      compositionDraft === undefined || legality === null
        ? null
        : buildRulesChecklist({ result: legality, draft: compositionDraft, heroName, t }),
    [compositionDraft, legality, heroName, t],
  );

  // If no draft yet (shouldn't happen after U12 wiring, but guard gracefully)
  if (!compositionDraft || !cascadeCheck) {
    return (
      <div className={styles.editCanvas} data-testid="deck-canvas-edit">
        <p className={styles.editEmptyState}>{t('decks.loadingComposition')}</p>
      </div>
    );
  }

  const slotGroups = new Map<TSlotGroup, IDraftCard[]>(
    [...LOADOUT_SLOTS, ...DECK_SLOTS].map((group) => [group, []]),
  );
  for (const card of compositionDraft.cards) {
    slotGroups.get(card.slot as TSlotGroup)?.push(card);
  }
  const rowsOf = (groups: readonly TSlotGroup[]): IDraftCard[] => groups.flatMap((group) => slotGroups.get(group) ?? []);
  const deckRows = rowsOf(DECK_SLOTS);

  function handlePick(card: ISearchCardResult): void {
    onAddCard?.(card);
  }

  function handleRemoveIllegal(ids: ReadonlySet<string>): void {
    onRemoveIllegalCards?.(ids);
    // Focus autocomplete after removing illegal cards
    setTimeout(() => autocompleteRef.current?.focus(), 50);
  }

  const totalCards = compositionDraft.cards.reduce((sum, c) => sum + c.quantity + inventoryOf(c), 0);
  const hasInventory = compositionDraft.cards.some((card) => inventoryOf(card) > 0);
  const pool = hasInventory ? poolOf(compositionDraft) : null;

  return (
    <div className={styles.editCanvas} data-testid="deck-canvas-edit">

      {/* ---- Mobile-only: Hero dropdown (format is edited on the Edit deck screen) ---- */}
      {/* These show on mobile (<1280px) where the sidebar is hidden. */}
      {/* On desktop (≥1280px) they live in the sidebar instead. */}
      {onSetHero !== undefined && (
        <div className={styles.editMobileDropdowns} data-testid="edit-mobile-dropdowns">
          <HeroDropdown
            value={compositionDraft.heroIdentifier}
            onChange={onSetHero}
          />
        </div>
      )}

      {/* ---- Mobile-only: Cascade warning banner ---- */}
      {cascadeCheck.count > 0 && (
        <div className={styles.editMobileBanner} data-testid="edit-mobile-cascade-banner">
          <CascadeWarningPanelBanner
            draft={compositionDraft}
            cascadeCheck={cascadeCheck}
            onRemoveIllegal={handleRemoveIllegal}
          />
        </div>
      )}

      {/* ---- Card search autocomplete + slot picker ---- */}
      <div className={styles.editSearch}>
        <DeckCardSearchAutocomplete
          onPick={handlePick}
          label={t('decks.addCardsToDeck')}
          inputRef={autocompleteRef}
        />
      </div>

      {totalCards === 0 ? (
        <div className={styles.editEmptyState} data-testid="edit-empty-state">
          <p className={styles.editEmptyState__title}>
            {t('decks.noCardsYet')}
          </p>
          <p className={styles.editEmptyState__sub}>
            {t('decks.searchToAddCards')}
          </p>
        </div>
      ) : (
        <div className={styles.editSlotGroups} data-testid="edit-slot-groups">
          {rowsOf(LOADOUT_SLOTS).length > 0 && (
            <div className={styles.loadout} aria-label={t('deckDetail.editorLoadoutAria')} role="group">
              {LOADOUT_SLOTS.map((group) => {
                const cards = slotGroups.get(group) ?? [];
                if (cards.length === 0) return null;
                return (
                  <ul key={group} className={styles.loadoutList} data-testid={`edit-slot-group-${group}`}>
                    {cards.map((card) => (
                      <LoadoutRow
                        key={`${card.cardIdentifier}-${card.slot}`}
                        card={card}
                        onRemove={(id, slot) => onRemoveCard?.(id, slot)}
                        onOpenLightbox={setEditLightbox}
                      />
                    ))}
                  </ul>
                );
              })}
            </div>
          )}

          {deckRows.length > 0 && (
            <section className={styles.deckSection} data-testid="edit-slot-group-mainboard">
              <div className={styles.deckHeader}>
                <h2 className={styles.deckHeading}>{t('deckDetail.editorDeckHeading')}</h2>
                {checklist !== null && <span className={styles.deckSize}>{checklist.deckSizeText}</span>}
              </div>
              {pool !== null && (
                <div className={styles.inventorySummary} data-testid="inventory-summary">
                  <p className={styles.inventoryCounts}>
                    {t('deckDetail.inventorySummary', {
                      deck: pool.deck,
                      inventory: pool.inventory,
                      pool: pool.cards,
                      limit: pool.limit,
                    })}
                  </p>
                  <p className={styles.plainLine}>{t('deckDetail.inventoryPlain')}</p>
                  <p className={styles.plainLine}>{t('deckDetail.rulePool', { count: pool.cards, limit: pool.limit })}</p>
                  <p className={styles.plainLine}>{t('deckDetail.rulePoolHint')}</p>
                </div>
              )}
              {hasInventory && (
                <div className={styles.columnHeads} aria-hidden="true">
                  <span className={styles.headCard}>{t('deckDetail.columnCard')}</span>
                  <span className={styles.headSide}>{t('deckDetail.columnDeck')}</span>
                  <span className={styles.headSide}>{t('deckDetail.columnInventory')}</span>
                </div>
              )}
              <ul className={styles.deckList} aria-label={t('decks.slotGroupCardsAria', { group: 'mainboard' })}>
                {deckRows.map((card) => (
                  <EditableCardRow
                    key={`${card.cardIdentifier}-${card.slot}`}
                    cardIdentifier={card.cardIdentifier}
                    name={card.name}
                    pitch={card.pitch}
                    quantity={card.quantity}
                    inventoryQuantity={inventoryOf(card)}
                    showInventory={hasInventory}
                    slot={card.slot}
                    type={card.type}
                    cost={card.cost}
                    copies={copyInfoFor(compositionDraft, card)}
                    copySplit={copySplitFor(compositionDraft, card)}
                    formatName={compositionDraft.format}
                    imageUrl={card.imageUrl}
                    onQuantityChange={(id, sl, qty) => {
                      if (qty <= 0 && inventoryOf(card) === 0) {
                        onRemoveCard?.(id, sl);
                      } else {
                        onUpdateQuantity?.(id, sl, qty);
                      }
                    }}
                    onInventoryQuantityChange={onUpdateInventoryQuantity}
                    onMoveCopies={onMoveCopies}
                    onRemove={(id, sl) => onRemoveCard?.(id, sl)}
                    onOpenLightbox={setEditLightbox}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {checklist !== null && (
        <>
          <RulesBar checklist={checklist} open={sheetOpen} onToggle={() => setSheetOpen((open) => !open)} />
          <RulesChecklistSheet
            checklist={checklist}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onGoToCard={focusCardRow}
            tutorDeckId={tutorDeckId}
          />
        </>
      )}

      {editLightbox && (
        <CardLightbox
          imageUrl={editLightbox.imageUrl}
          sources={editLightbox.sources}
          name={editLightbox.name}
          onClose={() => setEditLightbox(null)}
        />
      )}
    </div>
  );
}

interface IPool {
  readonly deck: number;
  readonly inventory: number;
  /** Deck, inventory, weapons and equipment together; the hero does not count. */
  readonly cards: number;
  readonly limit: number;
}

/** The numbers of the inventory header, or null for a format the rules do not cover. */
function poolOf(draft: ICompositionDraft): IPool | null {
  if (!Object.prototype.hasOwnProperty.call(FORMAT_RULES, draft.format)) return null;
  const sum = (cards: readonly IDraftCard[], count: (card: IDraftCard) => number): number =>
    cards.reduce((total, card) => total + count(card), 0);
  const deckRows = draft.cards.filter((card) => card.slot === 'mainboard' || card.slot === 'other');
  const notHero = draft.cards.filter((card) => card.slot !== 'hero');
  return {
    deck: sum(deckRows, (card) => card.quantity),
    inventory: sum(draft.cards, inventoryOf),
    cards: sum(notHero, (card) => card.quantity + inventoryOf(card)),
    limit: FORMAT_RULES[draft.format as TSupportedFormat].maxCardPool,
  };
}
