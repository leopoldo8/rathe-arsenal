import React from 'react';
import { CardArt } from '../card-art/CardArt';
import type { ILibraryCard } from '../../api/library';
import type { TGroupBy } from './LibraryFilters';
import styles from './LibraryGrid.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ILibraryGridProps {
  readonly cards: readonly ILibraryCard[];
  readonly group: TGroupBy;
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

function primaryType(types: readonly string[]): string {
  return types[0] ?? 'Other';
}

function primarySet(sets: readonly string[]): string {
  return sets[0] ?? 'Unknown';
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
    return [['All cards', cards]];
  }

  const groupMap = new Map<string, ILibraryCard[]>();

  for (const card of cards) {
    let key: string;
    if (group === 'type') {
      key = primaryType(card.types);
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

  // Sort group keys alphabetically for deterministic ordering.
  return [...groupMap.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Sub-component: single card cell
// ---------------------------------------------------------------------------

interface ILibraryCardCellProps {
  readonly card: ILibraryCard;
}

function LibraryCardCell({ card }: ILibraryCardCellProps): React.ReactElement {
  const typeStr = primaryType(card.types);
  return (
    <li
      className={styles.cell}
      aria-label={`${card.name}, owned: ${card.ownedQuantity}`}
    >
      <div className={styles.art}>
        <CardArt
          name={card.name}
          pitch={pitchValue(card.pitch)}
          cost={null}
          type={typeStr}
          missing={false}
          size="sm"
          imageUrl={card.imageUrl}
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
export function LibraryGrid({ cards, group }: ILibraryGridProps): React.ReactElement {
  const groups = groupCards(cards, group);

  return (
    <div className={styles.container}>
      {groups.map(([groupKey, groupCards]) => (
        <section key={groupKey} className={styles.group}>
          {group !== 'flat' && (
            <h2 className={styles.groupHeading}>{groupKey}</h2>
          )}
          <ul className={styles.grid} aria-label={group !== 'flat' ? groupKey : 'Library cards'}>
            {groupCards.map((card) => (
              <LibraryCardCell key={card.cardIdentifier} card={card} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
