# Swaps into alternatives verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 2aa6468..56cd8cb
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

HEAD `56cd8cb` on `feat/swaps-into-alternatives`. All proofs were run by the Verifier at this commit; nothing was trusted from the author's log. 35 of 39 checks are proven. Four are not (C33, C34, C35, C36), none of them a behaviour regression: three proof commands exit non-zero as written and one claim names a path its test never drives.

## Binding sources

Profile `standard`: step 1 (checking the checks against binding sources) does not run. The plan marks no source binding beyond itself and the owner decisions it quotes.

## Checks

Runs: engine `jest __tests__/readiness.spec.ts` (3 names, 3 shown); API unit `jest` over 2 files (2 names, 2 shown); API e2e/int against the throwaway Postgres on 55433, one invocation, `--runInBand` (21 names, shown individually, 1 failed: C35); web unit `vitest run` over 8 files (12 names shown); Playwright `e2e-chromium` `suggestions-flow.spec.ts` (3 names shown, servers on 3100 and 5273 were up). Full suites for C37 run separately.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | 60 raw, 60 effective, 3 substituted | engine jest `-t "effectivePercent counts exact copies only"` exit 0 | `packages/engine/__tests__/readiness.spec.ts:1013-1015` - `expect(result.effectivePercent).toBe(60)`, `expect(result.breakdown.substituted).toHaveLength(3)` | PASS |
| C2 | no `approved`; fifth input protects copies | engine jest `-t "suggestions carry no approval and the fifth input protects copies"` exit 0 | `readiness.spec.ts:1021-1022` - `expect(Object.keys(entry).sort()).toEqual(['match','original'])`, `not.toHaveProperty('approved')`; `:1033-1034` protected map leaves 2 substituted and a missing entry | PASS |
| C3 | path B, tier-weighted fidelity, effective below 100; path C with an uncovered copy | engine jest `-t "suggestions, fidelity and path come from the collection alone"` exit 0 | `readiness.spec.ts:1060-1063` - `path` `'B'`, `fidelityPercent` `toBeCloseTo(95, 6)`, `effectivePercent` `toBe(50)`; `:1066` path `'C'` | PASS |
| C4 | import recompute calls `(deckId, userId)`; no approval/exclusion parameter | API unit `-t "recomputes the other decks with the inputs a deck read uses"` exit 0; API typecheck exit 0 | `apps/api/src/decks/import/__tests__/decks-import.service.spec.ts:188-191` - `expect(existingDeckCalls).toEqual([[7, USER_ID],[8, USER_ID]])`; signature `substitution.service.ts:45-49` is `(trackedDeckId, userId, manager?)` | PASS |
| C5 | list and read answer effective = raw; read fidelity above | e2e `-t "the list and the deck read count the deck as it is"` ok | `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts:92` `expect(listed.effectivePercent).toBe(listed.rawPercent)`; `:94-95` read effective = raw, `fidelityPercent` `toBeGreaterThan(read.rawPercent)` | PASS |
| C6 | no `approved` on substituted entries | same test | `suggested-uses.e2e-spec.ts:96-98` - `toHaveLength(3)`, `expect(entry).not.toHaveProperty('approved')` | PASS |
| C7 | first list read stores one snapshot per deck (2 decks); first deck read stores one | e2e `-t "the first read after the truncate stores a fresh snapshot"` ok | `suggested-uses.e2e-spec.ts:114` `toEqual([1, 1])`; `:118` `toBe(1)` | PASS |
| C8 | use answers 201, quantity 2, deck holds 2 of suggestion, one active `suggested` row | e2e `-t "a one-click use is a pick recorded as suggested"` ok | `suggested-uses.e2e-spec.ts:131-133` `objectContaining({ pickedFrom: 'suggested', quantity: 2, status: 'active' ... })`; `:135-136` 2 and `undefined`; `:138` `[['suggested','active']]` | PASS |
| C9 | 1 owned for 2 missing: use moves both, next snapshot 1 exact + 1 missing, no stand-in | e2e `-t "a use moves every missing copy even when the collection covers fewer"` ok | `suggested-uses.e2e-spec.ts:160-161` quantity 2 and 2 copies; `:163-165` exact quantity 1, missing quantity 1, `substituted ... toEqual([])` | PASS |
| C10 | `swap` refused with 400 and nothing changes; `suggested` 201 | e2e `-t "accepts suggested and refuses swap as an origin"` ok | `suggested-uses.e2e-spec.ts:176` `.expect(400)`; `:178-179` deck cards and rows unchanged; `:180` `.expect(201)` | PASS |
| C11 | deck read lists replacement with original id and name | same test as C8 | `suggested-uses.e2e-spec.ts:140-146` `originalCardIdentifier: EMISSARY`, `originalName: 'Emissary of Tides'` | PASS |
| C12 | suggestion per missing row over 4 row kinds; N is 2 | web `-t "a missing row's suggestion is the first stand-in found for its card and slot"` ok | `apps/web/src/components/deck-detail/__tests__/deckDetailModel.spec.ts:43-48` `toEqual({'a::mainboard':'stand-in-a1','x::mainboard':..., 'x::equipment':...})` (no entry for `none`, none for held); `:56` `suggestionCount` `toBe(2)`. Not table-driven; one deck covers the four cases | PASS |
| C13 | row shows "Erase Face (Vermelho)", "da sua coleção", "Usar", "Ver alternativas" | web `-t "shows the collection's suggestion with Usar beside Ver alternativas"` ok | `apps/web/src/components/deck-detail/__tests__/MissingPanel.spec.tsx:478-481` | PASS |
| C14 | row without suggestion: only "Ver alternativas" | web `-t "a row without a suggestion offers only the alternatives"` ok | `MissingPanel.spec.tsx:490-492` `queryByRole('button',{name:/^Usar /})` `toBeNull()`, `not.toHaveTextContent('da sua coleção')` | PASS |
| C15 | one POST with the exact body, disabled while running, 409 shows localized message | web `-t "Usar sends the suggestion as a suggested pick"` ok | `MissingPanel.spec.tsx:505-513` path and body `toEqual({... pickedFrom: 'suggested'})`; `:514` `toBeDisabled()`; `:520-522` message text | PASS |
| C16 | browser: Usar removes the row; one "no lugar de" mark | Playwright `-g "Usar on a missing row uses the collection's card"` 1 passed | `apps/web/tests/e2e/suggestions-flow.spec.ts:34` row `toHaveCount(0)`; `:36-38` mark count 1, contains "no lugar de" and the original | PASS |
| C17 | bulk rule over 6 outcome rows | API unit `-t "plans one use per suggestion and skips what cannot take its place"` ok | `apps/api/src/replacements/__tests__/plan-suggested-uses.spec.ts:126` `expect({ label: row.label, plan }).toEqual({ label, ...})`; six labels at `:53, :64, :75, :86, :97, :108` | PASS |
| C18 | bulk 201, 2 rows `suggested`/`active`, skipped 0, copies moved, snapshots +1 | e2e `-t "the bulk route uses every suggestion with one recompute"` ok | `suggested-uses.e2e-spec.ts:189` `skipped` `toBe(0)`; `:190-201` rows `[EMISSARY, FIRST, 2, 'suggested','active'], [FLEX, SECOND, 1, ...]`; `:209` `toBe(snapshotsBefore + 1)` | PASS |
| C19 | no suggestion: 409 `NOTHING_TO_REPLACE`, nothing changes | e2e `-t "the bulk route refuses a deck with no suggestion"` ok | `suggested-uses.e2e-spec.ts:219-224` `.expect(409)`, code, cards, rows, snapshot count unchanged | PASS |
| C20 | past the copy limit: 201, 1 replacement, skipped 1, emissary stays | e2e `-t "the bulk route skips a suggestion past the copy limit and uses the others"` ok | `suggested-uses.e2e-spec.ts:234-236` `skipped` `toBe(1)`, originals `toEqual([FLEX])`, emissary `toBe(2)` | PASS |
| C21 | race: 201 and 409; one run's rows | e2e `-t "two bulk requests race and one finds nothing left"` ok | `suggested-uses.e2e-spec.ts:244-246` statuses `toEqual([201, 409])`, code, `replacementRows ... toHaveLength(2)` | PASS |
| C22 | bulk 401, 404 foreign, 404 missing | e2e `-t "the bulk route refuses anonymous and foreign decks"` ok | `suggested-uses.e2e-spec.ts:255-257` `.expect(401)`, `.expect(404)`, `.expect(404)` | PASS |
| C23 | strip copy in 3 states, no "Ver trocas" | web `-t "says what the collection covers in each state"` ok | `apps/web/src/components/deck-detail/__tests__/DeckStatusStrip.spec.tsx:50-51, :54` texts; `:66-69` message, button text, `queryByText('Ver trocas')` `toBeNull()` | PASS |
| C24 | one bulk POST, disabled, 409 message | web `-t "Usar as N sends one bulk request"` ok | `DeckStatusStrip.spec.tsx:82-85` `toHaveBeenCalledTimes(1)`, called with `/decks/${DECK_ID}/replacements/suggested`, `aria-disabled`; `:95` error text | PASS |
| C25 | onboarding variants | web `-t "offers to use every suggestion or not now"` and `"a deck with no suggestion shows the looking good step"` ok | `apps/web/src/components/onboarding/__tests__/Step3FirstReview.spec.tsx:98-100` both buttons, no approve/reject; `:103-104, :110-111` bulk once then complete, later complete with no request; `:118-119` heading "Tudo certo", no `Usar` | PASS |
| C26 | browser: "Usar as 3" leaves 3 marks, strip no longer offers a use | Playwright `-g "Usar as N uses every suggestion"` 1 passed | `suggestions-flow.spec.ts:44` strip text; `:48` marks `toHaveCount(3)`; `:49` `strip-use-suggestions` `toHaveCount(0)` | PASS |
| C27 | no "Trocas" link in the top bar and tab bar | web `-t "has no swaps entry"` x2 ok | `apps/web/src/components/shell/__tests__/TopBar.spec.tsx:145-146`; `BottomTabBar.spec.tsx:75-76` | PASS |
| C28 | `/swaps` and `/reviews` land on `/home`; no "Trocas" link | Playwright `-g "the swaps addresses lead home"` 1 passed | `suggestions-flow.spec.ts:55` `toHaveURL(/\/home(\?|$)/)`; `:57` `getByRole('link',{name:'Trocas'})` `toHaveCount(0)` | PASS |
| C29 | deck page renders no swaps panel, banner or link | web `-t "shows no swaps panel, banner or link"` ok | `apps/web/src/components/deck-detail/__tests__/DeckDetailView.suggestions.spec.tsx:83-86` `deck-swaps-panel` null, "trocas recusadas" null, "Ver trocas" null, no `a[href^="/swaps"]` | PASS |
| C30 | six swaps routes answer 404 | e2e `-t "the swaps routes are gone"` ok | `suggested-uses.e2e-spec.ts:264` `get('/api/swaps').expect(404)`; `:266` loop over actions `.expect(404)` | PASS |
| C31 | up drops table and empties snapshots; down recreates empty | int `-t "drops the swap table and empties the snapshots"` ok | `apps/api/src/database/migrations/__tests__/drop-swap-suggestion.migration.int-spec.ts:96-97` seeded 2 and 2; `:101-102` `hasTable` false, snapshots 0; `:106-107` down: table true, count 0 | PASS |
| C32 | 7 origins accepted, `swap` refused; `suggested` refused after down | int `-t "accepts suggested as a replacement origin"` ok | `drop-swap-suggestion.migration.int-spec.ts:117-118` all ORIGINS `true`, `accepts('swap')` `toBe(false)`; `:122` `accepts('suggested')` `toBe(false)` after down | PASS |
| C33 | every recompute path answers 2xx without a swap table, deck import included | e2e `-t "every recompute path runs without a swap table"` ok | `suggested-uses.e2e-spec.ts:272` `toBeNull()` then `:275-296` covers list, read, alternatives, pick, revert, bulk, collection batch add, mark owned, composition save. No deck import call appears in the test (search: `rg "import" suggested-uses.e2e-spec.ts` finds no route call; `decks/import` is only in `apps/api/src/__tests__/plan-b-full-flow.e2e-spec.ts`, not named by the check) | FAIL |
| C34 | no API source outside migrations names the swap table; API typechecks | `! git grep -nE "swap_suggestion\|SwapSuggestion\|SwapsReconciliation" -- apps/api/src ':!apps/api/src/database/migrations'` exits 1 (3 hits); API typecheck exit 0 | hits: `apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts:46`, `:271`, `:297`, all inside the e2e spec that drops the table and asserts it is absent. Production code is clean | FAIL |
| C35 | earlier migrations' int-specs still pass with the new migration in the chain | `-t "rebuilds an empty synchronize-created swap_suggestion with the migration-owned constraints"` run alone exits 1; the whole file passes 5/5 and both `replace-substitute-decision...` names pass | `apps/api/src/database/migrations/__tests__/redesign-migrations-on-synchronized-schema.int-spec.ts:70` `expect(await constraintNames('swap_suggestion')).toEqual(arrayContaining([...]))` receives `[]` when run alone, because the schema is seeded by the first test in the file (`:63`, `seedSynchronizedState`). The file is unchanged by this diff; the proof command as written selects a test that depends on its predecessor | FAIL |
| C36 | no web source imports the swaps client or components; web typechecks | `! git grep -nE "api/swaps\|components/swaps\|SwapsPanel\|ModifiedViewBanner" -- apps/web/src` exits 1 (2 hits); web typecheck exit 0 | `apps/web/src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx:44-45` still mocks `../ModifiedViewBanner`, a component that no longer exists | FAIL |
| C37 | full suites green | `pnpm --filter @rathe-arsenal/engine test`, `api test`, `web test`, then Playwright `e2e-chromium` | engine 17 suites / 343 tests, API 82 suites / 881 tests, web 147 files / 2097 tests, Playwright 32 passed (exit 0 on all four) | PASS |
| C38 | pick route 400, 401, 404 as missing, 409 | e2e, 4 names in the same run, all ok | `apps/api/src/replacements/__tests__/replacements.e2e-spec.ts:220-226` `.expect(400)`; `:455-459` `.expect(401)`; `:312-314` foreign 404 body `toEqual` missing 404 body; `:168` `res.body.code` `toBe('NOTHING_TO_REPLACE')` | PASS |
| C39 | pt-BR and en-US key paths identical | web `-t "pt-BR and en-US expose an identical set of translation key paths"` ok | `apps/web/src/i18n/__tests__/catalog-parity.spec.ts:27` `expect(en).toEqual(pt)` | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `POST /replacements` statuses (5) | plan Surface | 201 C8 (`suggested-uses.e2e-spec.ts:129`); 400 C10 (`:176`), C38 (`replacements.e2e-spec.ts:220`); 401 C38 (`:455`); 404 C38 (`:312`); 409 C38 (`:168`) | - |
| `POST /replacements/suggested` statuses (4) | plan Surface | 201 C18 (`:189`); 401 C22 (`:255`); 404 C22 (`:256`); 409 C19 (`:219`), C21 (`:245`) | - |
| removed swaps routes (6) | plan Surface | `GET /api/swaps` and five actions, one loop at `:264-266` | - |
| `card_replacement.pickedFrom` values (8) | `ORIGINS` list in `drop-swap-suggestion.migration.int-spec.ts` plus `swap` | 7 accepted `:117`, `swap` refused `:118` (C32), `swap` 400 at the route `:176` (C10) | - |
| bulk outcomes per suggestion (5) | `plan-suggested-uses.ts:60-77` branches | used, copy limit, hero-illegal, no free copy, held: six labels `plan-suggested-uses.spec.ts:53-108`; route: used `:190`, copy limit `:234` | all-skipped answers 409 (implementation-notes deviation 2, `plan-suggested-uses.ts` returns `uses: []`): no check or test names it, see gap 5 |
| missing-row suggestion cases (4) | `deckDetailModel.ts:32-49` | `deckDetailModel.spec.ts:43-48` | - |
| status strip states (3) | `deckDetailModel.ts:54` (`complete`, `suggestions`, `incomplete`) | `DeckStatusStrip.spec.tsx:50-54` | - |
| onboarding variants (2) | plan AC 12 | `Step3FirstReview.spec.tsx:98`, `:118` | - |
| recompute paths that read approvals before (10) | check C33 and plan AC 22 | list, read `suggested-uses.e2e-spec.ts:275-276`; composition save `:286`; pick, revert, bulk `:280-282`; alternatives `:277-279`; collection batch `:283`; mark owned `:284`; deck import: unit only (C4); CSV upload, sources, Fabrary collection import: grep only (C34) | deck import never run against a database without the table (C33 names it, test omits it) |
| readiness fields (4) | `types.ts`, plan Impact | `effectivePercent` `readiness.spec.ts:1014`; `substituted` `:1021`; `fidelityPercent` `:1062`; `path` `:1060` | - |
| Landing doors (4) | plan Landing | door 1 `:117`; door 2 `readiness.spec.ts:1014,1022`; door 3 `suggested-uses.e2e-spec.ts:189`; door 4 `drop-swap-suggestion.migration.int-spec.ts:101` | - |
| Relations entities (2) | plan Relations | `card_replacement` C8, C32; `swap_suggestion` C31 | - |
| removed web surfaces (4) | plan S4 | nav C27; `/swaps` `/reviews` C28; panel and banner C29; client and components C36 (red, stale mock) | stale `ModifiedViewBanner` mock still referenced (`DeckCanvas.edit.spec.tsx:44`) |
| startup config (1 assembly) | `AppModule`, booted via `bootFixture()` in `suggested-uses.e2e-spec.ts:44` | C30, C33 | - |
| locales (2) | `catalog-parity.spec.ts` | pt-BR C13, C23, C25; en-US parity `:27` | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (the bulk rule) | `apps/api/src/replacements/plan-suggested-uses.ts` | own layer C17; route C18, C19, C20, C21 | yes |
| Decides, not reached across a boundary (readiness math, missing-row suggestion, strip copy) | `packages/engine/src/readiness/compute.ts`, `deckDetailModel.ts`, `DeckStatusStrip.tsx` | one at its own layer: C1 to C3, C12, C23 | yes |
| Schema change (the migration) | `1778533593000-DropSwapSuggestion.ts` | `up` and `down` against Postgres: C31, C32 (every origin, the refused one, table dropped, snapshots emptied) | yes |
| Removal (routes, screens, imports) | swaps module, web swaps page, panel, banner | one observable absence each: C27, C28, C29, C30 met; C34 and C36 greps exit 1 as written | no - the two grep absences (C34, C36) do not exit 0 |

## Faults injected

Scratch worktree at HEAD (removed afterwards); real tree porcelain empty before and after (matches).

| Mutation | Location | Killed |
| --- | --- | --- |
| copy limit `<=` -> `<` (a use that lands exactly on the limit is skipped) | `apps/api/src/replacements/plan-suggested-uses.ts:68` | yes - C17 `plans one use per suggestion and skips what cannot take its place` failed |
| `effectivePercent = rawPercent` -> `Math.min(100, rawPercent + 5)` | `packages/engine/src/readiness/compute.ts:276` | yes - C1 and C3 failed |
| drop the "not already held by a replacement" condition | `apps/web/src/components/deck-detail/deckDetailModel.ts:44` | yes - C12 failed |
| `pickedFrom: 'suggested'` -> `'search'` | `apps/web/src/components/deck-detail/SuggestionUseButton.tsx:29` | yes - C15 failed |
| migration CHECK list loses `suggested` | `apps/api/src/database/migrations/1778533593000-DropSwapSuggestion.ts:7` | yes - C32 failed |

## Gate

Proofs at HEAD: engine 3/3, API unit 2/2, API e2e and int 20 of 21 named tests (the miss is C35 run alone), web unit 12/12, Playwright 3/3. Full suites: engine 343, API 881, web 2097, Playwright 32, all green. Typecheck: API and web exit 0.

Gaps, ranked:

1. C33 - the claim lists deck import among the recompute paths that run without a swap table, and the coverage row credits it to C33, but the test body (`apps/api/src/replacements/__tests__/suggested-uses.e2e-spec.ts:270-296`) never imports a deck; the only route-level import test is in `apps/api/src/__tests__/plan-b-full-flow.e2e-spec.ts`, which is not named by any check. Add a deck import call to the C33 test, or name the existing proof.
2. C36 - `apps/web/src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx:44-45` is a dead mock of the deleted `ModifiedViewBanner`; the `! git grep` proof exits 1. Delete the mock.
3. C34 - `! git grep` exits 1 on the three test lines `suggested-uses.e2e-spec.ts:46, :271, :297`. Production code is clean; the check text and proof should exclude `__tests__` (precision gap in the check), or the test should build the table name from a constant.
4. C35 - the named proof selects a test that depends on its predecessor (`redesign-migrations-on-synchronized-schema.int-spec.ts:61-70`); run alone it fails. Pre-existing and untouched by this diff; the fix is to run the whole file in the proof, or make each test seed its own schema.
5. Deviation 2 in `implementation-notes.md` (the bulk route answers `409` when suggestions exist but all are skipped) is behaviour no check or test asserts, and AC 8 and 10 read as `201` with `skipped`. Not a failure of a listed check; flagged as an unproven behaviour.
