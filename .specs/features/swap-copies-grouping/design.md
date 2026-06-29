# Swap Copies Grouping Design

**Spec**: `.specs/features/swap-copies-grouping/spec.md`
**Status**: Draft

---

## Architecture Overview

Frontend-only. The readiness engine emits one `substituted` entry per missing copy.
We collapse truly-identical entries (same original + same substitute) into a single
**group** in the UI layer, via pure helper functions, and render one row per group with
a `× N` copies indicator. The decision model is unchanged: a single idempotent decision
keyed by `(deck, substitute)` already covers every copy in a group, so accept/reject/reset
on a grouped row reuses the existing per-row action path verbatim — just emitted once.

Two independent surfaces, same pattern:

```mermaid
graph TD
    subgraph Swaps page (/swaps)
        Q[useReviewsQuery rows] --> G1[groupReviewRows -> IReviewRowGroup[]]
        G1 --> F1[applyFilters groups]
        G1 --> C1[computeTabCounts groups]
        F1 --> L1[ReviewsRowList]
        L1 --> R1[ReviewsRow row + count]
        G1 --> B1[ReviewsBulkBar groups]
    end
    subgraph Deck detail (/decks/:id)
        S[breakdown.substituted] --> G2[groupSubstitutedEntries -> ISubstitutedGroup[]]
        G2 --> BS[BreakdownSections]
        BS --> R2[SubstitutionRow entry + count]
    end
    R1 -->|approve/reject/reset once| ACT[onAction: 1 op keyed by substitute]
    R2 -->|approve/reject/reset once| ACT
```

**Chosen approach (A): group early in pure helpers.** Evaluated during brainstorming:
- **A — group early in pure helpers (CHOSEN).** Single source of truth; counts/selection/keys
  all derive from groups; matches the repo's helper + unit-test culture.
- **B — de-dupe only at render.** Smallest diff, but tab counts/aria still count raw copies
  (mismatch) and selection ids keep colliding. Rejected.
- **C — fix in the engine (`quantity: N`).** Root-cause fix, but changes fidelity/notOwned
  math and persisted snapshots; owner chose frontend-only. Rejected; logged as debt.

Owner confirmed A and frontend-only scope this session.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `-swaps.helpers.ts` | `apps/web/src/routes/_auth/-swaps.helpers.ts` | Add `groupReviewRows`; change `applyFilters`/`computeTabCounts` to operate on groups |
| `ReviewsRow` | `apps/web/src/components/reviews/ReviewsRow.tsx` | Add `count` prop; badge + "all" labels when `count > 1`; unchanged when `1` |
| `ReviewsRowList` | `apps/web/src/components/reviews/ReviewsRowList.tsx` | Iterate groups; pass `row` + `count`; key/id from grouped identity |
| `ReviewsBulkBar` | `apps/web/src/components/reviews/ReviewsBulkBar.tsx` | `buildOperations` over groups → one op per selected group |
| `makeReviewRowId` | `apps/web/src/api/reviews.ts` | Extend to include `substituteIdentifier` in the composite id |
| `BreakdownSections` | `apps/web/src/components/deck-detail/BreakdownSections.tsx` | Group `breakdown.substituted`; key includes substitute; section count = groups |
| `SubstitutionRow` | `apps/web/src/components/deck-detail/SubstitutionRow.tsx` | Add `count` prop; same badge + "all" labels pattern |
| `×{quantity}` badge pattern | `BreakdownSections.tsx:116,210` (`cardCell__qty`, `missRow__qty`) | Reuse the existing visual idiom for the copies indicator |
| `ReviewsFilters.helpers.ts` sibling pattern | `apps/web/src/components/reviews/` | Mirror for the new `BreakdownSections.helpers.ts` |
| i18next plural/interpolation | `apps/web/src/i18n/locales/{pt-BR,en-US}/{reviews,decks}.ts` | New keys for copies badge + "all" labels (AD-001 compliance) |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| `useBulkReviewsMutation` / `POST /reviews/bulk` | Unchanged — grouped row still emits one `IBulkOperation` keyed by `substituteIdentifier` |
| `useDecideSubstitutionMutation` (deck detail) | Unchanged — grouped `SubstitutionRow` calls `onApprove/onReject/onReset(substituteId)` once |
| `substitute_decision` table | Unchanged — binary decision per `(deck, substitute)` already covers all copies |

---

## Components

### `groupReviewRows` (new helper)

- **Purpose**: Collapse identical Swaps rows (same deck + original + substitute) into one group with a copy count.
- **Location**: `apps/web/src/routes/_auth/-swaps.helpers.ts`
- **Interfaces**:
  - `groupReviewRows(rows: readonly IReviewRow[]): readonly IReviewRowGroup[]` — preserves first-seen order; group key `` `${trackedDeckId}:${cardIdentifier}:${substituteIdentifier}` ``; `count` = number of merged rows; `row` = first occurrence (representative).
- **Dependencies**: `IReviewRow` from `api/reviews`.
- **Reuses**: nothing; pure function.

### `applyFilters` / `computeTabCounts` (changed signatures)

- **Purpose**: Filter and count over **groups** so the list, tab counts, and aria-count are consistent.
- **Location**: `apps/web/src/routes/_auth/-swaps.helpers.ts`
- **Interfaces**:
  - `applyFilters(groups: readonly IReviewRowGroup[], search: ISwapsSearch): readonly IReviewRowGroup[]` — predicate reads `group.row.*` (tier/deck/hero/confidence/state). Equivalent to filtering rows then grouping because copies share these attributes (SWAPGRP-17).
  - `computeTabCounts(groups: readonly IReviewRowGroup[]): { pending; approved; rejected; all }` — counts one unit per group via `group.row.decision`.
- **Dependencies**: `IReviewRowGroup`.
- **Reuses**: existing predicate logic, retargeted to `group.row`.

### `makeReviewRowId` (changed signature)

- **Purpose**: Unique composite id per group (and per row), eliminating the latent key collision.
- **Location**: `apps/web/src/api/reviews.ts`
- **Interfaces**:
  - `makeReviewRowId(trackedDeckId: number, cardIdentifier: string, substituteIdentifier: string): TReviewRowId` → `` `${trackedDeckId}:${cardIdentifier}:${substituteIdentifier}` `` (still matches `` `${number}:${string}` ``).
- **Dependencies**: none.
- **Reuses**: existing `TReviewRowId` type.
- **Callers to update**: `ReviewsRowList.tsx`, `ReviewsRow.tsx`, `ReviewsBulkBar.tsx`, and any test. (Grep `makeReviewRowId` before finishing.)

### `ReviewsRow` (changed)

- **Purpose**: Render one grouped Swaps row.
- **Location**: `apps/web/src/components/reviews/ReviewsRow.tsx`
- **Interfaces**: add `readonly count: number` to props. Behavior:
  - `count > 1`: show `× N` copies badge on the card pair; approve/reject/reset use the localized "all" labels + arias.
  - `count === 1`: identical to today (no badge, standard labels).
  - Compute `rowId = makeReviewRowId(row.trackedDeckId, row.cardIdentifier, row.substituteIdentifier)`.
- **Dependencies**: i18n keys; `ReviewsRow.module.css` (badge style).
- **Reuses**: existing render modes; action handlers unchanged (still emit one op).

### `ReviewsRowList` (changed)

- **Purpose**: Iterate groups instead of raw rows.
- **Location**: `apps/web/src/components/reviews/ReviewsRowList.tsx`
- **Interfaces**: `rows` prop becomes `groups: readonly IReviewRowGroup[]`; `key`/id from grouped identity; aria-count uses `groups.length`; pass `row={group.row} count={group.count}` to `ReviewsRow`.

### `ReviewsBulkBar` (changed)

- **Purpose**: One bulk operation per selected group.
- **Location**: `apps/web/src/components/reviews/ReviewsBulkBar.tsx`
- **Interfaces**: `rows` prop becomes `groups: readonly IReviewRowGroup[]`; `buildOperations` filters groups by grouped id and maps each selected group to a single `IBulkOperation` keyed by `group.row.substituteIdentifier`. Cap logic unchanged (now counts groups).

### `SwapsPage` (changed wiring)

- **Location**: `apps/web/src/routes/_auth/swaps.tsx`
- **Change**: `const allGroups = useMemo(() => groupReviewRows(allRows), [allRows])`; `filteredGroups = applyFilters(allGroups, search)`; `tabCounts = computeTabCounts(allGroups)`; pass `groups` to list + bulk bar; `totalRowCount = allGroups.length`. `deriveUniqueDecks`/`availableHeroes` stay on `allRows`.

### `groupSubstitutedEntries` (new helper)

- **Purpose**: Collapse identical deck-detail substituted entries into groups with a count.
- **Location**: `apps/web/src/components/deck-detail/BreakdownSections.helpers.ts` (new sibling, mirrors `ReviewsFilters.helpers.ts`).
- **Interfaces**:
  - `groupSubstitutedEntries(entries: readonly ISubstitutedEntry[]): readonly ISubstitutedGroup[]` — group key `` `${original.cardIdentifier}:${original.slot}:${match.substitute.cardIdentifier}` ``; `count` = merged entries; `entry` = first occurrence.
- **Dependencies**: `ISubstitutedEntry` from `api/deck-detail`.
- **Reuses**: nothing; pure function.

### `BreakdownSections` (changed)

- **Location**: `apps/web/src/components/deck-detail/BreakdownSections.tsx`
- **Change**: `const subGroups = groupSubstitutedEntries(breakdown.substituted)`; map groups; `key = ` `${original.cardIdentifier}-${original.slot}-${substituteId}` ``; pass `count={group.count}` to `SubstitutionRow`; the "Swaps" section count uses `subGroups.length` (rows shown).

### `SubstitutionRow` (changed)

- **Location**: `apps/web/src/components/deck-detail/SubstitutionRow.tsx`
- **Interfaces**: add `readonly count?: number` (default `1`). `count > 1` → `× N` badge on the card pair + "all" labels/arias; `count <= 1` → unchanged. Action handlers unchanged.
- **Dependencies**: i18n keys; `SubstitutionRow.module.css` (badge style).

---

## Data Models

```typescript
// -swaps.helpers.ts
export interface IReviewRowGroup {
  readonly row: IReviewRow;   // representative (first occurrence)
  readonly count: number;     // copies merged into this group (>= 1)
}

// BreakdownSections.helpers.ts
export interface ISubstitutedGroup {
  readonly entry: ISubstitutedEntry; // representative (first occurrence)
  readonly count: number;            // copies merged into this group (>= 1)
}
```

**Relationships**: Each group wraps a representative source object; `count` is the only
derived field. No persistence; ephemeral, recomputed from query/snapshot data per render.

---

## i18n Keys to Add (AD-001 compliance)

| Catalog | Keys |
| ------- | ---- |
| `reviews.ts` (pt-BR / en-US) | `copiesBadge` (`× {{count}}`), `copiesBadgeAria` (`{{count}} cópias` / `{{count}} copies`), `approveAll`, `rejectAll`, `resetAll`, `approveAllAria`, `rejectAllAria`, `resetAllAria` (interpolate `count` + `cardIdentifier`) |
| `decks.ts` (pt-BR / en-US) | `swapCopiesBadge` (`× {{count}}`), `swapCopiesBadgeAria`, `approveAllBtn`, `rejectAllBtn`, `resetAllBtn`, `approveAllSubstitutionAria`, `rejectAllSubstitutionAria`, `resetAllSubstitutionAria` (interpolate `count` + `original`/`substitute`) |

Exact PT-BR/EN-US copy finalized during implementation against the existing key style.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Bulk/decision mutation fails | Unchanged existing path (consolidated error toast + refetch) | Same as today |
| Empty / loading / error list states | Unchanged | Same as today |
| Group of count 1 | Helper returns a single-count group; row renders exactly as today | None |
| Same original, different substitute | Distinct group keys → separate rows | Correct, no false merge |

No new error surface is introduced — grouping is a pure read-side transform.

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | -------------------- | ------ | ---------- |
| `ReviewsBulkBar` hardcodes English UI strings (violates AD-001 i18n) | `ReviewsBulkBar.tsx:101,107,113,125,135,145,155` | Pre-existing untranslated UI; not introduced here | Out of scope; flag as a follow-up i18n task. This feature only edits `buildOperations` (groups), not the labels. |
| `makeReviewRowId` signature change ripples to all callers | `ReviewsRowList.tsx:115`, `ReviewsRow.tsx:59`, `ReviewsBulkBar.tsx:65` + tests | Compile error if a caller is missed | Dedicated task greps every caller; TS compiler is the backstop |
| Latent duplicate React `key` for copies exists today | `ReviewsRowList.tsx:115`, `BreakdownSections.tsx:146` | Pre-existing React warning / unstable reconciliation | This feature fixes it as a side effect (SWAPGRP-06): keys/ids now include the substitute |
| Engine still expands copies into per-copy entries (root cause) | `packages/engine/src/readiness/compute.ts:201-227` | Frontend masks it; any non-grouped consumer still sees duplicates | Logged to `docs/phase-1-followups.md` as debt; Out of Scope in spec; revisit if per-copy partial decisions are ever needed |
| `applyFilters`/`computeTabCounts` signature change breaks their unit tests | `apps/web/src/routes/_auth/__tests__/` (if present) | Test compile/break | Update those tests to group-shaped fixtures within the same task |

---

## Tech Decisions (non-obvious)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Where grouping happens | Pure helpers, applied once per surface before filter/count/render | Single source of truth; consistent counts/selection; unit-testable |
| Grouping identity | original **and** substitute (+ slot for deck-detail) | "Identical substitutions" = same original + same substitute; different substitutes are distinct suggestions |
| Per-copy partial accept | Dropped (frontend-only) | Binary `(deck, substitute)` decision can't represent "1 of N"; owner confirmed |
| `applyFilters`/`computeTabCounts` operate on groups | Change signatures rather than group twice | Avoids count/list mismatch; cleaner than re-grouping for counts |
| Deck-detail "Swaps" section count | Count groups (rows shown), not raw copies | Header number matches the rows the user sees |

> **Project-level decision** to append to `.specs/STATE.md` as **AD-005**: identical
> per-copy substitution suggestions are grouped in the UI; decisions stay binary per
> `(deck, substitute)` and apply to every copy; the engine's per-copy expansion is left
> in place intentionally. Recorded after design approval.
