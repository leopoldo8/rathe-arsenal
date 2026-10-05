# Card alternatives checks

Profile: standard
Plan: `.specs/features/card-alternatives/plan.md`

70 checks in 3 slices · 5 one-way doors · 1 open, of which 0 block

Proof commands, by suite (each proof below names its file and test):

- engine: `pnpm --filter @rathe-arsenal/engine exec jest <file> -t "<test>"`
- api unit: `pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"`
- api int: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' <file> -t "<test>"` (needs the local Postgres)
- api e2e: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"` (needs the local Postgres and `apps/api/.env`)
- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"`
- web e2e: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium <file> -g "<test>"` (needs `pnpm dev` running and `pnpm seed:fixture`)

API fixture used by the e2e checks unless a check says otherwise: a Classic Constructed deck for `katsu-the-wanderer` with `emissary-of-tides-red` x2 and `flex-red` x2 in `mainboard` and `talishar-the-lost-prince` x1 in `weapon`, the shape `swaps.controller.e2e-spec.ts` already seeds.
For `emissary-of-tides-red` the catalog holds 21 tier 1 candidates, 64 more at tier 2, 133 more with pitch relaxed and 9 more in Generic (measured 2026-10-04 with `scoreCandidate`, before the legality filter).

## Checks

### S1 - Grouped alternatives for one missing card · 18 files · 230 KB · ~58k

**C1** - `needed` equals the slot's `notOwned` quantity from a fresh readiness compute minus the copies active replacements of that card hold in that slot: with nothing owned, `emissary-of-tides-red` in `mainboard` gives `needed: 2`; with 1 copy owned, `needed: 1`; with one active replacement holding 2 copies of `coax-a-commotion-red` in `mainboard` and none owned, `needed` for `coax-a-commotion-red` is 0 (AC 1) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/alternatives.service.spec.ts -t "needed is the slot's not-owned copies minus protected copies"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand alternatives.e2e-spec -t "returns needed 2 for a card missing both copies"`

**C2** - Without `q`, groups come in the order `very_close`, `close`, `other_pitch`, `generic`, an empty group is absent, and no group holds more than 10 cards; for `emissary-of-tides-red` in the Katsu deck `very_close` holds exactly 10 (AC 2) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "orders the four groups, drops empty ones and caps each at 10"`

**C3** - `very_close` accepts a candidate exactly when `scoreCandidate(missing, candidate, TIER_1_CONFIG)` is not null and at least 0.90; table-driven over 9 cases, each rejecting on one gate: other pitch, no shared class, no shared type, no shared talent when the missing card has one, no shared keyword when the missing card has one, other equipment body slot, power delta 2, defense delta 2, score below 0.90 (AC 3) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "very_close applies every tier 1 gate"`

**C4** - `close` accepts a candidate exactly when `scoreCandidate(missing, candidate, TIER_2_CONFIG)` is not null and at least 0.70: a zero-keyword-overlap candidate with power delta 2 is accepted, power delta 3 is rejected, a score below 0.70 is rejected (AC 4) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "close applies the tier 2 gates and floor"`

**C5** - `other_pitch` accepts a candidate of a different pitch that `close` would accept at the missing card's pitch, and rejects one that `close` would reject at that pitch (no shared class) (AC 5) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "other_pitch relaxes only the pitch"`

**C6** - `generic` accepts a Generic-class candidate with the missing card's pitch, a shared type, the same body slot for equipment and power and defense within 2, and rejects one case per gate: non-Generic class, other pitch, no shared type, other body slot, power delta 3, defense delta 3 (AC 6) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "generic applies its six gates"`

**C7** - A candidate both `very_close` and `generic` would accept appears once, in `very_close`; across a full response for `emissary-of-tides-red` no `cardIdentifier` repeats (AC 7) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "lists a card once, in the strictest group"`

**C8** - No response, grouped or `search`, contains the missing card's own identifier, a Hero card or a Token card; the search `q=Katsu` returns no Hero card (AC 8) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "never lists itself, a hero or a token"`

**C9** - A candidate is dropped when it is banned in the format, not legal in the format, not legal for the deck's hero, or outside Silver Age rarities in a Silver Age deck; the same four rules drop it when the missing card sits in `equipment`; each of the 4 x 2 cases is a table row with a real catalog card (AC 9) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/legality/card-legality.spec.ts -t "rejects each per-card rule in mainboard and equipment"`
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "drops candidates the per-card legality rejects"`

**C10** - The copy limit counts the candidate's copies in every slot plus `needed`: in Classic Constructed, 1 held + 2 needed is listed and 2 held + 2 needed is not; in Blitz, 0 held + 2 needed is listed and 1 held + 2 needed is not; a Legendary card with 0 held + 1 needed is listed and 1 held + 1 needed is not (AC 10) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "enforces the copy limit across slots"`

**C11** - Inside a group, cards sort by score plus 0.05 when `freeCopies >= needed`: an owned card 0.04 below an unowned one sorts first, an owned card 0.06 below sorts second, equal adjusted scores sort by name ascending, and an owned card never moves into a stricter group (AC 11) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "orders by score with the owned bonus of 0.05"`

**C12** - `freeCopies` is owned copies across active sources minus copies in this deck in any slot, floored at 0: owned 3 with 1 in `mainboard` gives 2; owned 1 with 2 in the deck gives 0; copies in an inactive source do not count (AC 12) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/alternatives.service.spec.ts -t "freeCopies subtracts this deck's copies"`

**C13** - For a listed card in stock, `priceCents` equals the shopping line's `unitPriceCents` for that card at quantity `needed` and `productUrl` equals its validated URL, both on the listing path and on the fresh-variant path (cheapest variant) (AC 13) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/alternatives.service.spec.ts -t "prices match the shopping line on both paths"`

**C14** - `priceCents` and `productUrl` are both `null` and the card is still listed when the store has no row for it, when its quantity is 0, when its price is null, and when no active `cupula-dt` store exists (AC 14) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/alternatives.service.spec.ts -t "lists out-of-stock cards with null price"`

**C15** - Each card's `rationale` carries `tier`, `pitch`, `sharedClasses`, `powerDelta`, `defenseDelta`, `sharedKeywords` equal to `describeRationale(missing, card, tier)`, plus `relaxed`: `null` in `very_close` and `close`, `pitch` in `other_pitch`, `class` in `generic` (AC 15) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "rationale carries the swap detail and the relaxed rule"`

**C16** - With `q`, the response is exactly one group `search`, at most 10 cards whose name contains `q` ignoring case, names starting with `q` before names only containing it, filtered by C8, C9 and C10: `q=sink` lists `sink-below-red` before any card that only contains "sink"; a query matching more than 10 legal cards returns 10 (AC 16) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/alternatives.spec.ts -t "search group matches by name with legality"`

**C17** - `q` bounds: 1 character after trimming returns `400`, 2 returns `200`, 50 returns `200`, 51 returns `400`; `q="  a  "` returns `400` (AC 17) (extended after verification: a request without `cardIdentifier` and one without `slot` each return `400`) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand alternatives.e2e-spec -t "bounds q between 2 and 50 characters"`

**C18** - For `talishar-the-lost-prince` in `weapon` missing 1 copy, and for the hero in `hero`, the route returns `200` with `groups: []`, with and without `q` (AC 18) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand alternatives.e2e-spec -t "returns no groups for hero and weapon slots"`

**C19** - The route returns `409` with code `NOTHING_TO_REPLACE` for a card fully owned in that slot, for a card not in the deck, and for a card whose missing copies are all held by an active replacement (AC 19) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand alternatives.e2e-spec -t "answers 409 NOTHING_TO_REPLACE when nothing is missing"`

**C20** - For a deck id that does not exist and for another user's deck, `GET .../alternatives`, `POST .../replacements` and `GET /api/decks/:deckId` each return `404` with the same body (AC 20) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "answers another user's deck exactly like a missing deck"`

**C21** - A `200` from the alternatives route logs exactly one `alternatives.listed` line with `userId`, `trackedDeckId`, `cardIdentifier`, `slot`, `needed`, the card count per group and `hasQuery`; a `409` logs none (AC 21) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/alternatives.service.spec.ts -t "logs alternatives.listed once per answered request"`

**C22** - A `200` body has `needed` and `groups[]`, each group `group` and `cards[]`, each card exactly `cardIdentifier`, `name`, `pitch`, `imageUrl`, `freeCopies`, `priceCents`, `productUrl`, `rationale` (Surface) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand alternatives.e2e-spec -t "answers with the documented shape"`

**C23** - The missing panel shows an "Alternatives" control on a `mainboard` row and an `equipment` row, none on a `hero` or `weapon` row, and none on a row whose copies are all held by an active replacement (AC 22) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "shows Alternatives only on replaceable rows"`

**C24** - The deck's swaps panel shows the "Alternatives" control on an approved row and not on a pending or rejected row (AC 23) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/SwapsPanel.spec.tsx -t "shows Alternatives on approved rows only"`

**C25** - The open sheet names the missing card and its `needed` count, shows each group under its localized label in response order, and each card's art, name, pitch and localized rationale (AC 24) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "renders the groups and each card"`

**C26** - A card with `freeCopies` 2 and `needed` 2 shows "owned"; a card with `freeCopies` 1 and `needed` 2 shows "1 free" (en-US) (AC 25) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "marks owned and free copies"`

**C27** - A not-owned card with `priceCents` 350 shows "R$ 3,50" linking to its `productUrl`; a not-owned card with `priceCents: null` shows "out of stock"; an owned card shows no price (AC 26) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "shows price or out of stock for cards not owned"`

**C28** - While the request is pending the sheet shows its loading state and no group (AC 27) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "shows loading while fetching"`

**C29** - When the request fails with `500`, the sheet shows the localized error and a retry control that refetches (AC 28) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "shows error with retry"`

**C30** - When the response has `groups: []`, the sheet shows the no-alternatives message and the name search input has focus (AC 29) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "focuses the search when nothing fits"`

**C31** - Typing "s" sends no search request; typing "si" requests with `q=si` and the sheet shows the `search` group in place of the four groups (AC 30) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "searches by name from 2 characters"`

### S2 - Pick an alternative as a replacement, and undo it · 20 files · 260 KB · ~65k

**C32** - A pick of `coax-a-commotion-red` (not owned) for `emissary-of-tides-red` x2 missing in `mainboard` returns `201` with `replacement` of `slot: mainboard`, both identifiers, `quantity: 2`, `pickedFrom: very_close`, `status: active`, `resolvedAt: null`; afterwards `deck_card` has no `emissary-of-tides-red` row and a `coax-a-commotion-red` row with quantity 2. Second fixture: with 1 `emissary` owned and `coax` x1 already in `mainboard`, the pick moves 1 copy, leaving `emissary` x1 and `coax` x2 (AC 31) (extended after verification: the row shapes deleted at 0, reduced, created and increased are also proven at the service layer) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "a pick moves the missing copies and records the original"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/replacements.service.spec.ts -t "pick (deletes|reduces)"`

**C33** - Right after the pick's `201`, the deck's newest `deck_readiness_snapshot` lists `coax-a-commotion-red` x2 in `breakdown.missing` and no `emissary-of-tides-red` copy anywhere in `breakdown` (AC 32) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "the snapshot after a pick shows the moved copies"`

**C34** - Active replacements reach the engine on every recompute path: `runReadiness` loads them through the passed manager and passes their copy counts to `computeEffectiveReadiness`; `updateComposition` passes them to both of its engine calls; end to end, owning a tier 1 candidate of an unowned active replacement and then marking another card owned leaves the replacement in `breakdown.missing` with no `substituted` entry (AC 33) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/substitution/__tests__/substitution.service.spec.ts -t "passes active replacements to the engine through the manager"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/decks/__tests__/decks.service.update-composition.spec.ts -t "passes active replacements to both engine passes"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "a later recompute gives a protected replacement no stand-in"`

**C35** - With `m` = 3 copies not covered exactly and an owned tier 1 candidate for each: protected count 0 gives 3 substituted; 1 gives 2 substituted and 1 missing; 3 gives 0 substituted and 3 missing; 5 gives 0 substituted and 3 missing; a count for the same card in another slot changes nothing (AC 34) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/readiness.spec.ts -t "protected copies get no stand-in"`

**C36** - Calling `computeEffectiveReadiness` without the protected input and with an empty one gives deep-equal results for every deck in the readiness suite, and the existing readiness and gold-set suites pass with their files unchanged (AC 35) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest __tests__/readiness.spec.ts -t "an empty protected input changes nothing"`
Proof: `git diff --exit-code origin/main -- packages/engine/__tests__/gold-set-regression.spec.ts && pnpm --filter @rathe-arsenal/engine exec jest __tests__/gold-set-regression.spec.ts`

**C37** - `TIER_1_CONFIG` is `{ tier: 1, requireKeywordOverlap: true, keywordPenaltyWeight: 0.35, maxPowerDelta: 1, maxDefenseDelta: 1, floorScore: 0.9 }` and `TIER_2_CONFIG` is `{ tier: 2, requireKeywordOverlap: false, keywordPenaltyWeight: 0.15, maxPowerDelta: 2, maxDefenseDelta: 2, floorScore: 0.7 }` (AC 36) · done
Proof: `git diff --exit-code origin/main -- packages/engine/src/substitution/constants.ts`

**C38** - `computeDeckLegality` returns the same verdicts as before: its spec file is unchanged and passes (AC 37) · done
Proof: `git diff --exit-code origin/main -- packages/engine/__tests__/legality/compute.spec.ts && pnpm --filter @rathe-arsenal/engine exec jest __tests__/legality/compute.spec.ts`

**C39** - Before the pick the deck holds `swap_suggestion` rows for (`emissary-of-tides-red`, `mainboard`) in `pending`, `approved` and `rejected`; after the pick the first two are `retired` and the `rejected` row is unchanged, and `GET /api/swaps?state=all` lists none of the retired ones (AC 38) (extended after verification: also proven at the service layer over `pending`, `approved` and `rejected`) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "a pick retires the original's pending and approved swaps"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/replacements.service.spec.ts -t "retires only the original"`

**C40** - A pick returns `409` with code `REPLACEMENT_ILLEGAL` and leaves `deck_card`, `card_replacement` and `swap_suggestion` unchanged for: a card not legal for Katsu, a card that would exceed 3 copies, the slot `weapon`, the slot `hero`, and the original itself as replacement (AC 39) (extended after verification: each of the five causes is also proven at the service layer, writing nothing) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "refuses an illegal replacement and changes nothing"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/replacements.service.spec.ts -t "as REPLACEMENT_ILLEGAL and writes nothing"`

**C41** - A pick for a card with nothing missing in that slot returns `409` with code `NOTHING_TO_REPLACE` and changes no row (AC 40) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "refuses a pick when nothing is missing"`

**C42** - Two concurrent picks for `emissary-of-tides-red` in `mainboard` with different replacements: one `201`, one `409 NOTHING_TO_REPLACE`, one active `card_replacement` row, and `deck_card` holds exactly the winning replacement's 2 copies (AC 41) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "serializes two concurrent picks for one card"`

**C43** - A pick returns `400` and changes no row for: missing `slot`, missing `replacementCardIdentifier`, `pickedFrom: "other"`, an unknown `replacementCardIdentifier`, an unknown `originalCardIdentifier` (AC 42) (extended after verification: a body missing `originalCardIdentifier` and one missing `pickedFrom` also return `400`) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "rejects malformed picks with 400"`

**C44** - A committed pick logs exactly one `replacements.picked` line with `userId`, `trackedDeckId`, `originalCardIdentifier`, `replacementCardIdentifier`, `slot`, `quantity`, `pickedFrom` and `owned`; a refused pick logs none (AC 43) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/replacements.service.spec.ts -t "logs replacements.picked once per committed pick"`

**C45** - Reverting the C32 replacement returns `200` with `status: reverted` and `resolvedAt` set; `deck_card` again holds `emissary-of-tides-red` x2 and no `coax-a-commotion-red` row; for the second C32 fixture it leaves `emissary` x2 and `coax` x1 (AC 44) (extended after verification: the same four row shapes for a revert at the service layer, and keep leaves `deck_card` alone) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "revert moves the copies back"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/replacements.service.spec.ts -t "(revert (deletes|reduces)|keep leaves)"`

**C46** - Right after the revert's `200`, the newest snapshot lists `emissary-of-tides-red` x2 in `breakdown.missing` or `breakdown.substituted` and no `coax-a-commotion-red` copy (AC 45) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "the snapshot after a revert shows the original"`

**C47** - Revert and keep each return `409` with code `REPLACEMENT_NOT_ACTIVE` and change no row on a replacement in `kept`, `reverted` and `removed` (6 cases) (AC 46) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "refuses to resolve a closed replacement"`

**C48** - Revert and keep return `404` with the same body for an unknown uuid and for another user's replacement, and `400` for an id that is not a uuid (AC 47) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "answers another user's replacement like a missing one"`

**C49** - A composition save closes active replacements as `removed` with `resolvedAt` set: when it drops the replacement card from the slot; when it lowers it from 2 to 1 copy with one record of quantity 2; and when two records of quantity 1 each for the same card and slot face 1 remaining copy, both close (AC 48) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/decks/__tests__/decks.service.update-composition.spec.ts -t "closes replacements the save broke as removed"`
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "a composition save that drops the replacement closes it"`

**C50** - A composition save that keeps 3 copies of a replacement card with one record of quantity 2 leaves the record `active`, and the save's readiness result has no `substituted` entry for those 2 copies (AC 49) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/decks/__tests__/decks.service.update-composition.spec.ts -t "keeps replacements the save still covers"`

**C51** - After a pick, a revert, a keep and a save that removes a replacement, the deck's `card_replacement` row count is 4; deleting the deck leaves 0 rows for it; no source file calls `delete` or `remove` on the replacement repository (AC 50, door 1) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "never deletes a replacement row"`
Proof: `! grep -rnE "(CardReplacementEntity|replacementRepo|replacements?Repo)[^;]*\.(delete|remove)\(" apps/api/src --include='*.ts' --exclude-dir=__tests__`

**C52** - Against Postgres, the migration creates `card_replacement` and an insert fails for `status: 'open'`, `pickedFrom: 'other'`, `quantity: 0`, an `originalCardIdentifier` of 129 characters and a `slot` of 65 characters; a valid row inserts; dropping the deck cascades it (doors 1-4) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' card-replacement.migration -t "enforces the table's constraints"`

**C53** - Tapping a card in the sheet sends `POST /api/decks/:deckId/replacements` with that card's identifier and `pickedFrom` equal to its group (`search` for a search result), closes the sheet, and invalidates the deck detail and swaps queries (AC 51) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "a tap sends the pick with its group"`

**C54** - A pick answered with `409` shows the localized message of `NOTHING_TO_REPLACE`, `REPLACEMENT_ILLEGAL` and `REPLACEMENT_NOT_ACTIVE` respectively, and invalidates the deck detail query (AC 52) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "shows the localized 409 message"`

**C55** - A deck list cell whose card has an active replacement in that slot shows "in place of Emissary of Tides" (en-US) and an Undo control; a cell without one shows neither (AC 53) (extended after verification: with an original named `A Moment's Peace` the cell shows "in place of A Moment's Peace", the name the server sends) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/DeckList.replacement.spec.tsx -t "marks a replacement with its original and Undo"`

**C56** - A missing panel row for an unowned active replacement shows "in place of Emissary of Tides" (AC 54) (extended after verification: the same punctuation case in the missing panel row) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "marks a missing replacement with its original"`

**C57** - Undo sends `POST /api/replacements/:id/revert` for that replacement's id and invalidates the deck detail and swaps queries (AC 55) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/DeckList.replacement.spec.tsx -t "Undo sends the revert"`

**C58** - In the browser, on the fixture deck: open Alternatives from a missing row, see the groups, tap the first card, see "in place of" on the deck list, tap Undo, see the original back in the missing panel (S1, S2 independent tests) · done
Proof: `pnpm --filter @rathe-arsenal/web exec playwright test --project=e2e-chromium tests/e2e/card-alternatives-flow.spec.ts -g "pick an alternative and undo it"`

### S3 - The original returns · 8 files · 110 KB · ~28k

**C59** - `GET /api/decks/:deckId` lists one entry per active replacement with exactly `id`, `slot`, `originalCardIdentifier`, `replacementCardIdentifier`, `quantity`, `originalOwned`, and omits `kept`, `reverted` and `removed` ones (AC 56) (extended after verification: each entry also carries `originalName`, the catalog name of the original, `A Moment's Peace` for `a-moments-peace-blue`; a card gone from the catalog shows its identifier) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "the deck detail lists active replacements only"`

**C60** - For a replacement of quantity 2: owning 2 copies of the original with none in the deck gives `originalOwned: true`; owning 1 gives false; owning 3 with 2 already in another slot of this deck gives false; copies in an inactive source do not count (AC 57) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/decks/__tests__/decks.service.replacements.spec.ts -t "originalOwned compares free copies with the quantity"`

**C61** - A replacement cell with `originalOwned: true` shows the prompt with Keep and Go back controls (AC 58) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/DeckList.replacement.spec.tsx -t "prompts keep or go back when the original is owned"`

**C62** - A replacement cell with `originalOwned: false` shows no prompt (AC 59) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/DeckList.replacement.spec.tsx -t "shows no prompt while the original is not owned"`

**C63** - Keep on an active replacement returns `200` with `status: kept` and `resolvedAt` set, leaves `deck_card` unchanged, writes a new snapshot, and the deck detail no longer lists it (AC 60) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "keep closes the replacement and leaves the deck"`

**C64** - After keeping an unowned `coax-a-commotion-red` replacement and owning one of its tier 1 candidates, the next recompute lists a `substituted` entry for a `coax-a-commotion-red` copy (AC 61) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "a kept replacement can get a stand-in"`

**C65** - Go back sends `POST /api/replacements/:id/revert` and invalidates the deck detail and swaps queries; Keep sends `POST /api/replacements/:id/keep` and invalidates the same (AC 62, AC 60) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/DeckList.replacement.spec.tsx -t "Go back and Keep send their routes"`

**C66** - With an active replacement whose original is owned, the home deck tile and the `/swaps` page render no keep-or-go-back prompt (AC 63) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/home/__tests__/DeckTile.spec.tsx -t "shows no replacement prompt"`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/routes/_auth/__tests__/-swaps.test.tsx -t "shows no replacement prompt"`

**C67** - A committed keep and a committed revert each log exactly one `replacements.resolved` line with `userId`, `trackedDeckId`, `replacementId` and the new status; a refused one logs none (AC 64) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest src/replacements/__tests__/replacements.service.spec.ts -t "logs replacements.resolved once per committed resolution"`

**C68** - Every new key (sheet, group labels, marks, prompt, `apiErrors.NOTHING_TO_REPLACE`, `apiErrors.REPLACEMENT_ILLEGAL`, `apiErrors.REPLACEMENT_NOT_ACTIVE`) exists with non-empty copy in pt-BR and in en-US, and the catalogs keep key parity (AC 65) · done
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/i18n/__tests__/catalog-parity.spec.ts`
Proof: `pnpm --filter @rathe-arsenal/web exec vitest run src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "has copy for every new key in both locales"`

**C69** - With the real throttler, the 121st request inside one minute returns `429` for `GET .../alternatives`, `POST .../replacements`, `POST /api/replacements/:id/revert`, `POST /api/replacements/:id/keep` and `GET /api/decks/:deckId` (Surface) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements-throttle.e2e-spec -t "throttles the replacement routes"`

**C70** - Without a valid token, the same five routes return `401` (Surface) · done
Proof: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand replacements.e2e-spec -t "rejects every replacement route without a token"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `very_close` gates (9) | C3, table-driven over all 9 | - |
| `close` outcomes (3) | delta 2 accepted C4 · delta 3 rejected C4 · below floor rejected C4 | - |
| `other_pitch` outcomes (2) | relaxed pitch accepted C5 · other gate rejected C5 | - |
| `generic` gates (6) | C6, table-driven over all 6 | - |
| group order and cap (3) | order C2 · empty dropped C2 · cap 10 C2 | - |
| excluded cards (3) | itself C8 · Hero C8 · Token C8 | - |
| per-card legality rules, 4 rules x 2 slots (8) | C9, table-driven over all 8 | - |
| copy limit edges (6) | CC 3 listed C10 · CC 4 dropped C10 · Blitz 2 listed C10 · Blitz 3 dropped C10 · Legendary 1 listed C10 · Legendary 2 dropped C10 | - |
| in-group ordering (4) | bonus wins C11 · bonus loses C11 · name tie C11 · no group crossing C11 | - |
| `freeCopies` inputs (3) | deck copies subtracted C12 · floor 0 C12 · inactive source C12 | - |
| price paths (2) | listing C13 · fresh variant C13 | - |
| out-of-stock causes (4) | no row C14 · quantity 0 C14 · null price C14 · no store C14 | - |
| `relaxed` values (3) | `null` C15 · `pitch` C15 · `class` C15 | - |
| `q` edges (5) | 1 C17 · 2 C17 · 50 C17 · 51 C17 · whitespace-padded 1 C17 | - |
| no-groups slots (2) | `hero` C18 · `weapon` C18 | - |
| `NOTHING_TO_REPLACE` causes on read (3) | fully owned C19 · not in deck C19 · all protected C19 | - |
| `GET /api/decks/:deckId/alternatives` statuses (6) | 200 C22 · 400 C17 (`q`, no `cardIdentifier`, no `slot`) · 401 C70 · 404 C20 · 409 C19 · 429 C69 | - |
| `POST /api/decks/:deckId/replacements` statuses (6) | 201 C32 · 400 C43 · 401 C70 · 404 C20 · 409 C40, C41, C42 · 429 C69 | - |
| `POST /api/replacements/:id/revert` statuses (6) | 200 C45 · 400 C48 · 401 C70 · 404 C48 · 409 C47 · 429 C69 | - |
| `POST /api/replacements/:id/keep` statuses (6) | 200 C63 · 400 C48 · 401 C70 · 404 C48 · 409 C47 · 429 C69 | - |
| `GET /api/decks/:deckId` statuses (4) | 200 C59 · 401 C70 · 404 C20 · 429 C69 | - |
| pick refusals, 5 illegal + 1 empty + 7 malformed (13) | not for hero C40 · copy limit C40 · weapon C40 · hero C40 · itself C40 · nothing missing C41 · no slot C43 · no replacement C43 · no original C43 · no `pickedFrom` C43 · bad `pickedFrom` C43 · unknown replacement C43 · unknown original C43 | - |
| `deck_card` move shapes, in pick and in revert (4) | row deleted at 0 C32, C45 · row reduced C32, C45 · row created C32, C45 · row increased C32, C45 | - |
| replacement transitions, 3 allowed + 6 refused (9) | active -> reverted C45 · active -> kept C63 · active -> removed C49 · revert kept C47 · revert reverted C47 · revert removed C47 · keep kept C47 · keep reverted C47 · keep removed C47 | - |
| composition save outcomes (4) | card dropped C49 · lowered below C49 · two records summed C49 · still covered C50 | - |
| swap rows on pick (3) | `pending` retired C39 · `approved` retired C39 · `rejected` unchanged C39 | - |
| protected count cases (5) | 0 C35 · 1 C35 · equal C35 · above C35 · other slot C35 | - |
| recompute paths, as places (3) | `SubstitutionService.runReadiness`, shared by every `computeAndStoreReadiness` caller C34 · `updateComposition` in-transaction C34 · `updateComposition` post-commit C34 | - |
| snapshot freshness after a write (2) | pick C33 · revert C46 | - |
| `originalOwned` edges (4) | covered C60 · short by 1 C60 · deck copies subtracted C60 · inactive source C60 | - |
| sheet states (5) | groups C25 · loading C28 · error C29 · empty C30 · search C31 | - |
| replacement marks on deck page (4) | list cell C55 · missing row C56 · prompt C61 · no prompt C62 | - |
| web 409 codes (3) | `NOTHING_TO_REPLACE` C54 · `REPLACEMENT_ILLEGAL` C54 · `REPLACEMENT_NOT_ACTIVE` C54 | - |
| log events (3) | `alternatives.listed` C21 · `replacements.picked` C44 (owned true and false) · `replacements.resolved` C67 (`reverted` and `kept`) | - |
| locales (2) | pt-BR C68 · en-US C68 | - |
| Landing doors (5) | 1 record table C51, C52 · 2 status values C52 · 3 pick origin values C52 · 4 widths C52 · 5 pick rewrites the deck C32, C33 | - |
| Relations entities (2) | `card_replacement` C52 · its link to `deck_card` copies C32, C49 | - |

- Claims naming a status code, route or response shape: C17-C20, C22, C32, C40-C43, C45, C47, C48, C59, C63, C69, C70 - each has a proof that crosses the HTTP boundary against real Postgres
- Decision tables proven at their own layer and again at the boundary: group rules and legality (engine spec, plus C22 and C40 at the route); protected copies (C35 engine, C34 service and e2e); composition save outcomes (C49 unit, plus e2e)
- No other check claims more than the single case its proof exercises

## Test policy

The repo's testing rules (`~/.claude/rules/testing.md`) say which test types exist and where they live; they do not say which level proves a decision or how much of its input space a proof must assert. Rows for this change:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (pick, revert, keep, alternatives route) | one at the boundary against real Postgres **and** one at its own layer where the decision is not SQL or locking | the HTTP contract and every status at the boundary; locking, transactions and constraints only against Postgres; one asserted case per row of each decision table at its own layer |
| Decides, not reached across a boundary (group rules, per-card legality, protected copies, ordering, `originalOwned`) | one at its own layer | one asserted case per gate or edge: 9 tier 1 gates, 6 generic gates, 8 legality cases, 6 copy-limit edges, 5 protected counts, 4 ownership edges |
| Entry point that decides nothing (controllers, DTOs) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation (log lines, query invalidation) | asserted where the event is the claim (C21, C44, C67, C53, C57) | one asserted call each |

Evidence:

- alternatives search: 4 groups x their gates, 4 per-card legality rules, copy limit with Legendary branch, ordering with bonus -> decides, about 30 branch points
- replacements service: 2 refusal codes on pick, 5 illegal causes, 1 not-active code, row create/increase/reduce/delete in both directions, swap retirement over 3 statuses -> decides
- `updateComposition` change: close-as-removed rule with summed records, protected input to two engine calls -> decides
- engine readiness change: protected count against missing count per (card, slot) -> decides
- closest analogue: `apps/api/src/swaps/__tests__/swaps.controller.e2e-spec.ts` proves the swap lifecycle and its deck lock against real Postgres; `packages/engine/__tests__/score.spec.ts` proves tier gates one case per gate

Cost: about 40 proofs at their own layer across 7 test files. Without these rows, the group gates and the protected-copy rule would be proven only by the few cards the route tests happen to use.

## Swept

- validation: C17 (`q`), C43 (pick body), C48 (replacement id)
- failure modes: C40, C41 (refused picks change nothing), C29, C54 (client errors); the recompute runs inside the pick, revert and keep transactions, so a recompute that throws rolls the write back with it - no separate check, C33 and C46 prove the success path reads the same transaction
- idempotency: C42 (a second pick for the same copies gets `409`), C47 (a second revert or keep gets `409`)
- authorization: existing - global `JwtAuthGuard` (C70) and `OwnsTrackedDeckGuard` on deck routes; C20 and C48 prove another user's deck and replacement answer like missing ones
- concurrency: C42 (concurrent picks under the deck lock); a composition save does not take the deck lock (DEV-10 in product-redesign), so a save racing a pick stays last-write-wins as every other save does today
- data lifecycle: C51 (rows never deleted, cascade on deck delete), C52 (cascade constraint)
- dependency failure: C14 (store data missing or no store), C29 (API down for the sheet)
- state transitions: C45, C47, C49, C63
- observability: C21, C44, C67

## Handoff

- Existing files touched: engine `readiness/compute.ts` 12.3 KB, `legality/compute.ts` 12.5 KB, `substitution/score.ts` 6.8 KB, `index.ts` 1.8 KB, `__tests__/readiness.spec.ts` 39.6 KB; api `substitution.service.ts` 6.7 KB and its spec 12.9 KB, `decks.service.ts` 43.8 KB, `decks.service.update-composition.spec.ts` 23.1 KB, `tracked-deck-detail.response.dto.ts` 5.7 KB, `shopping-line.service.ts` 24.3 KB, `entities/index.ts` 1 KB, `app.module.ts` 3 KB, `swaps.controller.e2e-spec.ts` 12.9 KB (read as the fixture precedent); web `MissingPanel.tsx` 4.8 KB, `SwapsPanel.tsx` 5.9 KB, `DeckList.tsx` 5.3 KB, `DeckActionPanels.tsx` 2.4 KB, `DeckDetailView.tsx` 4.7 KB, `decks.$deckId.tsx` 24.6 KB, `api/deck-detail.ts` 8.9 KB, `api/swaps.ts` 8.8 KB, four locale files 9.6 KB, `MissingPanel.spec.tsx` 12.8 KB, `SwapsPanel.spec.tsx` 2.9 KB = 297 KB
- New files, estimated: engine alternatives search 10 KB, per-card legality 4 KB, their specs 21 KB; api module (entity, migration, two services, two controllers, DTOs) 36 KB, unit specs 15 KB, e2e and int specs 30 KB, throttle e2e 3 KB; web sheet and its CSS 14 KB, replacement mark and prompt 6 KB, api client 5 KB, specs 20 KB, Playwright flow 6 KB = 170 KB
- Total about 467 KB / 4 = ~117k tokens. Slice headers (they double-count shared files): S1 58k, S2 enters the write path at 123k, S3 151k counted naively; without the double count the whole feature is ~117k, under the 150k budget - one builder, no ask
- Mechanism: one builder (under budget), in its own worktree on `feat/card-alternatives`

- Boundary: C1-C70 closed at a853357 (one builder, no handoff).
- Settled mid-build: nothing was asked of the owner; twelve conservative calls are logged under `## Deviations` in `implementation-notes.md`, one needing the owner (deviation 8: the replacement's original has no name in the approved response shape).
- Abandoned: nothing.
- Boundary (after verification): all checks re-closed at the commit that follows this line's commit; Playwright C58 passes twice in a row and the full run is green.
- Settled mid-build: `originalName` added to `replacements[]` (orchestrator, additive Surface); fixture repaired for the current card data; manual-source index declared on the entity.
- Abandoned: nothing.
