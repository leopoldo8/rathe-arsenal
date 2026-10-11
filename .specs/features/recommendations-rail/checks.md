# Recommendations rail checks

Profile: standard
Plan: `.specs/features/recommendations-rail/plan.md`

36 checks in 5 slices · 1 one-way door · 0 open

Proof commands, by suite (each proof below names its file and test):

- api unit: `pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"`
- api e2e: `DATABASE_URL=<throwaway Postgres> pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"` (a throwaway `postgres:16` container, never the owner's dev database)
- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"`
- web e2e: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium <file> -g "<test>"` (dev servers up, fixture seeded by the Playwright global setup; the recommendations read route is mocked with `page.route`, because a real run needs Gemini)

A proof written `... <file> -t "<test>"` uses the command of the suite its file belongs to.

## Checks

### S1 - the API reports a run in progress honestly · 6 files · 60 KB · ~15k

**C1** - The generation status is derived from the run row, table-driven over 6 rows: `pending`/`manual`/attempts 0/`runAfter` now -> `queued`; `pending`/`auto`/attempts 0/`runAfter` past -> `queued`; `pending`/`auto`/attempts 0/`runAfter` future -> `null`; `pending`/`auto`/attempts 1/`runAfter` future -> `retrying`; `pending`/`manual`/attempts 2 -> `retrying`; `running` -> `running` (AC 1, 2, 3, 4) · done
Proof: `apps/api/src/recommendations/__tests__/generation-state.spec.ts -t "derives the status from the run row"`

**C2** - Elapsed time is now minus `startedAt` when set, else minus the later of `createdAt` and `runAfter`, and 0 when that is in the future: three cases asserting 42 000, 15 000 and 0 ms (AC 6) · done
Proof: `apps/api/src/recommendations/__tests__/generation-state.spec.ts -t "measures elapsed time from the start"`

**C3** - Typical duration is the median of the durations given: [60 000, 90 000, 300 000] -> 90 000; [60 000, 80 000, 100 000, 120 000] -> 90 000; 2 durations -> `null`; 0 durations -> `null` (AC 7) · done
Proof: `apps/api/src/recommendations/__tests__/generation-state.spec.ts -t "typical duration is the median of at least 3 runs"`

**C4** - The pool sample holds at most 16 cards, all with an image, no identifier twice, and the same 16 identifiers in the same order for two calls with the same pool; a pool of 5 imaged cards gives 5 (AC 9) · done
Proof: `apps/api/src/recommendations/__tests__/generation-state.spec.ts -t "samples up to 16 imaged pool cards, the same each time"`

**C5** - On the read route: a deck with a `running` run started 30 s ago answers `generation.status` `running`, `elapsedMs` between 30 000 and 40 000, `poolSize` equal to `buildRecommendationPool(...)`'s length for that deck, and `poolSample` of 1 to 16 entries each with `cardIdentifier`, `name` and `imageUrl.small`; the same deck with a `manual` `pending` run answers `queued`; with an `auto` `pending` run due in 5 minutes answers `generation: null` and `pending: true`; with no active run answers `generation: null` and `pending: false` (AC 1, 3, 4, 5, 6, 8, 9) · done
Proof: `apps/api/src/recommendations/__tests__/recommendations-read.e2e-spec.ts -t "reports a run in progress as generation"`

**C6** - On the read route, with 3 `done` runs on other decks lasting 60, 90 and 300 s and one `failed` run lasting 10 s, a deck with a running run answers `typicalMs` 90 000; with only 2 `done` runs it answers `typicalMs` `null`; only the 20 most recently finished `done` runs count: 21 older runs of 1 s and 20 newer runs of 100 s answer 100 000, where the 20 oldest or all 41 would answer 1 000 (AC 7) (reworded after verification round 1: one 1 s outlier could not move the median, so the window direction was unproven)
Proof: `apps/api/src/recommendations/__tests__/recommendations-read.e2e-spec.ts -t "typical duration comes from recent done runs"`

**C7** - The read route still answers `401` without a token and `404` for another user's deck and for an unknown deck, with `generation` in neither body (Surface statuses) · done
Proof: `apps/api/src/recommendations/__tests__/recommendations-read.e2e-spec.ts -t "refuses foreign, malformed and anonymous reads"`

### S2 - recommendations are a full-width rail of swap cards · 10 files · 90 KB · ~23k

**C8** - On the deck page, with no rejected swaps, the recommendations section is the next section after the status strip and before the analysis row, for a complete deck and for an incomplete deck, and the action panels contain no recommendations section (AC 10) (reworded during build: the modified-view banner, when shown, stays attached to the strip it explains) · done
Proof: `apps/web/src/components/deck-detail/__tests__/DeckDetailView.recommendations.spec.tsx -t "puts recommendations right under the status strip"`

**C9** - The section heading reads "Recomendações para este deck" in pt-BR and "Recommendations for this deck" in en-US (AC 11) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "titles the section in both languages"`

**C10** - A done run with 3 recommendations renders 3 swap cards in rank order inside one list whose container scrolls horizontally (`overflow-x: auto` in the CSS module rule the list uses) (AC 12) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "renders one swap card per recommendation in rank order"`

**C11** - A swap card shows the art, "Name (Vermelho)", the "melhoria clara" chip for a clear upgrade and "considerar" otherwise, the reason, the cut choice labelled "No lugar de", and the Usar and Dispensar buttons; ownership reads "na coleção" when owned, the price as a link to the store when priced, and "sem estoque" otherwise (AC 13) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "a swap card shows art, name, chips, reason, cut and actions"`
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "ownership reads owned, price or out of stock"`

**C12** - A recommendation with a cut shows the cut card's art behind the recommended card with the label "sai", and the cut choice starts on the cut card; one without a cut shows no tucked card and the choice starts empty (AC 14) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "tucks the cut card behind and preselects it"`

**C13** - The cost chip, table-driven over 6 rows: cost 1 cut 0 -> "+1 custo"; cost 0 cut 2 -> "-2 custo"; cost 1 cut 1 -> "mesmo custo"; cost 2 no cut -> "custo 2"; cost 2 cut cost unknown -> "custo 2"; cost unknown -> no chip (AC 15) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "the cost chip compares with the cut card"`

**C14** - Tapping the art opens the large preview with the card's name and sends no adopt request (AC 16) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "tapping the art opens the card large without adopting it"`

**C15** - Usar sends `POST .../recommendations/:id/adopt` with the chosen `cutCardIdentifier` and the recommendation's `cutSlot`; with no cut chosen Usar is disabled; a `NOTHING_TO_REPLACE` refusal shows the cut-gone message (AC 17) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "Usar adopts with the chosen cut"`

**C16** - Dispensar hides the card, sends `POST .../dismissals` with the card, and shows a toast whose Desfazer sends `DELETE .../dismissals/:card` and brings the card back (AC 18) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "Dispensar hides the card and offers undo"`

**C17** - The section states, table-driven: no run and nothing active -> the empty message and a button "Gerar"; a done run -> the button "Gerar de novo"; a done run with no recommendations -> the no-upgrades message; a later failed run with `MODEL_TIMEOUT` -> "O modelo demorou demais para responder."; a read error -> the load error and Tentar de novo, which refetches; a stale run -> the stale notice (AC 19, 20, 21, 22) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "renders every section state"`

**C18** - Gerar sends `POST .../recommendations/runs` and every mutation refreshes the recommendations query and the decks list (AC 19) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "Gerar sends the run request"`
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "every mutation refreshes the data it changes"`

### S3 - the wait is a pile, a clock and the real step · 6 files · 50 KB · ~13k

**C19** - With `generation` present the section shows the pile with an image of the card back (`src` ending `card-back.webp`), the number 821 and "cartas candidatas" (AC 23) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "shows the candidate pile while generating"`

**C20** - The clock starts at `elapsedMs` 65 000 as "1:05" and reads "1:08" after 3 s of fake time (AC 24) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "the clock starts at the elapsed time and ticks every second"`

**C21** - The step line, table-driven: `queued` -> "Na fila"; `retrying` -> "O modelo estava ocupado; tentando de novo"; `running` with `poolSize` 821 and hero "Azalea, Ace in the Hole" -> "O modelo avalia 821 cartas para Azalea, Ace in the Hole" (AC 25) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "names the step the server is on"`

**C22** - `typicalMs` 100 000 shows "costuma levar ~2 min" and the usual-time mark; 70 000 shows "~1 min"; `null` shows neither (AC 26) (reworded on 2026-10-11: the label rounds to the nearest minute) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "shows the usual duration when known"`

**C23** - With `elapsedMs` 110 000 and `typicalMs` 100 000 (shown as ~2 min) the step line still shows the running step at 119 s and reads "Passou do tempo de costume. Pode sair da página; as recomendações aparecem aqui quando terminarem." at 121 s (AC 27) (reworded on 2026-10-11: the warning follows the shown minutes, not the raw median) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "says when the run passes the usual time"`

**C24** - Without reduced motion, a lifted card appears on the pile within 1.2 s of fake time showing an image and the name of a `poolSample` card; with `prefers-reduced-motion: reduce` no lifted card appears after 5 s (AC 28, 35) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "lifts pool cards off the pile unless motion is reduced"`

**C25** - While generating, Gerar reads "Gerando…" and is disabled, and the previous run's swap cards stay in the document dimmed (`data-dimmed="true"`) with Usar and Dispensar disabled (AC 29) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "keeps the previous cards dimmed while generating"`

**C26** - The query refetches every 10 s while `generation` is present or `pending` is true, and stops when both are absent (AC 30) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "polls every 10 seconds only while a run is active"`

### S4 - the answer is dealt into place · 6 files · 50 KB · ~13k

**C27** - The deal keyframes map the pile box onto the slot box: for pile `{ left: 40, top: 300, width: 110 }` in a section at `{ left: 10, top: 100 }` and slot `{ left: 400, top: 260, width: 202 }`, the first keyframe is `translate(30px, 200px) scale(1) rotate(0deg)`, the last is `translate(390px, 160px) scale(1.8363636363636364) rotate(0deg)`, the middle keyframe's vertical position is above both ends, and the transform origin is `0 0` (AC 31, 32) · done
Proof: `apps/web/src/components/deck-detail/__tests__/deal-geometry.spec.ts -t "maps the pile box onto the slot box"`

**C28** - In the browser, after a poll moves from a `generation` payload to a done run with 3 recommendations, three flying cards are created 190 ms apart and each one's box when its flight finishes equals its slot's art box within 0.5 px in left, top, width and height; afterwards the pile is gone and 3 swap cards are visible with their reason text (AC 31, 32, 33, 34) · done
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "deals the arriving cards exactly into place"`

**C29** - In the browser, the rail's height before the first card lands equals its height after every card has settled, within 1 px (AC 33) · done
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "deals the arriving cards exactly into place"`

**C30** - With reduced motion emulated, the same transition creates no flying card and the 3 swap cards are visible; opening a deck whose run is already done shows the swap cards with no pile and no flying card (AC 35, 36) · done
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "arrives without motion when motion is reduced"`
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "a finished run renders without a deal"`

### Added after verification round 1

The round-1 report found three plan criteria proven only in part; each gets its own check.

**C31** - After a `generation` poll, a poll that returns the same run (here with a `MODEL_TIMEOUT` failure) removes the pile at once and leaves the cards undimmed, while a poll that returns a different run keeps the pile in place for the deal and removes it within 2 s (AC 31) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "deals only when a different run arrives"`

**C32** - In the browser, 60 ms after each dealt card lands its reason text is still below 0.5 opacity, and once the deal is over every reason is at opacity 1 (AC 33)
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "deals the arriving cards exactly into place"` · done

**C33** - With `typicalMs` 130 000 (shown as ~2 min) the mark sits at the bottom of the ring, the ring is a quarter full at 60 s, half full at 120 s with no warning yet, and at 122 s the warning shows with the ring just past half (AC 26, 27) (replaced on 2026-10-11 after the owner tested staging) · done
Proof: `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "reaches the usual-time mark half way round the ring, exactly when the warning shows"`

### S5 - the rail scrolls like a carousel on desktop (added 2026-10-11, owner feedback)

**C34** - In the browser, the rail's computed `scrollbar-width` is `none`, it reserves 0 px for a scrollbar, and with six cards it overflows sideways (AC 37) · done
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "the mouse wheel scrolls the rail sideways"`

**C35** - In the browser, a 200 px wheel over the rail moves the rail right and leaves the page where it was; once the rail reaches its end, further wheel turns scroll the page down (AC 38, 39) · done
Proof: `apps/web/tests/e2e/recommendations-rail-flow.spec.ts -g "the mouse wheel scrolls the rail sideways"`

**C36** - The wheel rule, table-driven over a 1000 px rail in a 400 px box: +100 px moves to 100 and is cancelled; 3 lines move 120 px; a large turn stops at 600; past the end nothing is cancelled; -250 moves back to 350; at the start a turn back, a sideways gesture and ctrl + wheel are not cancelled; a rail that fits never cancels (AC 38, 39) · done
Proof: `apps/web/src/hooks/__tests__/useWheelScrollsSideways.spec.tsx -t "turns a vertical wheel into sideways scrolling until an end is reached"`
Proof: `apps/web/src/hooks/__tests__/useWheelScrollsSideways.spec.tsx -t "leaves sideways gestures, pinch-zoom and the start edge to the browser"`
Proof: `apps/web/src/hooks/__tests__/useWheelScrollsSideways.spec.tsx -t "does nothing when the content fits"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| generation status per run row (6) | manual due C1 · auto due C1 · auto future C1, C5 · auto retry C1 · manual retry C1 · running C1, C5 | - |
| elapsed start (3) | `startedAt` C2, C5 · later of `createdAt`/`runAfter` C2 · future floored C2 | - |
| typical duration (4) | odd count C3, C6 · even count C3 · under 3 C3, C6 · 20-run window C6 | - |
| `GET /api/decks/:deckId/recommendations` statuses (3) | 200 C5 · 401 C7 · 404 C7 | - |
| section states (6) | empty C17 · done C17 · no upgrades C17 · failed C17 · load error C17 · stale C17 | - |
| ownership chip (3) | owned C11 · priced C11 · out of stock C11 | - |
| cost chip (6) | more C13 · less C13 · equal C13 · no cut C13 · cut cost unknown C13 · cost unknown C13 | - |
| step line (4) | queued C21 · retrying C21 · running C21 · past usual C23 | - |
| motion paths (2) | full C24, C28 · reduced C24, C30 | - |
| wheel outcomes (5) | moves sideways C35, C36 · past the end C35, C36 · sideways gesture C36 · pinch-zoom C36 · content fits C36 | - |
| deal trigger (2) | different run C31, C28 · same run C31 | - |
| deck states for placement (2) | complete C8 · incomplete C8 | - |
| locales (2) | pt-BR C9 · en-US C9 | - |
| Landing door 1 (1) | `generation` shape C5 | - |

- Claims naming a status code, route or response shape: C5, C6, C7 - each crosses the route.
- Every UI claim is proven in a component test; the deal's pixel claims (C28, C29) are proven in a real browser, because jsdom has no layout.

## Test policy

The repo's testing rules name the test types and where they live; they do not say which level proves a decision or how much of its input space must be asserted. Rows for this change:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (generation state on the read route) | one at its own layer **and** one at the route against Postgres | every status row at its own layer; the route asserts one row per status plus the null cases and the typical-duration window |
| Decides, not reached across a boundary (cost chip, step line, section states, deal geometry) | one at its own layer | one asserted case per row |
| Layout and motion that need a real layout engine (landing boxes, rail height) | one in a real browser | the full deal of 3 cards and the reduced-motion path |
| Instrumentation (query invalidation, the move of the section in the page) | asserted where it is the claim (C8, C18) | one asserted call or position each |

Evidence:

- generation state: status from 3 fields with 6 rows, elapsed with 3 branches, median with 3 branches, sample with 2 filters -> decides, about 14 branch points
- cost chip: 6 branches; step line: 4 branches; section states: 6 branches -> decide
- closest analogue: `apps/api/src/recommendations/__tests__/validate-answer.spec.ts` proves the answer validation at its own layer, and `recommendations-read.e2e-spec.ts` proves the route against Postgres; `RecommendationsPanel.spec.tsx` is the precedent for the panel states

Cost: about 20 proofs at their own layer across 4 test files, plus one Playwright file.

## Swept

- validation: C4 - the sample has a bound of 16 and filters cards with no image; the route takes no new input
- failure modes: C17 - failed run and read error states; C23 - a run past its usual time
- idempotency: C4 - the same pool gives the same sample on every poll, so the flipping cards do not reshuffle between polls
- authorization: existing - `JwtAuthGuard` and `OwnsTrackedDeckGuard` on the read route; C7 asserts `401` and `404` still hold
- concurrency: C1 - a run moving from `pending` to `running` between polls changes only the status; the route reads one row per poll
- data lifecycle: n/a - nothing stored or deleted; typical duration reads finished runs that already exist
- dependency failure: C17 - a model failure shows its code; the wait itself shows the retrying step (C21) when the provider asked to retry
- state transitions: C1, C21, C28 - queued to running to done, with the deal on the done transition
- observability: n/a - the worker already logs claim, request, done and failure with durations; the new fields are read from those rows

## Handoff

- S1 = 15k, all in `apps/api/src/recommendations`; S2 enters `apps/web` at 38k; S3 at 51k; S4 at 64k total, under the 150k budget - one builder
