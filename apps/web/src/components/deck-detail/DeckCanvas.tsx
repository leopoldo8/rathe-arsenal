/**
 * DeckCanvas — the composition-edit canvas of the deck detail page (`?edit=1`).
 *
 * View mode is DeckDetailView; this file keeps the edit body plus the slot
 * helpers it and its tests share.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardLightbox } from '../card-art/CardLightbox';
import { EditableCardRow } from './EditableCardRow';
import { HeroDropdown } from './HeroDropdown';
import { FormatDropdown } from './FormatDropdown';
import { CascadeWarningPanelBanner } from './CascadeWarningPanel';
import { DeckCardSearchAutocomplete } from '../deck-card-search/DeckCardSearchAutocomplete';
import type { ICompositionDraft, IDraftCard, TDraftSlot } from '../../hooks/useCompositionDraft';
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
  readonly onAddCard?: (card: ISearchCardResult) => void;
  readonly onUpdateQuantity?: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  readonly onRemoveCard?: (cardIdentifier: string, slot: TDraftSlot) => void;
  readonly onRemoveIllegalCards?: (ids: ReadonlySet<string>) => void;
  readonly onSetHero?: (heroIdentifier: string | null) => void;
  readonly onSetFormat?: (format: string) => void;
}

export function DeckCanvas(props: IDeckCanvasProps): React.ReactElement {
  return (
    <EditBody
      compositionDraft={props.compositionDraft}
      cascadeCheck={props.cascadeCheck}
      onAddCard={props.onAddCard}
      onUpdateQuantity={props.onUpdateQuantity}
      onRemoveCard={props.onRemoveCard}
      onRemoveIllegalCards={props.onRemoveIllegalCards}
      onSetHero={props.onSetHero}
      onSetFormat={props.onSetFormat}
    />
  );
}

// ---------------------------------------------------------------------------
// EditBody — implemented in U12
// ---------------------------------------------------------------------------

interface IEditBodyProps {
  readonly compositionDraft: ICompositionDraft | undefined;
  readonly cascadeCheck: ICascadeCheckResult | undefined;
  readonly onAddCard: ((card: ISearchCardResult) => void) | undefined;
  readonly onUpdateQuantity: ((cardIdentifier: string, slot: TDraftSlot, quantity: number) => void) | undefined;
  readonly onRemoveCard: ((cardIdentifier: string, slot: TDraftSlot) => void) | undefined;
  readonly onRemoveIllegalCards: ((ids: ReadonlySet<string>) => void) | undefined;
  readonly onSetHero: ((heroIdentifier: string | null) => void) | undefined;
  readonly onSetFormat: ((format: string) => void) | undefined;
}

/**
 * EditBody — the editable canvas for deck composition editing.
 *
 * Layout:
 *  Mobile (<1280px): hero → format → cascade banner → autocomplete → card list.
 *  Desktop (≥1280px): autocomplete at top + grouped editable rows by slot.
 *    Hero/format dropdowns live in the sidebar (hidden here via CSS).
 *
 * Both modes share the same <SlotGroup>-style grouping helper that ViewBody uses.
 */
function EditBody({
  compositionDraft,
  cascadeCheck,
  onAddCard,
  onUpdateQuantity,
  onRemoveCard,
  onRemoveIllegalCards,
  onSetHero,
  onSetFormat,
}: IEditBodyProps): React.ReactElement {
  const { t } = useTranslation();
  const autocompleteRef = React.useRef<HTMLInputElement>(null);
  const [editLightbox, setEditLightbox] = React.useState<{
    readonly imageUrl: string;
    readonly sources: readonly string[];
    readonly name: string;
  } | null>(null);

  // If no draft yet (shouldn't happen after U12 wiring, but guard gracefully)
  if (!compositionDraft || !cascadeCheck) {
    return (
      <div className={styles.editCanvas} data-testid="deck-canvas-edit">
        <p className={styles.editEmptyState}>{t('decks.loadingComposition')}</p>
      </div>
    );
  }

  // Group draft cards by slot (same helper as ViewBody uses)
  const ORDERED_SLOTS: TSlotGroup[] = ['mainboard', 'hero', 'weapon', 'equipment', 'other'];
  const slotGroups = new Map<TSlotGroup, IDraftCard[]>(
    ORDERED_SLOTS.map((g) => [g, []]),
  );
  for (const card of compositionDraft.cards) {
    const group = card.slot as TSlotGroup;
    slotGroups.get(group)!.push(card);
  }

  function handlePick(card: ISearchCardResult): void {
    onAddCard?.(card);
  }

  function handleRemoveIllegal(ids: ReadonlySet<string>): void {
    onRemoveIllegalCards?.(ids);
    // Focus autocomplete after removing illegal cards
    setTimeout(() => autocompleteRef.current?.focus(), 50);
  }

  const totalCards = compositionDraft.cards.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className={styles.editCanvas} data-testid="deck-canvas-edit">

      {/* ---- Mobile-only: Hero + Format dropdowns ---- */}
      {/* These show on mobile (<1280px) where the sidebar is hidden. */}
      {/* On desktop (≥1280px) they live in the sidebar instead. */}
      {onSetHero !== undefined && onSetFormat !== undefined && (
        <div className={styles.editMobileDropdowns} data-testid="edit-mobile-dropdowns">
          <HeroDropdown
            value={compositionDraft.heroIdentifier}
            onChange={onSetHero}
          />
          <FormatDropdown
            value={compositionDraft.format}
            onChange={onSetFormat}
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

      {/* ---- Editable card list — grouped by slot ---- */}
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
          {Array.from(slotGroups.entries()).map(([group, cards]) => {
            if (cards.length === 0) return null;
            const total = cards.reduce((s, c) => s + c.quantity, 0);
            return (
              <div
                key={group}
                className={styles.editSlotGroup}
                data-testid={`edit-slot-group-${group}`}
              >
                {/* Slot group header */}
                <div className={styles.editSlotGroupHeader}>
                  <SlotIcon group={group} />
                  <span className={styles.editSlotGroupName}>{group}</span>
                  <span className={styles.editSlotGroupCount}>{total}&times;</span>
                </div>

                {/* Editable card rows */}
                <ul className={styles.editCardList} aria-label={t('decks.slotGroupCardsAria', { group })}>
                  {cards.map((card) => (
                    <EditableCardRow
                      key={`${card.cardIdentifier}-${card.slot}`}
                      cardIdentifier={card.cardIdentifier}
                      name={card.name}
                      quantity={card.quantity}
                      slot={card.slot}
                      type={card.type}
                      imageUrl={card.imageUrl}
                      onQuantityChange={(id, sl, qty) => {
                        if (qty <= 0) {
                          onRemoveCard?.(id, sl);
                        } else {
                          onUpdateQuantity?.(id, sl, qty);
                        }
                      }}
                      onRemove={(id, sl) => onRemoveCard?.(id, sl)}
                      onOpenLightbox={setEditLightbox}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
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
