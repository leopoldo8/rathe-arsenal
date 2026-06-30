# swap-copies-grouping Validation

**Date**: 2026-06-29 (re-verify iteration 2)
**Spec**: `.specs/features/swap-copies-grouping/spec.md`
**Diff range**: `origin/main..HEAD` (commits: `eed37c6`, `e21c9fc`, `9b155c1`, `a2df54a`, `eb4719b` — impl; `436e10a` — verifier v1; `3c21c38` — fix tests)
**Verifier**: independent sub-agent (author ≠ verifier), iteration 2 after fix commit `3c21c38`

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (groupReviewRows helper + makeReviewRowId) | ✅ Done | `-swaps.helpers.ts` + `api/reviews.ts` |
| T2 (ReviewsRow count prop + badges + all-labels) | ✅ Done | `ReviewsRow.tsx` |
| T3 (ReviewsRowList, ReviewsBulkBar, swaps.tsx wiring) | ✅ Done | All callers updated |
| T4 (groupSubstitutedEntries helper + BreakdownSections.helpers.ts) | ✅ Done | New helper file |
| T5 (SubstitutionRow count prop; BreakdownSections wiring) | ✅ Done | Both components updated |
| Fix (SWAPGRP-05 collapsed, 12, 14, 15 — test-only) | ✅ Done | `3c21c38` — 6 new tests |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| SWAPGRP-01: Swaps — identical copies → 1 row | exactly 1 group, count=2 | `-swaps.helpers.grouping.test.ts:51` — `expect(groups).toHaveLength(1); expect(groups[0]?.count).toBe(2)` | ✅ PASS |
| SWAPGRP-02: deck-detail — identical copies → 1 row | 1 `<li>` in swap list | `BreakdownSections.spec.tsx:339-340` — `expect(rows).toHaveLength(1)` | ✅ PASS |
| SWAPGRP-03: N>1 copies badge | "× N" badge rendered | `ReviewsRow.test.tsx:247-249` — `expect(screen.getByText('× 2')).toBeInTheDocument()`; also collapsed-state coverage at `ReviewsRow.test.tsx:370-376` | ✅ PASS |
| SWAPGRP-04: different substitute → separate rows (both surfaces) | 2 groups for same original + 2 different substitutes | `-swaps.helpers.grouping.test.ts:64-72`; `BreakdownSections.helpers.test.ts:104-118`; `BreakdownSections.spec.tsx:376-391` | ✅ PASS |
| SWAPGRP-05: N=1 → no badge, standard labels (Swaps — expanded/pending) | no badge for count=1 | `ReviewsRow.test.tsx:253-260` — `expect(screen.queryByText(/× \d+/)).not.toBeInTheDocument()`; `ReviewsRow.test.tsx:281-293` — standard aria label | ✅ PASS |
| SWAPGRP-05: N=1 → no badge in collapsed (decided) state | no badge for decided+count=1 row | `ReviewsRow.test.tsx:360-367` — `renderRow(makeRow({ decision: 'approved' }), { count: 1 }); expect(screen.queryByText(/× \d+/)).not.toBeInTheDocument()` (no expansion click — collapsed view) | ✅ PASS (previously surviving mutant M3a now killed) |
| SWAPGRP-05: N=1 → no badge (deck-detail) | no badge for count=1 | `SubstitutionRow.spec.tsx:253-258` — `expect(screen.queryByText(/× \d/)).not.toBeInTheDocument()` | ✅ PASS |
| SWAPGRP-06: unique React key/identity | key includes original + substitute | `ReviewsRow.test.tsx:230` — `expect(onToggleSelect).toHaveBeenCalledWith(makeReviewRowId(1, 'ARC012', 'ELE020'))` | ✅ PASS |
| SWAPGRP-07: approve → exactly 1 op keyed by substitute (Swaps) | `ops.length === 1`; `cardIdentifier = substituteIdentifier` | `ReviewsRow.test.tsx:301-315` — `expect(onAction).toHaveBeenCalledOnce(); expect(ops).toHaveLength(1); expect(ops![0]).toMatchObject({ cardIdentifier: 'ELE020', decision: 'APPROVED' })` | ✅ PASS |
| SWAPGRP-08: reject → exactly 1 op (Swaps) | `ops.length === 1`; `decision: 'REJECTED'` | `ReviewsRow.test.tsx:317-332` | ✅ PASS |
| SWAPGRP-09: reset → exactly 1 op (Swaps) | `ops.length === 1`; `reset: true` | `ReviewsRow.test.tsx:334-352` | ✅ PASS |
| SWAPGRP-10: N>1 → "all copies" action labels | aria includes "Aprovar todas as 2 cópias de ARC012" | `ReviewsRow.test.tsx:266-295` | ✅ PASS |
| SWAPGRP-11: N=1 → standard labels | standard aria, no "all" variant | `ReviewsRow.test.tsx:281-293` | ✅ PASS |
| SWAPGRP-12: grouped row state from single `(deck, substitute)` decision | row displays "Aprovado"/"Rejeitado" badge for decided grouped (count>1) row | `ReviewsRow.test.tsx:383-396` — `renderRow(makeRow({ decision: 'approved' }), { count: 2 }); expect(screen.getByText('Aprovado')).toBeInTheDocument()` and `renderRow(makeRow({ decision: 'rejected' }), { count: 2 }); expect(screen.getByText('Rejeitado')).toBeInTheDocument()` | ✅ PASS (previously spec-precision gap, now fully verified) |
| SWAPGRP-13: tab counts over groups | group with count=2 counts as 1 unit | `swaps.test.tsx:481-492` (original) + new `swaps.test.tsx:494-502` — `expect(counts.pending).toBe(1); expect(counts.all).toBe(2)` for fixture with 1 group count=2 + 1 group count=1 | ✅ PASS |
| SWAPGRP-14: list aria-count reflects grouped rows | `aria-label` uses `groups.length` (1), not raw row count (2) | `swaps.test.tsx:1155-1183` — `screen.getByRole('list', { name: /Avaliações de substituições — 1 itens/i })` for fixture of 2 identical rows | ✅ PASS (previously no evidence) |
| SWAPGRP-15: selection uniquely identifies group | toggling group A does not select group B | `swaps.test.tsx:1186-1216` — `await userEvent.click(checkboxes[0]!); expect(checkboxes[0]).toBeChecked(); expect(checkboxes[1]).not.toBeChecked()` for same-original/different-substitute fixture | ✅ PASS (previously spec-precision gap) |
| SWAPGRP-16: bulk action → 1 op per selected group | group with count=2 → `ops.length === 1` | `ReviewsBulkBar.test.tsx:228-243` | ✅ PASS |
| SWAPGRP-17: filters operate on groups | `applyFilters(groups, search)` — all filter dimensions | `swaps.test.tsx:286-447` | ✅ PASS |

**Status**: ✅ All 17 ACs covered with spec-anchored evidence

---

## Discrimination Sensor

### This iteration (re-verify)

| # | Mutation | File:line | Description | Killed? |
|---|----------|-----------|-------------|---------|
| A | M3a (re-run) | `ReviewsRow.tsx:223` | Flipped `count > 1` → `count >= 1` in collapsed badge render | ✅ Killed — `ReviewsRow.test.tsx:360-367` (new test from `3c21c38`) |
| B | groupReviewRows key drop | `-swaps.helpers.ts:40` | Dropped `substituteIdentifier` from key → `${trackedDeckId}:${cardIdentifier}` | ✅ Killed — 3 tests failed (`-swaps.helpers.grouping.test.ts`, `swaps.test.tsx`) |
| C | BulkBar APPROVED cardIdentifier | `ReviewsBulkBar.tsx:89` | Changed `cardIdentifier: row.substituteIdentifier` → `row.cardIdentifier` in APPROVED/REJECTED op | ✅ Killed — 5 tests failed |
| D | BulkBar RESET cardIdentifier | `ReviewsBulkBar.tsx:82` | Changed `cardIdentifier: row.substituteIdentifier` → `row.cardIdentifier` in RESET-only op | ⚠️ Survived — no test verifies `cardIdentifier` in RESET ops (tests only assert `reset: true`). Pre-existing gap not part of the 4 claimed fixes. |

**Sensor depth**: lightweight (4 mutations)
**Result**: 3/4 killed — ⚠️ 1 survivor (RESET-branch cardIdentifier, pre-existing, not part of fix commit)

**Tree state**: `git status` clean after all sensors. Only untracked `.agents/` and `apps/web/test-results/` visible.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| No features beyond what was asked | ✅ |
| Surgical changes — only required files modified | ✅ — `3c21c38` is test-only, no impl change |
| No scope creep | ✅ |
| Matches existing patterns/style | ✅ |
| Spec-anchored outcome check | ✅ — all 17 ACs now have `file:line` + assertion expression matching spec outcome |
| Per-layer Coverage Expectation | ✅ — domain helpers 1:1 with ACs; component layer covers expanded + collapsed branches |
| Every test maps to a spec requirement | ✅ |
| AD-001 i18n compliance | ✅ — `copiesBadge`, `approveAll`, `reviewsListAria` keys in both pt-BR and en-US; catalog-parity test passes |

---

## Edge Cases

- [x] Empty row set → existing empty states unchanged — `swaps.test.tsx:912-929`
- [x] Already-decided group + select → decided rows remain selectable
- [x] N>1 approve → exactly 1 op (not N) — `ReviewsBulkBar.test.tsx:228-243`
- [x] Single non-duplicated entry → group of count=1 — `-swaps.helpers.grouping.test.ts:89-101`
- [x] Same substitute / different originals → separate rows — `-swaps.helpers.grouping.test.ts:118-126`
- [x] Same original + different substitute → separate rows (SWAPGRP-04) — all surfaces

---

## Gate Check

- **Gate command**: `pnpm --filter @rathe-arsenal/web test && pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web lint`
- **Result**: 1393 passed, 1 skipped, 0 failed — exit 0
- **Typecheck**: clean (exit 0)
- **Lint**: clean (exit 0)
- **Test count before feature**: ~1387 (iteration 1)
- **Test count after fix**: 1393 — delta +6 tests (2 SWAPGRP-05 collapsed, 2 SWAPGRP-12, 1 SWAPGRP-14, 1 SWAPGRP-15)
- **Skipped tests**: 1 — `contrast.spec.ts:193` `describe.skip('borderline dark tokens — body-size failures documented as known')` — pre-existing, not modified in this branch (confirmed via `git log origin/main..HEAD -- apps/web/src/styles/__tests__/contrast.spec.ts` returning empty)
- **Failures**: none

---

## Fix Plans

### Minor: ReviewsBulkBar RESET-branch cardIdentifier not verified [MINOR]

- **Root cause**: `ReviewsBulkBar.test.tsx` RESET tests only assert `op.reset === true`; they don't assert `op.cardIdentifier === substituteIdentifier`. Mutation M-D (swapping `row.substituteIdentifier` → `row.cardIdentifier` in RESET branch) survived.
- **Implementation is correct** — line 82 uses `row.substituteIdentifier`.
- **Fix task**: Add `expect(ops![0]).toMatchObject({ cardIdentifier: 'SUB-ARC001', reset: true })` to the RESET test in `ReviewsBulkBar.test.tsx:162-169`.
- **Priority**: Minor (implementation correct; gap is test depth only; not a claimed fix from this iteration)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SWAPGRP-01 | ✅ Verified | ✅ Verified |
| SWAPGRP-02 | ✅ Verified | ✅ Verified |
| SWAPGRP-03 | ✅ Verified | ✅ Verified |
| SWAPGRP-04 | ✅ Verified | ✅ Verified |
| SWAPGRP-05 | ❌ Needs Fix (collapsed state untested; surviving mutant M3a) | ✅ Verified (M3a now killed by new test at `ReviewsRow.test.tsx:360-367`) |
| SWAPGRP-06 | ✅ Verified | ✅ Verified |
| SWAPGRP-07 | ✅ Verified | ✅ Verified |
| SWAPGRP-08 | ✅ Verified | ✅ Verified |
| SWAPGRP-09 | ✅ Verified | ✅ Verified |
| SWAPGRP-10 | ✅ Verified | ✅ Verified |
| SWAPGRP-11 | ✅ Verified | ✅ Verified |
| SWAPGRP-12 | ⚠️ Spec-precision gap | ✅ Verified (2 new tests at `ReviewsRow.test.tsx:383-396`) |
| SWAPGRP-13 | ✅ Verified | ✅ Verified |
| SWAPGRP-14 | ❌ Needs Fix (no test evidence) | ✅ Verified (new integration test at `swaps.test.tsx:1155-1183`) |
| SWAPGRP-15 | ⚠️ Spec-precision gap | ✅ Verified (new integration test at `swaps.test.tsx:1186-1216`) |
| SWAPGRP-16 | ✅ Verified | ✅ Verified |
| SWAPGRP-17 | ✅ Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (all 4 claimed fixes verified; one minor pre-existing weakness noted)

**Spec-anchored check**: 17/17 ACs matched spec outcome
**Sensor**: 3/4 mutations killed (Survivor D = pre-existing RESET cardIdentifier gap in BulkBar tests; not part of the 4 claimed fixes)
**Gate**: 1393 passed, 1 skipped (pre-existing), typecheck clean, lint clean

**What works**: All grouping (SWAPGRP-01–06); all action mechanics (SWAPGRP-07–11); grouped decision state (SWAPGRP-12 ✅ now); tab counts (SWAPGRP-13); list aria-count (SWAPGRP-14 ✅ now); unique selection (SWAPGRP-15 ✅ now); bulk ops (SWAPGRP-16); filters (SWAPGRP-17); i18n parity (AD-001).

**Minor follow-up**: Add `cardIdentifier` assertion to `ReviewsBulkBar` RESET test (`ReviewsBulkBar.test.tsx:162`) — implementation is correct, test is shallow for that branch.

**Next steps**: Feature is verified. Merge-ready. Optional follow-up: strengthen RESET-branch assertion in ReviewsBulkBar (minor, non-blocking).
