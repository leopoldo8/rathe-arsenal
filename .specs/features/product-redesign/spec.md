# Product Redesign Specification

**Source of truth for visual detail:** [`design-handoff.md`](design-handoff.md) — the designer's handoff, imported verbatim from Claude Design project `04a045d9-9491-4223-bf42-e4201c7b9512`. Where this spec and the handoff disagree on a pixel value, the handoff wins. Where they disagree on scope or data model, this spec wins (it records owner decisions the handoff could not know).

## Problem Statement

The current UI applies a fantasy serif to every label, button and eyebrow, decorates surfaces with elements that carry no meaning (the "100%" octagon, ◆ diamonds, roman numerals I/II/III), and buries the product's actual value — what a deck is missing and which swaps make it playable — under long copy and engine jargon (`RAW`, `FIDELITY`, `EFFECTIVE READY`). The Home page floats a couple of decks in empty space with no sense of grouping or progress. A full redesign exists as a hi-fi prototype covering all 11 screens; this feature applies it to the product.

The redesign also fixes a product gap the visual work exposed: a swap suggestion today is a transient engine output with a binary decision attached. The user cannot undo an approval, cannot recover a mistaken rejection, cannot say why a suggestion was wrong, and the engine keeps re-proposing suggestions the user already refused.

## Goals

- [ ] Every one of the 11 screens matches the handoff's tokens, typography, spacing, radii, motion and copy, at ≥1280px.
- [ ] The fantasy serif is confined to titles, hero numbers and the wordmark; all other UI text uses the functional sans.
- [ ] A swap suggestion becomes a durable, addressable record with a lifecycle: pending → approved → (revert) → pending, and pending → rejected → (restore) → pending.
- [ ] The engine stops re-proposing a rejected substitution for the deck it was rejected in.
- [ ] Nothing already shipped regresses: the light theme, both locales, the accessibility guarantees from `uxui-remediation`, and the `× N` copy grouping from AD-005 all survive.

## Owner Decisions (2026-08-16)

Recorded here because they change scope and are not derivable from the handoff.

| # | Decision | Consequence |
|---|----------|-------------|
| D1 | Ship as **one feature with internal phases**, in the handoff's suggested order. | One spec, one branch. Phases may land as separate PRs; the app is never left half-redesigned across a long gap. |
| D2 | The **full swap lifecycle ships with the redesign**, not after it. | Adds a schema migration, five endpoints, and an engine suppression input to what would otherwise be frontend work. |
| D3 | Swap suggestions become **persisted rows with their own id**. | The handoff's `POST /swaps/:id/...` endpoints are taken literally. Requires reconciliation logic when the engine recomputes — see SWAP-03, the highest-risk requirement in this spec. |
| D4 | The **light theme is ported**, not retired. | Every new token needs a light counterpart; the existing contrast test must stay green. |
| D5 | `ready` and `active` deck statuses **share the "Ativos" group** on Home. | No migration, no change to the five-value CHECK constraint, no change to the edit screen's status segments. |
| D6 | The **AD-005 `× N` copy grouping survives**, adapted into the handoff's row design. | One decision still applies to all copies of an identical suggestion. Requires design not present in the handoff. |
| D7 | **Only approved substitutions count toward readiness.** Today `computeEffectiveReadiness` counts every substitution it finds, excluding only rejected ones, so a pending suggestion already inflates the percentage. | The percentage starts meaning "what you can actually play". Approving moves the number, which is what the redesigned screen promises. Every deck with pending suggestions drops on the day this ships; acceptable at closed-beta scale. Engine change plus the existing tests that assert the current behavior. |
| D8 | **Legacy substitute decisions are discarded** in the migration rather than reconstructed. | The current table records only the substitute card — never the original or the slot — so approved rows cannot be mapped into the new model at all and rejected rows could only be guessed at. Aplicadas starts empty and each previously-rejected suggestion is proposed once more. |
| D9 | **The shipped filter rail, bulk actions and "all" tab survive** the Swaps redesign, adapted into the handoff's layout. | The handoff draws none of them, but they are shipped behavior and the spec forbids regressions. Requires design the handoff does not supply. |

## Out of Scope

| Excluded | Reason |
|----------|--------|
| Per-copy partial swap decisions (accept 2 of 3 copies) | AD-005 deferred this deliberately; D6 keeps the group-level decision. Revisit as its own feature. |
| Discover surface, three-mode home fallback, readiness history chart, outbound click telemetry | Phase 1c, `status: deferred`. The redesign's Home is the populated state only. |
| Real deckbox texture art | Handoff specifies pure-CSS gradients and says art is optional. |
| Mobile-first rework below 768px beyond the handoff's stated guidance | The prototype is desktop; the handoff gives breakpoint direction, not designs. Responsive requirements below cover the stated guidance and nothing more. |
| Retiring `.impeccable.md` / `docs/design/v1/contrast-matrix.md` as documents | They get *updated* to the new tokens (FND-05), not deleted. |

---

## User Stories

### P1: Redesigned foundation — tokens, typography, app shell ⭐ MVP

**User Story**: As a player, I want the app to use one functional typeface for interface text and reserve the display serif for titles, so that labels and buttons stop reading as decoration.

**Why P1**: Every other screen depends on these tokens. Nothing can be built to the handoff before they exist.

**Acceptance Criteria**:

1. WHEN any surface renders THEN the app SHALL resolve its colors from the handoff's token set (`--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--ink`, `--ink-2`, `--dim`, `--dim-2`, `--muted`, `--acc`, `--acc-hi`, `--acc-deep`, `--ready`, `--miss`, `--warn`, `--building`, `--idea`) and the seven pitch colors, mapped onto the repo's existing `--ra-*` token names.
2. WHEN interface text renders (labels, buttons, nav, inputs, body, metadata, eyebrows, badges) THEN it SHALL use Hanken Grotesque.
3. WHEN a page title, deck title or readiness number renders THEN it SHALL use Newsreader.
4. WHEN the wordmark or the R monogram renders THEN it SHALL use UnifrakturCook 700.
5. WHEN the app renders under `[data-theme="light"]` THEN every new token SHALL have a light counterpart and the existing contrast test SHALL pass with no pair below WCAG AA at body size.
6. WHEN the top nav renders THEN the active item SHALL carry `bg rgba(208,168,76,.14)` and `--acc` text, with Library active on Sources and Add cards, and Home active on Deck, Edit and New deck.
7. WHEN fonts load THEN they SHALL be self-hosted or loaded without blocking first paint, and no layout shift SHALL occur on swap.

**Independent Test**: Storybook-less check — render the shell with each nav route active, in both themes, and assert computed font families and the active-item token values.

---

### P2: Readiness medallion

**User Story**: As a player, I want a single readiness dial showing my hero's art and one number, so that I stop parsing three concatenated engine figures.

**Why P2**: Used by two screens (deckbox face and deck detail hero); must exist before either.

**Acceptance Criteria**:

1. WHEN a medallion renders with readiness `pct` THEN it SHALL draw a progress ring covering `pct/100` of a turn, starting at -90deg.
2. WHEN `pct >= 100` THEN the ring SHALL be `--ready`; WHEN `pct >= 85` and `< 100` THEN `--acc`; WHEN `< 85` THEN `--building`.
3. WHEN the medallion renders at 38px THEN it SHALL show the number only; WHEN at 90px THEN it SHALL additionally show a `%` glyph and the hero name as an uppercase sublabel.
4. WHEN hero art is unavailable THEN the medallion SHALL fall back to a pitch-colored gradient without breaking the ring or the number.
5. WHEN the medallion renders THEN it SHALL expose the readiness percentage to assistive technology as text, not only as color.

**Independent Test**: Render medallions at 0, 84, 85, 99, 100 percent in both sizes and assert ring color, ring sweep and label content.

---

### P1: Isometric deckbox ⭐ MVP

**User Story**: As a player, I want my decks shown as card boxes with the cards inside them, so that the Home page reads as an armory rather than a list.

**Why P1**: It is the identity element of the redesign and Home cannot ship without it.

**Acceptance Criteria**:

1. WHEN a deckbox renders THEN it SHALL compose three scenes sharing one `.ib2-box` transform, with the back wall at `z-index:1`, the cards at `z-index:2` and the front wall at `z-index:3`, so the cards read as being inside the box.
2. WHEN the pointer enters a deckbox THEN the box SHALL straighten to `rotateX(-9deg) rotateY(-16deg)` and the three cards SHALL fly out over `.8s`, changing depth at the 80% keyframe, settling above and in front of the box without covering the deck name or the medallion.
3. WHEN the deck's status is `idea` THEN the cards scene SHALL be omitted entirely.
4. WHEN the deck's status is `retired` THEN the front face SHALL render with `grayscale(1) brightness(.8)`; WHEN `idea` THEN with `brightness(.62) saturate(.7)`.
5. WHEN `prefers-reduced-motion: reduce` is set THEN the hover SHALL produce only a subtle lift, with no card flight and no depth change.
6. WHEN a deckbox is activated by click, Enter or Space THEN it SHALL navigate to that deck's detail page.
7. WHEN a deckbox receives keyboard focus THEN it SHALL show a visible focus indicator meeting the contrast bar established by `uxui-remediation`.

**Independent Test**: Render one deckbox per status, assert the DOM stacking structure, assert the reduced-motion branch drops the flight animation, and drive keyboard activation.

---

### P1: Home — the armory ⭐ MVP

**User Story**: As a player, I want my decks grouped by what I intend to do with them and a summary of how ready they are, so that I can see at a glance what is playable.

**Why P1**: It is the landing surface; the redesign's core claim is that this page becomes useful.

**Acceptance Criteria**:

1. WHEN Home renders THEN it SHALL show a KPI strip with deck count, average readiness (in `--acc`) and total missing cards (in `--miss`), each derived from real data.
2. WHEN decks are grouped THEN there SHALL be four groups in order — Ativos, Construindo, Ideias, Aposentados — each with a status-colored dot, name, hint line and count.
3. WHEN a deck's status is `ready` or `active` THEN it SHALL appear in the Ativos group (D5).
4. WHEN a group has no decks THEN the group SHALL be omitted rather than rendered empty.
5. WHEN the search field or a filter pill changes THEN the grid SHALL filter without a full page reload, and group counts SHALL reflect the filtered set.
6. WHEN a deck is complete THEN its meta line SHALL read completed with owned/total in `--ready`; WHEN incomplete THEN missing count with owned/total in `--warn`; WHEN it has no card list THEN the draft label in `--dim-2`.
7. WHEN the user has no decks at all THEN Home SHALL show an actionable empty state leading to New deck, not an empty grid.

**Independent Test**: Seed decks across all five statuses, assert group membership and counts, then filter and assert the counts update.

---

### P1: Deck detail ⭐ MVP

**User Story**: As a player, I want the deck page to tell me first what is missing and what to swap, so that I can decide whether I can play this deck tonight.

**Why P1**: The handoff calls this the highest-value screen and it carries the product's core claim.

**Acceptance Criteria**:

1. WHEN the deck page renders THEN the hero banner SHALL show hero art, format and league eyebrow, deck title, hero name, a status chip, an Edit action, and the 90px readiness medallion.
2. WHEN the deck is incomplete THEN the status strip SHALL render in the `--miss` tone, state how many cards are missing across how many slots and how many swaps would make it playable, and offer "Ver trocas" and "Comprar tudo" plus a single Fabrary link.
3. WHEN the deck is complete THEN the status strip SHALL render in the `--ready` tone with no actions.
4. WHEN the analysis row renders THEN it SHALL show three cards — readiness (raw and fidelity as separate bars plus format legality), pitch color distribution, and cost curve — with `raw`, `fidelity` and `pct` presented as distinct values and never concatenated into one string.
5. WHEN the deck is incomplete THEN the "falta comprar" and "trocas sugeridas" panels SHALL render; WHEN complete THEN both SHALL be omitted.
6. WHEN a decklist card is missing copies THEN its thumbnail SHALL carry the missing badge and the `--miss` border.
7. WHEN the decklist view toggle changes between by-type, by-cost and list THEN the grouping SHALL change without refetching.
8. WHEN card art is available THEN decklist thumbnails SHALL use the existing `CardArt` component and its fallback chain, not a gradient placeholder.
9. WHEN the Fabrary link appears in the status strip THEN it SHALL not be duplicated elsewhere on the page.

**Independent Test**: Render one complete and one incomplete deck and assert the strip tone, the presence or absence of the two panels, and that raw/fidelity/pct appear as three separate values.

---

### P1: Swaps — screen and lifecycle ⭐ MVP

**User Story**: As a player, I want to approve, undo, refuse and un-refuse swap suggestions, and tell the app why a suggestion was wrong, so that the suggestions get better instead of repeating.

**Why P1**: D2 puts the lifecycle in this feature. The redesigned screen is not honest without it — it renders Reverter and Restaurar buttons that must do something.

**Acceptance Criteria**:

1. WHEN the engine computes readiness for a deck THEN each distinct substitution it proposes SHALL be persisted as a swap suggestion row with a stable id that survives subsequent recomputations (D3).
2. WHEN the engine recomputes and proposes a substitution matching an existing row THEN the existing row and its status SHALL be reused, not duplicated; WHEN it no longer proposes a substitution whose row is `pending` THEN that row SHALL be retired without being deleted.
3. WHEN the engine generates suggestions for a deck THEN it SHALL exclude any substitution previously rejected for that deck, so a rejected pair is never re-proposed while it stays rejected.
4. WHEN a suggestion is approved THEN it SHALL be applied to the deck's effective list, contribute to readiness, record `appliedAt`, and appear in the Aplicadas tab with its elapsed time and a Reverter action.
5. WHEN an applied suggestion is reverted THEN the swap SHALL be undone in the deck, readiness SHALL recompute, and the row SHALL return to Pendentes.
6. WHEN a suggestion is rejected THEN a reason panel SHALL open in the row offering five one-click reasons plus an optional free-text note, with both optional, and rejecting SHALL record `rejectedAt` and the reason.
7. WHEN a rejected suggestion is displayed THEN it SHALL appear at `opacity .6` in the Recusadas tab showing the reason in quotes and offering a Restaurar action that returns it to Pendentes.
8. WHEN a suggestion is approved or rejected THEN its row SHALL stay in place with an in-place confirmation and a Desfazer action, migrating to its new tab only when the user switches tabs or re-enters the page, while the tab counts update immediately.
9. WHEN tab counts render THEN they SHALL be derived from actual state, never hardcoded.
10. WHEN an applied suggestion is displayed THEN it SHALL offer an optional post-play outcome control recording `worked` or `did_not_work`.
11. WHEN identical suggestions exist for multiple copies of the same card in the same deck THEN they SHALL render as a single row carrying a `× N` indicator, and one decision SHALL apply to every copy in the group (D6, preserving AD-005).
12. WHEN a swap row renders THEN it SHALL show the outgoing card thumbnail struck through at `opacity .5`, the incoming card thumbnail with a gold border, the slot, and the confidence value colored by band (≥90 `--ready`, 70–89 `--acc`, below `--warn`).
13. WHEN readiness is computed THEN only substitutions the user has approved SHALL count toward the effective percentage; a pending suggestion SHALL NOT inflate it (D7).
14. WHEN the Swaps screen renders THEN the shipped filter rail (tier, deck, hero, confidence range), the multi-select bulk actions and the "all" tab SHALL remain available, adapted into the handoff's layout (D9).
15. WHEN the migration runs THEN existing `substitute_decision` rows SHALL be discarded rather than mapped into the new model, since the original card and slot were never recorded (D8).

**Independent Test**: Drive one suggestion through pending → approved → reverted → pending → rejected → restored, asserting deck readiness and tab counts at each step, and assert a rejected pair is absent from the next engine run's output.

---

### P2: Library, sources and add cards

**User Story**: As a player, I want my collection browsable with the filters I already have and a clear place to manage where cards came from, so that I can find and fix my collection quickly.

**Why P2**: High value, but the product is demonstrable without it being redesigned.

**Acceptance Criteria**:

1. WHEN Library renders THEN the sidebar SHALL carry every filter the current app offers — search, the four pitch chips, the class/talent/set facets with counts, the card-size slider, and the group-by segments — with no filter lost in the redesign.
2. WHEN the card-size slider changes THEN the grid card size SHALL change and the legend SHALL report the size in pixels.
3. WHEN the group-by segment changes THEN the grid SHALL regroup between type, pitch, set and list.
4. WHEN Library stats render THEN each pitch count SHALL be shown in its pitch color.
5. WHEN the Sources page renders THEN each source SHALL show its type badge, name, card count, import date, active label and a toggle.
6. WHEN a source toggle is switched THEN the row SHALL dim to `opacity .55`, the label SHALL flip, and the Library totals SHALL recompute.
7. WHEN Add cards renders THEN the three paths SHALL be tabs — manual, CSV, Fabrary — each with a single explanatory sentence, replacing the current three long paragraphs and the roman numerals.
8. WHEN the CSV tab renders THEN the dropzone SHALL state the expected columns and the size limit.

**Independent Test**: Toggle a source off and assert the Library totals drop by that source's contribution; switch each group-by segment and assert the group headers change.

---

### P2: New deck, edit deck and settings

**User Story**: As a player, I want to create, categorize and configure decks and my account through the redesigned surfaces, so that the app is consistent end to end.

**Why P2**: Mechanically simpler screens that depend on the foundation but block nothing.

**Acceptance Criteria**:

1. WHEN New deck renders THEN it SHALL offer two cards — import from Fabrary and start from scratch — with the scratch path carrying hero and format inputs.
2. WHEN Edit deck renders THEN it SHALL offer name, format, a four-segment status control, removable tag chips with an add affordance, and notes.
3. WHEN the status control renders THEN it SHALL still be able to express every value the database allows, including `ready` (D5).
4. WHEN the danger zone renders THEN retire and delete SHALL be visually separated from the save actions and delete SHALL require confirmation.
5. WHEN Settings renders THEN it SHALL show four panels — profile, appearance, language and danger zone — with the appearance toggle switching theme and the language toggle switching locale, both persisting as they do today.

**Independent Test**: Change status via the edit screen for each of the five values and assert the deck lands in the expected Home group.

---

### P2: Sign in and onboarding

**User Story**: As a new player, I want the entry screens to look like the rest of the product, so that the first impression matches what follows.

**Why P2**: Last in the handoff's own implementation order.

**Acceptance Criteria**:

1. WHEN Sign in renders THEN it SHALL use the 50/50 split with the branded deckbox on the left and the form capped at 400px on the right.
2. WHEN Onboarding renders THEN it SHALL show a three-node stepper with active, completed and future states, and SHALL NOT show roman numerals or ◆ diamonds.
3. WHEN a stepper node is activated THEN it SHALL navigate to that step.
4. WHEN step 3's primary action is activated THEN it SHALL navigate to Home.
5. WHEN the anonymous layout renders THEN the fan-content disclaimer link shipped by `pre-launch-hardening` SHALL remain present.

**Independent Test**: Walk all three onboarding steps and assert the stepper node states and the absence of roman numerals.

---

## Cross-Cutting Requirements

These apply to every screen above and are not optional polish.

1. WHEN any user-facing string is introduced or changed THEN it SHALL exist in both the `pt-BR` and `en-US` catalogs, and the catalog-completeness test SHALL pass. The handoff supplies Portuguese copy only; English equivalents are authored as part of each phase.
2. WHEN any interactive control is added THEN it SHALL meet the touch-target and focus-visibility bars established by `uxui-remediation`, and SHALL NOT reintroduce the anti-patterns that feature banned.
3. WHEN any animation is added THEN it SHALL degrade under `prefers-color-scheme` and `prefers-reduced-motion` as the handoff specifies.
4. WHEN a phase lands THEN the visual regression baselines for the screens it touches SHALL be regenerated in the same change, so the suite never sits red.
5. WHEN the redesign changes the brand tokens THEN `.impeccable.md` and `docs/design/v1/contrast-matrix.md` SHALL be updated to describe the new system, since `CLAUDE.md` points every future UI task at them.

---

## Edge Cases

- WHEN a deck has no hero art THEN the deckbox face, the medallion and the deck banner SHALL each fall back without breaking layout.
- WHEN readiness is exactly 85 or exactly 100 THEN the medallion ring color SHALL follow the inclusive boundaries in CMP-02.
- WHEN a deck has 60+ cards and the decklist renders at 6 columns THEN the grid SHALL not overflow its container at 1280px.
- WHEN the engine proposes a suggestion whose substitute card the user no longer owns THEN the row SHALL still render with an accurate owned count rather than disappearing silently.
- WHEN a suggestion is approved and the underlying deck is then edited so the slot no longer exists THEN the approval SHALL be retired without corrupting readiness.
- WHEN a user rejects a suggestion without choosing a reason THEN the rejection SHALL succeed and the Recusadas tab SHALL render without a quoted reason.
- WHEN the same substitution is rejected in deck A THEN it SHALL still be proposable in deck B.
- WHEN a source is toggled off while Library is filtered THEN the filtered counts SHALL recompute, not just the totals.

---

## Requirement Traceability

| ID | Story | Phase | Status |
|----|-------|-------|--------|
| FND-01 | P1: Foundation | 1 | Verified |
| FND-02 | P1: Foundation | 1 | Verified |
| FND-03 | P1: Foundation | 1 | Verified |
| FND-04 | P1: Foundation | 1 | Verified |
| FND-05 | P1: Foundation + Cross-cutting 5 | 1 | Implementing (manual read in phase 10) |
| FND-06 | P1: Foundation | 1 | Verified |
| FND-07 | P1: Foundation | 1 | Implementing (layout shift unmeasured) |
| SWAP-01..03, SWAP-13, SWAP-15 | P1: Swaps, Half A | 2 | Verified |
| CMP-01..05 | P2: Medallion | 3 | Implementing — ring rendering visual check pending |
| BOX-01..07 | P1: Deckbox | 3 | BOX-01, 03..07 Verified; BOX-02 Implementing — visual check pending |
| HOME-01..07 | P1: Home | 4 | Verified (route spec); medallion and card rendering visual check pending, with CMP-01..05 and BOX-02 |
| DECK-01..09 | P1: Deck detail | 5 | Pending |
| LIB-01..08 | P2: Library/Sources/Add | 6 | Pending |
| EDIT-01..05 | P2: New/Edit/Settings | 7 | Pending |
| AUTH-01..05 | P2: Sign in/Onboarding | 8 | Pending |
| SWAP-04..12, SWAP-14 | P1: Swaps, Half B | 9 | Pending |
| I18N-01 | Cross-cutting 1 | all | Pending |
| A11Y-01, A11Y-02 | Cross-cutting 2, 3 | all | Pending |
| VIS-01 | Cross-cutting 4 | all | Pending |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 stories, 5 cross-cutting requirements, 8 edge cases. Task mapping happens in `tasks.md`.

---

## Success Criteria

- [ ] All 11 screens render to the handoff at 1440px in the dark theme, verified against the prototype's screenshots.
- [ ] Both themes and both locales pass their existing automated checks with no exclusions added.
- [ ] A swap can be approved, reverted, rejected with a reason, and restored, with readiness recomputing correctly at each step.
- [ ] A rejected substitution does not reappear in the next engine run for that deck.
- [ ] The `× N` grouping still collapses identical per-copy suggestions into one row.
- [ ] Web and API typecheck, lint and the full unit suite are green; visual regression baselines are current.
