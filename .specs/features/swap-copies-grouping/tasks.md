# Swap Copies Grouping Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/swap-copies-grouping/design.md`
**Status**: In Progress — Phase 1 done (T1 `eed37c6`, T2 `e21c9fc`, T3 `9b155c1`); Phase 2 next (T4, T5)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `~/.claude/rules/testing.md` (TDD, AAA, co-located tests), `apps/web/vitest.config.ts`, root `CLAUDE.md`, `.specs/STATE.md` AD-001. Existing samples: `ReviewsRow.test.tsx`, `ReviewsBulkBar.test.tsx`, `BreakdownSections.spec.tsx`, `SubstitutionRow.spec.tsx`, `swaps.test.tsx`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure helpers (`-swaps.helpers.ts`, `BreakdownSections.helpers.ts`, `api/reviews.ts` id helper) | unit | All branches; 1:1 to grouping ACs; every listed edge case (identical→merge, same-original/diff-substitute→separate, single→count 1, order preserved) | `apps/web/src/**/__tests__/*.test.ts(x)` | `pnpm --filter @rathe-arsenal/web test` |
| React components (`ReviewsRow`, `ReviewsRowList`, `ReviewsBulkBar`, `swaps.tsx`, `BreakdownSections`, `SubstitutionRow`) | unit (RTL) | AC-driven: badge when N>1, "all" labels/arias, single-op action, N=1 unchanged, counts/selection over groups | `apps/web/src/**/__tests__/*.{test,spec}.tsx` | `pnpm --filter @rathe-arsenal/web test` |
| i18n catalogs (`locales/{pt-BR,en-US}/{reviews,decks}.ts`) | none | Build/typecheck gate; exercised indirectly via component tests using `t()` (AD-001) | `apps/web/src/i18n/locales/**` | build gate only |
| CSS modules (`*.module.css`) | none | Build gate only | `apps/web/src/**/*.module.css` | build gate only |

**Provenance note:** Strong defaults applied for the helper layer (all branches + every spec edge case). Component depth follows existing `ReviewsRow.test.tsx` / `SubstitutionRow.spec.tsx` as the floor, raised to cover the new grouping ACs.

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Vitest unit/component | Yes | Per-file jsdom env; RTL cleanup in `src/test/setup.ts`; no shared DB/store; deps mocked | `apps/web/vitest.config.ts`, existing component tests run under vitest default isolation |

Note: `[P]` here is informational ordering only. Phase 1 tasks have code dependencies (sequential); Phase 2 is independent of Phase 1 but executed inline after it.

## Gate Check Commands

> Generated from codebase — confirm before Execute. All scoped to `apps/web`. Per the i18n handoff process lesson, **lint is included in every per-task gate** (a residual once surfaced only at a later build gate).

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (standard per-task) | After every task | `pnpm --filter @rathe-arsenal/web test && pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web lint` |
| Build | After each phase | same as Quick (web has no separate build-only test stage; visual/e2e are out of the deterministic gate) |

**Out of the deterministic gate (owner self-validation, per `docs/validation-philosophy.md`):** Playwright visual regression (`pnpm --filter @rathe-arsenal/web test:visual`) — the `× N` badge + grouped rows change the Swaps and deck-detail surfaces, so visual baselines will need a refresh (`test:visual:update`). Flagged, not blocking; owner runs/updates when convenient.

---

## Execution Plan

### Phase 1: Swaps surface (Sequential)

```
T1 → T2 → T3
```

### Phase 2: Deck-detail surface (Sequential, independent of Phase 1)

```
T4 → T5
```

Phase 2 shares no files with Phase 1 and could run in parallel; executed inline after Phase 1 for simplicity.

---

## Task Breakdown

### T1: Swaps grouping helper + grouped row identity

**What**: Add `groupReviewRows` + `IReviewRowGroup` and extend `makeReviewRowId` to include the substitute, so identical Swaps copies collapse to one group with a stable unique id.
**Where**: `apps/web/src/api/reviews.ts`, `apps/web/src/routes/_auth/-swaps.helpers.ts` (+ compile-only call-site updates in `ReviewsRowList.tsx`, `ReviewsRow.tsx`, `ReviewsBulkBar.tsx`)
**Depends on**: None
**Reuses**: existing `TReviewRowId` type; existing first-seen-order Map idiom in `deriveUniqueDecks`
**Requirement**: SWAPGRP-06 (foundation for SWAPGRP-01, 04, 15)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `makeReviewRowId(trackedDeckId, cardIdentifier, substituteIdentifier)` returns `` `${deckId}:${cardId}:${subId}` `` (still typed `` `${number}:${string}` ``)
- [ ] `IReviewRowGroup { row: IReviewRow; count: number }` exported
- [ ] `groupReviewRows(rows)` groups by `(trackedDeckId, cardIdentifier, substituteIdentifier)`, preserves first-seen order, `count` = merged rows, `row` = first occurrence
- [ ] The 3 existing `makeReviewRowId` call sites pass `substituteIdentifier`; build stays green (behavior unchanged at those sites)
- [ ] Unit tests cover: 2 identical → 1 group count 2; same original + different substitute → 2 groups; single entry → 1 group count 1; order preserved
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web test && ... typecheck && ... lint`
- [ ] Test count: existing web suite green + new helper tests (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(swaps): add review-row grouping helper + substitute-keyed row id`

---

### T2: ReviewsRow grouped UI + Swaps i18n keys

**What**: Give `ReviewsRow` an optional `count`; when `count > 1` show a `× N` badge and "all copies" approve/reject/reset labels + arias; `count <= 1` unchanged.
**Where**: `apps/web/src/components/reviews/ReviewsRow.tsx`, `ReviewsRow.module.css`, `apps/web/src/i18n/locales/pt-BR/reviews.ts`, `apps/web/src/i18n/locales/en-US/reviews.ts`
**Depends on**: T1 (3-arg `makeReviewRowId`)
**Reuses**: existing `×{quantity}` badge idiom; existing action handlers (emit one op); existing `t()` key style
**Requirement**: SWAPGRP-03, 05, 07, 08, 09, 10, 11, 12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `ReviewsRow` accepts `count?: number` (default 1); `rowId` uses 3-arg `makeReviewRowId`
- [ ] `count > 1`: `× N` badge rendered with accessible label; approve/reject/reset use localized "all" labels + arias
- [ ] `count === 1`: no badge; existing labels/arias unchanged
- [ ] New `reviews.*` keys added in BOTH pt-BR and en-US (no hardcoded literals — AD-001)
- [ ] `ReviewsRow.test.tsx` updated: badge present at N=2 / absent at N=1; "all" label at N=2; approve at N=2 calls `onAction` exactly once with `{ cardIdentifier: substituteIdentifier, decision: 'APPROVED' }`
- [ ] Gate passes: web test + typecheck + lint
- [ ] Test count: prior ReviewsRow tests green + new assertions (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(swaps): show copies badge + accept-all actions on grouped review row`

---

### T3: Swaps page, list and bulk bar over groups

**What**: Group once on the page; filter/count/select/render over groups; bulk bar emits one operation per selected group.
**Where**: `apps/web/src/routes/_auth/-swaps.helpers.ts` (`applyFilters`/`computeTabCounts` → groups), `apps/web/src/routes/_auth/swaps.tsx`, `apps/web/src/components/reviews/ReviewsRowList.tsx`, `apps/web/src/components/reviews/ReviewsBulkBar.tsx`
**Depends on**: T1 (helper + types), T2 (ReviewsRow `count` prop)
**Reuses**: existing filter predicate logic (retargeted to `group.row`); existing bulk cap logic
**Requirement**: SWAPGRP-01, 13, 14, 15, 16, 17

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `applyFilters(groups, search)` and `computeTabCounts(groups)` operate over groups (predicate reads `group.row.*`)
- [ ] `swaps.tsx` computes `allGroups` once; `filteredGroups` + `tabCounts` derive from groups; passes groups + `count` to list; passes groups to bulk bar; `totalRowCount = allGroups.length`
- [ ] `ReviewsRowList` iterates groups; `key`/id from grouped identity; aria-count uses group count; passes `row` + `count` to `ReviewsRow`
- [ ] `ReviewsBulkBar` accepts groups; `buildOperations` emits exactly one op per selected group keyed by `substituteIdentifier`
- [ ] Selecting one group never toggles a same-original/different-substitute group
- [ ] Tests updated: `swaps.test.tsx`, `reviews.test.tsx`, `ReviewsBulkBar.test.tsx`, `-swaps-state-transition-matrix.test.tsx` (as affected); group-shaped fixtures for `applyFilters`/`computeTabCounts`
- [ ] Gate passes: web test + typecheck + lint
- [ ] Test count: full web suite green (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(swaps): render and act on grouped review rows across page, list, bulk bar`

---

### T4: Deck-detail substituted-entry grouping helper

**What**: Add `groupSubstitutedEntries` + `ISubstitutedGroup` to collapse identical deck-detail substitution entries.
**Where**: `apps/web/src/components/deck-detail/BreakdownSections.helpers.ts` (new)
**Depends on**: None (independent of Phase 1)
**Reuses**: `ISubstitutedEntry` type from `api/deck-detail`; the `ReviewsFilters.helpers.ts` sibling-helper pattern
**Requirement**: SWAPGRP-06 (foundation for SWAPGRP-02, 04)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `ISubstitutedGroup { entry: ISubstitutedEntry; count: number }` exported
- [ ] `groupSubstitutedEntries(entries)` groups by `(original.cardIdentifier, original.slot, match.substitute.cardIdentifier)`, preserves order, `count` = merged, `entry` = first occurrence
- [ ] Unit tests: 2 identical → 1 group count 2; same original/slot + different substitute → 2 groups; single → count 1; order preserved
- [ ] Gate passes: web test + typecheck + lint
- [ ] Test count: existing suite green + new helper tests

**Tests**: unit · **Gate**: quick
**Commit**: `feat(decks): add substituted-entry grouping helper for deck detail`

---

### T5: BreakdownSections + SubstitutionRow grouped UI + decks i18n

**What**: Render one `SubstitutionRow` per group with a `× N` badge and "all copies" labels; section count reflects groups.
**Where**: `apps/web/src/components/deck-detail/BreakdownSections.tsx`, `apps/web/src/components/deck-detail/SubstitutionRow.tsx`, `SubstitutionRow.module.css`, `apps/web/src/i18n/locales/pt-BR/decks.ts`, `apps/web/src/i18n/locales/en-US/decks.ts`
**Depends on**: T4 (grouping helper)
**Reuses**: existing `×{quantity}` badge idiom in `BreakdownSections`; existing 3-state row + action handlers; `t()` key style
**Requirement**: SWAPGRP-02, 03, 05, 07, 08, 09, 10, 11, 12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `BreakdownSections` groups `breakdown.substituted` via `groupSubstitutedEntries`; `key` includes the substitute; passes `count`; "Swaps" section count = number of groups
- [ ] `SubstitutionRow` accepts `count?: number` (default 1); `count > 1` → `× N` badge + "all" labels/arias; `count <= 1` unchanged
- [ ] New `decks.*` keys added in BOTH pt-BR and en-US (AD-001)
- [ ] `BreakdownSections.spec.tsx` + `SubstitutionRow.spec.tsx` updated: one row per group; badge at N=2 / absent at N=1; "all" labels at N=2; approve calls `onApprove(substituteId)` once
- [ ] Gate passes: web test + typecheck + lint
- [ ] Test count: prior deck-detail tests green + new assertions (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(decks): group identical substitutions with copies badge + accept-all in deck detail`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (Sequential, independent of Phase 1):
  T4 ──→ T5
```

No `[P]` within phases — every task depends on its predecessor. Phases are mutually independent (disjoint files) but run inline in order.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Swaps grouping helper + id | 2 helper files + compile-only call-site touches | ✅ Cohesive (one deliverable: grouped identity) |
| T2: ReviewsRow UI + reviews i18n | 1 component + css + 2 locale files | ✅ Cohesive (one row's grouped UI) |
| T3: page/list/bulk over groups | 4 files, compile-coupled by groups prop | ✅ Cohesive (one integration; splitting breaks the build) |
| T4: deck-detail grouping helper | 1 new helper file | ✅ Granular |
| T5: BreakdownSections + SubstitutionRow + decks i18n | 2 components + css + 2 locale files | ✅ Cohesive (one surface's grouped UI) |

T3 spans 4 files by necessity: the `groups`/`rows` prop change couples the page, list, and bulk bar at compile time. Splitting would leave an intermediate red build, violating the per-task green gate.

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | (root of Phase 1) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1, T2 | T2 → T3 (T2 depends on T1, transitive) | ✅ Match |
| T4 | None | (root of Phase 2) | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Pure helpers + id helper | unit | unit | ✅ OK |
| T2 | React component + i18n (none) | unit (highest) | unit | ✅ OK |
| T3 | Helpers + React components | unit | unit | ✅ OK |
| T4 | Pure helper | unit | unit | ✅ OK |
| T5 | React components + i18n (none) | unit (highest) | unit | ✅ OK |

All tasks co-locate their tests; no deferral. i18n/CSS layers are "none" per matrix and are exercised through the component tests in the same task.
