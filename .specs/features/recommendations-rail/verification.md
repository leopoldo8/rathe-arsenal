# Recommendations rail verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 735bf12..18e8730
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 2 re-ran every proof at `18e8730` (verified at 18e8730) and re-injected faults only on the surfaces the fix `0a75a5d..18e8730` touched. Everything else is marked `carried from 0a75a5d`. The fix changed only tests and `checks.md` (no production code), so the production citations below did not move.

Binding sources: not required under `standard` (step 1 skipped; the fix touched no interface). Proof commands are the ones in `checks.md`, batched per runner; every named test appeared individually in the output as passing.

## Checks

Paths: G = `apps/api/src/recommendations/__tests__/generation-state.spec.ts`, R = `apps/api/src/recommendations/__tests__/recommendations-read.e2e-spec.ts`, X = `apps/web/src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx`, P = `apps/web/src/components/deck-detail/__tests__/DeckDetailView.recommendations.spec.tsx`, D = `apps/web/src/components/deck-detail/__tests__/deal-geometry.spec.ts`, E = `apps/web/tests/e2e/recommendations-rail-flow.spec.ts`.

Proofs verified at 18e8730: api unit 4/4, api e2e 11/11 (throwaway DB from `ci-env.sh`), web unit 24/24 (3 files, each test listed individually), Playwright 3/3. Evidence cells for untouched files are carried from 0a75a5d (line numbers in G, D, P and in X above line 520 are unchanged, since the fix only appended to X after line 518 and E/R lines were re-read where they shifted).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | status derived from run row, 6 rows | api unit batch at 18e8730, exit 0 | `G:25` - `expect(deriveGenerationStatus(run, NOW)).toBe(expected)` over the 6 rows at `G:16-21` | PASS |
| C2 | elapsed 42000 / 15000 / 0 | api unit batch at 18e8730, exit 0 | `G:30-34` - `.toBe(42_000)`, `.toBe(15_000)`, `.toBe(0)` | PASS |
| C3 | median 90000 / 90000 / null / null | api unit batch at 18e8730, exit 0 | `G:38-41` - `medianDurationMs([60_000, 90_000, 300_000])` `.toBe(90_000)`, even `.toBe(90_000)`, `.toBeNull()` twice | PASS |
| C4 | sample <=16, imaged, distinct, stable, 5 of 5 | api unit batch at 18e8730, exit 0 | `G:53-58` - `toHaveLength(16)`, `Set(...).size).toBe(16)`, `second...toEqual(first...)`, `samplePool([... 5]) toHaveLength(5)` | PASS |
| C5 | running/queued/null+pending/null+not pending on route | api e2e batch at 18e8730, 11 passed | `R:202` `status).toBe('running')`; `R:203-204` elapsed 30000..40000; `R:205` `poolSize).toBe(expectedPool.length)`; `R:216` `'queued'`; `R:224` `{ generation: null, pending: true }`; `R:227` `{ generation: null, pending: false }` | PASS |
| C6 | typicalMs 90000 / null / 100000 with the 20-run window (21 old runs of 1 s, 20 new of 100 s) | api e2e batch at 18e8730 | `R:245` `.toBeNull()`; `R:249` `.toBe(90_000)`; `R:258` `expect((await read(deckId, jwt)).generation.typicalMs).toBe(100_000)` after seeding 21 x 1 s at `R:252-254` and 20 x 100 s at `R:255-257`. Window direction and limit are now pinned: ASC and a 1000-row window both fail it (see Faults) | PASS |
| C7 | 401 / 404 and no `generation` in body | api e2e batch at 18e8730 | `R:267-268` `.expect(404)` twice; `R:270` `.expect(401)`; `R:271` `expect(body).not.toHaveProperty('generation')` | PASS |
| C8 | section right after status strip, not in action panels, both deck states | web unit batch at 18e8730 | `P` diff hunk: `expect(order[strip + 1]).toBe('recommendations-panel')`, `expect(order.indexOf('analysis-row')).toBeGreaterThan(strip + 1)`, `within(panels!).queryByTestId('recommendations-panel')).toBeNull()` (file lines ~86-98); loop covers `[50, true]` and `[100, false]` | PASS |
| C9 | titles in pt-BR and en-US | web unit batch at 18e8730 | `X:135` `toHaveTextContent('Recomendações para este deck')`; `X:140` `toHaveTextContent('Recommendations for this deck')` | PASS |
| C10 | 3 cards in rank order, one scrolling container | web unit batch at 18e8730 | `X:157` `.toEqual(['first', 'second', 'third'])`; `X:158` `parentElement === rail`; `X:160` regex `\.rail\s*{[^}]*overflow-x:\s*auto` not null | PASS |
| C11 | art, name+pitch, chips, reason, cut label, buttons, ownership | web unit batch at 18e8730 | `X:177` `'Clear Card (Vermelho)'`; `X:178` `'melhoria clara'`; `X:181` `'considerar'`; `X:184` label `'No lugar de'`; `X:185-186` Usar/Dispensar; `X:202` `'na coleção'`; `X:204-205` href + `'R$ 4,50'`; `X:207` `'sem estoque'` | PASS |
| C12 | cut art tucked, "sai", preselected; none without cut | web unit batch at 18e8730 | `X:223` tucked img `src` small/flex; `X:224` `getByText('sai')`; `X:225` select value `'flex-red'`; `X:226-228` null / null / value `''` | PASS |
| C13 | cost chip 6 rows | web unit batch at 18e8730 | `X:234-239` rows; `X:250` `expect(chip).toHaveTextContent(expected)` and `X:249` `toBeNull()` for the unknown-cost row | PASS |
| C14 | art tap opens large preview, no adopt | web unit batch at 18e8730 | `X:261-262` dialog with large img `src`; `X:263` `some(... method === 'POST')).toBe(false)` | PASS |
| C15 | adopt with cut + slot; disabled without cut; NOTHING_TO_REPLACE message | web unit batch at 18e8730 | `X:280` `Usar ... toBeDisabled()`; `X:284-287` `toHaveBeenCalledWith(.../rec-9/adopt, { method: 'POST', body: JSON.stringify({ cutCardIdentifier: 'emissary-of-tides-red', cutSlot: 'mainboard' }) })`; `X:288` `cutGone` | PASS |
| C16 | Dispensar hides, POST dismissals, toast, Desfazer DELETE, card returns | web unit batch at 18e8730 | `X:299` POST `/dismissals`; `X:300` row null; `X:304` `'Desfazer'`; `X:308` DELETE `/dismissals/adrenaline-rush-red`; `X:309` row back | PASS |
| C17 | six section states, retry refetches | web unit batch at 18e8730 | `X:315-317` empty + `Gerar` not `Gerar de novo`; `X:320` `'Gerar de novo'`; `X:324` no-upgrades; `X:327` `'O modelo demorou demais para responder.'`; `X:330-331` load error + Tentar de novo; `X:354` call count grows; `X:334` stale | PASS |
| C18 | Gerar POSTs runs; mutations invalidate recommendations and decks | web unit batch at 18e8730 | `X:375` `toHaveBeenCalledWith(`${BASE}/runs`, { method: 'POST' })`; `X:396-406` invalidated keys `toEqual` per mutation (adopt, dismiss, undo, generate) | PASS |
| C19 | pile with card back, 821, label | web unit batch at 18e8730 | `X:414-417` `img[src$="card-back.webp"]` length > 0, `'821'`, `'cartas candidatas'` | PASS |
| C20 | clock 1:05 then 1:08 | web unit batch at 18e8730 | `X:426` `'1:05'`; `X:430` `'1:08'` | PASS |
| C21 | step line queued / retrying / running | web unit batch at 18e8730 | `X:434-437` rows; `X:447` `expect(...generation-step).toHaveTextContent(expected)` | PASS |
| C22 | usual duration + mark, or neither | web unit batch at 18e8730 | `X:455` `'costuma levar ~2 min'`; `X:456` mark present; `X:462-463` both `toBeNull()` | PASS |
| C23 | passes usual time message | web unit batch at 18e8730 | `X:473` running step; `X:479-481` exact "Passou do tempo de costume..." text | PASS |
| C24 | lift within 1.2 s unless reduced | web unit batch at 18e8730 | `X:495` face `src` `^https://img.test/small/`; `X:496` name in poolSample; `X:505` `recommendations-pile-lift` `toBeNull()` after 5 s with reduced motion | PASS |
| C25 | Gerando… disabled, previous cards dimmed and disabled | web unit batch at 18e8730 | `X:513` `data-dimmed='true'`; `X:514-515` both `toBeDisabled()`; `X:517-518` `'Gerando…'` + disabled | PASS |
| C26 | poll every 10 s only while active | web unit batch at 18e8730 | `X:526` 1 read; `X:531` still 1 at 9 999 ms; `X:536` 2 at 10 s; `X:541` 3; `X:546` still 3 after 30 s idle | PASS |
| C27 | deal keyframes | web unit batch at 18e8730 | `D:14` first `'translate(30px, 200px) scale(1) rotate(0deg)'`; `D:15` last `'translate(390px, 160px) scale(1.8363636363636364) rotate(0deg)'`; `D:17-18` middle Y < 200 and < 160; `D:19` origin `'0 0'` | PASS |
| C28 | 3 cards 190 ms apart land within 0.5 px, pile gone, 3 cards with reasons | Playwright batch at 18e8730, 3 passed | `E:147` `__delays).toEqual([0, 190, 380])`; `E:151` `Math.abs(difference)).toBeLessThanOrEqual(0.5)` for left/top/width/height; `E:131` pile `toHaveCount(0)`; `E:154-156` 3 rows and `Motivo para ...` visible; `E:160` no `dealt-card` left | PASS |
| C29 | rail height unchanged within 1 px | Playwright batch at 18e8730, 3 passed | `E:159` `Math.abs(record.__railHeights[0]! - settledHeight)).toBeLessThanOrEqual(1)` | PASS |
| C30 | reduced motion: no flying card, 3 cards; finished run: no pile, no deal | Playwright batch at 18e8730, 3 passed | `E:190` 3 rows; `E:192` pile 0; `E:193` `__dealt).toBe(0)`; `E:201-204` 3 rows, pile 0, `dealt-card` 0 | PASS |
| C31 | same run: pile gone at once, cards undimmed; different run: pile kept for the deal, gone within 2 s | web unit batch at 18e8730 | `X:533` `queryByTestId('recommendations-pile')).toBeNull()` and `X:534` `getByTestId('recommendation-row')).toHaveAttribute('data-dimmed', 'false')` after a `MODEL_TIMEOUT` poll with the same run; `X:544` `'Gerar de novo'`, `X:545` pile `toBeInTheDocument()` after a poll with run `run-2`, then `X:549` pile `toBeNull()` after 2 s. Mutant of the run-changed condition killed | PASS |
| C32 | 60 ms after each landing the reason is below 0.5 opacity; after the deal every reason is at 1 | Playwright batch at 18e8730, 3 passed | `E:161` `expect(record.__reasonOpacityAfterLanding).toHaveLength(3)`; `E:162` `expect(opacity).toBeLessThan(0.5)` per card; `E:164` `...getComputedStyle(el).opacity)).toBe(1)` per reason (recording at `E:96-100`). No mutant run for the fade (see Faults) | PASS |
| C33 | mark at the bottom of the ring (`x1`=`x2`=15, `y1`>15), arc half full at elapsed = typical | web unit batch at 18e8730 | `X:559` `expect([x1, x2]).toEqual(['15', '15'])`; `X:560` `Number(y1)).toBeGreaterThan(15)`; `X:563` `expect(filled / circumference).toBeCloseTo(0.5, 2)` | PASS |

## Coverage

Rows for the typical-duration window and the deal trigger were recomputed at 18e8730; the rest are carried from 0a75a5d.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| typical duration (4), verified at 18e8730 | `generation-state.ts:44-49` plus service window `recommendations.service.ts:174-180` (`ORDER BY "finishedAt" DESC LIMIT $1`, `TYPICAL_DURATION_WINDOW`) | odd/even/under 3 `G:38-41`; route 90 000 `R:249`, null `R:245`; 20-run window `R:258` with 21 old 1 s runs, so ASC (20 oldest -> 1 000) and an unbounded window (41 runs -> 1 000) both fail; both mutants killed | - |
| deal trigger (2), verified at 18e8730 | `RecommendationsRail.tsx:74` `runId !== null && runId !== phase.runBefore && listed.length > 0 && !reducedMotion` | different run `X:544-549` and `E:147-151`; same run `X:533-534` | - |
| typical-time mark (2: position, fill), verified at 18e8730 | `GenerationStatus.tsx:36,56` (`typicalMs * 2` full turn; line `x1=15 y1=26 x2=15 y2=30`) | position `X:559-560`; fill `X:563` | - |
| landing fade-in (1), verified at 18e8730 | `SwapCard.module.css:237-248` (`swap-card-fade`/`swap-card-rise` with `both`) | `E:161-164` | - |
| generation status per run row (6), carried from 0a75a5d | `generation-state.ts:31-37` | `G:16-21`; route `R:202,216,224` | - |
| elapsed start (3), carried from 0a75a5d | `generation-state.ts:39-42` | `G:30-34` | - |
| read route statuses (200/401/404), carried from 0a75a5d (R lines re-read at 18e8730) | plan Surface | 200 `R:202`, 401 `R:270`, 404 `R:267-268` | - |
| section states (6), carried from 0a75a5d | plan AC 19-22 | `X:314-335` | - |
| ownership chip (3), carried from 0a75a5d | plan AC 13 | `X:202,204-205,207` | - |
| cost chip (6), carried from 0a75a5d | plan AC 15 | `X:234-239` | - |
| step line (4), carried from 0a75a5d | plan AC 25, 27 | `X:434-437`, `X:479` | - |
| motion paths (2), carried from 0a75a5d | plan AC 28, 35 | full `X:495`, `E:147`; reduced `X:505`, `E:193` | - |
| deck states for placement (2), carried from 0a75a5d | plan AC 10 | `P` loop over `[50, true]`, `[100, false]` | - |
| locales (2), carried from 0a75a5d | plan AC 11 | `X:135,140` | - |
| Landing door 1 shape, carried from 0a75a5d | plan Landing | `R:206-211`, `R:203-205` | - |

The three round-1 sweep gaps (AC 26 mark position, AC 31 same-run guard, AC 33 fade-in) now each have a check (C33, C31, C32) with a located assertion. Existing-constraint re-read (carried from 0a75a5d): `OwnsTrackedDeckGuard` at `apps/api/src/recommendations/recommendations.controller.ts:37`, and the 401 at `R:270`.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, reached across a boundary (generation state on the read route), re-judged at 18e8730 | `generation-state.ts`, `recommendations.service.ts` | own layer `G:25,30-41,53-58` plus route `R:202-258` | yes - every status row at its layer, route asserts running/queued/null+pending/null+not pending, and the typical-duration window is now pinned (`R:258`; ASC and unbounded mutants killed) |
| Decides, not reached across a boundary (cost chip, step line, section states, deal geometry), carried from 0a75a5d | `SwapCard.tsx`, `GenerationStatus.tsx`, `RecommendationsRail.tsx`, `deal-geometry.ts` | one at own layer | yes (`X:234-251`, `X:434-448`, `X:314-357`, `D:12-19`; the new `X:521-564` add the deal trigger and mark) |
| Layout and motion needing a real layout engine, re-judged at 18e8730 | `useDeal.ts`, `CandidatePile.tsx`, rail CSS, `SwapCard.module.css` | one in a real browser | yes (`E:147-164` full deal of 3 plus fade; reduced-motion path `E:190-193`) |
| Instrumentation (query invalidation, section position), carried from 0a75a5d | `RecommendationsRail.tsx`, `DeckDetailView.tsx` | asserted where it is the claim | yes (`X:396-406`, `P:90-96`) |

## Faults injected

Scratch worktree `git worktree add --detach /private/tmp/claude-501/verify-r2-scratch HEAD`, with `pnpm install --frozen-lockfile --offline` and the engine build, removed afterwards. Real-tree `git status --porcelain` was empty before and after. Round-1 faults on untouched surfaces are carried from 0a75a5d (all four killed: retrying threshold, deal scale, cost difference, rail position). The fix touched tests only, so these are the surfaces it created or sharpened. Six mutants on four surfaces (one over the usual cap of five, because two surfaces each got a second mutant to pin a second aspect of the same new assertion).

| Mutation | Location | Killed |
| --- | --- | --- |
| window order `ORDER BY "finishedAt" DESC` -> `ASC` (this survived in round 1) | `apps/api/src/recommendations/recommendations.service.ts:178` | yes (`typical duration comes from recent done runs` failed) |
| window size `[TYPICAL_DURATION_WINDOW]` -> `[1000]` (all 41 runs count) | `apps/api/src/recommendations/recommendations.service.ts:180` | yes (`typical duration comes from recent done runs` failed) |
| deal condition `runId !== phase.runBefore` removed, so the same run deals | `apps/web/src/components/deck-detail/recommendations/RecommendationsRail.tsx:74` | yes (`deals only when a different run arrives` failed) |
| typical mark `y1="26"` -> `y1="10"` (mark moved to the top half) | `apps/web/src/components/deck-detail/recommendations/GenerationStatus.tsx:56` | yes (`marks the usual time half way round the ring` failed) |
| ring fill `typicalMs * 2` -> `typicalMs * 1` (arc full at the typical time) | `apps/web/src/components/deck-detail/recommendations/GenerationStatus.tsx:36` | yes (`marks the usual time half way round the ring` failed) |
| typical mark `x1="15"` -> `x1="20"` (mark slanted off the vertical) | `apps/web/src/components/deck-detail/recommendations/GenerationStatus.tsx:56` | yes (`marks the usual time half way round the ring` failed) |

Not injected: the reveal fade-in in `SwapCard.module.css` (C32). Its proof is Playwright, which runs against the dev servers served from the real tree; mutating the CSS would mean editing the real tree, and a scratch worktree is not what those servers serve. So C32's assertions (`E:161-164`) are located and green, but have not been made to fail once; that is a stated limit, not a pass on the mutant.

## Gate

Unit and e2e proofs for this feature at `18e8730`: api unit 4 passed, api e2e 11 passed (file `recommendations-read.e2e-spec.ts`), web unit 24 passed (3 files), Playwright 3 passed. Total 42 passed, 0 failed. The full repo suites were not run by the Verifier.

## Notes

1. C32 has no mutation evidence (reason above). Non-blocking: the assertion compares a measured opacity to 0.5 at 60 ms and to 1 after the deal, so a missing fade would read 1 at 60 ms and fail the first.
2. Carried from round 1: `checks.md` C6 wording was fixed; the 21-old-runs seed is what killed the ASC mutant.
