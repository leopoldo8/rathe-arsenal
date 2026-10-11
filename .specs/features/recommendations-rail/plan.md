# Recommendations rail

## Problem

On a deck that is not complete (most decks), the recommendations panel sits in the right column under the swaps panel, below the fold, as a small list with 40 px art; on a complete deck it is a thin row that reads like a settings line.
The owner called it out directly: recommendations are what sets the site apart and they get less weight than the swaps panel.
Generating takes one to four minutes, and the whole wait is one line of text, "Gerando recomendações…", with no sign of progress or that anything is still alive; the owner reported clicking Generate and staring at that line "por muito tempo".
The API only says `pending: true/false`, so no screen could show more even if it wanted to.

When this ships, recommendations are a full-width section right under the deck's status strip, titled "Recomendações para este deck", showing each recommendation as a large card with the card it replaces tucked behind it.
While a run is in progress the section shows a pile of face-down Flesh and Blood cards labelled with the real number of candidate cards, cards lifting off it and turning face up, a brass ring clock with the step the server is really on and how long runs usually take; when the answer arrives the recommendations are dealt from the pile into their places.

The design was chosen by the owner from mockups: layout B ("swap rail"), title T1, loader 3 (pile, ring clock, deal), with the official card back.

## Flow

Reuses the existing read route `GET /api/decks/:deckId/recommendations`, the run rows the worker already writes (`status`, `runAfter`, `attempts`, `startedAt`, `finishedAt`), `buildRecommendationPool` for the candidate count, the existing adopt, dismiss and generate mutations, `CardLightbox` for the large preview, and the 10 s polling that already runs while a run is active.

1. Generate -> `POST /api/decks/:deckId/recommendations/runs` (exists, unchanged) -> run row `pending`, `manual`, due now
2. web polls `GET /api/decks/:deckId/recommendations` (exists) -> `RecommendationsService.read` (exists) additionally reads the deck's active run and, when it is in progress, builds `generation` (door 1): status from the run row, elapsed time from the server clock, the candidate count and a sample of candidate cards from `buildRecommendationPool` (exists), and the typical duration from recent finished runs
3. out: the same response plus `generation`; the worker (exists, unchanged) moves the run to `running` and then `done` or `failed`
4. web: the recommendations rail (new component, no door - placement) renders above the analysis row for every deck state, replacing the panel inside `DeckActionPanels` and the complete-deck row; while `generation` is present it shows the pile, the ring clock and the step; when a poll returns the new run's cards it deals them into the rail
5. web: adopt, dismiss and undo go through the existing mutations from the new swap card

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `generation` - the in-progress state of a deck's run as the read route reports it (`queued`, `retrying`, `running`), with elapsed and typical duration; lives in `apps/api/src/recommendations` |
| API response | `GET /api/decks/:deckId/recommendations` gains `generation`; consumed only by this SPA, deployed with it |
| deck page layout | recommendations move from the right column (incomplete deck) and the row under the analysis (complete deck) to one full-width section between the status strip and the analysis row; `DeckActionPanels` loses its `recommendations` slot, so the swaps panel stands alone in its column |
| visual baseline | the deck-detail baseline changes on purpose (recommendations move up); updated in the same branch |
| static assets | the web app ships one image file, the Flesh and Blood card back, under the LSS card-image permission like the card images (docs/research/ip-posture.md) |
| stored data | nothing to migrate - no column or table changes |

## Relations

None - no stored-data shape change

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /api/decks/:deckId/recommendations` | path `deckId`, header `Accept-Language` | existing fields · `generation` object or null: status, elapsedMs, typicalMs, poolSize, poolSample of cardIdentifier, name, imageUrl | `200`, `401`, `404` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. in-progress state on the read route | `generation: { status: 'queued' or 'retrying' or 'running', elapsedMs: number, typicalMs: number or null, poolSize: number, poolSample: { cardIdentifier, name, imageUrl }[] }` or `null`, present only while the deck has a run in progress; `pending` keeps its meaning (any active run, drives polling) | a persisted `stage` column written by the worker at each step: the steps between claim and the model call take milliseconds, so the only stages a person can see are queued, retrying and running, which the run row already holds |

- Nothing else in this change is hard to reverse: the card back is one static file, and the rail is a component swap.

## Criteria

### S1: the API reports a run in progress honestly (P1)

The read route says whether a run is queued, retrying or running, for how long, how long runs usually take, and how many cards are being judged.

**Acceptance Criteria**

1. WHEN the deck's active run is `pending` with `attempts` 0 and is `manual` or due (`runAfter` not in the future) THEN the read route SHALL return `generation.status` `queued`
2. WHEN the deck's active run is `pending` with `attempts` of 1 or more THEN the read route SHALL return `generation.status` `retrying`
3. WHEN the deck's active run is `running` THEN the read route SHALL return `generation.status` `running`
4. IF the deck's only active run is an `auto` run with `attempts` 0 whose `runAfter` is in the future THEN the read route SHALL return `generation` `null` and `pending` `true`
5. WHEN the deck has no `pending` or `running` run THEN the read route SHALL return `generation` `null`
6. WHEN `generation` is present THEN `generation.elapsedMs` SHALL equal the server's now minus `startedAt` for a run that has started, else minus the later of `createdAt` and `runAfter`, floored at 0
7. WHEN `generation` is present THEN `generation.typicalMs` SHALL be the median of `finishedAt - startedAt` over the 20 most recently finished `done` runs of any deck, or `null` when there are fewer than 3 such runs
8. WHEN `generation` is present THEN `generation.poolSize` SHALL equal the number of cards `buildRecommendationPool` returns for the deck, its hero, format and excluded cards
9. WHEN `generation` is present THEN `generation.poolSample` SHALL hold up to 16 distinct pool cards that have an image, each with `cardIdentifier`, `name` and `imageUrl`, the same list on every poll of the same deck state

**Independent test:** e2e on the read route with run rows inserted in each state.

### S2: recommendations are a full-width rail of swap cards (P1)

The section sits right under the status strip on every deck, titled "Recomendações para este deck", and each recommendation is a large card with the card it replaces behind it.

**Acceptance Criteria**

10. The deck page SHALL render the recommendations section directly after the status strip (after the modified-view banner when that banner is shown, since it explains the strip) and before the analysis row, for both an incomplete and a complete deck, and SHALL NOT render it inside the action panels
11. The section SHALL be titled "Recomendações para este deck" in pt-BR and "Recommendations for this deck" in en-US
12. WHEN a done run has recommendations THEN the section SHALL render one swap card per recommendation, in rank order, in one horizontal row that scrolls sideways
13. The rail SHALL show on each swap card the recommended card's art, its name with its pitch, a "melhoria clara" or "considerar" chip, a cost chip, an ownership chip ("na coleção", the price linking to the store, or "sem estoque"), the reason, a "no lugar de" cut choice and the Usar and Dispensar buttons
14. WHERE the recommendation names a cut card still in the deck the swap card SHALL show that card's art tucked behind the recommended card with the label "sai", and the cut choice SHALL start on that card
15. WHERE both costs are known the cost chip SHALL read "+N custo" when the recommended card costs N more than the cut card, "-N custo" when it costs N less, and "mesmo custo" when equal; WHERE there is no cut card or the cut card's cost is unknown it SHALL read "custo N" with the recommended card's cost; WHERE the recommended card's cost is unknown there SHALL be no cost chip
16. WHEN the owner taps a swap card's art THEN the system SHALL open the card in the large preview without adopting it
17. WHEN the owner presses Usar with a cut chosen THEN the system SHALL send the adopt request with that cut and its slot; WHILE no cut is chosen Usar SHALL be disabled
18. WHEN the owner presses Dispensar THEN the system SHALL hide the card, send the dismissal and offer Desfazer in a toast
19. WHEN the deck has no done run and nothing in progress THEN the section SHALL show the empty message and a Gerar button; WHEN a done run exists the button SHALL read "Gerar de novo"
20. WHEN a done run has no recommendations left to show THEN the section SHALL show the no-upgrades message
21. IF the latest finished run failed THEN the section SHALL show that failure's message for its code; IF the read itself fails THEN the section SHALL show the load error with Tentar de novo
22. WHEN the done run's fingerprint no longer matches the deck THEN the section SHALL show the stale notice

**Independent test:** component tests on the rail with a mocked API; the deck page test for placement.

### S3: the wait is a pile, a clock and the real step (P1)

While a run is in progress the section shows what the server is doing, for how long, and keeps moving.

**Acceptance Criteria**

23. WHILE `generation` is present the section SHALL show a pile of face-down cards using the Flesh and Blood card back image with `generation.poolSize` and the label "cartas candidatas"
24. WHILE `generation` is present the section SHALL show a clock in m:ss starting at `generation.elapsedMs` and advancing once per second
25. WHILE `generation.status` is `queued` the step SHALL read "Na fila"; WHILE `retrying` it SHALL read "O modelo estava ocupado; tentando de novo"; WHILE `running` it SHALL read "O modelo avalia {poolSize} cartas para {hero}" with the deck's hero name
26. WHERE `generation.typicalMs` is not null the section SHALL show "costuma levar ~{minutes} min" with the typical duration rounded up to whole minutes, and the ring clock SHALL carry a mark at the typical duration
27. WHEN the clock passes `generation.typicalMs` THEN the step line SHALL read "Passou do tempo de costume. Pode sair da página; as recomendações aparecem aqui quando terminarem."
28. WHILE `generation` is present and reduced motion is not requested the pile SHALL lift one card at a time, turn it face up showing a card from `generation.poolSample` and show that card's name
29. WHILE `generation` is present the Gerar button SHALL be disabled and read "Gerando…", and any recommendations from the previous run SHALL stay visible but dimmed with their buttons disabled
30. WHILE `generation` is present the section SHALL poll the read route every 10 s

**Independent test:** component test with a `generation` payload and fake timers; Playwright flow with the route mocked.

### S4: the answer is dealt into place (P2)

When the new run's cards arrive while the page is open, each card flies from the pile and lands exactly where it stays.

**Acceptance Criteria**

31. WHEN a poll returns no `generation` and a done run whose id differs from the run shown before the generation started THEN the section SHALL deal the new recommendations: each card flies from the pile to its slot in rank order, starting 190 ms apart
32. The deal SHALL end each card's flight on a box equal to its slot's art box, to the pixel, in position and size
33. WHEN a dealt card lands THEN the card it replaces, the text lines and the buttons of that swap card SHALL fade in after it, and the rail SHALL NOT change height while the cards land
34. WHEN the last dealt card has settled THEN the pile SHALL fold away and the rail SHALL hold only the swap cards
35. WHERE reduced motion is requested no card SHALL fly, lift or flip: the pile SHALL stay still, the clock SHALL still advance, and the arriving cards SHALL appear in place without movement
36. WHEN the page opens on a deck whose run is already done THEN the section SHALL render the swap cards directly, with no pile and no deal

**Independent test:** unit test of the deal geometry; Playwright flow measuring the landed boxes against the slots.

## Out of scope

| Excluded | Why |
| --- | --- |
| a toast when a run finishes after leaving the deck page | needs a check that keeps running across pages; the mockup listed it as shared by every loader, the owner picked the loader only |
| a "generating" marker on the Home deck tile | same as above; Home already shows the clear-upgrade count once a run is done |
| per-step progress inside the worker | the steps between claim and model call take milliseconds (Landing door 1) |
| light-theme-specific art for the card back | the image is the same in both themes |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| card back file in the public repo | commit one cropped, compressed copy of the official card back under the web app's public folder | the owner asked for the real card back; it is a Flesh and Blood card image under the same LSS permission as the card art the site already shows, and one file is trivially removable on a takedown request | n |
| old cards during "Gerar de novo" | keep them dimmed with buttons disabled until the new cards are dealt | the mockup note said so; losing them during a four-minute wait would be a regression | n |
| number of placeholders while the first run is generating | 5 empty slots | matches the mockup; the real count is unknown until the answer | n |
| dealing when the answer has more cards than fit on screen | every card is dealt; cards whose slot is outside the visible rail fly to it and are clipped by the rail's edge | keeps one code path; the rail scrolls to them | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen deck page · recommendations | empty state | AC 19 |
| screen deck page · recommendations | loading state | AC 23-30 |
| screen deck page · recommendations | error state | AC 21 |
| screen deck page · recommendations | unauthorised state | existing - the deck route redirects to sign-in; the read route answers 401 |
| screen deck page · recommendations | density and ordering | AC 12 |
| screen deck page · recommendations | destructive action confirms | existing - Dispensar is undone from the toast (AC 18), adopt is undone from the deck list mark |
| screen deck page · recommendations | no results | AC 20 |
| API `GET /api/decks/:deckId/recommendations` | response shape | AC 1-9 |
| API `GET /api/decks/:deckId/recommendations` | error shape and codes | existing - 401 and 404 from the guards, unchanged |
| API `GET /api/decks/:deckId/recommendations` | who may call it | existing - `OwnsTrackedDeckGuard` |
| API `GET /api/decks/:deckId/recommendations` | versioning, rate limits | n/a - the response gains an optional field read only by this SPA, deployed together; the route keeps the global throttle |

## Sources

- Mockups chosen by the owner on 2026-10-11: layout B, title T1, loader 3 with the official card back - binding for arrangement and motion.
- `.impeccable.md` - design tokens, motion and reduced-motion rules; loader 3 bends "motion is subtle", accepted by the owner when choosing it.
