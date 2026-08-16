/**
 * Reconciles the engine's fresh substitution groups for a deck against the
 * persisted `swap_suggestion` rows for that deck (SWAP-01, SWAP-02).
 *
 * Pure function -- no database, no persistence -- so this, the highest-risk
 * logic in the redesign (AD-006), is unit-testable without a running
 * Postgres. The caller (`SwapsReconciliationService`) is the only piece
 * that talks to TypeORM: it groups the engine's `breakdown.substituted[]`
 * into `IFreshSwapGroup[]`, calls this function, and applies the returned
 * mutations inside whatever transaction triggered the recompute.
 *
 * See `.specs/features/product-redesign/design/07-swaps.md` §2 for the
 * full reconciliation rule this implements.
 */

export type TSwapSuggestionStatus = 'pending' | 'approved' | 'rejected' | 'retired';

export interface IPersistedSwapRow {
  readonly id: string;
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
  readonly status: TSwapSuggestionStatus;
}

export interface IFreshSwapGroup {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
  readonly quantity: number;
  readonly tier: 1 | 2;
  readonly confidence: number;
  readonly rationale: string;
}

export type TSwapMutation =
  | { readonly kind: 'insert'; readonly group: IFreshSwapGroup }
  | {
      readonly kind: 'update';
      readonly id: string;
      readonly group: IFreshSwapGroup;
      readonly unretire: boolean;
    }
  | { readonly kind: 'retire'; readonly id: string };
// No 'no-op' variant needed -- a persisted row with no matching fresh group
// whose (cardIdentifier, slot) is still in currentDeckSlots simply produces
// no mutation at all (the "substitute currently at zero owned" case), and
// neither does a `rejected` or already-`retired` row with no match.

function groupKey(row: {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
}): string {
  return `${row.cardIdentifier}::${row.slot}::${row.substituteIdentifier}`;
}

function deckSlotKey(row: { readonly cardIdentifier: string; readonly slot: string }): string {
  return `${row.cardIdentifier}::${row.slot}`;
}

export function reconcileSwapSuggestions(
  persistedRows: readonly IPersistedSwapRow[],
  freshGroups: readonly IFreshSwapGroup[],
  currentDeckSlots: ReadonlySet<string>,
): readonly TSwapMutation[] {
  const persistedByKey = new Map<string, IPersistedSwapRow>();
  for (const row of persistedRows) {
    persistedByKey.set(groupKey(row), row);
  }

  const matchedPersistedIds = new Set<string>();
  const mutations: TSwapMutation[] = [];

  for (const group of freshGroups) {
    const existing = persistedByKey.get(groupKey(group));

    if (!existing) {
      mutations.push({ kind: 'insert', group });
      continue;
    }

    matchedPersistedIds.add(existing.id);

    if (existing.status === 'rejected') {
      // By construction this should not occur -- a rejected pair is fed
      // into the engine's exclusion set, so it is never proposed again
      // while it stays rejected. If it somehow does, rejected rows are
      // left untouched by reconciliation; status only changes through an
      // explicit endpoint (approve/reject/revert/restore).
      continue;
    }

    if (existing.status === 'approved') {
      // Refresh display fields for accuracy, but never touch status --
      // approval is only undone by an explicit Reverter action.
      mutations.push({ kind: 'update', id: existing.id, group, unretire: false });
      continue;
    }

    // 'pending' or 'retired' -- refresh fields, and un-retire if needed.
    mutations.push({
      kind: 'update',
      id: existing.id,
      group,
      unretire: existing.status === 'retired',
    });
  }

  for (const row of persistedRows) {
    if (matchedPersistedIds.has(row.id)) continue;
    if (row.status === 'rejected' || row.status === 'retired') continue;

    // 'pending' or 'approved' with no matching fresh group this recompute.
    const stillInDeck = currentDeckSlots.has(deckSlotKey(row));
    if (stillInDeck) {
      // The position still exists -- the substitute's owned quantity
      // likely dropped to zero. Leave the row exactly as-is; it keeps
      // rendering with its last-known data. Live owned-count is a
      // read-time (GET /api/swaps) concern, not a reconciliation one.
      continue;
    }

    mutations.push({ kind: 'retire', id: row.id });
  }

  return mutations;
}
