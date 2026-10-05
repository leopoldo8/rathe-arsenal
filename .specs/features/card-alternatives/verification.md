# Card alternatives verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: origin/main (a5652bb)..HEAD (2e84a1d)
**Round**: 3 - full (a fresh Verifier; every check, coverage set, policy row and fault re-done from the code at HEAD 2e84a1d; nothing carried from earlier reports)
**Verifier**: independent sub-agent (author != verifier)

Totals: 70 checks, 67 PASS, 3 FAIL (C12, C44, C52). 155 mutants injected, 136 killed, 19 survived (6 are equivalent mutants, named below; 13 are findings). 11 coverage rows leave members unproven. Test policy: 3 of 4 rows met, row 1 (decides, reached across a boundary) unmet, see the section. Step 7 (distill lessons with `scripts/lessons.py`) was not run: the brief limits this Verifier to writing `verification.md`.
Gate: `pnpm typecheck` and `pnpm lint` exit 0; `pnpm -r test` failed once and passed once (a flaky web test outside the range, finding 12); api `test:int` 13 suites 106 passed; api `test:e2e --runInBand` 5 runs, all 14 suites and 116 tests passed every time (no failure, no `407`); full Playwright run 60 passed; C58 passed twice in a row.
Every fault was restored with `git checkout -- <file>` right after its proof run; the engine was rebuilt after every engine fault and after its restore; `git status --short` at the end shows only the pre-existing `.agents/`, `.cursor/`, `.windsurf/` and this report. The shared stash stack was never touched (no `git stash`). The dev server was started only for the Playwright runs and stopped afterwards (ports 3000 and 5173 were free before and after). Two throwaway fixture users created for the fixture comparison were deleted from the local database.

## Ranked gaps

1. C52, Landing door 4 and door 1: `replacementCardIdentifier` `varchar(128)` is never asserted. Fault M10 (`1778533590000-AddCardReplacement.ts:51` width 129) leaves the whole migration int spec green (4 of 4); the test only rejects a 129-character `originalCardIdentifier` (`card-replacement.migration.int-spec.ts:84`). Also fault H9: the entity's `@Index('IDX_card_replacement_deck_status', ...)` (`card-replacement.entity.ts:40`) can lose its name and both int specs stay green (12 of 12), although C52's own text says "the entity declares the same index name" (commit `322a720` exists for exactly that).
2. C44: the `replacements.picked` log line is pinned only at `quantity: 1`. Fault P19 (`replacements.service.ts:149` `quantity: 1`) leaves all 18 service specs green; both log cases run with one missing copy (`replacements.service.spec.ts:111-134`) and no e2e reads the log. Fault P18 (the `owned` formula ignoring copies already in the deck, `:151`) also survives, because the only boundary case lands on the same answer.
3. C12 and AC 10 / AC 12, "in any slot": the alternatives service builds the per-card deck copies by summing every slot (`alternatives.service.ts:127`). Fault A8 (keep only the last row of a card) survives the service spec, both e2e files (34 of 34) and every engine test, because no test puts one card in two slots through the service; the engine proofs (C10) hand the engine an already summed map. The same cross-slot rule at pick time (`replacements.service.ts:98-100`) survives fault P21 (count only the target slot): C40's "would exceed 3 copies" case is same-slot only.
4. The error state of Undo, Keep and Go back has no check and no test. The plan's Observable table says an error "is shown as the existing deck-page toast" (a `ToastProvider` exists, `apps/web/src/main.tsx:34`); the code renders an inline `role="alert"` span (`ReplacementMark.tsx:74-78`). Fault W19 (the `onError` handler removed) leaves all 7 `DeckList.replacement` specs green. Both the missing proof and the divergence from the plan's wording are findings.
5. AC 54 end to end: `DeckActionPanels` hands `replacements` to `MissingPanel`; fault W26 (the prop dropped, `DeckActionPanels.tsx:65`) leaves C58 green, because the browser flow never asserts the mark in the missing panel (`card-alternatives-flow.spec.ts:39-48`), and the component specs render `MissingPanel` directly.
6. `findBrokenReplacements` is slot-blind in its proof: fault D12 (`replacement-copies.ts:43` deck copies keyed to `mainboard` for every row) survives all 16 composition-save specs and the e2e. A replacement picked in `equipment` (allowed: only `hero` and `weapon` are refused) would be closed as `removed` by any later save that keeps it covered; no test covers a covered non-mainboard record (AC 49).
7. The `replacements` field of the `PUT /api/decks/:deckId` response (plan Impact: "so do the other responses that share its shape (PUT, scratch create)") has no check: faults D6 and D7 (`decks.service.ts:1047`, replace it with `[]` or with the unfiltered list) survive the PUT int spec, the composition-save spec and the e2e.
8. Engine: the protected count is spent row by row when one (card, slot) is split across several deck rows (`readiness/compute.ts:187-189`, explicit in a code comment). Fault R3 (the decrement removed) survives the whole engine suite (334 of 334). `deck_card` has no unique key on (deck, card, slot), so the case is reachable in principle.
9. Swept row "dependency failure" cites C14 for store data; the other half, a store query that throws (`shopping-line.service.ts` `priceCards` catch block), is unproven: fault A16 (rethrow) leaves the alternatives and shopping-line specs green (45 of 45).
10. Not a finding of this range, recorded for the user's rule "tests always green": `apps/web/src/components/csv-sources/__tests__/CsvSourceRow.test.tsx:165` failed in the first of two `pnpm -r test` runs (`label: "ew Name"` received; the first keystroke was dropped while the 25 s recognition benchmark ran in the same run). It passed 5 of 5 alone and in the second full run. The file is outside the range; the failure is a timing flake under load.
11. A guard remark, no failing test: `OwnsTrackedDeckGuard` rejects non-digit ids with 400, but a digit string beyond the integer range (`100000000000000000000`) still reaches Postgres. Probed with the `pg` driver (`22003 out of range for type integer`, which the app would answer as 500, as it did before the commit); not exercised over HTTP.
12. Read-only judgement, no check: AC 53 says the cell shows an Undo control while a replacement is active; when `originalOwned` is true `ReplacementMark.tsx:41-62` swaps Undo for Keep and Go back (Go back sends the same revert). Consistent with AC 58; no check states it.

## Binding sources

Profile is `standard`: step 1 (checks against binding sources) runs under `ui` only, so no binding-source section is owed. `.design/card-alternatives.md` was opened to judge the deviations and the Observable rows: group rules, table shape, 409 codes and the detail field list match the code and `plan.md`; the one divergence is finding 4 (inline alert instead of the toast the plan names).

## Checks

Proof batches run at HEAD, one invocation per suite with the JSON reporter; each named test was listed individually as `passed` and none was skipped or filtered to zero: engine 5 files 161 passed (the 7 named test groups of C2 to C16, C35, C36, C38 all present); api unit 6 files 60 passed + the guard spec 5 passed; api e2e (`replacements`, `alternatives`, throttle, `decks.meta`) 47 passed; api int 13 suites 106 passed (the two named int specs 4 and 8 passed); web 7 files 77 passed; Playwright C58 run alone twice (4.8 s, 3.6 s) and inside the full run. Shell proofs: C36 gold-set `git diff --exit-code` exit 0, C37 exit 0, C38 exit 0, C51 `! grep` exit 0.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `needed` = notOwned minus protected copies | api unit (1 ran), api e2e (1 ran) | `apps/api/src/replacements/__tests__/alternatives.service.spec.ts:162` `.needed).toBe(2)`, `:167` `toBe(1)`, `:174-176` `NOTHING_TO_REPLACE`; `alternatives.e2e-spec.ts:22` `toBe(2)`, `:26` `toBe(1)` | PASS |
| C2 | group order, empty dropped, cap 10 | engine (1 ran) | `packages/engine/__tests__/alternatives.spec.ts:268` `toEqual(['very_close','close','other_pitch','generic'])`, `:269` `toHaveLength(10)` | PASS |
| C3 | `very_close`, 9 tier 1 gates | engine (9 ran) | `alternatives.spec.ts:130` control `toBe('very_close')`, `:131` candidate `not.toBe('very_close')` | PASS |
| C4 | `close`, tier 2 gates and floor | engine (4 ran) | `alternatives.spec.ts:141` `toBe('close')`, `:151` `toBeCloseTo(0.85, 10)`, `:157`, `:164` `has(...)` false | PASS |
| C5 | `other_pitch` relaxes only pitch | engine (3 ran) | `alternatives.spec.ts:172` `toBe('other_pitch')`, `:178`, `:184` rejected | PASS |
| C6 | `generic`, six gates | engine (8 ran) | `alternatives.spec.ts:195`, `:201` `toBe('generic')`, `:214` six rejections | PASS |
| C7 | one group per card | engine (1 ran) | `alternatives.spec.ts:223` `toEqual(['very_close'])`, `:229` unique identifiers | PASS |
| C8 | never itself, Hero, Token | engine (1 ran) | `alternatives.spec.ts:250`, `:257-258`, search `Katsu` at `:447` | PASS |
| C9 | 4 per-card rules x 2 slots | engine, 2 proofs (8 + 8 ran) | `packages/engine/__tests__/legality/card-legality.spec.ts:43` `expect(violation?.detail.code).toBe(code)`; `alternatives.spec.ts:301-302`. The eight rows of the first proof are real catalog cards (`blade-dance` for both rarity rows, which also stands in for the `equipment` rarity row since no equipment card reaches that rule: precision note) | PASS |
| C10 | copy limit across slots, 6 edges | engine (6 ran) | `alternatives.spec.ts:325` `expect(placed.has('candidate')).toBe(listed)`; the held count is an input map, so the cross-slot sum itself is finding 3 | PASS |
| C11 | owned bonus ordering | engine (5 ran) | `alternatives.spec.ts:339`, `:345`, `:353`, `:359`, `:371` | PASS |
| C12 | `freeCopies` | api unit (2 ran) | `alternatives.service.spec.ts:217` `toBe(2)`, `:226` `toBe(0)`, `:239` `toBe(1)`; "in any slot" is not exercised: fault A8 survives | FAIL |
| C13 | prices match the shopping line, both paths | api unit (1 ran) | `alternatives.service.spec.ts:269-275`, `:275` `toBe(lines.get(variantCard)!.unitPriceCents)`. Fault A11 (price asked at quantity 1) is equivalent: `buildLine` returns the cheapest unit price whatever the quantity | PASS |
| C14 | null price and URL, still listed | api unit (2 ran) | `alternatives.service.spec.ts:296-298`, `:304`, `:314` | PASS |
| C15 | rationale and `relaxed` | engine (1 ran) | `alternatives.spec.ts:410` `toEqual({ ...describeRationale(emissary, entry.card, tier), relaxed })` over four groups | PASS |
| C16 | search group | engine (5 ran) | `alternatives.spec.ts:423` `['search']`, `:427` order, `:448-449`, `:459` `toHaveLength(10)` | PASS |
| C17 | `q` bounds, required fields, lengths, deck id | api e2e (2 ran) | `alternatives.e2e-spec.ts:72-76` 400/200/200/400/400, `:79-80`, `:87-96` | PASS |
| C18 | hero and weapon `groups: []` | api e2e (1 ran) | `alternatives.e2e-spec.ts:105` `toEqual([])`, `:106` `needed` 1 | PASS |
| C19 | 409 `NOTHING_TO_REPLACE`, 3 causes | api e2e (1 ran) | `alternatives.e2e-spec.ts:116`, `:119`, `:126` | PASS |
| C20 | foreign deck answers like missing | api e2e (2 ran) | `replacements.e2e-spec.ts:334-336` three routes, bodies `toEqual`; `alternatives.e2e-spec.ts:137` | PASS |
| C21 | `alternatives.listed` log | api unit (1 ran) | `alternatives.service.spec.ts:327-336` full object with `hasQuery: true`, `:343-348` `hasQuery: false` and group counts, `:353` none on 409 | PASS |
| C22 | response shape | api e2e (1 ran) | `alternatives.e2e-spec.ts:34` `['groups','needed']`, `:37`, `:40-42` exact key sets | PASS |
| C23 | control on replaceable rows | web (1 ran) | `apps/web/src/components/deck-detail/__tests__/MissingPanel.spec.tsx:366-370` | PASS |
| C24 | control on approved swap rows | web (1 ran) | `SwapsPanel.spec.tsx:113-116` | PASS |
| C25 | sheet names the card, groups, art, rationale | web (1 ran) | `AlternativesSheet.spec.tsx:94-95`, `:97-100`, `:104-111` | PASS |
| C26 | owned and N free | web (1 ran) | `AlternativesSheet.spec.tsx:132-133` | PASS |
| C27 | price, link, out of stock | web (1 ran) | `AlternativesSheet.spec.tsx:152-156`, `:159` | PASS |
| C28 | loading state | web (1 ran) | `AlternativesSheet.spec.tsx:166-167` | PASS |
| C29 | error and retry | web (1 ran) | `AlternativesSheet.spec.tsx:175`, `:180` | PASS |
| C30 | empty state and focus | web (1 ran) | `AlternativesSheet.spec.tsx:187-188` | PASS |
| C31 | search from 2 characters | web (1 ran) | `AlternativesSheet.spec.tsx:203`, `:208-210` | PASS |
| C32 | pick moves copies, records original, every `pickedFrom` | api e2e (6 ran), api unit (9 ran) | `replacements.e2e-spec.ts:70-80`, `:82-83`, `:90-91`, `:101-103`; `replacements.service.spec.ts:175-178`, `:233-243` | PASS |
| C33 | snapshot after pick | api e2e (1 ran) | `replacements.e2e-spec.ts:113-116` | PASS |
| C34 | active replacements reach the engine on every path | 3 proofs (all ran) | `apps/api/src/substitution/__tests__/substitution.service.spec.ts:327-336`; `apps/api/src/decks/__tests__/decks.service.update-composition.spec.ts:623-626`; `replacements.e2e-spec.ts:127-130`. Direct engine callers in code: `decks.service.ts:1008`, `:1082`, `substitution.service.ts:173` (all pass the map), `test-deck.service.ts:192` (none, as the plan says) | PASS |
| C35 | protected counts 0/1/equal/above/other slot | engine (6 ran) | `packages/engine/__tests__/readiness.spec.ts:1191-1192`, `:1198-1199` | PASS |
| C36 | empty protected input changes nothing | engine (1 ran), `git diff --exit-code` exit 0, gold set 16 passed | `readiness.spec.ts:1287` `expect(empty).toEqual(omitted)` over 8 decks (deviation 1); the file only gained lines (`--numstat` 144 added, 0 removed) | PASS |
| C37 | tier configs unchanged | `git diff --exit-code` exit 0 | `packages/engine/src/substitution/constants.ts:8`, `:16`, `:30`, `:31` (0.9, 0.7, 0.35, 0.15), `:40-47`, `:60-67` | PASS |
| C38 | `computeDeckLegality` unchanged | `git diff --exit-code` exit 0, `compute.spec` 31 passed | `compute.spec.ts` byte-identical to origin/main | PASS |
| C39 | pick retires pending and approved swaps | api e2e (1 ran), api unit (1 ran) | `replacements.e2e-spec.ts:153-155`, `:159-161`; `replacements.service.spec.ts:209-213` | PASS |
| C40 | 409 `REPLACEMENT_ILLEGAL` x5, nothing changes | api e2e (1 ran), api unit (5 ran) | `replacements.e2e-spec.ts:178-179`; `replacements.service.spec.ts:195-199`. The copy-limit case is same-slot only (fault P21) | PASS |
| C41 | 409 `NOTHING_TO_REPLACE` on pick | api e2e (1 ran) | `replacements.e2e-spec.ts:190-191` | PASS |
| C42 | concurrent picks serialize | api e2e (1 ran) | `replacements.e2e-spec.ts:202`, `:204`, `:207`, `:209-210` | PASS |
| C43 | malformed picks give 400 | api e2e (2 ran) | `replacements.e2e-spec.ts:230` `.expect(400)` over 7 bodies, `:232`, `:242-254`, `:253-254` non-integer deck id | PASS |
| C44 | `replacements.picked` log | api unit (1 ran) | `replacements.service.spec.ts:117-129` full object (`quantity: 1`, `owned: false`), `:134` `owned: true`, `:145` none on refusal; fault P19 (`quantity` constant 1) and P18 survive | FAIL |
| C45 | revert moves copies back | api e2e (1 ran), api unit (4 ran) | `replacements.e2e-spec.ts:264-267`, `:274-275`; `replacements.service.spec.ts:260-270` | PASS |
| C46 | snapshot after revert | api e2e (1 ran) | `replacements.e2e-spec.ts:288-289` | PASS |
| C47 | 409 `REPLACEMENT_NOT_ACTIVE` x6 | api e2e (1 ran) | `replacements.e2e-spec.ts:303-304` | PASS |
| C48 | 404 same body, 400 non-uuid | api e2e (1 ran) | `replacements.e2e-spec.ts:315-318` | PASS |
| C49 | save closes broken replacements | api unit (4 ran), api e2e (1 ran) | `decks.service.update-composition.spec.ts:645`, `:661`; `replacements.e2e-spec.ts:354-355`. Slot-blind in its proof: fault D12 survives | PASS |
| C50 | save keeps covered replacements | api unit (1 ran) | `decks.service.update-composition.spec.ts:682`, `:687-688` (1 substituted, 2 missing of 3 copies) | PASS |
| C51 | rows never deleted | api e2e (1 ran), `! grep` exit 0 | `replacements.e2e-spec.ts:440` `toEqual(['active','kept','removed','reverted'])`, `:443`; the grep finds no `delete` or `remove` on the replacement repository | PASS |
| C52 | migration constraints (doors 1-4) | api int (4 + 8 ran) | `card-replacement.migration.int-spec.ts:87-90`, `:92-93`, `:95-96`, `:103-104` (index), `:110-111` (user cascade); `entity-check-constraints.int-spec.ts:84`, `:89-91` (`rejects.toMatchObject({ constraint })`). Faults M10 (`replacementCardIdentifier` width) and H9 (entity index name) survive | FAIL |
| C53 | tap sends pick with group, closes, invalidates | web (1 ran) | `AlternativesSheet.spec.tsx:229`, `:230-235`, `:237-238`, `:246` | PASS |
| C54 | localized 409 messages | web (3 ran) | `AlternativesSheet.spec.tsx:264`, `:265`, `:267` | PASS |
| C55 | list cell mark and Undo, one slot only | web (3 ran) | `DeckList.replacement.spec.tsx:65-66`, `:69-70`, `:80-81`, `:99-101` | PASS |
| C56 | missing row mark, one slot only | web (3 ran) | `MissingPanel.spec.tsx:394-395`, `:407-408`, `:425-426`; page-level wiring is finding 5 | PASS |
| C57 | Undo sends revert, invalidates | web (1 ran) | `DeckList.replacement.spec.tsx:111`, `:114-115` | PASS |
| C58 | browser flow | Playwright run twice (exit 0 both) and in the full run | `apps/web/tests/e2e/card-alternatives-flow.spec.ts:39` `toBeHidden`, `:41-42` `toHaveCount(1)` and `no lugar de`, `:43`, `:47-48`. Fault W25 (deck page passes no replacements to `DeckList`) fails line 41; W27 (open handler dropped) fails line 35 | PASS |
| C59 | detail lists active replacements only | api e2e (2 ran), api unit (1 ran) | `replacements.e2e-spec.ts:399-409`, `:418-420`; `decks.service.replacements.spec.ts:186`, `:208` (the identifier fallback, fault D2 killed by the named second proof) | PASS |
| C60 | `originalOwned` edges | api unit (4 ran) | `decks.service.replacements.spec.ts:156`, `:160`, `:166-167`, `:176` | PASS |
| C61 | prompt with Keep and Go back | web (1 ran) | `DeckList.replacement.spec.tsx:125-127` | PASS |
| C62 | no prompt when not owned | web (1 ran) | `DeckList.replacement.spec.tsx:133` | PASS |
| C63 | keep closes, deck unchanged, snapshot | api e2e (1 ran) | `replacements.e2e-spec.ts:366-370` | PASS |
| C64 | kept replacement can get a stand-in | api e2e (1 ran) | `replacements.e2e-spec.ts:383` | PASS |
| C65 | Go back and Keep routes | web (1 ran) | `DeckList.replacement.spec.tsx:143`, `:146`, `:149-150` | PASS |
| C66 | no prompt on tile or `/swaps` | web (2 ran) | `apps/web/src/components/home/__tests__/DeckTile.spec.tsx:215`; `apps/web/src/routes/_auth/__tests__/-swaps.test.tsx:70-71`. Absence checks: neither surface consumes replacements, so no implementation line exists to mutate | PASS |
| C67 | `replacements.resolved` log | api unit (1 ran) | `replacements.service.spec.ts:154-157` both `reverted` and `kept`, `:164` none on refusal | PASS |
| C68 | copy in both locales | web (2 files ran) | `apps/web/src/i18n/__tests__/catalog-parity.spec.ts:27` `expect(en).toEqual(pt)`; `AlternativesSheet.spec.tsx:317` | PASS |
| C69 | 429 on the 121st request, five routes | api e2e (1 ran) | `replacements-throttle.e2e-spec.ts:40-44`; the throttler keys per handler, so each route has its own count | PASS |
| C70 | 401 without token, five routes | api e2e (1 ran) | `replacements.e2e-spec.ts:452-456` | PASS |

## Coverage

Each set was recomputed from its authority: routes and statuses from `plan.md` Surface, doors from Landing, groups from the design tables, error codes and recompute callers from Impact and from the code (`grep` of `computeEffectiveReadiness(` shows four non-test callers), states from the Observable table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `GET .../alternatives` statuses (6) | plan Surface | 200 C22 · 400 C17 · 401 C70 · 404 C20 · 409 C19 · 429 C69 | - |
| `POST .../replacements` statuses (6) | plan Surface | 201 C32 · 400 C43 · 401 C70 · 404 C20 · 409 C40, C41, C42 · 429 C69 | - |
| `POST .../revert` and `.../keep` statuses (12) | plan Surface | 200 C45, C63 · 400 C48 · 401 C70 · 404 C48 · 409 C47 · 429 C69 | - |
| `GET /api/decks/:deckId` statuses (4) | plan Surface | 200 C59 · 401 C70 · 404 C20 · 429 C69 | - |
| error codes (3) | plan Impact | `NOTHING_TO_REPLACE` C19, C41, C54 · `REPLACEMENT_ILLEGAL` C40, C54 · `REPLACEMENT_NOT_ACTIVE` C47, C54; copy C68 | - |
| `pickedFrom` values (5) | plan Landing door 3 | each value stored and returned at the service (`replacements.service.spec.ts:175`) and at the boundary (`replacements.e2e-spec.ts:101-103`); fault P1 killed by 4 specs; the web sends `other_pitch` and `search` (`AlternativesSheet.spec.tsx:234`, `:246`) | - |
| status values (4) | plan Landing door 2 | `active` C32 · `kept`, `reverted`, `removed` inserted past the CHECK (`replacements.e2e-spec.ts:295-298`) · `open` rejected C52 | - |
| door 1 record table | plan Landing door 1 | table, deck cascade, user cascade, `("trackedDeckId", status)` index C52 · never deleted C51 · entity index name: none (H9) | the entity's index name (`IDX_card_replacement_deck_status`) |
| door 4 widths and quantity (6) | plan Landing door 4 | `originalCardIdentifier` 128 and 129 C52 · `slot` 64 and 65 C52 · `quantity 0` C52 · `replacementCardIdentifier` 128: none (M10) | `replacementCardIdentifier` `varchar(128)` |
| door 5, a pick rewrites the deck (4 row shapes x pick, revert) | plan Landing door 5 | deleted at 0, reduced, created, increased: `replacements.service.spec.ts:233-243`, `:260-270`; e2e `replacements.e2e-spec.ts:82-91`, `:266-275` | - |
| group gates and outcomes (9 + 3 + 3 + 8) | design group tables | C3 · C4 · C5 · C6; fault E9 (shared-type gate inside `generic`) is equivalent because `score.ts:79` already gates type | - |
| group order, cap, dedupe, exclusions (3 + 1 + 3) | plan AC 2, 7, 8 | C2 · C7 · C8 (itself, Hero, Token) | - |
| per-card legality, 4 rules x 2 slots (8) | plan AC 9 | C9, 8 real-card rows and 8 synthetic rows | - |
| copy limit across slots | plan AC 10 | 6 edges C10 (engine, map input) · the service's sum over slots in the alternatives route: none (A8) · the sum at pick time: none (P21) | cross-slot copy count in `alternatives.service.ts:127` and `replacements.service.ts:98-100` |
| ordering, `freeCopies`, prices, out of stock (4 + 3 + 2 + 4) | plan AC 11-14 | C11 · C12 (single slot only) · C13 · C14 | `freeCopies` over copies in two slots (A8) |
| `relaxed` values (3) | plan AC 15 | C15 | - |
| `q` edges and field bounds | plan AC 16, 17 | C17 (`q` 1, 2, 50, 51, padded; `cardIdentifier` and `slot` empty, over the limit, at the limit; non-integer deck id) | - |
| log events (3) and their fields | plan AC 21, 43, 64 | `alternatives.listed` C21 (`hasQuery` true and false) · `replacements.picked` C44 (`quantity` only at 1, `owned` formula under one boundary) · `replacements.resolved` C67 | `replacements.picked` `quantity` other than 1 and the `owned` formula (P19, P18) |
| replacement transitions (3 + 6) | plan state diagram | active to reverted C45 · to kept C63 · to removed C49 · six refusals C47 | - |
| composition save outcomes (4) | plan AC 48, 49 | dropped, lowered, two records, still covered: C49, C50, only the slot it broke (`update-composition.spec.ts:661`) | a covered record in a non-mainboard slot stays active (D12) |
| swap rows on pick (3) | plan AC 38 | pending, approved retired, rejected untouched C39 | - |
| protected counts (5) | plan AC 34 | C35 (0, 1, equal, above, other slot) · one (card, slot) split across rows: none (R3) | spending the count across split deck rows |
| recompute paths (3 places) | code: callers of `computeEffectiveReadiness` | `runReadiness` C34 · `updateComposition` in-transaction C34 · post-commit C34 | - |
| snapshot freshness after a write (2) | plan AC 32, 45 | pick C33 · revert C46 | - |
| `originalOwned` edges (4) | plan AC 57 | covered, short by 1, deck copies subtracted, inactive source C60 | - |
| sheet states (5) | plan Observable | groups C25 · loading C28 · error C29 · empty C30 · search C31 | - |
| replacement marks on deck page (4) | plan AC 53, 54, 58, 59 | list cell C55 · missing row C56 · prompt C61 · no prompt C62; missing-row mark through the page wiring: none (W26) | `DeckActionPanels` to `MissingPanel` wiring (AC 54 at page level) |
| error state of Undo, Keep, Go back (1) | plan Observable row "error on undo, keep or go back" | none (W19) | the error display of the replacement controls |
| web 409 codes (3) | plan Impact | C54 | - |
| response shape of the other deck responses (2) | plan Impact "PUT, scratch create share the shape" | `replacements` in the PUT and scratch create responses: none (D6, D7) | `replacements` in the PUT response |
| dependency failure (store query throws) | plan Swept row | store missing C14 · query throws: none (A16) | `priceCards` failure path |
| locales (2) | plan AC 65 | pt-BR and en-US C68 | - |
| Landing doors (5) and Relations entities (2) | plan Landing, Relations | doors 1, 4 see above; 2, 3 ok; 5 ok; `card_replacement` ok, no foreign key to `deck_card` (none declared in the migration) | see door 1 and door 4 rows |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (pick, revert, keep, alternatives route) | `replacements.service.ts`, `alternatives.service.ts`, `replacements.controller.ts` | boundary against real Postgres: `replacements.e2e-spec.ts`, `alternatives.e2e-spec.ts`, throttle spec · own layer: `replacements.service.spec.ts`, `alternatives.service.spec.ts` | no - gap: statuses, locking (C42, fault Q1 killed), rollback (`replacements.e2e-spec.ts:179`) and the pick decision rows (`replacements.service.spec.ts:195-270`) are asserted, but the cross-slot copy count of both services is asserted at no layer (faults A8, P21 survive) |
| Decides, not reached across a boundary (group rules, per-card legality, protected copies, ordering, `originalOwned`) | `alternatives.ts`, `card-legality.ts`, `readiness/compute.ts`, `build-replacement-views.ts`, `compareAlternatives` | one at its own layer | yes - 9 tier 1 gates, 6 generic gates, 8 legality cases, 6 copy-limit edges, 5 protected counts, 4 ownership edges, each asserted, and every fault on those surfaces killed (E1-E19 apart from the equivalent E9, L1-L6, R1, R2', R4, D8, D9); the split-row spend (R3) is outside the policy's counted edges |
| Entry point that decides nothing (controllers, DTOs, guard) | `replacements.controller.ts`, `pick-replacement.dto.ts`, `alternatives-query.dto.ts`, `owns-tracked-deck.guard.ts` | one at the boundary: accepted input, each rejected input, each error path | yes - accepted input for all five `pickedFrom` values, each rejected field and bound (Q7, Q8, Q11-Q17 killed), non-uuid and non-integer ids (Q5, Q19, G1, G2 killed); Q9, Q10 and Q18 are equivalent mutants (the catalog lookup and the guard answer the same 400 first) |
| Instrumentation (log lines, query invalidation) | the three log lines, invalidation | asserted where the event is the claim | yes for the event: one asserted call each (C21, C44, C67, C53, C57); the field-level survivors of `replacements.picked` are recorded against C44 |

## Faults injected

155 distinct mutants (compile failures and one mis-specified mutant, `compute.ts` key hard-coded to `mainboard`, are not counted; it was redone as R2'). 136 killed, 19 survived. Narrow proof run for each; the survivors that are equivalent say why. A mutant killed only by a test the named proof does not run is noted.

| Mutation | Location | Killed |
| --- | --- | --- |
| owned bonus 0.05 to 0.06 | `packages/engine/src/substitution/alternatives.ts:26` | yes |
| copy limit `<=` to `<` | `alternatives.ts:130` | yes |
| per-group cap 10 to 11 | `alternatives.ts:23` | yes |
| generic stat gap 2 to 3 | `alternatives.ts:29` | yes |
| tier 1 floor dropped | `alternatives.ts:82` | yes |
| tier 2 floor dropped | `alternatives.ts:87` | yes |
| `other_pitch` stops relaxing pitch | `alternatives.ts:92` | yes |
| `generic` class gate removed | `alternatives.ts:99` | yes |
| `generic` shared-type gate removed | `alternatives.ts:99` | no - equivalent mutant: `score.ts:79` already returns null without a shared type |
| `relaxed: 'class'` to `null` | `alternatives.ts:105` | yes |
| self exclusion removed | `alternatives.ts:125` | yes |
| Hero and Token exclusion removed | `alternatives.ts:126` | yes |
| search prefix ordering removed | `alternatives.ts:147` | yes |
| search cap 10 to 11 | `alternatives.ts:152` | yes |
| rationale tier fixed to 1 | `alternatives.ts:187` | yes |
| `freeCopies` ignores deck copies | `alternatives.ts:136` | yes |
| name tie order reversed | `alternatives.ts:121` | yes |
| per-card legality ignored by `isListable` | `alternatives.ts:127` | yes |
| group order swapped | `alternatives.ts:16-21` | yes |
| ban rule removed | `packages/engine/src/legality/card-legality.ts:28` | yes |
| format rule removed | `card-legality.ts:35` | yes |
| hero scope rule removed | `card-legality.ts:64` | yes |
| rarity test inverted | `card-legality.ts:81` | yes |
| rarity rule neutralised | `card-legality.ts:81` | yes |
| Legendary limit 1 to 2 | `card-legality.ts:105` | yes |
| protected count reduced by 1 | `packages/engine/src/readiness/compute.ts:226` | yes |
| protected lookup sums every slot | `compute.ts:226` | yes |
| protected count not spent across rows | `compute.ts:228` | no - survived the whole engine suite (R3) |
| protected copies skipped | `compute.ts:232` | yes |
| `computeDeckLegality` copy limit +1 | `packages/engine/src/legality/compute.ts:128` | yes |
| `computeDeckLegality` scope rule dropped | `legality/compute.ts:157` | yes |
| `hasQuery` constant true | `apps/api/src/replacements/alternatives.service.ts:100` | yes |
| `groupCounts` empty | `alternatives.service.ts:99` | yes |
| `needed === 0` refusal removed | `alternatives.service.ts:86` | yes |
| hero and weapon guard removed | `alternatives.service.ts:88` | yes (the e2e only; the unit spec survives it) |
| `computeNeeded` ignores held copies | `apps/api/src/replacements/compute-needed.ts:21` | yes |
| `computeNeeded` ignores the slot | `compute-needed.ts:18` | yes |
| owned map empty | `alternatives.service.ts:137` | yes |
| deck copies not summed across slots | `alternatives.service.ts:127` | no - survived (A8) |
| price always null | `alternatives.service.ts:154` | yes |
| product URL always null | `alternatives.service.ts:155` | yes |
| price asked at quantity 1 | `alternatives.service.ts:144` | no - equivalent mutant: unit price does not depend on quantity |
| zero stock keeps its price | `apps/api/src/stores/shopping-line.service.ts:247` | yes |
| null price still treated as priced | `shopping-line.service.ts:247` | no - equivalent mutant: a null price implies `quantityAvailable` 0 in `buildLine` |
| price lookup failure rethrown | `shopping-line.service.ts:253` | no - survived (A16) |
| `pickedFrom` stored as constant | `apps/api/src/replacements/replacements.service.ts:119` | yes |
| retirement drops `approved` | `replacements.service.ts:132` | yes |
| retirement ignores the slot | `replacements.service.ts:131` | yes |
| retirement also takes `rejected` | `replacements.service.ts:132` | yes |
| hero and weapon slot refusal removed | `replacements.service.ts:79` | yes |
| original-as-replacement refusal removed | `replacements.service.ts:80` | yes |
| `needed === 0` refusal removed | `replacements.service.ts:96` | yes |
| copy limit ignores held copies | `replacements.service.ts:101` | yes |
| legality violation ignored | `replacements.service.ts:221` | yes |
| copy limit `>` to `>=` | `replacements.service.ts:222` | yes |
| held copies counted for the target slot only | `replacements.service.ts:99` | no - survived unit and e2e (P21) |
| target row not increased | `replacements.service.ts:254` | yes |
| source row not deleted at 0 | `replacements.service.ts:248` | yes |
| source row reduced wrongly | `replacements.service.ts:246` | yes |
| revert does not move copies | `replacements.service.ts:166` | yes |
| status always `reverted` | `replacements.service.ts:180` | yes |
| not-active refusal removed | `replacements.service.ts:164` | yes |
| log `owned` constant true | `replacements.service.ts:151` | yes |
| log `owned` ignores held copies | `replacements.service.ts:151` | no - survived (P18) |
| log `quantity` constant 1 | `replacements.service.ts:149` | no - survived (P19) |
| resolved log id constant | `replacements.service.ts:193` | yes |
| deck lock removed | `replacements.service.ts:210` | yes |
| pick recompute removed | `replacements.service.ts:137` | yes |
| resolve recompute removed | `replacements.service.ts:182` | yes |
| resolve lookup ignores the user | `replacements.service.ts:158` | yes |
| keep route without `ParseUUIDPipe` | `replacements.controller.ts:67` | yes |
| revert route without `ParseUUIDPipe` | `replacements.controller.ts:59` | yes |
| pick answers 200 | `replacements.controller.ts:47` | yes |
| alternatives route without `ParseIntPipe` | `replacements.controller.ts:32` | no - equivalent mutant: the guard answers 400 first |
| pick `slot` loses `@MaxLength(64)` | `dtos/pick-replacement.dto.ts:12` | yes |
| pick `slot` loses `@IsNotEmpty()` | `pick-replacement.dto.ts:11` | yes |
| pick original loses `@MaxLength(128)` | `pick-replacement.dto.ts:7` | no - equivalent mutant: `requireCard` answers the same 400 for an unknown card |
| pick replacement loses `@IsNotEmpty()` | `pick-replacement.dto.ts:16` | no - equivalent mutant: the same 400 from the catalog lookup |
| `@IsIn` replaced by `@IsString` | `pick-replacement.dto.ts:20` | yes |
| query `cardIdentifier` loses `@MaxLength(128)` | `dtos/alternatives-query.dto.ts:10` | yes |
| query `cardIdentifier` loses `@IsNotEmpty()` | `alternatives-query.dto.ts:9` | yes |
| query `slot` loses `@MaxLength(64)` | `alternatives-query.dto.ts:15` | yes |
| query `slot` loses `@IsNotEmpty()` | `alternatives-query.dto.ts:14` | yes |
| `q` maximum 50 to 51 | `alternatives-query.dto.ts:5` | yes |
| `q` trim removed | `alternatives-query.dto.ts:20` | yes |
| guard integer test removed | `apps/api/src/auth/guards/owns-tracked-deck.guard.ts:26` | yes (guard spec and e2e) |
| guard accepts decimals | `owns-tracked-deck.guard.ts:26` | yes |
| detail `replacements: []` | `apps/api/src/decks/decks.service.ts:656` | yes |
| `originalName` fallback returns `''` | `decks.service.ts:77` | yes (by `decks.service.replacements.spec.ts:208`, the named second proof) |
| in-transaction engine call without protected copies | `decks.service.ts:1015` | yes |
| post-commit engine call without protected copies | `decks.service.ts:1089` | yes |
| `closeAsRemoved` skipped | `decks.service.ts:990` | yes |
| PUT response lists unfiltered replacements | `decks.service.ts:1047` | no - survived (D6) |
| PUT response `replacements: []` | `decks.service.ts:1047` | no - survived (D7) |
| `originalOwned` `>=` to `>` | `apps/api/src/replacements/build-replacement-views.ts:32` | yes |
| `originalOwned` ignores deck copies | `build-replacement-views.ts:23` | yes |
| broken-record test `<` to `<=` | `apps/api/src/replacements/replacement-copies.ts:49` | yes |
| claims not summed across records | `replacement-copies.ts:26` | yes |
| deck copies keyed to `mainboard` in `findBrokenReplacements` | `replacement-copies.ts:43` | no - survived (D12) |
| protected copies not loaded through the manager | `apps/api/src/substitution/substitution.service.ts:158` | yes |
| protected copies not passed to the engine | `substitution.service.ts:180` | yes (unit and e2e) |
| deck cards read outside the manager | `substitution.service.ts:144` | yes |
| manager not forwarded by `computeAndStoreReadiness` | `substitution.service.ts:70` | yes |
| `23505` no longer recognised | `apps/api/src/collection/csv/csv-upload.service.ts:193` | yes |
| `exact-match` answer carries a wrong source id | `csv-upload.service.ts:205` | yes |
| manual-source unique index removed from the entity | `apps/api/src/database/entities/csv-source.entity.ts:46` | yes |
| content-hash unique index removed from the entity | `csv-source.entity.ts:42` | yes |
| migration: index removed | `apps/api/src/database/migrations/1778533590000-AddCardReplacement.ts:106` | yes |
| migration: `userId` cascade removed | `1778533590000-AddCardReplacement.ts:93` | yes |
| migration: `trackedDeckId` cascade removed | `1778533590000-AddCardReplacement.ts:102` | yes |
| migration: status CHECK weakened | `1778533590000-AddCardReplacement.ts:67` | yes |
| migration: `pickedFrom` CHECK widened | `1778533590000-AddCardReplacement.ts:75` | yes |
| migration: quantity CHECK `>= 0` | `1778533590000-AddCardReplacement.ts:83` | yes |
| migration: `slot` width 65 | `1778533590000-AddCardReplacement.ts:49` | yes |
| migration: `originalCardIdentifier` width 129 | `1778533590000-AddCardReplacement.ts:50` | yes |
| migration: `replacementCardIdentifier` width 129 | `1778533590000-AddCardReplacement.ts:51` | no - survived (M10) |
| migration: id not generated | `1778533590000-AddCardReplacement.ts:46` | yes |
| migration: non-empty synchronized table no longer refused | `1778533590000-AddCardReplacement.ts:30` | yes |
| entity: quantity CHECK removed | `apps/api/src/database/entities/card-replacement.entity.ts:38` | yes |
| entity: status CHECK removed | `card-replacement.entity.ts:36` | yes |
| entity: `pickedFrom` CHECK removed | `card-replacement.entity.ts:37` | yes |
| entity: `csv_source` kind CHECK removed | `csv-source.entity.ts:32` | yes |
| entity: `tracked_deck` status CHECK removed | `apps/api/src/database/entities/tracked-deck.entity.ts:33` | yes |
| entity: `swap_suggestion` status CHECK removed | `apps/api/src/database/entities/swap-suggestion.entity.ts:34` | yes |
| entity: `swap_suggestion` rejection reason CHECK removed | `swap-suggestion.entity.ts:35` | yes |
| entity: `swap_suggestion` outcome CHECK removed | `swap-suggestion.entity.ts:36` | yes |
| entity: `card_replacement` index loses its name | `card-replacement.entity.ts:40` | no - survived (H9) |
| sheet: owned `>=` to `>` | `apps/web/src/components/deck-detail/AlternativesSheet.tsx:72` | yes |
| sheet: price shown for owned cards | `AlternativesSheet.tsx:114` | yes |
| sheet: focus on empty removed | `AlternativesSheet.tsx:157` | yes |
| sheet: pick sends a constant group | `AlternativesSheet.tsx:167` | yes |
| sheet: stays open after a pick | `AlternativesSheet.tsx:170` | yes |
| sheet: pick error not shown | `AlternativesSheet.tsx:171` | yes |
| sheet: group label swapped | `AlternativesSheet.tsx:25` | yes |
| sheet: retry does not refetch | `AlternativesSheet.tsx:221` | yes |
| search minimum 2 to 1 | `apps/web/src/api/replacements.ts:63` | yes |
| swaps query not invalidated | `replacements.ts:87` | yes |
| deck detail not invalidated on a pick error | `replacements.ts:104` | yes |
| keep and revert share one route | `replacements.ts:115` | yes |
| pt-BR `REPLACEMENT_ILLEGAL` key renamed | `apps/web/src/i18n/locales/pt-BR/apiErrors.ts` | yes |
| list cell ignores the slot | `apps/web/src/components/deck-detail/DeckList.tsx:164` | yes |
| missing row mark ignores the slot | `apps/web/src/components/deck-detail/MissingPanel.tsx:100` | yes |
| control on rows fully held (`>` to `>=`) | `MissingPanel.tsx:106` | yes |
| control allowed on weapon rows | `MissingPanel.tsx:34` | yes |
| missing row mark removed | `MissingPanel.tsx:112` | yes |
| control on pending and rejected swaps too | `apps/web/src/components/deck-detail/SwapsPanel.tsx:124` | yes |
| prompt never shown | `apps/web/src/components/deck-detail/ReplacementMark.tsx:41` | yes |
| Keep sends revert | `ReplacementMark.tsx:49` | yes |
| Undo sends keep | `ReplacementMark.tsx:69` | yes |
| Go back sends keep | `ReplacementMark.tsx:58` | yes |
| Undo, Keep and Go back errors not shown | `ReplacementMark.tsx:35` | no - survived (W19) |
| deck page passes no replacements to `DeckList` | `apps/web/src/components/deck-detail/DeckDetailView.tsx:143` | yes (killed by C58, line 41; the unit spec does not reach it) |
| deck page passes no replacements to `MissingPanel` | `apps/web/src/components/deck-detail/DeckActionPanels.tsx:65` | no - survived C58 (W26) |
| deck page opens no sheet | `DeckDetailView.tsx:140` | yes (C58, line 35) |

## Non-feature fixes in the range

| Fix | Does what its commit says | Proven by a test that fails without it | Other behaviour changed |
| --- | --- | --- | --- |
| fixture trim (`592eb06`, `8bf81b5`, `scripts/fixture/fixture-seed.ts`) | yes: seeding a fresh user with origin/main's file exits 1 (stack at `fixture-seed.ts:269`); with HEAD's file the seed ends `fixture ready` and the three swaps return (full Playwright run 60 passed) | yes: the seed itself is the check, red on the old composition for a new user, green on the new; C58 starts from its three missing rows | the swap deck leaves `show-of-strength-red` x3, `massacre-red` x3, `bam-bam-yellow` x2 and drops two copies each of `bear-hug-blue` and `argh-smash-yellow`; the owned set is unchanged; a re-seed of the already-seeded `fixture@test.local` user does not rebuild the deck, so the old file seeds cleanly there (only a new user shows the failure) |
| manual-source unique index on `CsvSourceEntity` (`9a377a5`) | yes: the entity now declares `IDX_csv_source_user_manual_uq`, so a `synchronize` schema has it | yes: `manual-source-concurrency.e2e-spec.ts` fails 2 of 2 without the entity index (30 racing first writes) and passes again once the schema re-synchronizes | none in production (the migration already creates it); a synchronize-managed database already holding duplicate manual sources would fail to start (deviation 15) |
| content-hash unique index and `23505` handling (`9faef66`, `csv-upload.service.ts:187-224`) | yes: a repeated or concurrent identical CSV answers `exact-match` with the existing source | yes: index removed fails 2 of 3 in `csv-duplicate-upload.e2e-spec.ts`; the `23505` code test and the answered source id each fail 1 of 3 | behaviour change: a unique-index violation on `(userId, contentHash)` used to surface as an error and now answers `exact-match` and logs `csv.upload` with `kind: exact-match`; the existing source is looked up by `(userId, kind 'csv', contentHash)` and a miss rethrows |
| 8 CHECK constraints declared on entities (`695ad99`) | yes: each of the 8 expressions equals its migration's text (read side by side) and each exists by name on a schema built by `synchronize` | yes now: `entity-check-constraints.int-spec.ts` (8 tests) fails for each removal (8 of 8 killed, constraint name asserted) | none observable; on a synchronize-managed database holding a violating row the schema sync would now refuse |
| listen-once harnesses (`989a7d4`, `bfbe845`, `8a0f5ff`) | yes: 7 e2e specs (`plan-b-full-flow`, `theme-persistence`, `auth.controller`, `admin-stores.controller`, `decks.meta`, `re-solve.controller`, `swaps.controller`) and 4 int specs (`decks` post, put, patch, `tags`) each swap one line `app.init()` for `app.listen(0, '127.0.0.1')`; the replacements fixture does the same (`replacements-e2e.fixture.ts:109`); no assertion touched | no test can fail without it: it removes a stochastic per-request listen failure (deviation 16 reports about 40% of isolated throttle runs). Evidence at HEAD: 5 full e2e runs, 580 tests, 0 failures, no `407` | each harness now binds an ephemeral loopback port for its lifetime; every other supertest user in the range already listens once |
| deck guard answers 400 for a non-digit id (`0df7e4c`) | yes: `/^\d+$/` before any query; `guard.spec` 5 passed | yes: removing the test fails 4 of 5 guard specs and the e2e deck-id case (`alternatives.e2e-spec.ts:95-96`, `replacements.e2e-spec.ts:253-254`); accepting decimals fails the `1.5` case | cannot reject a valid id (every digit string passes, `0` and leading zeros included). Routes using the guard: `GET`, `PATCH`, `PUT`, `DELETE /api/decks/:deckId`, `POST /api/decks/:deckId/fetch-variants`, the alternatives route and the pick route (7); all name the parameter `deckId` (`variant-fetch.controller.ts:74`), which the guard reads; only 2 are driven over HTTP, the other 5 rely on the shared guard spec. A negative id such as `-1` now answers 400 where the pipe let it reach a 404; a digit string beyond the integer range still reaches Postgres (finding 11) |

## Deviations judged

1 accepted (the 8-deck table covers every branch of the compute; `readiness.spec.ts` only gained lines). 2 accepted (generic reuses the tier 2 scorer on a copy that takes the missing card's classes and talents; matches the design table; its `hasSharedType` call is redundant with `score.ts:79`, fault equivalent). 3 accepted (the test pins the real scores 0.70 and 0.85). 4 accepted as corrected: the rarity rows now use the real `blade-dance` (`card-legality.spec.ts:30-31` area, assertions at `:43`); the equipment row reuses it because no equipment card reaches the rule. 5 accepted. 6 accepted (`substitution.service.spec.ts` +50 lines, 0 removed). 7 accepted. 8 accepted (`originalName` is in the plan's Surface row at line 88, proven by C59 and fault D2). 9 accepted (leaf `ReplacementsCoreModule`; the app boots and all modules resolve in the e2e runs). 10 accepted. 11 accepted (121 requests ending in 4xx per route; the throttler counts them). 12 accepted (the 0.05 bonus stays pinned; open question 1 stays open). 13 and 17 accepted for their extensions; their claim that every fault they list was "re-injected and killed" held when I re-ran each, except that the entity index name they say C52 asserts is not asserted (finding 1, H9). 14 accepted (the fixture trim is proven above). 15 accepted with its stated risk. 16 accepted: at HEAD no throttle-spec failure and no `407` appeared in 5 full runs; I did see one different flake in the web suite (finding 10). 18 accepted (diff read: one line per harness).

## Gate

- `pnpm typecheck` - exit 0.
- `pnpm lint` - exit 0.
- `pnpm -r test` - run 1 exit 1: engine 15 suites 334 passed, api 83 suites passed, web 1 failed of 2305 (`CsvSourceRow.test.tsx:165`, a dropped first keystroke under load, finding 10); run 2 exit 0: engine 334 passed, api 83 suites 948 passed, web 146 files 2305 passed. The file is outside the range and passed 5 of 5 alone.
- `pnpm --filter @rathe-arsenal/api test:int --runInBand` - 13 suites, 106 passed, 0 failed.
- `pnpm --filter @rathe-arsenal/api test:e2e` (`--runInBand`, dev server stopped), 5 full runs: 14 suites and 116 tests passed in each, 0 failed, no `407`.
- Playwright: dev server started for these runs only (ports free before, stopped after); `pnpm seed:fixture` exit 0; full run both projects 60 passed (3.1 min); C58 twice in a row, both passed (4.8 s, 3.6 s).
