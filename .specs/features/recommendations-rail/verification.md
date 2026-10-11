# Recommendations rail verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: 735bf12..0a75a5d
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Binding sources: not required under `standard` (step 1 skipped). Proof commands are the ones in `checks.md`, batched per runner; every named test appeared individually in the output as passing.

## Checks

Paths: G = `apps/api/src/recommendations/__tests__/generation-state.spec.ts`, R = `apps/api/src/recommendations/__tests__/recommendations-read.e2e-spec.ts`, X = `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx`, P = `apps/web/src/components/deck-detail/__tests__/DeckDetailView.recommendations.spec.tsx`, D = `apps/web/src/components/deck-detail/__tests__/deal-geometry.spec.ts`, E = `apps/web/tests/e2e/recommendations-rail-flow.spec.ts`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | status derived from run row, 6 rows | api unit batch, exit 0 | `G:25` - `expect(deriveGenerationStatus(run, NOW)).toBe(expected)` over the 6 rows at `G:16-21` | PASS |
| C2 | elapsed 42000 / 15000 / 0 | api unit batch, exit 0 | `G:30-34` - `.toBe(42_000)`, `.toBe(15_000)`, `.toBe(0)` | PASS |
| C3 | median 90000 / 90000 / null / null | api unit batch, exit 0 | `G:38-41` - `medianDurationMs([60_000, 90_000, 300_000])` `.toBe(90_000)`, even `.toBe(90_000)`, `.toBeNull()` twice | PASS |
| C4 | sample <=16, imaged, distinct, stable, 5 of 5 | api unit batch, exit 0 | `G:53-58` - `toHaveLength(16)`, `Set(...).size).toBe(16)`, `second...toEqual(first...)`, `samplePool([... 5]) toHaveLength(5)` | PASS |
| C5 | running/queued/null+pending/null+not pending on route | api e2e batch (port 55433 throwaway DB), 11 passed | `R:202` `status).toBe('running')`; `R:203-204` elapsed 30000..40000; `R:205` `poolSize).toBe(expectedPool.length)`; `R:216` `'queued'`; `R:224` `{ generation: null, pending: true }`; `R:227` `{ generation: null, pending: false }` | PASS |
| C6 | typicalMs 90000 / null / 100000 (window) | api e2e batch | `R:245` `.toBeNull()`; `R:249` `.toBe(90_000)`; `R:256` `.toBe(100_000)`. Window part is not killed by a mutant, see Faults (precision gap) | PASS (weak, see Faults) |
| C7 | 401 / 404 and no `generation` in body | api e2e batch | `R:265-266` `.expect(404)` twice; `R:268` `.expect(401)`; `R:269` `expect(body).not.toHaveProperty('generation')` | PASS |
| C8 | section right after status strip, not in action panels, both deck states | web unit batch | `P` diff hunk: `expect(order[strip + 1]).toBe('recommendations-panel')`, `expect(order.indexOf('analysis-row')).toBeGreaterThan(strip + 1)`, `within(panels!).queryByTestId('recommendations-panel')).toBeNull()` (file lines ~86-98); loop covers `[50, true]` and `[100, false]` | PASS |
| C9 | titles in pt-BR and en-US | web unit batch | `X:135` `toHaveTextContent('Recomendações para este deck')`; `X:140` `toHaveTextContent('Recommendations for this deck')` | PASS |
| C10 | 3 cards in rank order, one scrolling container | web unit batch | `X:157` `.toEqual(['first', 'second', 'third'])`; `X:158` `parentElement === rail`; `X:160` regex `\.rail\s*{[^}]*overflow-x:\s*auto` not null | PASS |
| C11 | art, name+pitch, chips, reason, cut label, buttons, ownership | web unit batch | `X:177` `'Clear Card (Vermelho)'`; `X:178` `'melhoria clara'`; `X:181` `'considerar'`; `X:184` label `'No lugar de'`; `X:185-186` Usar/Dispensar; `X:202` `'na coleção'`; `X:204-205` href + `'R$ 4,50'`; `X:207` `'sem estoque'` | PASS |
| C12 | cut art tucked, "sai", preselected; none without cut | web unit batch | `X:223` tucked img `src` small/flex; `X:224` `getByText('sai')`; `X:225` select value `'flex-red'`; `X:226-228` null / null / value `''` | PASS |
| C13 | cost chip 6 rows | web unit batch | `X:234-239` rows; `X:250` `expect(chip).toHaveTextContent(expected)` and `X:249` `toBeNull()` for the unknown-cost row | PASS |
| C14 | art tap opens large preview, no adopt | web unit batch | `X:261-262` dialog with large img `src`; `X:263` `some(... method === 'POST')).toBe(false)` | PASS |
| C15 | adopt with cut + slot; disabled without cut; NOTHING_TO_REPLACE message | web unit batch | `X:280` `Usar ... toBeDisabled()`; `X:284-287` `toHaveBeenCalledWith(.../rec-9/adopt, { method: 'POST', body: JSON.stringify({ cutCardIdentifier: 'emissary-of-tides-red', cutSlot: 'mainboard' }) })`; `X:288` `cutGone` | PASS |
| C16 | Dispensar hides, POST dismissals, toast, Desfazer DELETE, card returns | web unit batch | `X:299` POST `/dismissals`; `X:300` row null; `X:304` `'Desfazer'`; `X:308` DELETE `/dismissals/adrenaline-rush-red`; `X:309` row back | PASS |
| C17 | six section states, retry refetches | web unit batch | `X:315-317` empty + `Gerar` not `Gerar de novo`; `X:320` `'Gerar de novo'`; `X:324` no-upgrades; `X:327` `'O modelo demorou demais para responder.'`; `X:330-331` load error + Tentar de novo; `X:354` call count grows; `X:334` stale | PASS |
| C18 | Gerar POSTs runs; mutations invalidate recommendations and decks | web unit batch | `X:375` `toHaveBeenCalledWith(`${BASE}/runs`, { method: 'POST' })`; `X:396-406` invalidated keys `toEqual` per mutation (adopt, dismiss, undo, generate) | PASS |
| C19 | pile with card back, 821, label | web unit batch | `X:414-417` `img[src$="card-back.webp"]` length > 0, `'821'`, `'cartas candidatas'` | PASS |
| C20 | clock 1:05 then 1:08 | web unit batch | `X:426` `'1:05'`; `X:430` `'1:08'` | PASS |
| C21 | step line queued / retrying / running | web unit batch | `X:434-437` rows; `X:447` `expect(...generation-step).toHaveTextContent(expected)` | PASS |
| C22 | usual duration + mark, or neither | web unit batch | `X:455` `'costuma levar ~2 min'`; `X:456` mark present; `X:462-463` both `toBeNull()` | PASS |
| C23 | passes usual time message | web unit batch | `X:473` running step; `X:479-481` exact "Passou do tempo de costume..." text | PASS |
| C24 | lift within 1.2 s unless reduced | web unit batch | `X:495` face `src` `^https://img.test/small/`; `X:496` name in poolSample; `X:505` `recommendations-pile-lift` `toBeNull()` after 5 s with reduced motion | PASS |
| C25 | Gerando… disabled, previous cards dimmed and disabled | web unit batch | `X:513` `data-dimmed='true'`; `X:514-515` both `toBeDisabled()`; `X:517-518` `'Gerando…'` + disabled | PASS |
| C26 | poll every 10 s only while active | web unit batch | `X:526` 1 read; `X:531` still 1 at 9 999 ms; `X:536` 2 at 10 s; `X:541` 3; `X:546` still 3 after 30 s idle | PASS |
| C27 | deal keyframes | web unit batch | `D:14` first `'translate(30px, 200px) scale(1) rotate(0deg)'`; `D:15` last `'translate(390px, 160px) scale(1.8363636363636364) rotate(0deg)'`; `D:17-18` middle Y < 200 and < 160; `D:19` origin `'0 0'` | PASS |
| C28 | 3 cards 190 ms apart land within 0.5 px, pile gone, 3 cards with reasons | Playwright batch, 3 passed | `E:130` `__delays).toEqual([0, 190, 380])`; `E:134` `Math.abs(difference) <= 0.5` for left/top/width/height; `E:124` pile `toHaveCount(0)`; `E:137-139` 3 rows and `Motivo para ...` visible; `E:143` no `dealt-card` left | PASS |
| C29 | rail height unchanged within 1 px | Playwright batch | `E:142` `Math.abs(record.__railHeights[0]! - settledHeight)).toBeLessThanOrEqual(1)` | PASS |
| C30 | reduced motion: no flying card, 3 cards; finished run: no pile, no deal | Playwright batch | `E:168` 3 rows; `E:170` pile 0; `E:171` `__dealt).toBe(0)`; `E:179-182` 3 rows, pile 0, `dealt-card` 0 | PASS |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| generation status per run row (6) | `deriveGenerationStatus` branches, `generation-state.ts:31-37` | all six rows `G:16-21`; route: running/queued/null `R:202,216,224` | - |
| elapsed start (3) | `generation-state.ts:39-42` | `G:30-34` | - |
| typical duration (4) | `generation-state.ts:44-49` plus service window `recommendations.service.ts:178-179` | odd/even/under 3 `G:38-41`, `R:245,249`; 20-run window `R:256` asserts only the value, which is unchanged if the window selects the wrong 20 (see Faults) | window direction (`ORDER BY "finishedAt" DESC` vs `ASC`) not pinned |
| read route statuses (200/401/404) | plan Surface | 200 `R:202`, 401 `R:268`, 404 `R:265-266` | - |
| section states (6) | plan AC 19-22 | all in `X:314-335` | - |
| ownership chip (3) | plan AC 13 | `X:202,204-205,207` | - |
| cost chip (6) | plan AC 15 | `X:234-239` | - |
| step line (4) | plan AC 25, 27 | `X:434-437`, `X:479` | - |
| motion paths (2) | plan AC 28, 35 | full `X:495`, `E:130`; reduced `X:505`, `E:171` | - |
| deck states for placement (2) | plan AC 10 | `P` loop over `[50, true]`, `[100, false]` | - |
| locales (2) | plan AC 11 | `X:135,140` | - |
| Landing door 1 shape | plan Landing | `R:206-211` fields `cardIdentifier`, `name`, `imageUrl.small`; `R:203-205` numeric fields | - |

Existing-constraint re-read: `Swept` authorization cites `JwtAuthGuard` and `OwnsTrackedDeckGuard` on the read route. `OwnsTrackedDeckGuard` is at `apps/api/src/recommendations/recommendations.controller.ts:37`; the 401 is asserted at `R:268`, so the guard chain behaves as cited.

Sweep of plan enumerations with no row: AC 33 (the replaced card, text and buttons fade in after the landing) and AC 31's condition that the deal runs only when the new run id differs from the one shown before are not in any check (no negative case: a poll returning the same finished run). AC 26's "mark at the typical duration" is proven only as present, not at the right position. These are check-design gaps, not unproven check members; noted, not counted as FAIL causes.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (generation state on the read route) | `generation-state.ts`, `recommendations.service.ts` | own layer `G:25,30-41,53-58` plus route `R:202-256` | no - statuses and null cases are asserted, but the route's typical-duration window is not pinned (surviving mutant, second row of Faults). Expectation "asserts the typical-duration window" is not met by the data chosen |
| Decides, not reached across a boundary (cost chip, step line, section states, deal geometry) | `SwapCard.tsx`, `GenerationStatus.tsx`, `RecommendationsRail.tsx`, `deal-geometry.ts` | one at own layer | yes (`X:234-251`, `X:434-448`, `X:314-357`, `D:12-19`) |
| Layout and motion needing a real layout engine | `useDeal.ts`, `CandidatePile.tsx`, rail CSS | one in a real browser | yes (`E:130-143`, full deal of 3 and the reduced-motion path `E:168-171`) |
| Instrumentation (query invalidation, section position) | `RecommendationsRail.tsx`, `DeckDetailView.tsx` | asserted where it is the claim | yes (`X:396-406`, `P` order assertions) |

Because the first row's coverage expectation names the typical-duration window and F2 survived, the first row is recorded as met only in part; the verdict below treats it as unmet.

## Faults injected

Scratch worktree at a throwaway path under the session scratchpad, deleted afterwards; real-tree `git status --porcelain` before and after identical (empty). The first attempt used BSD `sed -i` wrongly and applied no mutation; those runs were discarded and redone with perl.

| Mutation | Location | Killed |
| --- | --- | --- |
| retrying threshold `attempts > 0` -> `attempts > 1` | `apps/api/src/recommendations/generation-state.ts:34` | yes (`derives the status from the run row` failed) |
| typical-duration window query `ORDER BY "finishedAt" DESC` -> `ASC` (takes the 20 oldest instead of the 20 newest) | `apps/api/src/recommendations/recommendations.service.ts:178` | no (`typical duration comes from recent done runs` still passed: the seed makes 19 of the 20 oldest also 100 s, so the median stays 100 000 either way) |
| deal scale `slot.width / pile.width` -> `pile.width / slot.width` | `apps/web/src/components/deck-detail/recommendations/deal-geometry.ts:29` | yes (`maps the pile box onto the slot box` failed) |
| cost difference `recommendation.cost - cut` -> `cut - recommendation.cost` | `apps/web/src/components/deck-detail/recommendations/SwapCard.tsx:35` | yes (`the cost chip compares with the cut card` failed) |
| rail moved after the analysis row | `apps/web/src/components/deck-detail/DeckDetailView.tsx:136` | yes (`puts recommendations right under the status strip` failed) |

## Gate

Unit and e2e proofs for this feature at `0a75a5d`: api unit 4 passed, api e2e 11 passed (file `recommendations-read.e2e-spec.ts`), web unit 22 passed (3 files), Playwright 3 passed. Total 40 passed, 0 failed. The full repo suites were not run by the Verifier.

## Ranked gaps

1. Surviving mutant: the "20 most recent done runs" window is not pinned - C6 - seed at `R:252-256` (a 1 s oldest run plus 20 x 100 s runs gives median 100 000 whether the query takes the newest or the oldest 20, and also with no LIMIT). Fix by making the oldest runs differ enough to shift the median, for example 11 old runs of 1 s that would dominate an ASC or unlimited window while the 20 newest are 100 s. The check text in `checks.md` C6 is itself imprecise ("the oldest-finished is 1 s"): a single outlier cannot move a median of 21.
2. Check-design gaps (non-blocking): AC 31's "different run id" guard and AC 33's fade-in have no check.
