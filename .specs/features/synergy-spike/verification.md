# Synergy spike verification

**Verdict**: PASS
**Profile**: light
**Diff range**: a5652bb79975c1bda0f4cee21e2455ff2ecc899b..1f10d62
**Round**: 3 - full
**Verifier**: independent sub-agent (author != verifier)

34 of 34 checks proven with located evidence (C3's second proof, the api suite, was not run by instruction; see finding 1).
This report replaces the round 2 report. All five faults the last round raised were re-injected at HEAD and each is now killed.

## Ranked findings

None blocking. Observations, in order of weight:

1. C3 names `pnpm --filter @rathe-arsenal/api test` as a proof. I did not run it: the brief reserved the api suite for another Verifier running in the main checkout. The diff outside `scripts/synergy-spike/` and `.specs/` touches `packages/engine/src/catalog/catalog.ts` and `types.ts` (one optional field), `packages/engine/__tests__/catalog.spec.ts`, `package.json`, `.env.example`, `scripts/gold-set/fetch-deck.ts` and `.design/card-alternatives.md`, and no file under `apps/`. The engine proofs for C3 ran and passed. The api proof is the other Verifier's to confirm.
2. The committed `out/judging-sheet.csv` still has the old row order: rows 1 to 30 are exactly the 30 heuristic cards (positions 0 to 29, recomputed from the key) and the 100 verdicts were given in that order. `implementation-notes.md` records this as a limitation: the heuristic versus model comparison is confounded by position, the model versus model comparison and the `STOP: gemini-3.8-flash passed on 3 decks` line are not (the 70 model rows were shuffled together; gemini passes on its own counts of 5, 7 and 10). The owner's record was not modified (out/ is byte-identical to `4dc2a3f`). Any rebuild is blind by position (C34, shown below). Not a FAIL: it is a documented, correctly scoped limitation of a record that predates the C34 fix.
3. C13 would not catch a formula edit made inside the same commit that first writes a verdict (`run.test.ts:121` uses `<first>..HEAD`). Not the case here: `git log -- scripts/synergy-spike/candidates/heuristic.ts` shows one commit, `f24eb68`, which precedes the first verdict commit `4dc2a3f`.
4. C3 removes an always-present field and adds an unexpected one both caught (faults F3a, F3b); a removed optional field (for example `specializations`) is outside what C3 can see by design, since those keys are legitimately absent on many cards. Other engine tests carry those.

Earlier findings, now closed: C16 pool rules text (`llm.test.ts:134-141`), C34 canonical sort and candidate-swap (`sheet.test.ts:137-151`), stale comment in `lib/sheet.ts:80-83` (removed, `rg orderBySeededShuffle` finds only the two uses in `sheet.ts`; `judge-page.html` has no re-sort of rows), C3 one-directional (`catalog.spec.ts:253-254` now both ways), C31 missing the Opus id (`impact.test.ts:33` now holds it).

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `.design/card-alternatives.md` section "Synergy spike" (line 71 index, line 25 pass bar) | yes - read at HEAD | none: pass bar is 5 of top 10 on three decks (C25, C26), stop rule is one candidate on three decks or each tried once (C26, C27), owner judges the lists himself (C21, C24, C33), first step exposes rules text (C1, C2) | - |

## Checks

All proofs ran at HEAD `1f10d62`: one invocation of the spike suite (`pnpm exec tsx --test --test-reporter=spec scripts/synergy-spike/__tests__/*.test.ts`, 40 passed, 0 failed, every `C<n>:` test listed individually as passing) and one jest run for `C[123]:` (3 passed) plus the full engine suite (259 passed). Each name filter matched; every test exists in the tree (`^test\('C` and `it\('C` hits cited below). The tests in this table were all touched or already present in the feature range; none resolves to a pre-existing test.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `functionalText` equals the package string; 5,139 of 5,177 carry it | `jest -t "C1:"` ran, passed | `packages/engine/__tests__/catalog.spec.ts:221` `expect(catalog.getCard('dorinthea-ironsong').functionalText).toBe(raw.functionalText)`; `:225` `expect(withText).toHaveLength(5139)` | PASS |
| C2 | key absent, never empty string; 38 cards | `jest -t "C2:"` ran, passed | `catalog.spec.ts:236` `expect(without).toHaveLength(38)`; `:238` `hasOwnProperty.call(card,'functionalText')).toBe(false)`; `:240` no `''` | PASS |
| C3 | same field set plus optional `functionalText`; engine and api green | `jest -t "C3:"` passed; engine suite 259 passed; api suite not run (finding 1); faults F3a and F3b killed it | `catalog.spec.ts:253` `expect(keys.filter((k) => !allowed.has(k))).toEqual([])`; `:254` `expect(alwaysPresent.filter((k) => !keys.includes(k))).toEqual([])` | PASS (api proof not mine to confirm) |
| C4 | 3 files, upper-cased ULIDs, hero/format/mainboard, quantity above 0 | `^C4:` ran, passed | `scripts/synergy-spike/__tests__/decks.test.ts:37-41` listFiles deepEqual the 3 upper-case names; `:45-48` mainboard deepEqual with the quantity-0 card absent | PASS |
| C5 | 2 and 1 URLs: exit 1, `three are required`, 0 files | `^C5:` ran, passed | `decks.test.ts:59` `assert.equal(result.status, 1)`; `:60` `assert.match(result.stderr, /three are required/)`; `:61` `listFiles(out)` deepEqual `[]` | PASS |
| C6 | failed fetch and unknown identifier name the URL (and identifier), 0 files, exit 1 | `^C6:` ran 2 tests, passed | `decks.test.ts:77-78` errors include URL plus `404` and URL plus `not-a-real-card-xyz`; `:79` no files; CLI `:90-92` `status 1`, URL in stderr, no files | PASS |
| C7 | each step-5 per-card test and Silver Age whitelist; 1,017 passing cards | `^C7:` ran, passed | `scripts/synergy-spike/__tests__/pool.test.ts:52` `assert.equal(passing.length, 1017)`; `:33-34` banned, format; `:37-43` legalHeroes, override (right and wrong format), specializations; `:48-49` Common true, Majestic false | PASS |
| C8 | pool drops hero cards, tokens, deck cards; `size` equals count | `^C8:` ran, passed; fault F8 killed | `pool.test.ts:64-66` four excluded ids; `:67` `assert.equal(pool.size, pool.cards.length)` | PASS |
| C9 | 9-card pool exits 1 naming the deck; 10 does not | `^C9:` ran, passed | `pool.test.ts:85` `assert.equal(result.status, expectedStatus, ...)` over `[9,1]` and `[10,0]`; `:87` `/TESTDECK/`; `:91` `written.size, 10` | PASS |
| C10 | heuristic: ok, 10 distinct, in pool, not in deck, rank order | `^C10:` ran 2 tests, passed; fault F6 killed the order test only | `scripts/synergy-spike/__tests__/run.test.ts:44-48` length 10, distinct, in pool, not in deck; `:71` `assert.deepEqual(new Set(ranked.slice(0, 6)), strongIds)` | PASS |
| C11 | out-of-pool and in-deck dropped; 9 left is failed, no `top10`, exit 1; 10 left ok | `^C11:` ran 2 tests, passed | `run.test.ts:80` finalize returns `valid`; `:81` `null` with 9; `:87` `'top10' in failed` false; `:88` `exitCodeFor([ok, failed]) 1`; CLI `:141-150` | PASS |
| C12 | two heuristic runs byte-identical | `^C12:` ran, passed | `run.test.ts:101` `assert.ok(first.equals(second))` | PASS |
| C13 | formula has no commit after the first verdict commit (from `git log`), no uncommitted change, owner rule in header | `^C13:` ran, passed; faults F5a and F5b killed | `run.test.ts:121-122` `git log <firstVerdictCommit>..HEAD -- FORMULA` equals `''`; `:126` `/must not change afterwards/`; `:127` porcelain `''`. At HEAD the first verdict commit is `4dc2a3f`, formula last touched `f24eb68` (finding 3) | PASS |
| C14 | cooccurrence with 0 decklists: `untestable`, `found` 0, exit 0 | `^C14:` ran, passed | `run.test.ts:134` `status 0`; `:136-138` `untestable`, `found 0`, `minimum 20` | PASS |
| C15 | key unset exits 1 for 5 names with 0 requests; no key value in any file | `^C15:` ran 2 tests, passed | `llm.test.ts:84` `status 1` per candidate and `llm-all`; `:217` `assert.equal(missing.calls.length, 0)`; `:223` `present.calls.length, 1`; `:98` no key shape outside comments; my own scan of `git log -p` found no secret | PASS |
| C16 | 1 POST per candidate: URL, bearer, pinned model, hero, deck rules text, every pool card with its rules text on its own line, 25 asked, strict json_schema, require_parameters, reasoning high for 2 only, first 10 kept | `^C16:` ran, passed; faults F1 killed | `llm.test.ts:119` `calls.length, 1`; `:121-127` url, bearer, model, `strict, true`, `require_parameters, true`, reasoning deepEqual; `:132` deck rules text; `:136-140` each pool id at the start of a line and its `functionalText` within `id.length + name.length + 250` chars after; `:142-143` `Rank the 25 cards`, `one sentence of reason`; `:148` `run.top10` deepEqual `POOL.cards.slice(0, 10)`; `:107` the four model ids | PASS |
| C17 | dry run: local estimate and ceiling per candidate and deck (4), 0 calls, no key, exit 0 | `^C17:` ran, passed | `llm.test.ts:158` `/estimated locally/`; `:160` `lines.length, 1 + 4`; `:162` per-candidate `about \d+ input tokens, at most \d+\.\d\d USD`; `:167` `status 0` with key unset; `:169` no run files | PASS |
| C18 | `usage` stored as `inputTokens`, `outputTokens`, `reasoningTokens`, `costUsd` | `^C18:` ran, passed | `llm.test.ts:178` `assert.deepEqual(run.usage, { inputTokens: 40100, outputTokens: 6900, reasoningTokens: 4000, costUsd: 0.0123 })` | PASS |
| C19 | 6 triggers: failed, 1 request, no retry, exit 1 | `^C19:` ran, passed; fault F9 killed | `llm.test.ts:190` `triggers.length, 6`; `:200` `calls.length, 1`; `:201` `exitCode, 1`; `:203` `status 'failed'`; `:204` no `top10`; `:183-188` stop reason per trigger | PASS |
| C20 | owner: live run accepted, nonzero tokens, 10-card `top10` | no network call; read the 12 committed run files | all 12 `out/runs/{gpt-6.1-sol,gemini-3.8-flash,mimo-v2.6-pro,opus-5.5}/<ULID>.json` read: `status ok`, `top10` of 10, `inputTokens` 27,479 to 77,855 and `outputTokens` 2,235 to 5,728, all above 0; e.g. `gemini-3.8-flash` on `01M2EA2J62QDE6ZZYP0YPXEBG4`: 29,372 in, 4,826 out | PASS (judged from the committed files) |
| C21 | header `deck,hero,card,pitch,rules,verdict`; one row per distinct pair; verdict empty; no candidate or rank cell | `^C21:` ran, passed | `scripts/synergy-spike/__tests__/sheet.test.ts:50` header equals the string; `:53` 15 rows; `:54` 15 distinct pairs; `:56` verdict `''`; `:60` no cell matches a candidate name or `rank` | PASS |
| C22 | seeded shuffle, reproducible; key maps pair to `{candidate, rank}` including a shared card | `^C22:` ran, passed | `sheet.test.ts:74` two builds same order; `:75` order is not the sorted order; `:81-84` shared card deepEqual `[{gpt-6.1-sol, 8}, {heuristic, 3}]` | PASS |
| C23 | rebuild keeps verdicts, adds only new pairs, no repeats | `^C23:` ran, passed | `sheet.test.ts:107-108` `yes` and `no` stay on their cards; `:109` exactly 2 non-empty verdicts; `:105` 15 rows; `:114` 15 distinct cards. The by-pair re-expression is sound: a full-set shuffle legitimately moves rows | PASS |
| C24 | blank, `maybe`, missing row: exit 1, count printed, no `result.md`; `YES`, `No` accepted | `^C24:` ran, passed | `scripts/synergy-spike/__tests__/score.test.ts:64-66` `status 1`, `/1 top-10 card/`, result null; `:70` `/2 top-10 card/`; `:77` `/30 top-10 card/`; `:80` case variants `status 0` | PASS |
| C25 | counts `yes` per candidate and deck; 5 PASS, 4 FAIL | `^C25:` ran, passed; fault F7 killed | `score.test.ts:91` the table row cell pair `5` then `PASS`; `:92` the table row cell pair `4` then `FAIL` | PASS |
| C26 | PASS on 3 decks gives the STOP line; on 2 does not | `^C26:` ran, passed; F7 killed | `score.test.ts:98` `/^STOP: gpt-6.1-sol passed on 3 decks$/m`; `:105` `doesNotMatch(..., /passed on 3 decks/)` | PASS |
| C27 | all six run, none passing: `STOP: all candidates tried once, none passed` | `^C27:` ran, passed; F7 killed | `score.test.ts:118` the exact line; `:119` no `CONTINUE` | PASS |
| C28 | CONTINUE names gemini after 1, opus-5.5 after 3, heuristic after 4 | `^C28:` ran, passed | `score.test.ts:124`, `:131`, `:139` the three exact lines | PASS |
| C29 | `untestable` or `failed` prints its status, candidate counts as tried | `^C29:` ran, passed | `score.test.ts:150-152` `failed \(refusal\)`, `failed \(max_tokens\)`, `untestable \(found 0 of 20 decklists needed\)`; `:153` CONTINUE moves to gemini | PASS |
| C30 | per LLM candidate sums of input, output, cost | `^C30:` ran, passed | `score.test.ts:165` `gpt-6.1-sol tokens used: 120003 input, 9003 output, cost 0.3000 USD`; `:167` no line for a candidate that did not run. Real figures recomputed below | PASS |
| C31 | exactly 6 `synergy:*` scripts; no Anthropic SDK; four model ids only in `models.config.ts`; one commented key line; no `ANTHROPIC_API_KEY` | `^C31:` ran, passed; fault F4a killed | `scripts/synergy-spike/__tests__/impact.test.ts:20-23` the six names deepEqual; `:24-25` SDK undefined; `:33` pattern holds all four ids including `anthropic/claude-opus-5\.5`; `:35` file list deepEqual `['scripts/synergy-spike/lib/models.config.ts']`; `:38-40` env lines. `package.json` diff adds exactly six `synergy:*` lines; `.env.example:62` is `# OPENROUTER_API_KEY=` | PASS |
| C32 | spike typecheck, repo typecheck, lint, engine suite | all four ran at HEAD | `tsc --noEmit -p scripts/synergy-spike/tsconfig.json` exit 0; `pnpm typecheck` exit 0; `pnpm lint` exit 0; engine 259 passed, 13 suites | PASS |
| C33 | local page on 127.0.0.1 with art, rules, deck list; vote changes only its row; `maybe`, unknown card, missing verdict, non-JSON give 400 and leave the file byte-identical; payload has no candidate, rank, runs | `^C33:` ran 6 tests, passed | `scripts/synergy-spike/__tests__/judge.test.ts:54` deepEqual only row 0 changed; `:43` `listen(0, '127.0.0.1')`; `:106` `assert.equal(response.status, 400, body)` over the four bodies; `:109` file equals `before`; `:70-71` no candidate name, no `"rank"`, `"runs"`, `"candidate"` in the serialized payload; `:76-77` hero and deck list; `lib/judge.ts:36-37` payload built from sheet, decks and catalog only | PASS |
| C34 | row order depends only on the pair set; two-step build equals one step; A's cards are neither first 10 nor last 10; same pairs with the candidates swapped and runs written in the other order give the identical order | `^C34:` ran 2 tests, passed; fault F2 killed (the swap test only) | `sheet.test.ts:131` `assert.deepEqual(order, readRows(oneGo)...)`; `:132-133` not a prefix, not a suffix; `:134` second batch appears among the first ten; `:150` `assert.deepEqual(readRows(swapped).map((r) => r['card']), order)` after `writeRun(swapped, 'heuristic', 0)` then `writeRun(swapped, 'gpt-6.1-sol', 10)` | PASS |

## Blindness

- Sheet: columns are `deck,hero,card,pitch,rules,verdict`; no candidate or rank (C21, `sheet.test.ts:60`). The key lives in `out/judging-key.json`.
- `pnpm synergy:judge` payload: built from sheet, decks and catalog only (`lib/judge.ts:36-37`); the server routes are the page, the sheet payload and the verdict post; `judge.test.ts:70-71` asserts no candidate name, `"rank"`, `"runs"` or `"candidate"` in the serialized payload. `rg -i "candidate|rank|heuristic" lib/judge-page.html` hits only the page's own navigation variable `candidates` for pending rows (lines 262-264), not run data.
- Position after a rebuild: `buildSheet` orders every row by one seeded shuffle over a canonically sorted pair set (`lib/sheet.ts:85-93`, used at `:108`), keeping verdicts per pair, and the judge page keeps sheet order (no sort of rows in `judge-page.html`; the one `.sort` at `:193` orders the deck list by card name). C34 proves history independence in both directions (two-step versus one-step, and candidates swapped), and fault F2 shows that removing the canonical sort fails it.
- The committed sheet predates this fix: finding 2.

## Recomputed result

From `out/judging-sheet.csv`, `out/judging-key.json` and the 18 run files, with an independent script: 100 sheet rows, 100 distinct pairs, every verdict `yes` or `no`; the sheet's pair set equals the union of the ok runs' top 10; every `(candidate, rank)` in the key matches the run files (0 mismatches); the key's order equals the sheet's order.

Compared with `out/result.md` row by row (15 count rows, 3 untestable rows, 4 token lines, the STOP line): all match.

| candidate | Kayo `...TESWYP` | Azalea `...PXEBG4` | Levia `...NXAETH` |
| --- | --- | --- | --- |
| gpt-6.1-sol | 3 FAIL | 8 PASS | 8 PASS |
| gemini-3.8-flash | 5 PASS | 7 PASS | 10 PASS |
| mimo-v2.6-pro | 0 FAIL | 6 PASS | 8 PASS |
| opus-5.5 | 5 PASS | 7 PASS | 9 PASS |
| heuristic | 3 FAIL | 4 FAIL | 4 FAIL |
| cooccurrence | untestable | untestable | untestable |

Token and cost lines recomputed: gpt-6.1-sol 106,345 in, 14,515 out, 0.4110 USD; gemini-3.8-flash 113,171 and 13,922, 0.1371; mimo-v2.6-pro 106,103 and 13,682, 0.0581; opus-5.5 168,653 and 7,252, 0.8197. The result's final line is `STOP: gemini-3.8-flash passed on 3 decks`, and gemini has 5, 7, 10, so the line is right; opus-5.5 also passes on all three (5, 7, 9) and the first candidate in order to do so is named, per the rule.

`scripts/synergy-spike/out/` is byte-identical to commit `4dc2a3f`: `git diff --quiet 4dc2a3f HEAD -- scripts/synergy-spike/out` exits 0 and `git diff --quiet 4dc2a3f -- scripts/synergy-spike/out` (working tree) exits 0; `git status --short scripts/synergy-spike/out` is empty.

## Secrets

None found in `git log -p origin/main..HEAD` (patterns for `sk-or-`, `sk-ant-`, `sk-` followed by 20 or more characters, AWS key ids, private key headers, GitHub and Slack tokens, quoted key/secret/token/password assignments). The only match was a regular expression in a test, not a value. `.env.example` holds only the commented `# OPENROUTER_API_KEY=` line.

## Deviations judged

- C13 re-expressed over git history: sound; it protects the stated property and is stricter than the old one (fails on a later commit and on an uncommitted edit). One loophole, finding 3, not present in this history.
- C23 by pair, not position: sound, forced by the full-set shuffle; verdicts staying on their cards, no repeats and only new pairs are asserted.
- C10 order asserted at coarse level (six strong cards fill ranks 1 to 6): acceptable; reversing the comparator fails it and not C11 or C12 (F6).
- Row-order blindness (C34) and its limitation on the committed record: accurate and correctly scoped; confirmed from the key (finding 2). It does not touch the STOP result.
- C6, C11, C15 precision additions: present at `decks.test.ts:82-93`, `run.test.ts:141-150`, `llm.test.ts:209-223`.
- Renegotiations for 5.3.0 literals, the OpenRouter move, the Opus fourth candidate and the sixth script: only literals and members changed; proof strength kept (C1, C2, C7, C15 to C19, C27, C28, C31 read at HEAD above).
- Judging page added at the owner's request, `max_tokens` 32,000, `--deck` flag, skip of an already-ok deck without `--force`: noted, none contradicts a check.

## Coverage

Light profile: not required. Spot recompute from the code: candidates (6) are `CANDIDATE_ORDER` and are each run in `llm.test.ts:111-152` (four models, one request each), `run.test.ts:37` and `:132`; run statuses (3) asserted at `run.test.ts:43,86,136`; failure triggers (6) at `llm.test.ts:182-189`; verdict values (5) at `score.test.ts:62-81`; pool removals (3) at `pool.test.ts:64-66`; sheet columns (6) at `sheet.test.ts:50`; `synergy:*` scripts (6) at `impact.test.ts:20-23`. The `Coverage` row text in `checks.md` says six scripts and four models, matching the code. No member without a proof found.

Swept rows resolving to existing constraints were re-read: C15 key check (`lib/llm.ts` reads `OPENROUTER_API_KEY`, `llm.test.ts:77-79`), C23 data lifecycle, C29 state transitions: present.

## Faults injected

Light profile: optional; run where a claim looked wider than its test and for the five faults named by the previous round. Each fault was applied to one file and restored with `git checkout -- <file>` right after its run (F5b used a temporary commit, removed with `git reset --hard HEAD~1` after confirming HEAD was `06cf2de`, my commit; HEAD returned to `1f10d62`). The tree at the end shows only the untracked report.

| Id | Mutation | Location | Killed |
| --- | --- | --- | --- |
| F1 | pool lines built from id and name only, without rules text | `scripts/synergy-spike/lib/llm.ts:57` | yes (C16) |
| F2 | canonical sort removed before the shuffle (`const canonical = [...items]`) | `scripts/synergy-spike/lib/sheet.ts:86-91` | yes (C34 swap test; C21, C22, C23 and the first C34 stay green, as expected) |
| F3a | `young` removed from `normalizeCard` | `packages/engine/src/catalog/catalog.ts:162` | yes (C3) |
| F3b | an extra field `extra: 1` added to `normalizeCard` | `packages/engine/src/catalog/catalog.ts:162` | yes (C3) |
| F4a | the Opus id written in a second file | `scripts/synergy-spike/lib/llm.ts` (appended comment) | yes (C31) |
| F4b | the Opus id in `models.config.ts` changed to `anthropic/x` | `scripts/synergy-spike/lib/models.config.ts:19` | yes (C16; C31 stays green since the other three ids keep the file in its list) |
| F5a | a line appended to the formula, uncommitted | `scripts/synergy-spike/candidates/heuristic.ts` | yes (C13) |
| F5b | the same line committed after the verdict commit | `scripts/synergy-spike/candidates/heuristic.ts` | yes (C13) |
| F6 | sort comparator reversed (`a.score - b.score`) | `scripts/synergy-spike/candidates/heuristic.ts:124` | yes (C10 order test only; C11, C12 green) |
| F7 | `PASS_THRESHOLD` 5 to 4 | `scripts/synergy-spike/lib/score.ts:13` | yes (C25, C26, C27) |
| F8 | covered by the previous round (token filter) and not repeated | `scripts/synergy-spike/lib/pool-filter.ts` | carried from `a0df288`, killed |
| F9 | covered by the previous round (`error` finish reason) and not repeated | `scripts/synergy-spike/lib/llm.ts` | carried from `a0df288`, killed |

## Gate

- `pnpm exec tsx --test scripts/synergy-spike/__tests__/*.test.ts` - 40 passed, 0 failed
- `pnpm exec tsc --noEmit -p scripts/synergy-spike/tsconfig.json` - exit 0
- `pnpm --filter @rathe-arsenal/engine test` - 259 passed, 0 failed (13 suites)
- `pnpm typecheck` - exit 0
- `pnpm lint` - exit 0
- Not run, by instruction: the api suite, web suite, any e2e suite, any dev server; no network call to OpenRouter or any paid API.
