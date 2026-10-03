# Product Redesign — Tasks

The traceability spine for the run. Every requirement in `spec.md` appears exactly once below, bound to the phase that satisfies it, the design section that specifies it, and the check that proves it. This file is deliberately thin: the *how* lives in the design documents, and duplicating it here would just create two sources of truth that drift.

**Status values:** Pending → Implementing → Verified.

## Phase order and why it is this order

Phases run **sequentially**, not in parallel. Two reasons: the shared-file collision map in `implementation-notes.md` (both locale index files, the generated route tree, the visual baselines, and the token files are each touched by several phases), and the fact that a subagent running `git add -A` would sweep up another agent's half-finished work on the same branch.

Two ordering constraints are load-bearing and must not be relaxed:

1. **Foundation is first.** Every later phase consumes its token names. Running anything alongside it means a second phase inventing its own vocabulary against a contract that is still moving.
2. **The swaps engine comes before the screens that display readiness.** Decision D7 changes what `effectivePercent` means. Home and deck detail both render that number. Built first, their fixtures would encode the pre-D7 values and go red the moment the engine changed — forcing a retrofit of two phases' tests. This is why the swaps workstream is split: engine and API at phase 2, the screen itself at phase 9.

---

## Phase 1 — Foundation

**Design**: `design/01-foundation.md` · **Owns**: `apps/web/src/styles/tokens.css`, `global.css`

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| FND-01 colour token mapping, both themes | §1, §2, §7 | `contrast.spec.ts`, `design-guards.spec.ts` | Verified |
| FND-01a pitch `-ink` companion tokens | §1.6a | new contrast assertions on the four derived values | Verified |
| FND-02 Hanken Grotesque for all UI text | §3.1 | `design-guards.spec.ts` | Verified |
| FND-03 Newsreader for titles and readiness numbers | §3.1, §3.2 | `design-guards.spec.ts` | Verified |
| FND-04 UnifrakturCook for wordmark and monogram | §3.1 | `design-guards.spec.ts` FND-04 block (token + TopBar wordmark) | Verified |
| FND-05 `.impeccable.md` + contrast matrix updated | §6 | manual read; both must stop describing the old brand | Verified — manual read 2026-10-03 (DEV-23) |
| FND-06 nav active-item rule | §5.3 | unit tests over `resolveActiveNavKey`, both nav bars | Verified |
| FND-07 font loading, no first-paint block | §3.4 | see the caveat below | Verified — async load; CLS measured ≤ 0.047 on four routes (DEV-23) |

**Inherited defect this phase must clear**: the `describe.skip` block at `contrast.spec.ts:193`. The run's baseline has exactly one skipped test; phase 1 ends at zero.

**FND-07 caveat**: the design satisfies "no first-paint block" but leaves "no layout shift" unverified, because async font loading without metric-matched fallbacks is precisely what causes shift. Treat the layout-shift half as open until measured; self-hosting with `size-adjust` is the named fallback if it fails.

---

## Phase 2 — Swaps engine, persistence and API (Half A)

**Design**: `design/07-swaps.md`, Half A · **Owns**: `packages/engine/src/readiness`, `packages/engine/src/substitution`, the new `swap_suggestion` table

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| SWAP-01 suggestions persist with a stable id | §1, §5 | reconciliation unit tests; e2e asserts the sibling row keeps its id through a cascade | Verified |
| SWAP-02 reconciliation reuses and retires, never duplicates or deletes | §1 | `reconcileSwapSuggestions` unit tests | Verified |
| SWAP-03 rejected pairs suppressed from future runs | §3 | engine unit tests; e2e asserts a rejected pair stops being proposed | Verified |
| SWAP-13 only approved substitutions count toward readiness | §0 | engine unit tests; e2e asserts approve raises and revert restores `effectivePercent` | Verified |
| SWAP-15 legacy decisions discarded | §5 | `replace-substitute-decision-with-swap-suggestion.int-spec.ts` | Verified |
| Endpoints: approve, reject, revert, restore, outcome | §6 | `resolve-swap-transition.spec.ts` (every §6 cell), `swaps.service.spec.ts`, `swaps.controller.spec.ts`, `swaps.controller.e2e-spec.ts` | Verified |

**Two things this phase must not get wrong.** The existing Swaps screen keeps calling the existing endpoints until phase 9 replaces it, so the compatibility shim is not optional — a phase that leaves the app broken cannot be committed green. And the migration alone leaves `swap_suggestion` empty, so the backfill script ships with it; without it the old screen shows nothing and readiness drops raggedly as decks happen to recompute, instead of uniformly at deploy.

---

## Phase 3 — Core components

**Design**: `design/02-core-components.md`

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| CMP-01..05 readiness medallion | §1 | component spec; `data-band` assertions; `role="meter"` + `aria-valuetext` | Verified — specs pass; 38px ring checked visually on Home (dark + light), 90px ring on deck detail |
| BOX-01 three-scene stack cannot be flattened | §2 | structural test over the `DeckboxScene` primitive | Verified |
| BOX-02 hover choreography, 52% overshoot, 80% depth swap | §2 | `design-guards.spec.ts` pinning the keyframe literals | Verified — keyframe literals pinned; headless hover capture on Home (2026-10-03) shows the cards clear of the deck name and medallion |
| BOX-03..04 per-status variants | §2 | component spec, one case per status | Verified |
| BOX-05 reduced-motion degradation | §2 | component spec asserting the flight is absent, not merely that a class changed | Verified (CSS-source guard: jsdom evaluates no media query, see DEV-11) |
| BOX-06..07 activation and focus indicator | §2 | keyboard-driven component spec | Verified |
| Brand-mode deckbox for Sign in | §2, brand variant | type-level union plus a non-interactivity assertion | Verified (component only; Sign in wiring is phase 8) |

BOX-02's "cards must not cover the deck name or medallion" clause is a layout fact no jsdom assertion can reach. It is verified visually in phase 10, not here.

---

## Phase 4 — Home

**Design**: `design/03-deck-surfaces.md`, Home sections

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| HOME-01 KPI strip from real data | Home §  | route spec | Verified |
| HOME-02..03 four groups; `ready` and `active` share Ativos | `GROUP_OF` mapping | spec seeding all five statuses | Verified |
| HOME-04 empty groups omitted | Home § | route spec | Verified |
| HOME-05 filtering updates grid and counts | Home § | route spec | Verified |
| HOME-06 meta line per completion state | Home § | route spec, all three states | Verified |
| HOME-07 no-decks empty state | Home § | route spec | Verified |
| Exception-based legality in the meta line | Home § | route spec, legal and illegal | Verified |

---

## Phase 5 — Deck detail

**Design**: `design/03-deck-surfaces.md`, deck-detail sections

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| DECK-01 hero banner with the 90px medallion | detail § | route spec | Verified (banner and 90px medallion in the DOM; ring look not yet seen in a browser, see DEV-14) |
| DECK-02..03 status strip, both tones | detail § | route spec, complete and incomplete | Verified — both tones; PROVISIONAL: "Comprar tudo" has no bulk action to reuse, so the strip links to the shopping list instead (DEV-14), owner to confirm |
| DECK-04 raw, fidelity and pct as three distinct values | detail § | route spec asserting the concatenated string is gone | Verified |
| DECK-05 missing and swaps panels, driven by `score` | detail § | route spec | Verified |
| DECK-06..07 decklist badges and view toggle | detail § | route spec | Verified (the by-type grouping is PROVISIONAL, DEV-14) |
| DECK-08 decklist uses `CardArt` | detail § | route spec | Verified |
| DECK-09 no duplicated Fabrary link | detail § | route spec | Verified |
| Possible-versus-applied copy when Path is complete but pct < 100 | detail § | route spec for that exact combination | Verified |

---

## Phase 6 — Collection surfaces

**Design**: `design/04-collection-surfaces.md`

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| LIB-01 no filter lost | §3, parity table | route spec per control | Verified |
| LIB-02 card-size slider drives the grid | §3 | route spec | Verified |
| LIB-03 group-by regroups | §3 | route spec, all four modes | Verified |
| LIB-04 pitch counts in pitch colours | §3.3 | route spec using the `-ink` tokens | Verified |
| LIB-05 source rows incl. Manual | §4.2 | api + route spec | Verified |
| LIB-06 toggle dims, flips label, recomputes totals | §4 | route spec | Verified |
| LIB-07 three tabs replace the paragraphs | §6 | route spec asserting the roman numerals are gone | Verified |
| LIB-08 dropzone states real columns and limits | §6.3 | route spec pinning the copy | Verified |
| Quantity stepper and multi-source popover survive | §3.4 | route spec | Verified |

---

## Phase 7 — New deck, edit deck, settings

**Design**: `design/03-deck-surfaces.md` (new/edit) and `design/05-entry-and-settings.md` (settings)

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| EDIT-01 two-card New deck | new § | route spec | Verified |
| EDIT-02 edit fields incl. notes | edit § | route spec; api test for the new column | Verified |
| EDIT-03 status control still expresses all five values | edit § | route spec, each value round-tripped | Verified |
| EDIT-04 danger zone separated, delete confirmed | edit § | route spec | Verified |
| EDIT-05 four settings panels | settings § | route spec; toggles untouched | Verified |

The settings eyebrow stays on `--ra-accent-body`. The handoff names a token by its role in a dark mock; that token fails AA at 11px in light theme. Do not "correct" it back.

---

## Phase 8 — Sign in and onboarding

**Design**: `design/05-entry-and-settings.md`

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| AUTH-01 50/50 split, four responsive zones | §4.4 | route spec | Verified |
| AUTH-02 stepper states; no roman numerals or diamonds | §5 | new `StepIndicator.spec.tsx` asserting both halves | Verified |
| AUTH-03..04 stepper navigation | §5 | route spec | Verified |
| AUTH-05 disclaimer survives | §5 | the existing pinned-`Link` test must still pass untouched | Verified |
| The five inherited anonymous screens | § | existing specs plus regenerated baselines | Verified — baselines regenerated and inspected 2026-10-03 |
| verify-email: diamond replaced, baseline added | § | new baseline | Verified — baselines regenerated and inspected 2026-10-03 |

---

## Phase 9 — Swaps screen (Half B)

**Design**: `design/07-swaps.md`, Half B

| Requirement | Design § | Verified by | Status |
|---|---|---|---|
| SWAP-04..05 approve and revert | §7 | route spec driving the full cycle | Verified |
| SWAP-06..07 reject with reason; restore | §7 | route spec | Verified |
| SWAP-08 in-place confirmation; migration deferred to tab switch | §7 | route spec asserting the row stays put | Verified |
| SWAP-09 counts derived, never hardcoded | §7 | route spec | Verified |
| SWAP-10 post-play outcome | §7 | route spec | Verified |
| SWAP-11 `× N` grouping preserved | §7 | `group-fresh-swap-entries.spec.ts` (server-side grouping); `SwapRow` and Swaps route "grouped rows" cases replace the deleted client-side grouping tests (DEV-20) | Verified |
| SWAP-12 row anatomy and confidence bands | §7 | route spec | Verified |
| SWAP-14 filter rail, bulk actions, `all` tab survive | §7 | `SwapsFilters`, `planBulkSteps` matrix and the Swaps route bulk cases; the old `reviews`/`ReviewsBulkBar` specs were rewritten against the new screen, scenario map in DEV-20 | Verified |

---

## Phase 10 — Verification and delivery

| Step | Done when |
|---|---|
| Full suite green | typecheck, lint, web + api + engine unit, api int, api e2e — zero failures, zero skips |
| Traceability closed | every row above reads Verified, and `spec.md`'s table matches |
| Cross-cutting 1 (i18n) | both catalogs complete; the completeness test passes |
| Cross-cutting 2/3 (a11y, motion) | no `uxui-remediation` guarantee regressed |
| Cross-cutting 4 (baselines) | every touched screen's baseline current |
| Cross-cutting 5 (design docs) | `.impeccable.md` and the contrast matrix describe the shipped system |
| Visual check | `scripts/screenshot-all-surfaces.ts` run; output compared against the prototype screenshots |
| `.specs/STATE.md` | handoff section rewritten; the stale "no local PostgreSQL" limitation corrected |
| Delivery | branch pushed, PR opened. **Not merged** — that is the owner's call. |
