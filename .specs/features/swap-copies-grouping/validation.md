# swap-copies-grouping Validation

**Date**: 2026-06-29
**Spec**: `.specs/features/swap-copies-grouping/spec.md`
**Diff range**: `436d8bb..HEAD` (implementation commits: `eed37c6`, `e21c9fc`, `9b155c1` — Swaps; `a2df54a`, `eb4719b` — deck-detail)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (groupReviewRows helper + makeReviewRowId) | ✅ Done | `-swaps.helpers.ts` + `api/reviews.ts` |
| T2 (ReviewsRow count prop + badges + all-labels) | ✅ Done | `ReviewsRow.tsx` |
| T3 (ReviewsRowList, ReviewsBulkBar, swaps.tsx wiring) | ✅ Done | All callers updated |
| T4 (groupSubstitutedEntries helper + BreakdownSections.helpers.ts) | ✅ Done | New helper file |
| T5 (SubstitutionRow count prop; BreakdownSections wiring) | ✅ Done | Both components updated |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| SWAPGRP-01: Swaps — identical copies → 1 row | exactly 1 group, count=2 | `-swaps.helpers.grouping.test.ts:51` — `expect(groups).toHaveLength(1); expect(groups[0]?.count).toBe(2)` | ✅ PASS |
| SWAPGRP-02: deck-detail — identical copies → 1 row | 1 `<li>` in swap list | `BreakdownSections.spec.tsx:339-340` — `expect(rows).toHaveLength(1)` | ✅ PASS |
| SWAPGRP-03: N>1 copies badge | "× N" badge rendered | `ReviewsRow.test.tsx:247-249` — `expect(screen.getByText('× 2')).toBeInTheDocument()`; `SubstitutionRow.spec.tsx:237-239` — `expect(screen.getByText('× 2')).toBeInTheDocument()` | ✅ PASS |
| SWAPGRP-04: different substitute → separate rows (both surfaces) | 2 groups for same original + 2 different substitutes | `-swaps.helpers.grouping.test.ts:64-72` — `expect(groups).toHaveLength(2)`; `BreakdownSections.helpers.test.ts:104-118` — `expect(groups).toHaveLength(2)`; `BreakdownSections.spec.tsx:376-391` — `expect(rows).toHaveLength(2)` | ✅ PASS |
| SWAPGRP-05: N=1 → no badge, standard labels (Swaps) | no badge; standard aria for count=1 | `ReviewsRow.test.tsx:253-260` — `expect(screen.queryByText(/× \d+/)).not.toBeInTheDocument()` (PENDING state only); `ReviewsRow.test.tsx:281-293` — standard aria label for count=1 | ⚠️ Partial — test covers PENDING (expanded) state only; collapsed (decided) view at `ReviewsRow.tsx:223` (`count > 1`) was mutated to `count >= 1` and SURVIVED (see sensor) |
| SWAPGRP-05: N=1 → no badge (deck-detail) | no badge for count=1 | `SubstitutionRow.spec.tsx:253-258` — `expect(screen.queryByText(/× \d/)).not.toBeInTheDocument()` | ✅ PASS |
| SWAPGRP-06: unique React key/identity | key includes original + substitute | `ReviewsRow.test.tsx:230` — `expect(onToggleSelect).toHaveBeenCalledWith(makeReviewRowId(1, 'ARC012', 'ELE020'))` (substituteIdentifier in key); `BreakdownSections.helpers.test.ts:120-134` (first-seen order verified across distinct groups) | ✅ PASS |
| SWAPGRP-07: approve → exactly 1 op keyed by substitute (Swaps) | `onAction` called once; `ops.length === 1`; `cardIdentifier = substituteIdentifier` | `ReviewsRow.test.tsx:301-315` — `expect(onAction).toHaveBeenCalledOnce(); expect(ops).toHaveLength(1); expect(ops![0]).toMatchObject({ cardIdentifier: 'ELE020', decision: 'APPROVED' })` | ✅ PASS |
| SWAPGRP-07: approve → 1 call with substituteId (deck-detail) | `onApprove` called once with substituteId | `SubstitutionRow.spec.tsx:302-314` — `expect(onApprove).toHaveBeenCalledTimes(1); expect(onApprove).toHaveBeenCalledWith('open-the-floodgates')`; also `BreakdownSections.spec.tsx:394-415` | ✅ PASS |
| SWAPGRP-08: reject → exactly 1 op (Swaps) | `ops.length === 1`; `decision: 'REJECTED'` | `ReviewsRow.test.tsx:317-332` — `expect(onAction).toHaveBeenCalledOnce(); expect(ops).toHaveLength(1); expect(ops![0]).toMatchObject({ cardIdentifier: 'ELE020', decision: 'REJECTED' })` | ✅ PASS |
| SWAPGRP-09: reset → exactly 1 op (Swaps) | `ops.length === 1`; `reset: true` | `ReviewsRow.test.tsx:334-352` — `expect(onAction).toHaveBeenCalledOnce(); expect(ops).toHaveLength(1); expect(ops![0]).toMatchObject({ reset: true })` | ✅ PASS |
| SWAPGRP-09: reset → 1 call (deck-detail) | `onReset` once with substituteId | `SubstitutionRow.spec.tsx:329-341` — `expect(onReset).toHaveBeenCalledTimes(1); expect(onReset).toHaveBeenCalledWith('open-the-floodgates')` | ✅ PASS |
| SWAPGRP-10: N>1 → "all copies" action labels | aria includes "Aprovar todas as 2 cópias de ARC012" | `ReviewsRow.test.tsx:266-295` — `expect(screen.getByRole('button', { name: /Aprovar todas as 2 cópias de ARC012/i })).toBeInTheDocument()`; `SubstitutionRow.spec.tsx:269-286` | ✅ PASS |
| SWAPGRP-11: N=1 → standard labels | standard aria, no "all" variant | `ReviewsRow.test.tsx:281-293` — standard aria; `queryByRole('button', { name: /Aprovar todas/i })` returns null; `SubstitutionRow.spec.tsx:289-299` | ✅ PASS |
| SWAPGRP-12: grouped row state from single `(deck, substitute)` decision | row displays same state as the single decision key | No test asserts this specifically for a grouped (count>1) row — decision-badge tests use count-1 rows (`ReviewsRow.test.tsx:134`, `SubstitutionRow.spec.tsx:134`) | ⚠️ Spec-precision gap |
| SWAPGRP-13: tab counts over groups | group with count=2 counts as 1 unit, not 2 | `swaps.test.tsx:481-492` — `expect(counts.pending).toBe(1); expect(counts.all).toBe(2)` for a fixture with 1 group of count=2 + 1 group of count=1 | ✅ PASS |
| SWAPGRP-14: list aria-count reflects grouped rows | `aria-label` uses `groups.length` | Implementation: `ReviewsRowList.tsx:112` uses `groups.length`. No test asserts aria-count = groups.length vs raw copy count | ❌ GAP — evidence-or-zero: no `file:line` citing a test that asserts the aria-count text reflects groups, not raw copies |
| SWAPGRP-15: selection uniquely identifies group | toggling group A does not select group B (same original, different substitute) | Implementation: composite ID `makeReviewRowId(deck, original, substitute)` ensures uniqueness. `ReviewsRow.test.tsx:226-231` verifies correct ID is passed to `onToggleSelect`. No integration test shows group-A check ≠ group-B check | ⚠️ Spec-precision gap |
| SWAPGRP-16: bulk action → 1 op per selected group | group with count=2 → `ops.length === 1` | `ReviewsBulkBar.test.tsx:228-243` — `expect(ops).toHaveLength(1); expect(ops![0]).toMatchObject({ cardIdentifier: 'SUB-ARC001', decision: 'APPROVED' })` | ✅ PASS |
| SWAPGRP-17: filters operate on groups | `applyFilters(groups, search)` — all filter dimensions work at group level | `swaps.test.tsx:286-447` — all `applyFilters` unit tests operate on `IReviewRowGroup[]` via `toGroups()` helper | ✅ PASS |

**Status**: ❌ Gaps present (SWAPGRP-14 uncovered; SWAPGRP-05 partial; SWAPGRP-12, 15 spec-precision gaps)

---

## Discrimination Sensor

| # | Mutation | File:line | Description | Killed? |
|---|----------|-----------|-------------|---------|
| 1 | M1 | `-swaps.helpers.ts:40` | Dropped `substituteIdentifier` from `groupReviewRows` key → `${trackedDeckId}:${cardIdentifier}` | ✅ Killed (2 tests failed in `-swaps.helpers.grouping.test.ts`) |
| 2 | M2 | `BreakdownSections.helpers.ts:42` | Dropped `substitute.cardIdentifier` from `groupSubstitutedEntries` key → `${originalId}:${slot}` | ✅ Killed (2 tests failed in `BreakdownSections.helpers.test.ts`) |
| 3a | M3a | `ReviewsRow.tsx:223` | Flipped `count > 1` → `count >= 1` in **collapsed** badge render | ❌ Survived — no test verifies collapsed (decided) row with count=1 shows no badge |
| 3b | M3b | `ReviewsRow.tsx:320` | Flipped `count > 1` → `count >= 1` in **expanded** badge render | ✅ Killed (2 tests failed in `ReviewsRow.test.tsx` — SWAPGRP-05 assertions) |

**Sensor depth**: lightweight (4 targeted mutations)
**Result**: 3/4 killed — ❌ FAIL (M3a survived)

**Tree state after sensor**: `git status` clean; all mutations fully restored.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| No features beyond what was asked | ✅ |
| Surgical changes — only required files modified | ✅ |
| No scope creep | ✅ |
| Matches existing patterns/style | ✅ — mirrors `ReviewsFilters.helpers.ts` pattern for new `BreakdownSections.helpers.ts` |
| Spec-anchored outcome check | ⚠️ — SWAPGRP-14 uncovered; SWAPGRP-05 collapsed-state badge not tested |
| Per-layer Coverage Expectation | ⚠️ — domain helpers 1:1 with ACs (good); component-layer missing collapsed-state badge + aria-count group test |
| Every test maps to a spec requirement | ✅ — all test descriptions cite SWAPGRP-NN or have clear rationale |
| AD-001 i18n compliance | ✅ — all new keys present in both `pt-BR` and `en-US`; catalog-parity test passes (1387/1387) |

---

## Edge Cases

- [x] Empty row set → existing empty states unchanged (no-subs / all-reviewed / no-results) — `swaps.test.tsx:912-929`
- [x] Already-decided group + select → decided rows remain selectable — existing behavior, no new path
- [x] N>1 approve → exactly 1 op (not N) — `ReviewsBulkBar.test.tsx:228-243`
- [x] Single non-duplicated entry → group of count=1 — `-swaps.helpers.grouping.test.ts:89-101`; `BreakdownSections.helpers.test.ts:77-88`
- [x] Same substitute / different originals → separate rows — `-swaps.helpers.grouping.test.ts:118-126`
- [x] Same original + different substitute → separate rows (SWAPGRP-04) — all surfaces

---

## Gate Check

- **Gate command**: `pnpm --filter @rathe-arsenal/web test && typecheck && lint`
- **Result**: 1387 passed, 1 skipped, 0 failed
- **Test count before feature** (cited in phase docs): ~1376 (Phase 1) → 1387 (Phase 2)
- **Test count after feature**: 1387 ✅ — delta matches expected new tests
- **Skipped tests**: 1 (pre-existing, unrelated to this feature)
- **Typecheck**: clean (exit 0)
- **Lint**: clean (exit 0)

---

## Fix Plans

### Fix 1: SWAPGRP-14 — Missing test for list aria-count over groups [MAJOR]

- **Root cause**: No test asserts that `ReviewsRowList`'s aria-label uses `groups.length` (not raw copy count). The implementation at `ReviewsRowList.tsx:112` is correct, but the test surface is missing.
- **Fix task**: Add a unit or integration test that renders `ReviewsRowList` (or the Swaps page) with a fixture of 2 identical raw rows (1 group with count=2) and asserts the list's `aria-label` contains `1` (not `2`).
  - Where: `apps/web/src/routes/_auth/__tests__/swaps.test.tsx` (integration) or a new `ReviewsRowList.test.tsx`
  - Verify: `screen.getByRole('list', { name: /1 substituição/i })` (or equivalent aria text)
  - Done when: Test fails if `ReviewsRowList` uses raw row count instead of `groups.length`
- **Priority**: Major (SWAPGRP-14 is P1)

### Fix 2: SWAPGRP-05 (collapsed) — Surviving mutant at `ReviewsRow.tsx:223` [MAJOR]

- **Root cause**: The `count > 1` guard on the copies badge in the collapsed (decided) view of `ReviewsRow` is not tested. Mutation `count > 1` → `count >= 1` at line 223 survived.
- **Fix task**: Add a test that renders `ReviewsRow` with `decision: 'approved'` (collapsed state) and `count: 1`, asserts no copies badge visible.
  - Where: `apps/web/src/components/reviews/__tests__/ReviewsRow.test.tsx`
  - Test: `renderRow(makeRow({ decision: 'approved' }), { count: 1 })` — verify `queryByText(/× \d+/)` returns null without clicking "Alterar decisão"
  - Done when: Test fails with the `>= 1` mutation, passes with original `> 1`
- **Priority**: Major (completes SWAPGRP-05 coverage; surviving mutant)

### Fix 3: SWAPGRP-12 spec-precision gap [MINOR]

- **Root cause**: No test exercises a grouped (count>1) row with an existing decision to verify the grouped row correctly derives its state from `row.decision`.
- **Fix task**: Add a test: `renderRow(makeRow({ decision: 'approved' }), { count: 2 })` in `ReviewsRow.test.tsx` — assert "Aprovado" badge is present in collapsed state (decision badge rendered). This proves the grouped row's decision state comes from the representative row's single decision.
- **Priority**: Minor (architecturally sound; gap is in test depth only)

### Fix 4: SWAPGRP-15 spec-precision gap [MINOR]

- **Root cause**: No integration test verifies that toggling group A's checkbox does not affect group B (same original, different substitute).
- **Fix task**: Add integration test in `swaps.test.tsx`: render 2 rows with same `cardIdentifier` but different `substituteIdentifier`; click first row's checkbox; assert second row's checkbox remains unchecked.
- **Priority**: Minor (selection mechanism is architecturally sound via composite ID; gap is test depth)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| SWAPGRP-01 | Pending | ✅ Verified |
| SWAPGRP-02 | Pending | ✅ Verified |
| SWAPGRP-03 | Pending | ✅ Verified |
| SWAPGRP-04 | Pending | ✅ Verified |
| SWAPGRP-05 | Pending | ❌ Needs Fix (collapsed state untested; surviving mutant) |
| SWAPGRP-06 | Pending | ✅ Verified |
| SWAPGRP-07 | Pending | ✅ Verified |
| SWAPGRP-08 | Pending | ✅ Verified |
| SWAPGRP-09 | Pending | ✅ Verified |
| SWAPGRP-10 | Pending | ✅ Verified |
| SWAPGRP-11 | Pending | ✅ Verified |
| SWAPGRP-12 | Pending | ⚠️ Spec-precision gap |
| SWAPGRP-13 | Pending | ✅ Verified |
| SWAPGRP-14 | Pending | ❌ Needs Fix (no test evidence) |
| SWAPGRP-15 | Pending | ⚠️ Spec-precision gap |
| SWAPGRP-16 | Pending | ✅ Verified |
| SWAPGRP-17 | Pending | ✅ Verified |

---

## Summary

**Overall**: ❌ Not Ready (2 fix tasks required)

**Spec-anchored check**: 13/17 ACs matched spec outcome | 2 spec-precision gaps (SWAPGRP-12, 15) | 1 uncovered (SWAPGRP-14) | 1 partial with surviving mutant (SWAPGRP-05)
**Sensor**: 3/4 mutations killed (M3a survived — collapsed badge count=1)
**Gate**: 1387 passed, typecheck clean, lint clean

**What works**: All grouping helpers (SWAPGRP-01-04, 06, SWAPGRP-13, 17); all action mechanics (SWAPGRP-07-11, SWAPGRP-16); i18n parity (AD-001); bulk bar one-op-per-group.

**Issues found**:
1. SWAPGRP-14: No test for list aria-count over groups → add integration test asserting `aria-label` uses group count.
2. SWAPGRP-05 (collapsed): Surviving mutant at `ReviewsRow.tsx:223` → add test for decided+collapsed row with count=1.
3. SWAPGRP-12 (minor): Add grouped-row decision-state test.
4. SWAPGRP-15 (minor): Add checkbox-isolation integration test.

**Next steps**: Route Fix 1 (SWAPGRP-14) and Fix 2 (SWAPGRP-05 collapsed) to an implementer as blockers; Fix 3 and Fix 4 as follow-ups. Re-verify after fixes.
