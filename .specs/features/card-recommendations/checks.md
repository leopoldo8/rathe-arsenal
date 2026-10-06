# Card recommendations checks

Profile: standard
Plan: `.specs/features/card-recommendations/plan.md`

73 checks in 6 slices · 8 one-way doors · 4 open, of which 0 block (2 block go-live)

Proof commands, by suite (each proof below names its file and test):

- api unit: `pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"`
- api e2e: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"` (needs the local Postgres; the separate database keeps the new tables and CHECK out of the owner's dev database)
- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"`

A proof written `... <file> -t "<test>"` is the api e2e command above with that file and test name.

API fixture used by the e2e checks unless a check says otherwise: the card-alternatives fixture (`replacements-e2e.fixture.ts`), a Classic Constructed deck for `katsu-the-wanderer` with `emissary-of-tides-red` x2 and `flex-red` x2 in `mainboard` and `talishar-the-lost-prince` x1 in `weapon`.
Gemini is never called: the worker e2e checks drive one drain with a stub `fetch` that records the request and returns a canned `generateContent` body.

## Checks

### S1 - Queued, coalesced runs drained by the worker · 22 files · 260 KB · ~65k

**C1** - After a composition save on a `building` deck with no run, the deck holds exactly one run: `pending`, `trigger: auto`, `runAfter` more than 298 and at most 300 seconds after the save's response on the database clock; a second save 10 seconds later leaves the same single row with `runAfter` again more than 298 and at most 300 seconds ahead (AC 1) (reworded after verification round 1: the values now match the assertions, measured on the database clock) · done
Proof: `... jest --testRegex '.*\.e2e-spec\.ts$' ... recommendation-queue.e2e-spec -t "a composition save leaves one pending auto run due in 5 minutes"`
Proof: `... recommendation-queue.e2e-spec -t "a second change pushes the pending auto run back"`

**C2** - A deck-list change while the pending run is `manual` leaves it `manual` with `runAfter` unchanged (AC 2) · done
Proof: `... recommendation-queue.e2e-spec -t "a change leaves a pending manual run alone"`

**C3** - Each of the six writers enqueues an auto run, table-driven: composition save, deck import (2 decks in one import give 2 runs, one per deck), pick, revert, adopt, `PATCH` with a different `format` (AC 3) · done
Proof: `... recommendation-queue.e2e-spec -t "every deck-list writer enqueues an auto run"`

**C4** - None of these touch `recommendation_run`, table-driven with the row count read before and after: keep, mark-owned (`POST /api/collection/cards/batch`), scratch deck create, `PATCH` with `name` only, `PATCH` with the same `format` (AC 4) · done
Proof: `... recommendation-queue.e2e-spec -t "non-writers enqueue nothing"`

**C5** - A composition save on a `retired` deck creates no run (AC 5) · done
Proof: `... recommendation-queue.e2e-spec -t "a retired deck gets no automatic run"`

**C6** - 8 concurrent composition saves on one deck leave exactly one `pending` run (AC 6) · done
Proof: `... recommendation-queue.e2e-spec -t "concurrent changes leave one pending run"`

**C7** - Generate on a deck with no run returns `202` with `status: pending`, `trigger: manual`, an `id` and a `createdAt`, and the row's `runAfter` is within 1 second of the request; on a deck with a pending auto run due in 5 minutes it returns that run's `id`, now `manual` and due now, and the deck still holds one pending run (AC 7) · done
Proof: `... recommendation-queue.e2e-spec -t "Generate creates a manual run due now"`
Proof: `... recommendation-queue.e2e-spec -t "Generate promotes the pending auto run"`

**C8** - Generate while a run is `running` returns `202` with that running run and leaves the row count unchanged (AC 8) · done
Proof: `... recommendation-queue.e2e-spec -t "Generate returns the running run"`

**C9** - Generate answers `404` for another user's deck and for a missing deck, `400` for deck id `abc`, `401` without a token (AC 9) · done
Proof: `... recommendation-queue.e2e-spec -t "Generate refuses foreign, missing and malformed decks"`

**C10** - The claim takes the oldest due pending run, sets `running`, `startedAt`, `claimedAt` and `attempts` 1; it skips a run whose `runAfter` is in the future and a run whose deck already holds a running run, returning nothing when only those exist (AC 10) · done
Proof: `... recommendation-worker.e2e-spec -t "claims only due runs of decks with nothing running"` (extended after verification round 1: two due runs claim in `runAfter` order, the earlier one first, whatever their creation order; same test, second phase)

**C11** - An auto run claimed after its deck became `retired` ends `failed` with `DECK_RETIRED` and the stub `fetch` is never called; a manual run of a retired deck is sent to the model (AC 11) · done
Proof: `... recommendation-worker.e2e-spec -t "an auto run of a retired deck fails without a call"`

**C12** - A run of a deck whose `heroIdentifier` is null ends `failed` with `DECK_INVALID` and no call (AC 12) · done
Proof: `... recommendation-worker.e2e-spec -t "a deck without a hero fails without a call"`

**C13** - The pool for the Katsu deck contains a legal Ninja card and a Generic card; it lacks a card banned in Classic Constructed, a card of another class, a Hero, a Token, a Weapon, `emissary-of-tides-red` and `flex-red` (in the deck), and a dismissed card - one asserted card per member (AC 13) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/recommendation-prompt.spec.ts -t "the pool keeps legal cards and drops each excluded kind"`
Proof: `... recommendation-worker.e2e-spec -t "the request leaves out dismissed and deck cards"`

**C14** - The prompt names the hero and the format, lists `2x emissary-of-tides-red` and `2x flex-red` under `mainboard` and `talishar-the-lost-prince` under `weapon`, does not list the hero among deck cards, lists each pool card as identifier, name, type line and rules text, and asks for 25 cards with strength, cut and reason (AC 14) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/recommendation-prompt.spec.ts -t "the prompt lists the deck by slot and asks for 25 cards"`

**C15** - With `GEMINI_API_KEY` unset, and again set to `"  "`, the run ends `failed` with `NO_API_KEY` and the stub `fetch` is never called (AC 15) · done
Proof: `... recommendation-worker.e2e-spec -t "a missing key fails without a call"`

**C16** - The client posts to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent` with header `x-goog-api-key` set to the key, `generationConfig.responseMimeType` `application/json`, a `responseJsonSchema` whose items require `card`, `strength` (enum `clear_upgrade`, `consider`), `cut` and `reason`, and `maxOutputTokens` 32000 (door 7) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/gemini-client.spec.ts -t "posts the documented generateContent request"`

**C17** - A `STOP` answer with 14 entries - 2 not in the pool, 1 repeating an earlier card, 1 with strength `great` - stores the first 10 valid entries as ranks 1-10 in answer order; the run ends `done` with a 64-character hex `deckFingerprint`, `model: gemini-3.8-flash`, `inputTokens` = `promptTokenCount` (41000) and `outputTokens` = `candidatesTokenCount` + `thoughtsTokenCount` (900 + 2100 = 3000) (AC 16) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/validate-answer.spec.ts -t "keeps the first 10 valid entries in order"`
Proof: `... recommendation-worker.e2e-spec -t "a valid answer stores ranked recommendations and usage"`

**C18** - A cut naming a `mainboard` deck card for a mainboard recommendation is stored with `cutSlot: mainboard`; a cut naming the deck's weapon, a card not in the deck, an empty string, or a mainboard card for an Equipment recommendation is stored as null cut and null slot (AC 17) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/validate-answer.spec.ts -t "keeps a cut only from the recommended card's slot"`

**C19** - An answer whose every entry is dropped ends the run `done` with 0 recommendations (AC 18) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/validate-answer.spec.ts -t "an answer with nothing valid keeps nothing"`
Proof: `... recommendation-worker.e2e-spec -t "an answer with nothing valid ends done and empty"`

**C20** - A `429` puts the run back to `pending` with `runAfter` 60 s after the drain on attempt 1 and 120 s on attempt 2; the third `429` ends it `failed` with `RATE_LIMITED`, `attempts: 3` (AC 19) · done
Proof: `... recommendation-worker.e2e-spec -t "a 429 backs off twice then fails RATE_LIMITED"` (implementation changed after verification round 1: the backoff is now computed on the database clock, as enqueue is, so the bound no longer races the host clock)

**C21** - `500`, `503` and `504` each back off as in C20, and a third one ends the run `failed` with `PROVIDER_UNAVAILABLE`, table-driven over the three (AC 20) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/gemini-client.spec.ts -t "classifies every provider outcome"`
Proof: `... recommendation-worker.e2e-spec -t "a 503 backs off then fails PROVIDER_UNAVAILABLE"`

**C22** - `400`, `403` and `404` answers and a `fetch` that rejects each end the run `failed` with `PROVIDER_ERROR` and no retry (AC 21) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/gemini-client.spec.ts -t "classifies every provider outcome"`

**C23** - A `fetch` that never answers is aborted at 180 s (fake timers) and the outcome is `MODEL_TIMEOUT` (AC 22) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/gemini-client.spec.ts -t "aborts a call at 180 seconds"`

**C24** - `promptFeedback.blockReason: SAFETY` and each `finishReason` of `SAFETY`, `RECITATION`, `LANGUAGE`, `OTHER`, `BLOCKLIST`, `PROHIBITED_CONTENT`, `FINISH_REASON_UNSPECIFIED` and an unknown `SPII` give `MODEL_REFUSED`; `MAX_TOKENS` gives `MODEL_TRUNCATED`; text `not json` and `{"ranking":[]}` give `MODEL_OFF_SCHEMA` (AC 23, AC 24, AC 25) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/gemini-client.spec.ts -t "classifies every provider outcome"`
Proof: `... recommendation-worker.e2e-spec -t "a refusal fails the run and keeps the earlier list"`

**C25** - After a deck's run ends `failed`, its earlier `done` run and that run's 10 `recommendation` rows are unchanged (AC 26) · done
Proof: `... recommendation-worker.e2e-spec -t "a refusal fails the run and keeps the earlier list"`

**C26** - A run claimed 11 minutes ago returns to `pending` with `claimedAt` null; one claimed 11 minutes ago on a deck that already holds a pending run ends `failed` with `WORKER_LOST`; one claimed 9 minutes ago stays `running` (AC 27) · done
Proof: `... recommendation-worker.e2e-spec -t "reclaims orphans after 10 minutes"`

**C27** - A `429` on a run whose deck gained a pending run while it ran ends it `failed` with `SUPERSEDED`, and the pending run's `runAfter` becomes the later of its own and the backoff time (AC 28) · done
Proof: `... recommendation-worker.e2e-spec -t "a retry behind a newer pending run is superseded"`

**C28** - With a recommendation drain that never resolves, the variant drain still runs at least 3 times in 3 poll intervals (fake timers) (AC 29, door 8) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/stores/__tests__/variant-queue-worker.spec.ts -t "a stuck recommendation drain does not block the variant drain"`

**C29** - The log carries `recommendations.enqueued` (with `trackedDeckId`, `trigger`) on a save, `recommendations.run.claimed` and `.done` (with `trackedDeckId`, `runId`, `kept`, `dropped`, `clearUpgrades`, `inputTokens`, `outputTokens`, `durationMs`) on a valid answer, `.retry` (with `status`, `runAfter`) on a 429, `.failed` (with `code`, `attempts`) on a refusal (AC 30) · done
Proof: `... recommendation-worker.e2e-spec -t "logs each run transition"`
Proof: `... recommendation-queue.e2e-spec -t "logs the enqueue"`

**C30** - Schema: `recommendation_run` rejects `trigger: soon` and `status: queued`; a second `pending` and a second `running` row for one deck each fail on the partial unique index; deleting the deck removes its runs, recommendations and dismissals; `recommendation` rejects rank 0, rank 11, a repeated (run, rank) and `strength: great`; `recommendation_dismissal` rejects a repeated (deck, card); `card_replacement` accepts `pickedFrom: recommendation` and rejects `pickedFrom: synergy` (doors 1-5) · done
Proof: `... recommendation-schema.e2e-spec -t "enforces every one-way constraint"`

**C31** - The migration's `up` creates the three tables with every index and CHECK the entities declare and replaces the `pickedFrom` CHECK; `down` restores the five-value CHECK and drops the three tables (doors 1-5) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' --forceExit src/database/migrations/__tests__/add-card-recommendations.migration.int-spec.ts -t "up creates and down drops the recommendation tables"` (proof file renamed before any code: the repo proves migrations as `.int-spec.ts` in their own schema) (extended after verification round 2: `up` also leaves every column of the three tables with the type, length and nullability in `recommendation-columns.ts`, so `error` is pinned as `text`)

**C32** - The fingerprint is the same for the same cards listed in another order and for one card split over two rows of a slot, and differs when a quantity, the hero, the format or a card's slot changes (door 6) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/recommendation-prompt.spec.ts -t "the fingerprint ignores order and tracks every input"`

### S2 - The recommendations panel · 10 files · 120 KB · ~30k

**C33** - The read returns `run` (latest `done`, with `id`, `trigger`, `finishedAt`, `stale`), `pending`, `failure` and `recommendations`, table-driven over: no run (`run: null`, `pending: false`, `failure: null`, `[]`); pending only (`pending: true`); done then pending (`run` set, `pending: true`); done then failed `MODEL_REFUSED` (`failure.code: MODEL_REFUSED`); failed then done (`failure: null`) (AC 31) · done
Proof: `... recommendations-read.e2e-spec -t "reports run, pending and failure for each history"`

**C34** - `stale` is false right after the run and true after a composition save that changes a quantity (AC 32) · done
Proof: `... recommendations-read.e2e-spec -t "stale follows the deck fingerprint"`

**C35** - From a run ranking A (consider), B (clear_upgrade), C (consider), D (clear_upgrade), E (consider), with C dismissed and E now in the deck, the read lists B, D, A in that order (AC 33) · done
Proof: `... recommendations-read.e2e-spec -t "lists clear upgrades first and hides dismissed and deck cards"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/recommendations/__tests__/list-recommendations.spec.ts -t "drops dismissed and deck cards and lists clear upgrades first by rank"` (own-layer proof added after verification round 1)

**C36** - A recommended card owned 2 with none in the deck has `freeCopies: 2`; an unowned card with store stock has the shopping line's unit price and product URL; an unowned card with no store row has `priceCents: null`, `productUrl: null` (AC 34) · done
Proof: `... recommendations-read.e2e-spec -t "joins ownership and store price live"`

**C37** - A stored cut still in its slot comes back with `cutName`; after a save removes that card, the same recommendation comes back with `cutCardIdentifier`, `cutName` and `cutSlot` null (AC 35) · done
Proof: `... recommendations-read.e2e-spec -t "drops a cut that left the deck"`

**C38** - The read answers `404` for another user's deck, `400` for deck id `abc`, `401` without a token (AC 36) · done
Proof: `... recommendations-read.e2e-spec -t "refuses foreign, malformed and anonymous reads"`

**C39** - Panel states, one render each: empty (Generate shown, no list); pending with no run ("generating", no list); pending with a run (list and "generating"); listed run (rows); stale (stale notice beside Generate); failure `RATE_LIMITED` with no pending (localized message and Generate, list kept); done with no cards ("no upgrades found") (AC 37, AC 38, AC 40, AC 41, AC 42) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "renders every panel state"`

**C40** - With `pending: true` the panel refetches after 10 s (fake timers, 2 requests), and after the response turns `pending: false` no request follows in the next 30 s (AC 38) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "polls every 10 seconds only while pending"`

**C41** - A row shows art, name and reason; `freeCopies: 1` shows "owned"; `freeCopies: 0` with a price shows the formatted price linking to `productUrl`; `freeCopies: 0` with null price shows "out of stock"; a cut shows "replaces <cutName>", no cut shows no such text (AC 39) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "a row shows reason, ownership or price, and the cut"`

**C42** - Pressing Generate sends `POST /api/decks/7/recommendations/runs` and shows "generating" (AC 43) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "Generate sends the run request"`

**C43** - On an incomplete deck the panel renders inside `deck-action-panels`, after the swaps panel in the same column; on a complete deck `deck-action-panels`, the missing panel and the swaps panel are absent and the recommendations panel sits alone in `deck-recommendations-row` (AC 44) (reworded before its proof existed: the existing page spec pins `deck-action-panels` absent on a complete deck) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/DeckDetailView.recommendations.spec.tsx -t "places the panel under swaps or alone"`

**C44** - pt-BR and en-US each define every panel key and one message for each of the 12 failure codes, and the two locales hold the same `recommendations` key set (AC 45) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/i18n/__tests__/recommendations-locales.spec.ts -t "both locales cover the panel and every failure code"`

### S3 - Clear upgrade notice · 6 files · 90 KB · ~22k

**C45** - `clearUpgradeCount` on `GET /api/decks`: 2 for a deck whose run has 2 clear upgrades; 1 after one of them is dismissed; 0 after the other is adopted; 0 for a `retired` deck with a clear upgrade; 0 for a deck with no done run ; the route still answers `401` without a token (AC 46) · done
Proof: `... recommendations-read.e2e-spec -t "clearUpgradeCount counts what the panel would show"`

**C46** - The home tile shows "2 upgrades suggested" for `clearUpgradeCount: 2` and no marker for 0 (AC 47) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/home/__tests__/DeckTile.spec.tsx -t "shows the upgrades marker only above 0"`

**C47** - A `clear_upgrade` row carries the clear-upgrade badge and a `consider` row carries none (AC 48) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "badges clear upgrades only"`

### S4 - Dismiss · 5 files · 50 KB · ~12k

**C48** - A first dismissal returns `201` with `cardIdentifier` and `createdAt` and one row; a repeat returns `200` with the same `createdAt` and still one row (AC 49, AC 50) · done
Proof: `... recommendation-dismissals.e2e-spec -t "dismisses once and answers a repeat with 200"`

**C49** - A missing `cardIdentifier`, one of 129 characters and `not-a-card` each return `400` with no row (AC 51) · done
Proof: `... recommendation-dismissals.e2e-spec -t "refuses malformed dismissals"`

**C50** - Undo of an existing dismissal returns `204` and removes the row; undo of an absent one returns `204` (AC 52) · done
Proof: `... recommendation-dismissals.e2e-spec -t "undo answers 204 whether or not a dismissal existed"`

**C51** - Both dismissal routes answer `404` for another user's deck and `401` without a token, and `400` for deck id `abc` (AC 53) · done
Proof: `... recommendation-dismissals.e2e-spec -t "refuses foreign, malformed and anonymous dismissals"`

**C52** - Tapping Dismiss sends the dismissal, the row leaves the panel, and the toast's Undo sends `DELETE /api/decks/7/recommendations/dismissals/<card>` (AC 54) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "Dismiss removes the row and offers undo"`

**C53** - The log carries `recommendations.dismissed` and `recommendations.undismissed` with `trackedDeckId` and `cardIdentifier` (AC 55) · done
Proof: `... recommendation-dismissals.e2e-spec -t "logs dismiss and undo"`

### S5 - Adopt · 8 files · 140 KB · ~35k

**C54** - Adopting a recommendation for a 3-copy limit card with `flex-red` x2 as cut moves 2 copies (`flex-red` row deleted, recommended card x2 in `mainboard`), inserts one `active` `card_replacement` with `quantity: 2`, `pickedFrom: recommendation`, writes a snapshot listing the new card, leaves one pending auto run, and returns `201`; a Legendary recommendation with cut `flex-red` x2 moves 1 copy and leaves `flex-red` x1 (AC 56) · done
Proof: `... recommendation-adopt.e2e-spec -t "adopt moves the cut copies up to the copy limit"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/adoption-rules.spec.ts -t "moves every cut copy, capped by the copy limit across the deck"` (own-layer proof added after verification round 1)

**C55** - `409 REPLACEMENT_ILLEGAL` with no `deck_card`, `card_replacement` or `recommendation_run` change, table-driven: copy limit already reached, a card not legal for the hero, cut slot `weapon`, cut slot `hero`, an Equipment recommendation with a mainboard cut, cut equal to the recommended card (AC 57) · done
Proof: `... recommendation-adopt.e2e-spec -t "refuses illegal adoptions without changing rows"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/adoption-rules.spec.ts -t "refuses each illegal adoption and an empty cut"` (own-layer proof added after verification round 1, also covering a deck with no hero and the `NOTHING_TO_REPLACE` order)

**C56** - A cut card absent from the given slot returns `409 NOTHING_TO_REPLACE` and changes no row (AC 58) · done
Proof: `... recommendation-adopt.e2e-spec -t "refuses a cut that is not in the slot"`

**C57** - A recommendation of another deck's run, an unknown uuid, another user's deck and a missing deck each return `404` (AC 59) · done
Proof: `... recommendation-adopt.e2e-spec -t "answers 404 for foreign or unknown targets"`

**C58** - A missing `cutCardIdentifier`, a missing `cutSlot`, a 65-character slot, a 129-character card and `not-a-card` each return `400` with no row; a non-uuid recommendation id returns `400`; no token returns `401` (AC 60) · done
Proof: `... recommendation-adopt.e2e-spec -t "refuses malformed adoptions"`

**C59** - Reverting the adoption returns `flex-red` x2 to `mainboard`, removes the recommended card, and the read lists the recommendation again (AC 61) · done
Proof: `... recommendation-adopt.e2e-spec -t "revert restores the cut and relists the card"`

**C60** - With the cut card owned 4 after adoption, the deck detail sends the adopted replacement with `originalOwned: false`, while a `close` pick in the same deck with its original owned sends `true` (AC 62) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/build-replacement-views.spec.ts -t "never prompts for an adopted recommendation"`
Proof: `... recommendation-adopt.e2e-spec -t "an adopted card never raises the original prompt"`

**C61** - The log carries `recommendations.adopted` with `trackedDeckId`, `recommendationId`, `rank`, `strength`, both card identifiers, `quantity` and `suggestedCut: true` for the suggested cut and `false` for another (AC 63) · done
Proof: `... recommendation-adopt.e2e-spec -t "logs the adoption"`

**C62** - Adopt sends the cut chosen in the row's selector, which defaults to the suggested cut and lists only deck cards of the recommended card's slot; a `409 REPLACEMENT_ILLEGAL` answer shows its localized message (AC 64, AC 65) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "Adopt sends the chosen cut and reports a refusal"` (extended after verification round 1: a `409 NOTHING_TO_REPLACE` shows the panel's "no longer in that place" message, and a successful adopt shows no error)

**C63** - `POST /api/decks/:deckId/replacements` with `pickedFrom: recommendation` returns `400` (AC 66) · done
Proof: `... recommendation-adopt.e2e-spec -t "the alternatives pick still refuses the recommendation origin"`

### S6 - Alternatives order · 3 files · 40 KB · ~10k

**C64** - Given a group [P, Q, R, S] and a run ranking S at 1 and Q at 4, the order becomes [S, Q, P, R]; with no run the group is unchanged; group membership and group order are identical with and without the run (AC 67, AC 68, AC 69) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/order-by-recommendations.spec.ts -t "lifts run cards by rank and keeps membership"`
Proof: `... alternatives-order.e2e-spec -t "a done run reorders a group without changing it"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| deck-list writers (6) | composition save C3 · import C3 · pick C3 · revert C3 · adopt C3, C54 · format `PATCH` C3 | - |
| non-writers (5) | keep C4 · mark-owned C4 · scratch create C4 · name-only `PATCH` C4 · same-format `PATCH` C4 | - |
| enqueue outcomes (5) | new auto C1 · auto pushed back C1 · manual untouched C2 · retired skipped C5 · behind a running run C68 | - |
| Generate outcomes (3) | new manual C7 · auto promoted C7 · running returned C8 | - |
| claim rules (4) | due and free claimed C10 · future skipped C10 · deck running skipped C10 · earliest `runAfter` first C10 | - |
| pre-call refusals (3) | `DECK_RETIRED` C11 · `DECK_INVALID` C12 · `NO_API_KEY` C15 | - |
| pool exclusions (7) | illegal C13 · Hero C13 · Token C13 · Weapon C13 · in deck C13 · dismissed C13 · other class C13 | - |
| answer validation drops (3) | not in pool C17 · repeat C17 · bad strength C17 | - |
| cut outcomes (5) | kept with slot C18 · weapon C18 · not in deck C18 · empty C18 · other slot C18 | - |
| provider outcomes (16) | `STOP` valid C17 · 429 C20 · 500 C21 · 503 C21 · 504 C21 · 400 C22 · 403 C22 · 404 C22 · network C22 · timeout C23 · `blockReason` C24 · 7 named refusal `finishReason`s C24 · unknown `finishReason` C24 · `MAX_TOKENS` C24 · not JSON C24 · wrong shape C24 | - |
| failure codes (12) | `NO_API_KEY` C15 · `RATE_LIMITED` C20 · `PROVIDER_UNAVAILABLE` C21 · `PROVIDER_ERROR` C22 · `MODEL_TIMEOUT` C23 · `MODEL_REFUSED` C24 · `MODEL_TRUNCATED` C24 · `MODEL_OFF_SCHEMA` C24 · `DECK_INVALID` C12 · `DECK_RETIRED` C11 · `WORKER_LOST` C26 · `SUPERSEDED` C27 | - |
| run transitions (7) | pending -> running C10 · running -> done C17 · running -> failed C24 · running -> pending (retry) C20 · running -> pending (orphan) C26 · running -> failed (orphan) C26 · running -> failed (superseded) C27 | - |
| fingerprint inputs (5) | order C32 · split rows C32 · quantity C32 · hero C32 · format C32 | - |
| read histories (5) | none C33 · pending C33 · done+pending C33 · done+failed C33 · failed+done C33 | - |
| read filters (3) | dismissed C35 · in deck C35 · clear-first order C35 | - |
| price and ownership paths (3) | owned C36 · priced C36 · no stock C36 | - |
| panel states (7) | empty C39 · pending no run C39 · pending with run C39 · list C39 · stale C39 · failure C39 · done empty C39 | - |
| `POST /api/decks/:deckId/recommendations/runs` statuses (5) | 202 C7 · 400 C9 · 401 C9 · 404 C9 · 429 C67 | - |
| `GET /api/decks/:deckId/recommendations` statuses (5) | 200 C33 · 400 C38 · 401 C38 · 404 C38 · 429 C65 | - |
| `POST /api/decks/:deckId/recommendations/dismissals` statuses (6) | 201 C48 · 200 C48 · 400 C49 · 401 C51 · 404 C51 · 429 C65 | - |
| `DELETE /api/decks/:deckId/recommendations/dismissals/:cardIdentifier` statuses (5) | 204 C50 · 400 C51 · 401 C51 · 404 C51 · 429 C65 | - |
| `POST /api/decks/:deckId/recommendations/:recommendationId/adopt` statuses (6) | 201 C54 · 400 C58 · 401 C58 · 404 C57 · 409 C55, C56 · 429 C65 | - |
| `GET /api/decks` statuses (3) | 200 C45 · 401 C45 · 429 C65 | - |
| adopt refusals, 6 illegal + 1 empty + 6 malformed (13) | limit C55 · hero scope C55 · weapon C55 · hero slot C55 · slot mismatch C55 · itself C55 · not in slot C56 · no card C58 · no slot C58 · long slot C58 · long card C58 · unknown card C58 · bad id C58 | - |
| adopt quantity edges (2) | all copies C54 · capped by Legendary C54 | - |
| `clearUpgradeCount` cases (5) | counted C45 · dismissed C45 · adopted C45 · retired C45 · no run C45 | - |
| query refreshes after a mutation (4) | Generate C71 · Dismiss C71 · Undo C71 · Adopt C71 | - |
| log events (8) | `recommendations.enqueued` C29 · `.run.claimed` C29 · `.run.done` C29 · `.run.retry` C29 · `.run.failed` C29 · `.dismissed` C53 · `.undismissed` C53 · `.adopted` C61 | - |
| locales (2) | pt-BR C44 · en-US C44 | - |
| startup config: `GEMINI_API_KEY` (2 assemblies) | `AppModule`'s `EnvDto`, shared by API and worker, optional there C66 · the worker's own assembly: `createRecommendationStep` reading the env per run and `runWorkerLoops` C69 · `runWorker`, `defaultWorkerDeps` and `main()` C73 | - |
| Landing doors (8) | 1 run table C30, C31 · 2 recommendation table C30, C31 · 3 dismissal and pool C30, C13 · 4 `pickedFrom` C30, C63 · 5 one pending, atomic upsert C6, C30 · 6 fingerprint C32, C34 · 7 provider contract C16 · 8 second loop C28 | - |
| column shapes, migration and entities (2 assemblies) | migration C31 · `synchronize` from entities C72 | - |
| Relations entities (4) | `recommendation_run` C30 · `recommendation` C30 · `recommendation_dismissal` C30 · `card_replacement` adoption C54 | - |

**C65** - Each new route other than Generate answers `429` after the global throttler's 120-per-minute limit, table-driven over the read, dismiss, undo and adopt routes, and `GET /api/decks` still does; Generate's lower limit is C67 (reworded after verification round 1, which found five routes claimed and four driven) · done
Proof: `... recommendations-throttle.e2e-spec -t "every recommendations route is throttled"`

**C66** - `AppModule`'s environment validation accepts an environment with no `GEMINI_API_KEY` and one with a value (startup config row) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/config/__tests__/env.dto.spec.ts -t "GEMINI_API_KEY is optional"`

**C67** - Generate answers `429` on the 11th request within a minute from one client, before the global 120-per-minute limit (added during build after a security review flagged repeated paid calls; plan Assumptions row "Generate rate limit") · done
Proof: `... recommendations-throttle.e2e-spec -t "Generate allows 10 requests a minute"`

**C68** - A composition save while the deck has a `running` run leaves that run running and adds one `pending` `auto` run (AC 70, design state "Deck changes while its run is running"; added after verification round 1) · done
Proof: `... recommendation-queue.e2e-spec -t "a change while a run is running queues an auto run behind it"`

**C69** - The worker's recommendation step reads `GEMINI_API_KEY` from the environment on every run (unset, then set without a restart), passes the fetch it was built with, logs `recommendations.worker.error` instead of throwing, and `runWorkerLoops` drives both loops (startup config row; added after verification round 1) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/stores/__tests__/variant-queue-worker.spec.ts -t "the worker reads GEMINI_API_KEY per run and runs both loops"`

**C70** - Two concurrent adoptions of the same recommendation and cut answer one `201` and one `409 NOTHING_TO_REPLACE`, leaving one replacement row and the moved copies once (adopt holds the `tracked_deck` lock; added after verification round 1) · done
Proof: `... recommendation-adopt.e2e-spec -t "concurrent adoptions of one cut hold the deck lock"`

**C71** - Generate, Dismiss and its Undo invalidate the recommendations and decks-list queries; Adopt invalidates those plus the deck detail and swaps queries (AC 64; added after verification round 1) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/RecommendationsPanel.spec.tsx -t "every mutation refreshes the data it changes"`

**C72** - TypeORM `synchronize` over the entities builds the three recommendation tables with exactly the columns, types, lengths and nullability the migration builds (`RECOMMENDATION_COLUMNS`; added after verification round 2) · done
Proof: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' --forceExit src/database/entities/__tests__/recommendation-entities.int-spec.ts -t "synchronize builds the same columns as the migration"`

**C73** - The worker's `main()` boots the application context once and runs both drains, the recommendation runs with `process.env.GEMINI_API_KEY` and the global `fetch`; `runWorker` wires both drains from the context with the environment it is given; `defaultWorkerDeps()` is `process.env` and the global `fetch` (startup config row; added after verification round 2) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/stores/__tests__/variant-queue-worker.main.spec.ts -t "boots the application context and runs both drains with the process key"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/stores/__tests__/variant-queue-worker.spec.ts -t "wires both drains from the application context|defaults to the process environment and the global fetch"`

- Claims naming a status code, route or response shape: C7-C9, C33, C35-C38, C45, C48-C51, C54-C59, C63, C65 - each has a proof that crosses the HTTP boundary against real Postgres
- Decision tables proven at their own layer and again at the boundary: provider outcomes (C21-C24 client spec, plus C20, C21, C24 against Postgres); answer validation (C17-C19 unit, plus e2e); pool (C13 unit, plus the captured request); in-group order (C64 unit, plus e2e)
- No other check claims more than the single case its proof exercises

## Test policy

The repo's testing rules (`~/.claude/rules/testing.md`) name the test types and where they live; they do not say which level proves a decision or how much of its input space a proof must assert. Rows for this change:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (queue SQL, routes, adopt) | one at the boundary against real Postgres **and** one at its own layer where the decision is not SQL or locking | every status at the boundary; coalescing, claiming, partial unique indexes and locks only against Postgres |
| Decides, not reached across a boundary (provider outcome classifier, answer validation, pool, prompt, fingerprint, in-group order) | one at its own layer | one asserted case per row of the decision table: 16 provider outcomes, 3 drops, 5 cut outcomes, 7 pool exclusions, 5 fingerprint inputs |
| Entry point that decides nothing (controllers, DTOs) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation (log lines, query invalidation) | asserted where the event is the claim (C29, C53, C61) | one asserted call each |

Evidence:

- Gemini client: 4 retryable statuses, other HTTP, network, timeout, `blockReason`, 9 `finishReason` branches, 2 parse failures -> decides, about 16 branch points
- answer validation: pool membership, repeat, strength, cap 10, cut slot rule -> decides, 7 branch points
- queue: upsert with three `CASE` arms, claim with two filters, reclaim with two outcomes, retry with backoff and supersede -> decides, SQL only, proven against Postgres
- closest analogue: `apps/api/src/stores/__tests__/variant-fetch-queue.service.spec.ts` proves the variant queue with a mocked repository; this change proves its queue against real Postgres instead, because a partial unique index and `ON CONFLICT` cannot be mocked meaningfully; `apps/api/src/replacements/__tests__/replacements.e2e-spec.ts` is the precedent for the lock and copy moves

Cost: about 30 proofs at their own layer across 6 test files. Without these rows, the provider outcome table would be proven only by the two or three outcomes the worker e2e happens to stub.

## Swept

- validation: C49, C51, C58, C9, C38 - malformed bodies and ids; C17, C18 - the model's answer is validated before storage
- failure modes: C20-C25 - every provider failure ends in a code and keeps the earlier list; C26 - a dead worker
- idempotency: C48 (repeat dismissal 200), C50 (undo of absent 204), C7 (Generate reuses the pending run), C1 (coalescing)
- authorization: existing - global `JwtAuthGuard` and `OwnsTrackedDeckGuard`; C9, C38, C51, C57 assert the `404` and `401` for each new route
- concurrency: C6 (concurrent enqueues, partial unique index), C10 (claim skips a deck already running), C27 (retry behind a newer pending run); adopt takes the `tracked_deck` lock as pick does (C54 shares `ReplacementsService`)
- data lifecycle: C30 - cascade from `tracked_deck` removes runs, recommendations and dismissals; runs are never pruned in this feature, at one row per change burst per deck
- dependency failure: C15 (no key), C20-C24 (provider), C28 (a stuck call does not stall the variant loop)
- state transitions: C10, C17, C20, C24, C26, C27 - the run state machine, every edge
- observability: C29, C53, C61 - one log line per run transition, dismissal and adoption, with token usage on `done`

## Handoff

Size, written after the checks and before any code (bytes of the files each slice reads or touches, divided by 4):

- S1 = 65k (new `recommendations` module, migration, 3 entities, `decks.service.ts` 50 KB, `decks-import.service.ts`, `replacements.service.ts`, worker, env DTO, tests); S2 enters the web app at 95k; S3 at 117k; S4 at 129k; S5 re-reads `replacements.service.ts` at 164k; S6 at 174k
- 174k exceeds the 150k budget. Proposed cut after S4, where the surface changes from queue, read and dismiss to the deck-edit path of adopt and alternatives
- Mechanism: one builder, compaction accepted - provisional, chosen without the owner (away for this run); the session holds a 1M-token context, so the 150k budget models a smaller window than this builder has, and `checks.md` plus the diff stay the recovery source if compaction happens
