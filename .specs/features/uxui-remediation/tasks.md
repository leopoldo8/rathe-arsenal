# UX/UI Remediation — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow
its Execute flow and Critical Rules.** The skill is the source of truth for the per-task
cycle (implement → gate → atomic commit), sub-agent delegation (>3 phases → one worker per
phase, offer-then-confirm), and the always-on Verifier after the final task.

**If the skill cannot be activated, STOP and tell the user.**

**Design**: `.specs/features/uxui-remediation/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase + project guidelines + spec — confirm before Execute.
> Guidelines found: global `CLAUDE.md` (TDD, ≥80% intent, `.spec`/`.test` conventions) +
> `~/.claude/rules/testing.md`; actual web stack = `vitest` + `@testing-library/react` +
> `jsdom` (`apps/web/src/test/setup.ts`), visual = `@playwright/test`
> (`apps/web/tests/visual/all-surfaces.spec.ts`), config `apps/web/vitest.config.ts` /
> `playwright.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| React component / route behavior (focus, touch, ARIA, error/empty state, skeleton, SPA nav, i18n) | unit (DOM) | Each touched behavior maps 1:1 to its spec AC; all listed edge cases (reduced-motion, keyboard, pt-BR) covered | `apps/web/src/**/__tests__/*.{test,spec}.{ts,tsx}` | `pnpm --filter @rathe-arsenal/web test` |
| Hook (`useFocusTrap`) | unit | Trap cycles at both ends + focus restore + inactive no-op | `apps/web/src/hooks/__tests__/*.test.tsx` | `pnpm --filter @rathe-arsenal/web test` |
| Cross-cutting CSS/TSX invariants (bans, drift, focus-suppression) | unit (fs-read guard) | One assertion per invariant; covers ALL files in scope | `apps/web/src/styles/__tests__/design-guards.spec.ts` | `pnpm --filter @rathe-arsenal/web test` |
| Pure CSS token/motion/style fix with no DOM behavior | none (guard + visual cover it) | Locked by the guard test + visual snapshot | — | build gate + visual |
| Visual appearance (changed surfaces, repaired fixtures) | visual (playwright) | Re-baseline only intentionally-changed surfaces; fixtures capture the true surface | `apps/web/tests/visual/all-surfaces.spec.ts` + `__snapshots__/` | `pnpm --filter @rathe-arsenal/web test:visual` |

Provenance: per-component unit tests already exist under `__tests__/` (e.g.
`components/shell/__tests__/ThemeToggle.spec.tsx`); the guard spec is net-new (design.md).

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (DOM / hook / guard) | Yes | Per-test jsdom; `cleanup()` in `afterEach`, locale reset in `beforeEach`, no shared store | `apps/web/src/test/setup.ts` |
| visual (playwright) | No | Single dev server + shared seeded fixture; snapshot regen is sequential and stateful | `tests/visual/all-surfaces.spec.ts:183` (`beforeAll` shared sign-in), `:212` skip-without-server |

`[P]` on a task means: no inter-task dependency AND the two tasks edit **disjoint files**
(unit tests are parallel-safe, so file-disjointness is the binding constraint). Visual
tasks are never `[P]`.

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks with unit/DOM/guard tests only | `pnpm --filter @rathe-arsenal/web test` |
| Full | Tasks that change a visually-baselined surface | `pnpm --filter @rathe-arsenal/web test && pnpm --filter @rathe-arsenal/web test:visual` (needs dev server + DB) |
| Build | Phase completion / CSS-only / dead-code tasks | `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web lint && pnpm --filter @rathe-arsenal/web test` |

> Env note (from STATE.md i18n precedent): DB-backed playwright runs may only pass in CI.
> If local Postgres is unavailable, visual re-baseline (Phase 5) defers to CI; unit +
> typecheck + lint + guards remain the local gate. This is a known, documented limitation,
> not a skipped gate.

---

## Execution Plan

### Phase 0: Shared foundations
```
T1 [P]   T2 [P]
```

### Phase 1: P1 a11y + bans
```
T1 → T7
T2 → T9, T10
T3 [P] T4 [P] T5 [P] T6 [P] T8 [P]   (disjoint files)
```

### Phase 2: Structural
```
T11 → T12
```

### Phase 3: Hygiene
```
T13 [P] T14 [P] T15 [P] T16 [P] T17 [P]
```

### Phase 4: States + ARIA
```
T18 [P] T19 [P] T20 [P] T21 [P]
```

### Phase 5: Visual fixtures + re-baseline
```
T22 → T23 → T24
```

---

## Task Breakdown

### T1: Create `useFocusTrap` hook [P]
**What**: A reusable hook that traps Tab/Shift+Tab within a container and restores focus to the opener on deactivate.
**Where**: `apps/web/src/hooks/useFocusTrap.ts` (+ `__tests__/useFocusTrap.test.tsx`)
**Depends on**: None · **Reuses**: focusable-selector convention from the 3 dialogs · **Requirement**: UXUI-03
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [x] Hook records opener, focuses initial element, cycles Tab at both ends, restores focus on deactivate, no-ops when inactive
- [x] Unit tests cover: forward-cycle at last element, backward-cycle at first, restore-on-close, inactive no-op
- [x] Quick gate passes; test count recorded (1347 passed, 4 new)
**Status**: ✅ Complete · **Commit**: f694c21
**Tests**: unit · **Gate**: quick

### T2: Scaffold `design-guards.spec.ts` [P]
**What**: A vitest fs-read guard file with helpers (read all `apps/web/src/**` module/tsx files) + a passing meta-assertion; later tasks append one invariant each.
**Where**: `apps/web/src/styles/__tests__/design-guards.spec.ts`
**Depends on**: None · **Reuses**: node `fs`/`glob` already available to vitest · **Requirement**: UXUI-04/05/06/15 (foundation)
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [x] Helper enumerates target files; meta-assertion passes (e.g., "found >0 css modules")
- [x] Quick gate passes
**Status**: ✅ Complete · **Commit**: 2d9ecf0
**Tests**: unit · **Gate**: quick

### T3: Standardize focus-visible — suppression group
**What**: Convert `outline:none`-without-replacement controls to the canonical `:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px }` (+ `:focus:not(:focus-visible){outline:none}` where pointer-clean wanted).
**Where**: `routes/auth-form.module.css`, `routes/sign-in.module.css`, `components/onboarding/Step1PasteUrl.module.css`, `components/deck-card-search/DeckCardSearchAutocomplete.module.css`, `components/csv-sources/CsvSourceRow.module.css`, `components/csv-sources/DeleteSourceModal.module.css`, `components/library/LibrarySearchAddBar.module.css`, `components/delete-account-modal.module.css`, `components/substitution-row.module.css` (+ representative `__tests__`)
**Depends on**: T2 · **Reuses**: `Button.module.css` canonical ring; `global.css:39-42` · **Requirement**: UXUI-01
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] All listed modules use the canonical `:focus-visible`; no bare `:focus` ring; no `outline:none` without sibling replacement
- [ ] Append focus-suppression guard assertion to `design-guards.spec.ts` (passes)
- [ ] DOM tests assert the focus-ring declaration on ≥2 representative controls (auth input, csv switch)
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T4: Standardize focus-visible — wrong-color group [P]
**What**: Replace non-accent focus rings (`--ra-border-strong`, `--ra-ready-low`) with `var(--ra-accent)` on modal/destructive controls.
**Where**: `components/deck-detail/SaveCascadeConfirmModal.module.css`, `DraftRestoreModal.module.css`, `CascadeWarningPanel.module.css`, `LegalityBadge.module.css`, `DiscardChangesConfirm.module.css`, `routes/_auth/settings.module.css`, `components/delete-account-modal.module.css` (focus rules only)
**Depends on**: T2 · **Reuses**: canonical ring · **Requirement**: UXUI-01
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] All listed focus rings use `var(--ra-accent)`
- [ ] DOM test asserts accent ring on a representative destructive button
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T5: Touch targets ≥44 — shell/home/library/add-cards/variant [P]
**What**: Raise sub-44px hit areas to ≥44 (size or padding + `box-sizing:content-box`).
**Where**: `routes/auth-form.module.css` (ghostBtn), `components/home/StatusShelves.module.css` (retired toggle), `components/home/DeckCard.module.css` (untrack pin), `components/library/LibraryCardStepper.module.css`, `components/library/LibraryFilterRail.module.css` (drawer variant controls), `components/variant-queue/VariantQueuePill.module.css`, `VariantQueueDrawer.module.css` (close), `components/shell/UserMenu.module.css` (+ representative `__tests__`)
**Depends on**: None · **Reuses**: `Button` 44px floor · **Requirement**: UXUI-02
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Each listed control's computed hit area ≥44×44; no comment claiming 44 with smaller math
- [ ] DOM tests assert ≥44px on ≥2 representatives (stepper, variant pill)
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T6: Touch targets ≥44 — deck-detail + mark-owned adopts Button [P]
**What**: Raise deck-detail control hit areas; refactor `mark-owned-button` to use the `Button` primitive (gains 44px + canonical focus + `type="button"`).
**Where**: `components/deck-detail/SubstitutionRow.module.css`, `EditableCardRow.module.css`, `TagChipRow.module.css`, `components/mark-owned-button.tsx` (+ `.module.css`), `components/deck-detail/MarkOwnedButton.module.css` (+ `__tests__`)
**Depends on**: None · **Reuses**: `components/ui/Button` · **Requirement**: UXUI-02
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Substitution/stepper/tag-remove ≥44px; `mark-owned-button` renders via `Button` with `type="button"`
- [ ] DOM test asserts `mark-owned-button` has `type="button"` + ≥44px
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T7: Focus-trap + restore in the 3 custom dialogs
**What**: Apply `useFocusTrap` to confine + restore focus in CardLightbox, VariantQueueDrawer, LibraryFilterDrawer.
**Where**: `components/card-art/CardLightbox.tsx`, `components/variant-queue/VariantQueueDrawer.tsx`, `components/library/LibraryFilterDrawer.tsx` (+ `__tests__`)
**Depends on**: T1 · **Reuses**: `useFocusTrap` · **Requirement**: UXUI-03
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Tab at the last focusable cycles to first inside each dialog; focus returns to opener on close
- [ ] DOM tests per dialog: trap cycle + restore
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T8: CascadeWarningPanel banner → native button [P]
**What**: Replace `div[role=button]` collapsible header with a native `<button>`.
**Where**: `components/deck-detail/CascadeWarningPanel.tsx` (+ `__tests__`)
**Depends on**: None · **Reuses**: native button semantics · **Requirement**: UXUI-03
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Header is a `<button type="button">` carrying `aria-expanded`/`aria-controls`; manual keydown removed
- [ ] DOM test asserts button role + expand toggle
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T9: Remove banned side-stripes
**What**: Eliminate `border-left/right>1px` colored stripes + the auth `.errorStripe` span; fix the auth error to the `--ra-ready-low-*` family.
**Where**: `routes/_auth/decks.$deckId.module.css` (Path C), `components/path-c-result.module.css`, `components/TestDeckResult.module.css`, `components/auth-layout/AuthLayout.tsx` (+ `.module.css`) (+ `__tests__`)
**Depends on**: T2 · **Reuses**: perimeter border + bg wash pattern · **Requirement**: UXUI-04
**Tools**: MCP NONE · Skill `impeccable:polish` (optional, for the replacement treatment)
**Done when**:
- [ ] No banned stripe remains; auth error uses error tokens, not brass; `.errorStripe` span removed
- [ ] Side-stripe guard assertion appended to `design-guards.spec.ts` (passes; chevron excluded)
- [ ] DOM test asserts auth error uses error-family class
- [ ] Full gate (visual re-baseline of Path C + auth-error surfaces) — defer visual to CI if no DB
**Tests**: unit (+ visual) · **Gate**: full

### T10: Wordmark solid brass [P]
**What**: Replace `.brandRathe` gradient-clip text with solid `var(--ra-accent)` fill; drop stale `#d69e2e`.
**Where**: `components/shell/TopBar.module.css` (+ `components/shell/__tests__/TopBar.spec.tsx`)
**Depends on**: T2 · **Reuses**: `--ra-accent`, `text-shadow` · **Requirement**: UXUI-05 (D2)
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] No `background-clip:text` in TopBar; wordmark uses `var(--ra-accent)`
- [ ] Gradient-text guard assertion appended to `design-guards.spec.ts` (passes)
- [ ] Full gate (visual re-baseline TopBar) — defer visual to CI if no DB
**Tests**: unit (+ visual) · **Gate**: full

### T11: Mount ReadinessHero as deck-detail canvas focal point
**What**: Render `ReadinessHero` full-width atop the canvas; remove the duplicate readiness block from `DeckDetailSidebar`; sub-labels use `--ra-fg-secondary`.
**Where**: `routes/_auth/decks.$deckId.tsx`, `components/deck-detail/DeckDetailLayout.tsx`, `DeckDetailSidebar.tsx` (+ `.module.css`) (+ `__tests__`)
**Depends on**: None · **Reuses**: `ReadinessHero` (existing) · **Requirement**: UXUI-14 (D1)
**Tools**: MCP NONE · Skill `impeccable:layout` (optional, for the canvas banner placement)
**Done when**:
- [ ] Populated deck-detail renders ReadinessHero in the canvas; exactly one hero-scale `.ra-readiness-display`; sidebar duplicate removed; sub-labels `--ra-fg-secondary`
- [ ] DOM test asserts hero renders in canvas region + single instance; update prior sidebar-readiness tests to the new structure
- [ ] Full gate (visual — covered by T23 fixture repair) — defer visual to CI if no DB
**Tests**: unit (+ visual) · **Gate**: full

### T12: Remove dead code
**What**: Delete the 3 unused components + dead 3-col CSS, after grep-confirming no static/dynamic refs.
**Where**: delete `components/readiness-header.tsx` (+css), `components/tracked-deck-card.tsx` (+css), `components/home/ReadinessShelves.tsx` (+css); trim `routes/_auth/decks.$deckId.module.css:5-68`
**Depends on**: T11 · **Reuses**: — · **Requirement**: UXUI-11
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] grep confirms zero imports (static + dynamic string) before deletion
- [ ] Files removed; dead CSS trimmed
- [ ] Build gate passes (typecheck + lint + tests)
**Tests**: none (build gate) · **Gate**: build

### T13: Token drift sweep [P]
**What**: Replace raw `#d69e2e`/`rgba(214,158,46,*)` + `#38a169` + `0.65rem` with tokens.
**Where**: `components/shell/TopBar.module.css` (divider), `components/shell/DeckboxDecoration.tsx`, `components/home/DeckCard.tsx` (+`.module.css`), `components/card-art/CardLightbox.module.css`, `components/csv-sources/SumExplainer.module.css` (+ representative `__tests__` where DOM-observable)
**Depends on**: T2 · **Reuses**: `--ra-accent`, `--ra-ready-high`, `--ra-text-caption`, `color-mix` · **Requirement**: UXUI-06
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] No raw `#d69e2e`/`#38a169` in `apps/web/src`; SVGs use `currentColor`+`color:var(--ra-accent)`
- [ ] Stale-hex guard assertion appended to `design-guards.spec.ts` (passes)
- [ ] Full gate (visual re-baseline DeckCard/TopBar/lightbox surfaces) — defer visual to CI if no DB
**Tests**: unit (guard) (+ visual) · **Gate**: full

### T14: Close i18n leaks [P]
**What**: Route SumExplainer strings, add-cards pitch labels, and substitution-row "Tier" through `t()` with keys in both locales.
**Where**: `components/csv-sources/SumExplainer.tsx`, `routes/_auth/add-cards.manual.tsx`, `components/substitution-row.tsx`, `i18n/locales/{en-US,pt-BR}/*` (+ `__tests__`)
**Depends on**: None · **Reuses**: `t()` per AD-001 · **Requirement**: UXUI-08
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] No hardcoded user-facing literal in the 3 components; keys present in both locales
- [ ] DOM tests render under pt-BR and assert localized text (no English leak)
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T15: Reduced-motion for transform animations [P]
**What**: Add per-component `prefers-reduced-motion: reduce` overrides for transform motion.
**Where**: `components/csv-sources/CsvSourceRow.module.css`, `routes/_auth/add-cards.module.css`
**Depends on**: None · **Reuses**: global reduce baseline pattern · **Requirement**: UXUI-09
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Each file defines a reduce override collapsing its transform (dropIn / `.method:hover`)
- [ ] Guard/CSS assertion in `design-guards.spec.ts` confirms the reduce block exists
- [ ] Build gate passes
**Tests**: unit (guard) · **Gate**: build

### T16: SPA `<Link>` in EducationalEmptyState [P]
**What**: Replace 3 bare `<a href="/...">` with TanStack `<Link>`.
**Where**: `components/home/EducationalEmptyState.tsx` (+ `__tests__`)
**Depends on**: None · **Reuses**: `@tanstack/react-router` `Link` · **Requirement**: UXUI-12
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] All 3 CTAs render `Link` (router-managed), no bare `<a href>`
- [ ] DOM test asserts router Link usage
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T17: Signature & typography discipline [P]
**What**: add-cards numerals → `--ra-font-display` (drop glow); CardLightbox caption → `var(--ra-font-display)`.
**Where**: `routes/_auth/add-cards.module.css` (+ subview numeral css), `components/card-art/CardLightbox.module.css`
**Depends on**: None · **Reuses**: `--ra-font-display` · **Requirement**: UXUI-17 (D4)
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Numerals use display font, no glow; caption uses the font token; ornament font reserved to `.ra-readiness-display`
- [ ] Guard/CSS assertion confirms numerals not using `--ra-font-ornament`
- [ ] Build gate passes
**Tests**: unit (guard) · **Gate**: build

### T18: Skeleton ↔ loaded parity [P]
**What**: Reshape home + deck-detail skeletons to match their loaded layouts.
**Where**: `routes/_auth/home.tsx` (skeleton block), `components/deck-detail/DeckDetailSkeleton.module.css` (+ `__tests__`)
**Depends on**: None · **Reuses**: `aspect-ratio` from DeckCard; `DeckDetailLayout` breakpoints · **Requirement**: UXUI-07
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Home skeleton card uses `aspect-ratio:200/240`; deck-detail skeleton grid matches layout breakpoints (single-col <1280, `280px 1fr` ≥1280)
- [ ] DOM tests assert skeleton container shape/grid at a breakpoint
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T19: Error states look like errors [P]
**What**: verify-email error → error container + recovery link; Fabrary/CSV import error callouts → danger tokens.
**Where**: `routes/verify-email.tsx`, `routes/auth-form.module.css` (error container), `components/decks-new/ImportFabraryCard.module.css`, `routes/_auth/add-cards.fabrary.module.css`, `add-cards.csv.module.css` (+ `__tests__`)
**Depends on**: None · **Reuses**: `--ra-ready-low-*` family · **Requirement**: UXUI-10
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] verify-email error uses error styling + a recovery action; import callouts use danger border/bg
- [ ] DOM test asserts error container carries danger-family class
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T20: Custom-control ARIA correctness [P]
**What**: Fix the 5 ARIA issues (ReviewsFilters aria-pressed→expanded; Step3 decision buttons; deck-card-search aria-owns; CardArt inner svg aria-hidden; ReviewsBulkBar pre-mounted live region).
**Where**: `components/reviews/ReviewsFilters.tsx`, `components/onboarding/Step3FirstReview.tsx`, `components/deck-card-search/DeckCardSearchAutocomplete.tsx`, `components/card-art/CardArt.tsx`, `components/reviews/ReviewsBulkBar.tsx` (+ `__tests__`)
**Depends on**: None · **Reuses**: Radix-managed `aria-expanded` · **Requirement**: UXUI-13
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Each control's ARIA corrected per the spec ACs (no conflicting `aria-pressed`; no `aria-owns`; svg aria-hidden in button; live region pre-mounted)
- [ ] DOM tests assert the corrected attributes on each of the 5 controls
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T21: Replace native confirm with undo-toast (untrack)
**What**: Optimistic untrack + undo toast in DeckCard; remove `window.confirm`.
**Where**: `components/home/DeckCard.tsx` (+ `__tests__`); uses `useToast`
**Depends on**: T12 (removes the other `window.confirm` carrier) · **Reuses**: `ToastProvider`/`useToast` · **Requirement**: UXUI-15
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Untrack uses optimistic remove + undo toast; no `window.confirm` in non-test code
- [ ] `window.confirm` guard assertion appended to `design-guards.spec.ts` (passes)
- [ ] DOM test covers untrack → toast → undo restores; prior `window.confirm` test updated to the new flow
- [ ] Quick gate passes
**Tests**: unit · **Gate**: quick

### T22: Repair onboarding visual fixture
**What**: Make the onboarding visual test render the 3-step wizard (zero-deck/stubbed-empty user), not `/decks/new`; regenerate the baseline.
**Where**: `tests/visual/all-surfaces.spec.ts` (onboarding fixture), `__snapshots__/*onboarding*`
**Depends on**: None · **Reuses**: `seedAuth` pattern · **Requirement**: UXUI-16
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Onboarding test produces the wizard surface; baseline regenerated + committed (or deferred to CI with a note if no local DB)
- [ ] Full gate (visual)
**Tests**: visual · **Gate**: full

### T23: Repair deck-detail visual fixtures
**What**: Ensure deck-detail + deck-detail-edit resolve to a populated deck (substitution fixture) and capture the new ReadinessHero layout; regenerate baselines.
**Where**: `tests/visual/all-surfaces.spec.ts` (deck-detail resolution), `__snapshots__/*deck-detail*`
**Depends on**: T11, T22 · **Reuses**: `resolveDeckUrl` · **Requirement**: UXUI-16
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] deck-detail + edit baselines show the populated deck with ReadinessHero; regenerated + committed (or CI-deferred with note)
- [ ] Full gate (visual)
**Tests**: visual · **Gate**: full

### T24: Full visual re-baseline + suite green
**What**: Regenerate baselines for all intentionally-changed surfaces (Path C, auth error, TopBar, DeckCard, lightbox, deck-detail, skeletons) and confirm the suite is green (or document the DB-env limitation per STATE precedent).
**Where**: `tests/visual/__snapshots__/*`
**Depends on**: T23 (+ all surface-changing tasks) · **Reuses**: `--update-snapshots` flow · **Requirement**: UXUI-16
**Tools**: MCP NONE · Skill NONE
**Done when**:
- [ ] Only intentionally-changed surfaces re-baselined; visual suite green locally or in CI; diff reviewed
- [ ] Build gate + visual gate
**Tests**: visual · **Gate**: full

---

## Parallel Execution Map
```
Phase 0 (foundations):      T1 [P]   T2 [P]
Phase 1 (a11y + bans):      T1→T7 ;  T2→{T9,T10} ;  T3[P] T4[P] T5[P] T6[P] T8[P]
Phase 2 (structural):       T11 → T12
Phase 3 (hygiene):          T13[P] T14[P] T15[P] T16[P] T17[P]   (T13 deps T2)
Phase 4 (states + ARIA):    T18[P] T19[P] T20[P] ;  T12→T21
Phase 5 (visual):           T22 → T23 → T24      (T23 deps T11)
```

## Task Granularity Check
| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 useFocusTrap | 1 hook | ✅ Granular |
| T2 guard scaffold | 1 file | ✅ Granular |
| T3 focus suppression | 1 invariant across N modules (cohesive sweep) | ⚠️ Cohesive multi-file — one concept, one guard; kept |
| T4 focus wrong-color | 1 invariant across modal css | ⚠️ Cohesive sweep; kept |
| T5 touch targets (non-deck) | 1 invariant across surfaces | ⚠️ Cohesive sweep; kept |
| T6 touch targets (deck) + mark-owned | deck controls + 1 primitive adoption | ✅ Cohesive |
| T7 dialog focus-trap | 3 dialogs, 1 mechanism | ✅ Cohesive |
| T8 native button | 1 component | ✅ Granular |
| T9 side-stripes | 1 ban across 3 surfaces + auth | ⚠️ Cohesive sweep; one guard; kept |
| T10 wordmark | 1 file | ✅ Granular |
| T11 ReadinessHero mount | 1 layout change (3 files, 1 concept) | ✅ Cohesive |
| T12 dead code | deletions | ✅ Granular |
| T13 token drift | 1 invariant across surfaces | ⚠️ Cohesive sweep; one guard; kept |
| T14 i18n | 3 components, 1 concept | ✅ Cohesive |
| T15 reduced-motion | 2 files | ✅ Granular |
| T16 SPA Link | 1 component | ✅ Granular |
| T17 type discipline | 2 css files | ✅ Granular |
| T18 skeleton parity | 2 skeletons | ✅ Cohesive |
| T19 error states | verify-email + import callouts | ✅ Cohesive |
| T20 ARIA | 5 controls, 1 concept | ⚠️ Cohesive sweep; per-control tests; kept |
| T21 untrack toast | 1 component | ✅ Granular |
| T22 onboarding fixture | 1 fixture | ✅ Granular |
| T23 deck-detail fixture | 1 fixture pair | ✅ Granular |
| T24 re-baseline | snapshot regen | ✅ Granular |

> Cohesive sweeps (⚠️) apply ONE invariant across a file set and are verified by a single
> guard assertion + representative DOM tests. Splitting per-file would create trivial tasks
> with no independent verification value. Accepted by judgment per the granularity guidance.

## Diagram-Definition Cross-Check
| Task | Depends On (body) | Diagram | Status |
| ---- | ----------------- | ------- | ------ |
| T1 | None | none | ✅ |
| T2 | None | none | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T2 | T2→T4 (parallel group, dep on T2) | ✅ |
| T5 | None | [P] | ✅ |
| T6 | None | [P] | ✅ |
| T7 | T1 | T1→T7 | ✅ |
| T8 | None | [P] | ✅ |
| T9 | T2 | T2→T9 | ✅ |
| T10 | T2 | T2→T10 | ✅ |
| T11 | None | start of Phase 2 | ✅ |
| T12 | T11 | T11→T12 | ✅ |
| T13 | T2 | [P] (dep T2 noted) | ✅ |
| T14–T17 | None | [P] | ✅ |
| T18–T20 | None | [P] | ✅ |
| T21 | T12 | T12→T21 | ✅ |
| T22 | None | start of Phase 5 | ✅ |
| T23 | T11, T22 | T22→T23 ; T11→T23 | ✅ |
| T24 | T23 (+ surface tasks) | T23→T24 | ✅ |

> Note: T3/T4/T9/T10/T13 carry a dependency on T2 (guard scaffold); they are still `[P]`
> with respect to **each other** (disjoint files), all gated behind T2.

## Test Co-location Validation
| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ---------------------- | --------------- | --------- | ------ |
| T1 | hook | unit | unit | ✅ |
| T2 | guard spec | unit | unit | ✅ |
| T3 | component css + behavior | unit | unit | ✅ |
| T4 | component css | unit | unit | ✅ |
| T5 | component css | unit | unit | ✅ |
| T6 | component (Button adoption) | unit | unit | ✅ |
| T7 | component behavior | unit | unit | ✅ |
| T8 | component | unit | unit | ✅ |
| T9 | css + component + visual surface | unit (+visual) | unit (+visual) | ✅ |
| T10 | css + visual surface | unit (+visual) | unit (+visual) | ✅ |
| T11 | component layout + visual | unit (+visual) | unit (+visual) | ✅ |
| T12 | deletions | none (build) | none (build) | ✅ |
| T13 | css/svg + visual | unit guard (+visual) | unit (+visual) | ✅ |
| T14 | component + i18n | unit | unit | ✅ |
| T15 | css only | unit guard | unit (guard) | ✅ |
| T16 | component | unit | unit | ✅ |
| T17 | css only | unit guard | unit (guard) | ✅ |
| T18 | component skeleton | unit | unit | ✅ |
| T19 | component error state | unit | unit | ✅ |
| T20 | component ARIA | unit | unit | ✅ |
| T21 | component behavior | unit | unit | ✅ |
| T22 | visual fixture | visual | visual | ✅ |
| T23 | visual fixture | visual | visual | ✅ |
| T24 | visual baselines | visual | visual | ✅ |

All ✅ — no test-deferral violations.

---

## Open question for Execute — Tools (step 6)
Default per task is **MCP NONE · Skill NONE** (plain edits + vitest/playwright gates).
Optional skill assists, if the owner wants them wired in:
- T9/T10/T13 (visual replacements) → `impeccable:polish`
- T11 (ReadinessHero canvas layout) → `impeccable:layout`
Confirm at Execute whether to use these or keep plain.
