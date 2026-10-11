# Swaps into alternatives checks

Profile: standard
Plan: `.specs/features/swaps-into-alternatives/plan.md`

39 checks in 4 slices · 4 one-way doors · 0 open

Proof commands, by suite (each proof below names its file and test):

- engine unit: `pnpm --filter @rathe-arsenal/engine exec jest <file> -t "<test>"`
- api unit: `pnpm --filter @rathe-arsenal/engine build && pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"` (the API resolves `@rathe-arsenal/engine` to `dist`, so every API proof builds the engine first, as CI does)
- api e2e and int: the api unit command with `DATABASE_URL=<throwaway Postgres> ... jest --testRegex '.*\.(e2e|int)-spec\.ts$' --forceExit --runInBand <file> -t "<test>"` (a throwaway `postgres:16` container, never the owner's dev database)
- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"`
- web e2e: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium <file> -g "<test>"` (isolated servers, fixture seeded by the Playwright global setup)
- command: a shell command whose exit code is the proof

A proof written `... <file> -t "<test>"` uses the command of the suite its file belongs to.

Terms pinned here, because several checks count them:

- **suggestion** of a missing row: for one (card, slot) of `breakdown.notOwned`, the substitute of the first `breakdown.substituted` entry whose original has that card and slot. A row whose missing copies are all held by active replacements has none.
- **N** in "Dá para cobrir N cartas" and "Usar as N": the number of missing rows with a suggestion, which is the number of `card_replacement` rows a bulk use creates when nothing is skipped. It is not a copy count.
- **use**: a pick with `pickedFrom: suggested`. It moves the copies a pick moves, `computeNeeded` of that card and slot, even when the engine covered fewer of them with the suggestion.

## Checks

### S3 - readiness counts the deck as it is · 14 files · 290 KB · ~73k

**C1** - For a deck of 10 copies where 6 are owned exactly, 3 have a stand-in from the collection and 1 has none, `computeEffectiveReadiness` returns `rawPercent` 60, `effectivePercent` 60 and 3 `substituted` entries (AC 13) · done
Proof: `packages/engine/__tests__/readiness.spec.ts -t "effectivePercent counts exact copies only"`

**C2** - A `substituted` entry carries `original` and `match` and no `approved` property, and the fifth argument of `computeEffectiveReadiness` is the protected-copies map: passing `{ card::slot -> 1 }` there sends one copy straight to `missing` (door 2) · done
Proof: `packages/engine/__tests__/readiness.spec.ts -t "suggestions carry no approval and the fifth input protects copies"`

**C3** - For a deck whose every missing copy has a stand-in, `path` is `B`, `fidelityPercent` is the tier-weighted value (exact + 0.9 per tier 1 copy over total) and `effectivePercent` stays below 100; for a deck with a copy no stand-in covers, `path` is `C` (AC 14) · done
Proof: `packages/engine/__tests__/readiness.spec.ts -t "suggestions, fidelity and path come from the collection alone"`

**C4** - The deck-import recompute of the owner's other decks calls `computeAndStoreReadiness` with exactly `(deckId, userId)`, the inputs a deck read recomputes with, and `computeAndStoreReadiness` has no approval or exclusion parameter (AC 15) · done
Proof: `apps/api/src/decks/import/__tests__/decks-import.service.spec.ts -t "recomputes the other decks with the inputs a deck read uses"`
Proof: `pnpm --filter @rathe-arsenal/engine build && pnpm --filter @rathe-arsenal/api typecheck`

**C5** - For a deck with two suggestions, `GET /api/decks` and `GET /api/decks/:deckId` both answer `effectivePercent` equal to `rawPercent`, and the deck read's `fidelityPercent` is above it (AC 16) (reworded during build: the list item carries no `fidelityPercent`) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the list and the deck read count the deck as it is"`

**C6** - `GET /api/decks/:deckId` breakdown `substituted` entries have no `approved` field (Impact, API response) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the list and the deck read count the deck as it is"`

**C7** - With the user's snapshots deleted, the first `GET /api/decks` stores exactly one fresh snapshot for each of the user's 2 decks, and a first `GET /api/decks/:deckId` on a deck with none stores one (AC 17) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the first read after the truncate stores a fresh snapshot"`

### S1 - one click uses the collection's best card · 12 files · 150 KB · ~38k

**C8** - `POST /api/decks/:deckId/replacements` with `pickedFrom: suggested` and the deck's suggestion answers `201` with `replacement.pickedFrom` `suggested` and `quantity` 2, the deck holds 2 copies of the suggestion and none of the original in that slot, and `card_replacement` holds one `active` row with `pickedFrom` `suggested` (AC 2, 4, 5) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "a one-click use is a pick recorded as suggested"`

**C9** - When the owner has 1 copy of the suggestion for 2 missing copies, a use moves both: the deck holds 2 copies of the suggestion, the next snapshot counts 1 of them exact and 1 missing, and none gets a stand-in (Flow 3, a use moves what a pick moves) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "a use moves every missing copy even when the collection covers fewer"`

**C10** - The pick route answers `400` for `pickedFrom: swap` and changes nothing, and `201` for `pickedFrom: suggested` (AC 4) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "accepts suggested and refuses swap as an origin"`

**C11** - After a use, `GET /api/decks/:deckId` lists the replacement under `replacements` with the original's identifier and name, which is what the deck list marks "no lugar de" (AC 5) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "a one-click use is a pick recorded as suggested"`

**C12** - The suggestion of each missing row, table-driven over 4 rows: a card whose copies got stand-ins A then B -> A; a card with no stand-in -> none; a card in two slots -> one suggestion per slot; a row whose copies are all held by an active replacement -> none; N for that deck is 2 (AC 1, 3, 6)
Proof: `apps/web/src/components/deck-detail/__tests__/deckDetailModel.spec.ts -t "a missing row's suggestion is the first stand-in found for its card and slot"`

**C13** - A missing row with a suggestion shows the suggestion as "Erase Face (Vermelho)", the label "da sua coleção", a button "Usar" and the button "Ver alternativas" (AC 1)
Proof: `apps/web/src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "shows the collection's suggestion with Usar beside Ver alternativas"`

**C14** - A missing row without a suggestion shows "Ver alternativas" and no "Usar" and no "da sua coleção" (AC 3)
Proof: `apps/web/src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "a row without a suggestion offers only the alternatives"`

**C15** - Pressing "Usar" sends one `POST /api/decks/7/replacements` with `{ originalCardIdentifier, slot, replacementCardIdentifier: <suggestion>, pickedFrom: 'suggested' }`, the button is disabled while it runs, and a `409` `NOTHING_TO_REPLACE` shows the localized message the alternatives sheet shows (AC 2, Observable loading and error)
Proof: `apps/web/src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "Usar sends the suggestion as a suggested pick"`

**C16** - In the browser, on the fixture's swap deck, "Usar" on the first missing row with a suggestion removes that card from the missing panel after the deck reloads, and the deck list shows one "no lugar de" mark naming it (AC 2, 5, S1 independent test)
Proof: `apps/web/tests/e2e/suggestions-flow.spec.ts -g "Usar on a missing row uses the collection's card"`

### S2 - every suggestion at once · 12 files · 140 KB · ~35k

**C17** - The bulk rule, table-driven over 6 rows: two suggestions, both legal and owned -> 2 uses, 0 skipped; a suggestion whose copies would exceed the copy limit (deck holds 2, needed 2, limit 3) -> skipped; a suggestion illegal for the hero -> skipped; a suggestion with no free copy left after an earlier use in the batch (owned 2, the earlier use moved 2) -> skipped; two rows suggesting the same card where the first use reaches the limit -> the second skipped; a row whose copies are all held by replacements -> no use and not counted (AC 8, 10) · done
Proof: `apps/api/src/replacements/__tests__/plan-suggested-uses.spec.ts -t "plans one use per suggestion and skips what cannot take its place"`

**C18** - `POST /api/decks/:deckId/replacements/suggested` on a deck with 2 suggestions answers `201` with `replacements` of 2 rows, each `pickedFrom` `suggested` and `status` `active`, and `skipped` 0; the deck holds the moved copies; the deck's snapshot rows grow by exactly 1 (AC 7, 8, door 3) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the bulk route uses every suggestion with one recompute"`

**C19** - On a deck with no suggestion the bulk route answers `409` with `code` `NOTHING_TO_REPLACE`, and the deck cards, the `card_replacement` rows and the snapshot count are unchanged (AC 9) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the bulk route refuses a deck with no suggestion"`

**C20** - On a deck that already holds 2 copies of the emissary's stand-in, where the emissary's 2 missing copies would take it to 4, the bulk route answers `201` with 1 replacement (the other card's) and `skipped` 1, and the emissary stays in the deck (AC 10) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the bulk route skips a suggestion past the copy limit and uses the others"`

**C21** - Two bulk requests sent together on one deck answer `201` and `409` `NOTHING_TO_REPLACE`, and the deck ends with exactly the replacements of one run (AC 11) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "two bulk requests race and one finds nothing left"`

**C22** - The bulk route answers `401` without a token, and `404` for another user's deck and for a deck id that does not exist (Surface) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the bulk route refuses anonymous and foreign decks"`

**C23** - The status strip, table-driven over 3 states: complete -> "Sua coleção cobre o deck inteiro."; 4 missing copies and no suggestion -> "Faltam 4 cartas." with no use button; 5 missing copies and 3 suggestions -> a message containing "Dá para cobrir 3 cartas com a sua coleção" and a button "Usar as 3"; no state shows "Ver trocas" (AC 6, 20, 23)
Proof: `apps/web/src/components/deck-detail/__tests__/DeckStatusStrip.spec.tsx -t "says what the collection covers in each state"`

**C24** - Pressing "Usar as 3" sends exactly one `POST /api/decks/7/replacements/suggested`, disables the button while it runs, and a `409` `NOTHING_TO_REPLACE` shows the localized message (AC 7, Observable error)
Proof: `apps/web/src/components/deck-detail/__tests__/DeckStatusStrip.spec.tsx -t "Usar as N sends one bulk request"`

**C25** - The onboarding's first-review step, on a deck with 3 suggestions, shows "Usar as 3 cartas da coleção" and "Agora não" and no approve or reject button; the first sends one bulk request and then completes the step, the second completes it with no request; with no suggestion it shows the "looking good" variant (AC 12)
Proof: `apps/web/src/components/onboarding/__tests__/Step3FirstReview.spec.tsx -t "offers to use every suggestion or not now"`
Proof: `apps/web/src/components/onboarding/__tests__/Step3FirstReview.spec.tsx -t "a deck with no suggestion shows the looking good step"`

**C26** - In the browser, on the fixture's swap deck, "Usar as 3" in the status strip leaves 3 "no lugar de" marks in the deck list and the strip no longer offers a use (S2 independent test)
Proof: `apps/web/tests/e2e/suggestions-flow.spec.ts -g "Usar as N uses every suggestion"`

### S4 - the swap feature is gone · 60 files deleted, 20 edited · 170 KB · ~43k

**C27** - The top bar and the bottom tab bar render no link named "Trocas" and none to `/swaps` (AC 18)
Proof: `apps/web/src/components/shell/__tests__/TopBar.spec.tsx -t "has no swaps entry"`
Proof: `apps/web/src/components/shell/__tests__/BottomTabBar.spec.tsx -t "has no swaps entry"`

**C28** - In the browser, opening `/swaps` and `/reviews` lands on `/` (AC 19)
Proof: `apps/web/tests/e2e/suggestions-flow.spec.ts -g "the swaps addresses lead home"`

**C29** - The deck page for a deck with suggestions renders no swaps panel (`deck-swaps-panel`), no modified-view banner and no link to `/swaps` (AC 20)
Proof: `apps/web/src/components/deck-detail/__tests__/DeckDetailView.suggestions.spec.tsx -t "shows no swaps panel, banner or link"`

**C30** - With a valid token, `GET /api/swaps` and `POST /api/swaps/<uuid>/approve`, `/reject`, `/revert`, `/restore` and `/outcome` each answer `404` (AC 21) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "the swaps routes are gone"`

**C31** - The migration's `up`, on a schema holding `swap_suggestion` with an approved and a pending row and `deck_readiness_snapshot` with 2 rows, leaves no `swap_suggestion` table and 0 snapshot rows; its `down` recreates `swap_suggestion` empty (AC 17, 22, door 4) · done
Proof: `apps/api/src/database/migrations/__tests__/drop-swap-suggestion.migration.int-spec.ts -t "drops the swap table and empties the snapshots"`

**C32** - After the migration's `up`, `card_replacement` accepts each of the 7 origins `very_close`, `close`, `other_pitch`, `generic`, `search`, `recommendation`, `suggested` and refuses `swap`; after `down` it refuses `suggested` again (door 1) · done
Proof: `apps/api/src/database/migrations/__tests__/drop-swap-suggestion.migration.int-spec.ts -t "accepts suggested as a replacement origin"`

**C33** - With `swap_suggestion` dropped from the e2e database, each recompute path answers 2xx: deck list, deck read, composition save, pick, revert, bulk use, alternatives list, collection batch add, mark owned, and deck import (AC 22) · done
Proof: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts -t "every recompute path runs without a swap table"`

**C34** - No API source outside the migrations names the swap table or its entity, and the API typechecks (AC 22) · done
Proof: `! git grep -nE "swap_suggestion|SwapSuggestion|SwapsReconciliation" -- apps/api/src ':!apps/api/src/database/migrations'`
Proof: `pnpm --filter @rathe-arsenal/engine build && pnpm --filter @rathe-arsenal/api typecheck`

**C35** - The two earlier migrations' int-specs still pass with the new migration in the chain (door 4 does not break the history) · done
Proof: `apps/api/src/database/migrations/__tests__/redesign-migrations-on-synchronized-schema.int-spec.ts -t "rebuilds an empty synchronize-created swap_suggestion with the migration-owned constraints"`
Proof: `apps/api/src/database/migrations/__tests__/replace-substitute-decision-with-swap-suggestion.int-spec.ts -t "up() drops substitute_decision"`
Proof: `apps/api/src/database/migrations/__tests__/replace-substitute-decision-with-swap-suggestion.int-spec.ts -t "down() recreates substitute_decision"`

**C36** - No web source outside the routes' redirect stubs imports the swaps client or the swaps components, and the web app typechecks (AC 18, 20)
Proof: `! git grep -nE "api/swaps|components/swaps|SwapsPanel|ModifiedViewBanner" -- apps/web/src`
Proof: `pnpm --filter @rathe-arsenal/web typecheck`

**C37** - The full suites are green after the removal: engine, API unit, web unit, and the Playwright e2e project (rule: removed tests are listed below, none skipped)
Proof: `pnpm --filter @rathe-arsenal/engine test && pnpm --filter @rathe-arsenal/api test && pnpm --filter @rathe-arsenal/web test`
Proof: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium`

### Kept obligations the change must not break

**C38** - The pick route still answers `400` for a malformed body, `401` without a token, `404` for another user's deck exactly as for a missing deck, and `409` `NOTHING_TO_REPLACE` when nothing is missing (Surface, pick route statuses) · done
Proof: `apps/api/src/replacements/__tests__/replacements.e2e-spec.ts -t "rejects malformed picks with 400"`
Proof: `apps/api/src/replacements/__tests__/replacements.e2e-spec.ts -t "rejects every replacement route without a token"`
Proof: `apps/api/src/replacements/__tests__/replacements.e2e-spec.ts -t "answers another user's deck exactly like a missing deck"`
Proof: `apps/api/src/replacements/__tests__/replacements.e2e-spec.ts -t "refuses a pick when nothing is missing"`

**C39** - Every new pt-BR string has its en-US key: the two catalogs expose an identical set of key paths (AC 1, 6, 12, 23 in both languages)
Proof: `apps/web/src/i18n/__tests__/catalog-parity.spec.ts -t "pt-BR and en-US expose an identical set of translation key paths"`

### Tests removed with the code they covered

Removed because the code they prove is deleted, not to make a suite pass:

- API `apps/api/src/swaps/__tests__/`: `backfill-swap-suggestions.spec.ts`, `build-current-deck-slots.spec.ts`, `build-swap-row.spec.ts`, `group-fresh-swap-entries.spec.ts`, `reconcile-swap-suggestions.spec.ts`, `resolve-swap-transition.spec.ts`, `swap-suggestion-query.service.spec.ts`, `swaps-reconciliation.service.spec.ts`, `swaps.controller.e2e-spec.ts`, `swaps.controller.spec.ts`, `swaps.service.spec.ts` - the swaps module, its reconciliation and its backfill.
- engine `packages/engine/__tests__/readiness.spec.ts`: the `excludedIdentifiers parameter (re-solve)` and `approvedIdentifiers parameter (D7/SWAP-13)` describes and the Path B "not yet approved" case - the two inputs door 2 removes. `findSubstitution` keeps its own exclusion input and its tests.
- API `replacements.e2e-spec.ts`: "a pick retires the original's pending and approved swaps" - the swap rows it checked no longer exist.
- web: `api/__tests__/swaps.spec.ts`, `components/swaps/__tests__/` (4 files), `deck-detail/__tests__/SwapsPanel.spec.tsx`, `deck-detail/__tests__/ModifiedViewBanner.spec.tsx`, `routes/_auth/__tests__/-swaps.helpers.test.ts`, `-swaps.test.tsx`, `swaps.test.tsx` - the Swaps page, the panel, the banner and the client.
- Playwright: `tests/e2e/swaps.spec.ts`, `tests/e2e/swaps-state-transitions.spec.ts`, and the `swaps` surface of the visual suite with its baselines.
- Swap-only cases inside kept files (deck page mutations, onboarding wizard, plan-b flow, update-composition, orphan cleanup) are removed case by case and named in the commit that removes them.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /api/decks/:deckId/replacements` statuses (5) | 201 C8 · 400 C10, C38 · 401 C38 · 404 C38 · 409 C38 | - |
| `POST /api/decks/:deckId/replacements/suggested` statuses (4) | 201 C18 · 401 C22 · 404 C22 · 409 C19, C21 | - |
| removed swaps routes (6) | `GET /api/swaps` C30 · approve C30 · reject C30 · revert C30 · restore C30 · outcome C30 | - |
| `card_replacement.pickedFrom` values (8) | `very_close` C32 · `close` C32 · `other_pitch` C32 · `generic` C32 · `search` C32 · `recommendation` C32 · `suggested` C32, C8 · `swap` refused C32, C10 | - |
| bulk outcomes per suggestion (5) | used C17, C18 · copy limit C17, C20 · hero-illegal C17 · no free copy C17 · held by replacements C17 | - |
| missing-row suggestion cases (4) | first of two stand-ins C12 · none C12, C14 · two slots C12 · held by replacement C12 | - |
| status strip states (3) | complete C23 · missing without suggestion C23 · with suggestions C23 | - |
| onboarding first-review variants (2) | with suggestions C25 · without C25 | - |
| recompute paths that read approvals before (10) | deck list C33, C7 · deck read C33, C7 · composition save C33 · pick and revert C33 · bulk C33 · alternatives C33 · collection batch C33 · mark owned C33 · CSV upload and sources and Fabrary collection import C34 · deck import C33, C4 | - |
| readiness fields (4) | `effectivePercent` C1, C5 · `substituted` C1, C2, C6 · `fidelityPercent` C3, C5 · `path` C3 | - |
| Landing doors (4) | door 1 C32, C8 · door 2 C2, C1 · door 3 C18 · door 4 C31, C35 | - |
| Relations entities (2) | `card_replacement` C8, C32 · `swap_suggestion` C31, C34 | - |
| removed web surfaces (4) | nav C27 · `/swaps` and `/reviews` C28 · deck-page panel and banner C29 · client and components C36 | - |
| startup config: modules the app mounts (1 assembly) | `AppModule`, booted by every e2e here, C30, C33 | - |
| locales (2) | pt-BR C13, C23, C25 · en-US C39 | - |

- Claims naming a status code, route or response shape: C5, C6, C8, C10, C18, C19, C20, C21, C22, C30 - each crosses the route against Postgres.
- The bulk rule is proven at its own layer over every outcome (C17); the route proves one skip reason end to end (C20) and the race (C21).
- The migration is proven by running its own `up` and `down` (C31, C32); the e2e database is built by `synchronize`, so the e2e checks prove the code, not the migration.

## Test policy

The repo's testing rules name the test types and where they live; they do not say which level proves a decision or how much of its input space must be asserted. Rows for this change:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the bulk rule) | one at its own layer **and** one at the route against Postgres | every outcome at its own layer; the route asserts the clean run, one skip, the refusal and the race |
| Decides, not reached across a boundary (readiness math, the missing-row suggestion, strip copy) | one at its own layer | one asserted case per row |
| Schema change (the migration) | its own `up` and `down` against Postgres | every allowed origin, the refused one, the dropped table and the emptied snapshots |
| Removal (routes, screens, imports) | one observable absence each | a `404`, a redirect, a missing element, or a grep that exits 0 |

Evidence:

- the bulk rule: per suggestion, 4 outcomes plus the held-by-replacements case, and state carried across the batch (copies moved earlier) -> decides, about 7 branch points
- readiness: the `effectivePercent` formula loses its approval branch; the suggestion per row folds entries by (card, slot) with 3 branches -> decides
- closest analogue: `apps/api/src/replacements/adoption-rules.ts` is a pure decision proven in `adoption-rules.spec.ts` and again at the route in `card-recommendations` e2e; `card-replacement.migration.int-spec.ts` is the precedent for a migration proven by its own `up`

Cost: about 15 proofs at their own layer across 6 test files, one new e2e file, one new int-spec and one new Playwright file.

## Swept

- validation: C10 - `pickedFrom` refuses `swap`; the bulk route takes no body
- failure modes: C19, C20 - nothing to use, a suggestion past the copy limit; C15, C24 - refusals shown on screen
- idempotency: C21 - a second bulk run finds nothing left and changes nothing
- authorization: existing - `OwnsTrackedDeckGuard` on the bulk route, as on the pick route; C22 asserts `401` and `404`
- concurrency: C21 - the `tracked_deck` lock serializes two bulk runs
- data lifecycle: C31 - approved, pending and rejected swaps are dropped with the table; C7 - snapshots are rebuilt on the next read
- dependency failure: n/a - the change calls no external service; the recommendation queue enqueue after a use is the existing pick behavior
- state transitions: C8, C18 - a use creates an `active` replacement that the existing revert and keep close
- observability: n/a - the plan sets no logging requirement; the bulk route logs `replacements.used_suggestions` with the deck, the count used and the count skipped, as `replacements.picked` does for a pick

## Handoff

- Existing files read and edited, measured with `wc -c`: engine `readiness/compute.ts`, `types.ts`, `readiness.spec.ts` 64 KB; api recompute paths (`substitution.service.ts` and spec, `decks.service.ts` and its two largest specs, four collection services, the import service and spec) 223 KB; api pick path (`replacements.service.ts`, controller, `alternatives.service.ts`, entity, e2e spec and fixture, unit spec, the previous `pickedFrom` migration and its int-spec) 88 KB; web (deck model, strip, missing panel, view, action panels, deck route, onboarding step, two api clients, their specs, two locales, two nav components, root route, Playwright fixture seed) 142 KB; other specs carrying swap cases (deck route mutations, plan-b flow, orphan cleanup, onboarding wizard, visual suite) 115 KB = 632 KB
- New files, estimated: bulk rule and spec 12 KB, bulk route e2e 18 KB, migration and int-spec 12 KB, Playwright flow 6 KB, deck-view spec 4 KB = 52 KB; deleted files cost no reading
- Total about 684 KB / 4 = ~171k tokens. In build order: S3 = 73k (engine and every recompute path); S1 enters the pick path at 111k; S2 at 146k; S4 enters the removal at 189k -> over the 150k budget; proposed cut after S2, where the surface changes from building the new flow to deleting the old one
- Mechanism: one builder (compaction accepted) — the owner's choice on 2026-10-11
