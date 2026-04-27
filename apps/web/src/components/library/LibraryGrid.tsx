import React, { useState } from 'react';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import { LibraryCardStepper } from './LibraryCardStepper';
import type { ILibraryCard } from '../../api/library';
import type { TGroupBy } from './LibraryFilterRail';
import styles from './LibraryGrid.module.css';

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
 * Picks the display type for grouping + the cell glyph.
 *
 * The FAB types catalog collapses Attack Actions and Non-Attack Actions
 * into a single `"Action"` top-level type, with the distinction living
 * in `subtypes`. That collapses two very different cards (a swing vs a
 * resource modifier) into one bucket, which the player doesn't think of
 * as the same group. We split them back out here so the grouping +
 * type-glyph affordances reflect how the cards are actually used.
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
 * Type groups that represent the arena (the play zone permanents the
 * player sets up at the start of the game) — listed last so the deck
 * cards (Actions, Reactions, etc.) appear first. The rule only kicks
 * in when grouping by type; for pitch/set the keys never match these
 * names so the comparator stays a no-op.
 */
const ARENA_TYPE_GROUPS = new Set(['Equipment', 'Hero', 'Token', 'Weapon']);

function compareGroupKeys(a: string, b: string): number {
  const aArena = ARENA_TYPE_GROUPS.has(a);
  const bArena = ARENA_TYPE_GROUPS.has(b);
  if (aArena !== bArena) return aArena ? 1 : -1;
  return a.localeCompare(b);
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

  const groupMap = new Map<string, ILibraryCard[]>();

  for (const card of cards) {
    let key: string;
    if (group === 'type') {
      key = primaryType(card.types, card.subtypes);
    } else if (group === 'pitch') {
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

  // Sort group keys deterministically. Arena type groups (Equipment,
  // Hero, Token, Weapon) get pushed to the end of the list so the deck
  // cards — which the player scans far more often — read first.
  return [...groupMap.entries()].sort(([a], [b]) => compareGroupKeys(a, b));
}

// ---------------------------------------------------------------------------
// Sub-component: single card cell
// ---------------------------------------------------------------------------

interface ILibraryCardCellProps {
  readonly card: ILibraryCard;
  readonly cardSize: number | undefined;
  readonly onOpenLightbox: (card: ILibraryCard) => void;
}

function LibraryCardCell({
  card,
  cardSize,
  onOpenLightbox,
}: ILibraryCardCellProps): React.ReactElement {
  const typeStr = primaryType(card.types, card.subtypes);
  const handleClick = card.imageUrl ? () => onOpenLightbox(card) : undefined;
  return (
    <li
      className={styles.cell}
      aria-label={`${card.name}, owned: ${card.ownedQuantity}`}
    >
      <LibraryCardStepper card={card} />
      <div className={styles.art}>
        <CardArt
          name={card.name}
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
        <span className={styles.name}>{card.name}</span>
        <span className={styles.qtyBadge} aria-label={`Owned: ${card.ownedQuantity}`}>
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
  const groups = groupCards(cards, group);

  const [lightbox, setLightbox] = useState<
    | {
        readonly imageUrl: string;
        readonly sources: readonly string[];
        readonly name: string;
      }
    | null
  >(null);

  function headingFor(key: string): string {
    if (group !== 'set') return key;
    const name = setNames?.[key];
    return name ? `${key} · ${name}` : key;
  }

  function openLightbox(card: ILibraryCard): void {
    if (!card.imageUrl) return;
    setLightbox({
      imageUrl: card.imageUrl.large,
      sources: lightboxSourcesFor(card.imageUrl),
      name: card.name,
    });
  }

  return (
    <div className={styles.container}>
      {groups.map(([groupKey, groupCards]) => (
        <section key={groupKey} className={styles.group}>
          {group !== 'flat' && (
            <h2 className={styles.groupHeading}>{headingFor(groupKey)}</h2>
          )}
          <ul
            className={styles.grid}
            aria-label={group !== 'flat' ? headingFor(groupKey) : 'Library cards'}
            style={
              cardSize !== undefined
                ? // Add 1rem to compensate for the cell's internal padding so
                  // the column track is always wider than the rendered card.
                  ({ '--cell-min': `calc(${cardSize}px + 1rem)` } as React.CSSProperties)
                : undefined
            }
          >
            {groupCards.map((card) => (
              <LibraryCardCell
                key={card.cardIdentifier}
                card={card}
                cardSize={cardSize}
                onOpenLightbox={openLightbox}
              />
            ))}
          </ul>
        </section>
      ))}
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
