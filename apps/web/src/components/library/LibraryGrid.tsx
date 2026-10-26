import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import { CARD_GROUP_LABEL_KEY, groupCardsByKind, type TCardGroupId } from '../../lib/card-groups';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import { LibraryCardStepper } from './LibraryCardStepper';
import { CardVersionsSheet } from '../collection-versions/CardVersionsSheet';
import type { ILibraryCard } from '../../api/library';
import type { TGroupBy } from './LibraryFilterRail';
import styles from './LibraryGrid.module.css';
import { setCssVar } from '../../lib/dom/setCssVar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ILibraryGridProps {
  readonly cards: readonly ILibraryCard[];
  readonly group: TGroupBy;
  /** Optional set-code → release-name map for prettier section headings. */
  readonly setNames?: Readonly<Record<string, string>>;
  /**
   * Card width in pixels for each grid cell. When omitted, falls back to the
   * 'sm' CardArt preset (72px) for backward compatibility with existing tests.
   */
  readonly cardSize?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TPitchLabel = 'Red' | 'Yellow' | 'Blue' | 'Colorless';

function pitchLabel(pitch: number | null): TPitchLabel {
  if (pitch === 1) return 'Red';
  if (pitch === 2) return 'Yellow';
  if (pitch === 3) return 'Blue';
  return 'Colorless';
}

function pitchValue(pitch: number | null): 1 | 2 | 3 | null {
  if (pitch === 1 || pitch === 2 || pitch === 3) return pitch;
  return null;
}

/**
 * Picks the display type for the cell glyph.
 *
 * The FAB types catalog collapses Attack Actions and Non-Attack Actions
 * into a single `"Action"` top-level type, with the distinction living
 * in `subtypes`. That collapses two very different cards (a swing vs a
 * resource modifier) into one bucket, which the player doesn't think of
 * as the same group. We split them back out here so the type glyph
 * reflects how the card is actually used.
 */
function primaryType(
  types: readonly string[],
  subtypes: readonly string[] = [],
): string {
  const top = types[0] ?? 'Other';
  if (top !== 'Action') return top;
  if (subtypes.includes('Attack')) return 'Attack Action';
  if (subtypes.includes('Non-Attack')) return 'Non-Attack Action';
  return 'Action';
}

function primarySet(sets: readonly string[]): string {
  return sets[0] ?? 'Unknown';
}

/**
 * Sorts cards by name for stable in-group order. The library API returns
 * rows in DB order, which can shift after a mutation (a decrement that
 * deletes a row reorders subsequent fetches). Sorting client-side by
 * `name` keeps each cell's position fixed regardless of quantity edits,
 * so a `−` click never makes the cell visually "drift" or appear to
 * disappear.
 */
function sortByName(cards: readonly ILibraryCard[]): ILibraryCard[] {
  return [...cards].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Groups cards by the requested dimension and returns an ordered list of
 * [groupKey, cards[]] pairs. Immutable — never mutates the input array.
 */
function groupCards(
  cards: readonly ILibraryCard[],
  group: TGroupBy,
): Array<[string, readonly ILibraryCard[]]> {
  if (group === 'flat') {
    return [['All cards', sortByName(cards)]];
  }

  if (group === 'type') {
    // The same rule as the deck page and the shared page, so one card reads under one heading everywhere.
    return groupCardsByKind(cards, (card) => ({ type: card.types[0] ?? '' })).map(
      ({ id, cards: members }): [string, readonly ILibraryCard[]] => [id, sortByName(members)],
    );
  }

  const groupMap = new Map<string, ILibraryCard[]>();

  for (const card of cards) {
    let key: string;
    if (group === 'pitch') {
      key = pitchLabel(card.pitch);
    } else {
      key = primarySet(card.sets);
    }

    const existing = groupMap.get(key);
    if (existing) {
      existing.push(card);
    } else {
      groupMap.set(key, [card]);
    }
  }

  // Sort each group's cards alphabetically — see `sortByName` rationale.
  for (const [key, list] of groupMap) {
    groupMap.set(key, sortByName(list));
  }

  return [...groupMap.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Sub-component: grid <ul> with optional --cell-min CSS var
// ---------------------------------------------------------------------------

interface ICardGridProps {
  readonly ariaLabel: string;
  readonly cardSize: number | undefined;
  readonly children: React.ReactNode;
}

function CardGrid({ ariaLabel, cardSize, children }: ICardGridProps): React.ReactElement {
  const gridRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setCssVar(
      gridRef.current,
      '--cell-min',
      // Add 1rem (≈16px) to compensate for the cell's internal padding so
      // the column track is always wider than the rendered card.
      cardSize !== undefined ? `calc(${cardSize}px + 1rem)` : null,
    );
  }, [cardSize]);

  return (
    <ul ref={gridRef} className={styles.grid} aria-label={ariaLabel}>
      {children}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single card cell
// ---------------------------------------------------------------------------

interface ILibraryCardCellProps {
  readonly card: ILibraryCard;
  readonly cardSize: number | undefined;
  readonly onOpenLightbox: (card: ILibraryCard) => void;
  readonly onOpenVersions: (card: ILibraryCard) => void;
}

function LibraryCardCell({
  card,
  cardSize,
  onOpenLightbox,
  onOpenVersions,
}: ILibraryCardCellProps): React.ReactElement {
  const { t } = useTranslation();
  const typeStr = primaryType(card.types, card.subtypes);
  const displayName = cardName(card.name, card.pitch, t);
  const handleClick = card.imageUrl ? () => onOpenLightbox(card) : undefined;
  return (
    <li
      className={styles.cell}
      aria-label={t('library.cardCellAriaLabel', { name: displayName, qty: card.ownedQuantity })}
    >
      <LibraryCardStepper card={card} />
      <div className={styles.art}>
        <CardArt
          name={displayName}
          pitch={pitchValue(card.pitch)}
          cost={null}
          type={typeStr}
          missing={false}
          size="sm"
          imageUrl={card.imageUrl}
          onClick={handleClick}
          widthOverride={cardSize}
        />
      </div>
      <div className={styles.meta}>
        <button type="button" className={styles.name} onClick={() => onOpenVersions(card)}>
          {displayName}
        </button>
        <span className={styles.qtyBadge} aria-label={t('library.ownedAriaLabel', { qty: card.ownedQuantity })}>
          ×{card.ownedQuantity}
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * LibraryGrid — renders the user's library as a grouped responsive grid.
 *
 * Groups are determined by the `group` prop (type | pitch | set | flat).
 * Client-side only; no refetch on group change.
 */
export function LibraryGrid({
  cards,
  group,
  setNames,
  cardSize,
}: ILibraryGridProps): React.ReactElement {
  const { t } = useTranslation();
  const groups = groupCards(cards, group);

  const [lightbox, setLightbox] = useState<
    | {
        readonly imageUrl: string;
        readonly sources: readonly string[];
        readonly name: string;
      }
    | null
  >(null);

  const pitchGroupLabels: Readonly<Record<string, string>> = {
    Red: t('library.pitchRedGroupLabel'),
    Yellow: t('library.pitchYellowGroupLabel'),
    Blue: t('library.pitchBlueGroupLabel'),
    Colorless: t('library.pitchColorlessGroupLabel'),
  };

  function headingFor(key: string): string {
    if (group === 'set') {
      if (key === 'Unknown') return t('library.setUnknownGroupLabel');
      const name = setNames?.[key];
      return name ? `${key} · ${name}` : key;
    }
    if (group === 'pitch') {
      return pitchGroupLabels[key] ?? key;
    }
    return t(CARD_GROUP_LABEL_KEY[key as TCardGroupId]);
  }

  const [versionsCard, setVersionsCard] = useState<ILibraryCard | null>(null);

  function openLightbox(card: ILibraryCard): void {
    if (!card.imageUrl) return;
    setLightbox({
      imageUrl: card.imageUrl.large,
      sources: lightboxSourcesFor(card.imageUrl),
      name: cardName(card.name, card.pitch, t),
    });
  }

  return (
    <div className={styles.container}>
      {groups.map(([groupKey, groupCards]) => (
        <section key={groupKey} className={styles.group}>
          {group !== 'flat' && (
            <h2 className={styles.groupHeading}>{headingFor(groupKey)}</h2>
          )}
          <CardGrid
            ariaLabel={group !== 'flat' ? headingFor(groupKey) : t('library.libraryCardsAriaLabel')}
            cardSize={cardSize}
          >
            {groupCards.map((card) => (
              <LibraryCardCell
                key={card.cardIdentifier}
                card={card}
                cardSize={cardSize}
                onOpenLightbox={openLightbox}
                onOpenVersions={setVersionsCard}
              />
            ))}
          </CardGrid>
        </section>
      ))}
      {versionsCard && (
        <CardVersionsSheet card={versionsCard} open onClose={() => setVersionsCard(null)} />
      )}
      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
