# Swap Copies Grouping Specification

## Problem Statement

When a deck is missing 2+ copies of the same card, the readiness engine emits one
`substituted` entry per missing copy (`packages/engine/src/readiness/compute.ts`,
Pass 2 — `for (i = 0; i < missingQty; i++)`, each entry `quantity: 1`). This leaks
to the UI as multiple identical substitution rows stacked on top of each other, on
both the Swaps page (`/swaps`) and the deck-detail breakdown (`/decks/:id`). Today
those duplicates also share a React `key`, so the redundancy is paired with a latent
key collision. Users see the same suggestion repeated instead of one clear row that
says "this applies to N copies".

## Goals

- [ ] Render substitution suggestions that are truly identical (same original card AND
      same substitute card, in the same deck) as a single row carrying a copies count,
      on both the Swaps page and the deck-detail breakdown.
- [ ] Let the user accept / reject / reset the suggestion once, applying the decision to
      all copies in the group, with action affordances that communicate "all copies".
- [ ] Keep counts, selection, and React keys consistent with the grouped rows (no copy
      that maps to a colliding identity).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| True per-copy partial decisions (accept 1 of N, leave the rest pending across reloads) | The decision model is binary per `(userId, deckId, substituteIdentifier)` in `substitute_decision`; partial-per-copy is not representable without a backend schema change + engine cap logic + migration. Owner chose the frontend-only path this session. |
| Engine change to aggregate copies into one `quantity: N` entry | Root-cause fix lives in `packages/engine`; touches fidelity/notOwned math and persisted snapshots. Owner chose frontend-only; logged as future debt. |
| Backend change to carry `quantity` on `ISubstitutionRow` / `IBulkOperation` | Not needed — grouping is derived client-side from duplicate rows; the binary decision already covers all copies. |
| Changing how decisions persist or recompute readiness | The accept-all action reuses the existing single idempotent decision write; no persistence change. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Grouping key = identical original **and** substitute (Swaps: `trackedDeckId + cardIdentifier + substituteIdentifier`; deck-detail: `cardIdentifier + slot + substituteIdentifier`) | Group only rows that are truly identical | "Two identical substitutions" means same original AND same substitute. Copies that received different substitutes (engine consumes inventory between copies) are genuinely distinct suggestions and must stay separate. | y |
| "Accept 1 at a time" is dropped | Provide only "accept/reject/reset all copies" | Binary per-substitute decision means accepting "1 of N" and "N of N" persist the same state; a per-copy button would be misleading after reload. Owner confirmed frontend-only path. | y |
| All copies in a group share one decision state | Read the single decision keyed by the substitute and apply it to the whole group | Decision is keyed by `(deck, substitute)`; every copy in a group resolves to the same key, so they cannot diverge. | y |
| Action labels for N>1 communicate "all copies" | `Approve all` / `Reject all` / `Reset all` (localized) when N>1; unchanged labels when N=1 | Matches the owner's request for a button that accepts the change "para todas as copias". | y |
| Swaps tab counts and list aria-count reflect grouped rows, not raw copies | Count groups | Keeps the displayed number consistent with the rows the user sees after grouping. | y |
| Copies indicator visual = `× N` badge, reusing the existing `×{quantity}` pattern already present in deck-detail exact/not-owned sections | `× N` badge near the card pair | Visual consistency with existing breakdown sections; low-risk. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: See identical copies as one row ⭐ MVP

**User Story**: As a deck owner reviewing substitutions, I want copies of the same
missing card with the same suggested substitute collapsed into one row, so that I see
one clear suggestion instead of the same line repeated.

**Why P1**: This is the core pain — duplicate rows stacked on top of each other.

**Acceptance Criteria**:

1. WHEN a deck has multiple substitution entries that share the same original card AND
   the same substitute card THEN the system SHALL render exactly one row for that group
   on the Swaps page.
2. WHEN a deck has multiple substitution entries that share the same original card AND
   the same substitute card THEN the system SHALL render exactly one row for that group
   in the deck-detail breakdown.
3. WHEN a group represents N copies with N greater than 1 THEN the row SHALL display a
   copies indicator showing the count N (e.g. "× 2").
4. WHEN two substitution entries share the same original card but have DIFFERENT
   substitute cards THEN the system SHALL render them as two separate rows (not grouped).
5. WHEN a group represents exactly 1 copy THEN the row SHALL render with no copies
   indicator and with the standard (non-"all") action labels — visually identical to
   today's single row.
6. WHEN grouped rows are rendered THEN each row SHALL have a unique React key/identity
   derived from original + substitute (no key collision across copies or across
   same-original/different-substitute rows).

**Independent Test**: Unit-test the grouping helpers with a fixture containing 2 identical
entries + 1 same-original/different-substitute entry; assert 2 groups, counts `{2, 1}`.
Component-test that a group with N=2 renders one row with a "× 2" indicator.

---

### P1: Decide once for all copies ⭐ MVP

**User Story**: As a deck owner, I want to accept, reject, or reset a grouped suggestion
once and have it apply to every copy in the group, so that I don't repeat the same
decision N times.

**Why P1**: Without this, grouping would hide copies the user still has to act on.

**Acceptance Criteria**:

1. WHEN the user approves a grouped row THEN the system SHALL issue a single decision
   write keyed by the substitute identifier (`decision: APPROVED`) and the row SHALL
   reflect the approved state for the whole group.
2. WHEN the user rejects a grouped row THEN the system SHALL issue a single decision
   write keyed by the substitute identifier (`decision: REJECTED`) and the row SHALL
   reflect the rejected state for the whole group.
3. WHEN the user resets a decided grouped row THEN the system SHALL issue a single reset
   write keyed by the substitute identifier and the row SHALL return to pending.
4. WHEN a group has N greater than 1 copies THEN the approve / reject / reset affordances
   SHALL use labels (and aria-labels) that communicate the action affects all copies.
5. WHEN a group has exactly 1 copy THEN the approve / reject / reset affordances SHALL use
   the existing single-copy labels unchanged.
6. WHEN a grouped row reflects an existing decision THEN the row SHALL derive its state
   from the single decision keyed by `(deck, substitute)`, identical for every copy.

**Independent Test**: Component-test that clicking "Approve all" on a 2-copy group calls
the action handler exactly once with `{ cardIdentifier: substituteIdentifier, decision:
'APPROVED' }`. Assert label reads the "all" variant when N=2 and the plain variant when N=1.

---

### P1: Consistent counts and selection on Swaps ⭐ MVP

**User Story**: As a deck owner on the Swaps page, I want the tab counts and bulk
selection to match the grouped rows, so that the numbers and checkboxes line up with
what I see.

**Why P1**: Grouping the list while counting raw copies would show mismatched numbers and
break per-row selection (colliding ids select the wrong rows).

**Acceptance Criteria**:

1. WHEN the Swaps page computes tab counts (pending / approved / rejected / all) THEN the
   counts SHALL be computed over grouped rows (one unit per group).
2. WHEN the Swaps list renders its accessible count label THEN the label SHALL reflect the
   number of grouped rows shown.
3. WHEN the user selects a grouped row for bulk action THEN the selection SHALL uniquely
   identify that group (original + substitute) and SHALL NOT select any other group.
4. WHEN the user triggers a bulk action over selected grouped rows THEN each selected group
   SHALL contribute exactly one operation keyed by its substitute identifier.
5. WHEN filters (tier, deck, hero, confidence, state) are applied THEN they SHALL operate
   on grouped rows; because every copy in a group shares these attributes, the filtered
   result SHALL be equivalent to filtering then grouping.

**Independent Test**: Unit-test `computeTabCounts` over a grouped fixture returns group
counts. Component-test that toggling selection on one group does not toggle a
same-original/different-substitute group.

---

## Edge Cases

- WHEN the row set is empty THEN the system SHALL show the existing empty states unchanged
  (no-subs / all-reviewed / no-results).
- WHEN a group is already decided AND the user selects it THEN selection SHALL behave as
  today for a decided row (decided rows remain selectable).
- WHEN a group has N>1 and the user approves THEN the system SHALL emit exactly one
  idempotent operation (not N operations) for that substitute.
- WHEN grouping runs on a single non-duplicated entry THEN the output SHALL be one group of
  count 1 (grouping is a no-op for non-duplicates).
- WHEN the same substitute is suggested for two DIFFERENT original cards THEN those remain
  separate rows (distinct original) — grouping never merges across different originals.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SWAPGRP-01 | P1: See identical copies as one row (Swaps single row) | Design | ✅ Verified |
| SWAPGRP-02 | P1: See identical copies as one row (deck-detail single row) | Design | ✅ Verified |
| SWAPGRP-03 | P1: See identical copies as one row (copies indicator N>1) | Design | ✅ Verified |
| SWAPGRP-04 | P1: See identical copies as one row (different substitute → separate) | Design | ✅ Verified |
| SWAPGRP-05 | P1: See identical copies as one row (N=1 unchanged) | Design | ✅ Verified |
| SWAPGRP-06 | P1: See identical copies as one row (unique key/identity) | Design | ✅ Verified |
| SWAPGRP-07 | P1: Decide once for all copies (approve all) | Design | ✅ Verified |
| SWAPGRP-08 | P1: Decide once for all copies (reject all) | Design | ✅ Verified |
| SWAPGRP-09 | P1: Decide once for all copies (reset all) | Design | ✅ Verified |
| SWAPGRP-10 | P1: Decide once for all copies (labels communicate "all" when N>1) | Design | ✅ Verified |
| SWAPGRP-11 | P1: Decide once for all copies (N=1 labels unchanged) | Design | ✅ Verified |
| SWAPGRP-12 | P1: Decide once for all copies (state from single decision) | Design | ✅ Verified |
| SWAPGRP-13 | P1: Consistent counts (tab counts over groups) | Design | ✅ Verified |
| SWAPGRP-14 | P1: Consistent counts (list aria-count over groups) | Design | ✅ Verified |
| SWAPGRP-15 | P1: Consistent selection (unique group selection) | Design | ✅ Verified |
| SWAPGRP-16 | P1: Consistent selection (one operation per selected group) | Design | ✅ Verified |
| SWAPGRP-17 | P1: Consistent counts (filters operate on groups) | Design | ✅ Verified |

**ID format:** `SWAPGRP-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 17 total | 17 Verified

---

## Success Criteria

- [ ] No duplicate identical substitution rows on the Swaps page or the deck-detail
      breakdown — identical copies collapse to one row.
- [ ] A grouped row with N>1 copies shows a "× N" indicator and "all copies" action labels.
- [ ] Accept / reject / reset on a grouped row issues exactly one decision write and reflects
      the state for the whole group.
- [ ] Swaps tab counts, list aria-count, and selection are consistent with grouped rows.
- [ ] `apps/web` typecheck + lint + unit tests are green; new grouping helpers are unit-tested
      (including the same-original/different-substitute "do not group" case).
