# Synergy spike checks

Profile: light
Plan: `.specs/features/synergy-spike/plan.md`

32 checks in 7 slices · 2 one-way doors · 2 open, of which 0 block

Every proof below is a named test. Proofs that need the owner's `OPENROUTER_API_KEY` or the owner's verdicts are marked **owner** and are left open by the builder; all other proofs run without network and without spend (language-model calls are faked in tests).

## Checks


### S1 - rules text on the catalog card · 2 files · 8 KB · ~6k

**C1** - `catalog.getCard('dorinthea-ironsong').functionalText` equals the string the package holds for that card, and exactly 5,139 of the 5,177 catalog cards carry the field (plan AC 1) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest -t "C1:"`

**C2** - A card the package holds no `functionalText` for has no `functionalText` key at all, never an empty string; 38 cards (5,177 minus 5,139) are in that state (plan AC 2) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest -t "C2:"`

**C3** - Every catalog card keeps exactly the pre-change field set plus the optional `functionalText`, and the engine and API suites stay green (plan AC 3) · done
Proof: `pnpm --filter @rathe-arsenal/engine exec jest -t "C3:"`
Proof: `pnpm --filter @rathe-arsenal/engine test`
Proof: `pnpm --filter @rathe-arsenal/api test`


### S2 - the owner's three decks · 3 files · 12 KB · ~12k

**C4** - `loadDecks` over 3 URLs writes 3 files `out/decks/<ULID>.json`, each holding `hero`, `format` and `mainboard` as `{card, quantity}` entries with quantity above 0, and ULIDs are upper-cased from the URL (plan AC 4) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C4:" scripts/synergy-spike/__tests__/decks.test.ts`

**C5** - `pnpm synergy:decks` with 2 URLs exits 1 with a message containing `three are required` and writes 0 files; with 1 URL the same (plan AC 5) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C5:" scripts/synergy-spike/__tests__/decks.test.ts`

**C6** - A deck whose fetch rejects, and a deck holding the identifier `not-a-real-card-xyz`, each print the deck URL and (for the second) the identifier, write 0 files for that deck and make the exit code 1 (plan AC 6) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C6:" scripts/synergy-spike/__tests__/decks.test.ts`


### S3 - the candidate pool · 2 files · 10 KB · ~12k

**C7** - `isCardInPool` applies each per-card test of step 5 of `computeDeckLegality`: banned format excluded, card not legal in the format excluded, hero scope (legalHeroes, legalOverrides for the format, specializations) honoured, Silver Age rarity whitelist enforced; and for Dorinthea Ironsong in Classic Constructed exactly 1,017 non-hero cards pass those tests (plan AC 7) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C7:" scripts/synergy-spike/__tests__/pool.test.ts`

**C8** - `buildPool` removes hero cards, tokens and every card already in the deck, and the pool file holds `size` equal to its number of cards (plan AC 8) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C8:" scripts/synergy-spike/__tests__/pool.test.ts`

**C9** - A pool of 9 cards makes `pnpm synergy:pool` exit 1 naming the deck; a pool of exactly 10 does not (plan AC 9) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C9:" scripts/synergy-spike/__tests__/pool.test.ts`


### S4 - candidates and the top 10 · 5 files · 25 KB · ~20k

**C10** - `pnpm synergy:run heuristic` writes `out/runs/heuristic/<ULID>.json` per deck with `status` `ok` and a `top10` of exactly 10 distinct identifiers, each in that deck's pool and absent from the deck, in rank order (plan AC 10) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C10:" scripts/synergy-spike/__tests__/run.test.ts`

**C11** - `finalizeTop10` drops an identifier outside the pool and one in the deck; with 9 valid remaining the run is `failed`, no `top10` is written and the exit code is 1; with 10 valid remaining it is `ok` (plan AC 11) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C11:" scripts/synergy-spike/__tests__/run.test.ts`

**C12** - Running `heuristic` twice over the same decks produces byte-identical run files (plan AC 12) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C12:" scripts/synergy-spike/__tests__/run.test.ts`

**C13** - At HEAD no verdict exists in any committed `out/judging-sheet.csv` (the verdict column is empty on every row), so the heuristic formula was fixed before verdicts; the owner rule that it never changes after verdicts is recorded in the file header of `candidates/heuristic.ts` (plan AC 13) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C13:" scripts/synergy-spike/__tests__/run.test.ts`

**C14** - `cooccurrence` with 0 public decklists found (minimum 20) writes `out/runs/cooccurrence/<ULID>.json` with `status` `untestable` and `found` 0 and exits 0 (plan AC 14) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C14:" scripts/synergy-spike/__tests__/run.test.ts`


### S5 - the three language-model candidates · 3 files · 24 KB · ~22k

**C15** - `pnpm synergy:run <gpt-6.1-sol|gemini-3.8-flash|mimo-v2.6-pro|opus-5.5|llm-all>` with `OPENROUTER_API_KEY` unset exits 1 before any request is made (the injected fetch is called 0 times), and no file under `scripts/synergy-spike/` or `.env.example` holds a key value (plan AC 15) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C15:" scripts/synergy-spike/__tests__/llm.test.ts`

**C16** - For each of the 4 candidates one deck sends exactly 1 POST to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <key>`, the pinned model id (`openai/gpt-6.1-sol`, `google/gemini-3.8-flash`, `xiaomi/mimo-v2.6-pro`, `anthropic/claude-opus-5.5`), the hero name, the rules text of every mainboard card, every card of the pool with its rules text, a request for 25 ranked identifiers with one reason each, `response_format` `json_schema` with `strict` true, `provider.require_parameters` true, `reasoning.effort` `high` for `gpt-6.1-sol` and `opus-5.5` only, and the first 10 valid identifiers are kept (plan AC 16) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C16:" scripts/synergy-spike/__tests__/llm.test.ts`

**C17** - `--dry-run` prints one estimated input token count and one cost ceiling per candidate (4) and deck, says the estimate is local, makes 0 HTTP calls and needs no key, and exits 0 (plan AC 17) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C17:" scripts/synergy-spike/__tests__/llm.test.ts`

**C18** - A response's `usage.prompt_tokens`, `usage.completion_tokens`, `usage.completion_tokens_details.reasoning_tokens` and `usage.cost` are stored in that deck's run file as `inputTokens`, `outputTokens`, `reasoningTokens` and `costUsd` (plan AC 18) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C18:" scripts/synergy-spike/__tests__/llm.test.ts`

**C19** - Each of 6 failure triggers records the deck as `failed`, makes exactly 1 request (no retry) and exits 1: `finish_reason` `length`, `finish_reason` `content_filter`, `finish_reason` `error`, a non-empty `message.refusal`, an HTTP 429 answer, and `message.content` that is not the JSON ranking (plan AC 19) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C19:" scripts/synergy-spike/__tests__/llm.test.ts`

**C20** - **owner** - with the real key, one deck's run file for one candidate holds nonzero `inputTokens` and `outputTokens` and a 10-card `top10` taken from a real response, and the request is accepted with `response_format` and `provider.require_parameters` set · done (owner's live pass 2026-10-04: all 12 runs `ok`; e.g. `gemini-3.8-flash` on `01M2EA2J62QDE6ZZYP0YPXEBG4`)
Proof: `OPENROUTER_API_KEY=<key> pnpm synergy:run gemini-3.8-flash --deck <ULID>` then reading `scripts/synergy-spike/out/runs/gemini-3.8-flash/<ULID>.json`

### S6 - the blind judging sheet · 2 files · 10 KB · ~12k

**C21** - `pnpm synergy:sheet` writes `out/judging-sheet.csv` with header exactly `deck,hero,card,pitch,rules,verdict`, one row per distinct (deck, card) across all candidates' top 10, verdict empty, and no cell naming a candidate or a rank (plan AC 20) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C21:" scripts/synergy-spike/__tests__/sheet.test.ts`

**C22** - Row order follows a seeded shuffle (two builds from the same runs give the same order), and `out/judging-key.json` maps each (deck, card) to its `{candidate, rank}` list, including a card produced by two candidates (plan AC 21) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C22:" scripts/synergy-spike/__tests__/sheet.test.ts`

**C23** - Rebuilding after 2 verdicts were filled and a second candidate was added keeps both verdicts, adds only the new (deck, card) pairs and repeats no row (plan AC 22) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C23:" scripts/synergy-spike/__tests__/sheet.test.ts`


### S7 - score and stop rule · 2 files · 12 KB · ~15k

**C24** - A top-10 card with verdict blank, `maybe`, or missing row makes `pnpm synergy:score` exit 1, print the count of unjudged or invalid cards, and write no `result.md`; `YES` and `no` in any case are accepted (plan AC 23) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C24:" scripts/synergy-spike/__tests__/score.test.ts`

**C25** - `result.md` lists per candidate and per deck the count of `yes`, with 5 yes giving PASS and 4 yes giving FAIL (plan AC 24) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C25:" scripts/synergy-spike/__tests__/score.test.ts`

**C26** - A candidate with PASS on 3 decks makes `result.md` hold the line `STOP: <candidate> passed on 3 decks`; PASS on 2 decks does not (plan AC 25) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C26:" scripts/synergy-spike/__tests__/score.test.ts`

**C27** - With `gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro`, `opus-5.5`, `heuristic` and `cooccurrence` all run on the same 3 decks and none passing on 3, `result.md` holds `STOP: all candidates tried once, none passed` (plan AC 26) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C27:" scripts/synergy-spike/__tests__/score.test.ts`

**C28** - With `gpt-6.1-sol` run and none passing, `result.md` holds `CONTINUE: next candidate is gemini-3.8-flash`; with the first three run it holds `CONTINUE: next candidate is opus-5.5`, and with all four language-model candidates run it holds `CONTINUE: next candidate is heuristic` (plan AC 27) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C28:" scripts/synergy-spike/__tests__/score.test.ts`

**C29** - A deck whose run is `untestable` or `failed` prints that status in place of a count, and the candidate counts as tried (plan AC 28) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C29:" scripts/synergy-spike/__tests__/score.test.ts`

**C30** - For each language-model candidate that ran, `result.md` prints the sum of its input tokens, output tokens and cost in USD over the decks (plan AC 29) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C30:" scripts/synergy-spike/__tests__/score.test.ts`


### Cross-cutting · 5 files · 8 KB · ~6k

**C31** - Root `package.json` holds exactly 6 `synergy:*` scripts (decks, pool, run, sheet, score, judge) and no `@anthropic-ai/sdk` anywhere in `package.json`; `.env.example` has one commented `OPENROUTER_API_KEY=` line with no value and no `ANTHROPIC_API_KEY` line; the three model ids live only in `scripts/synergy-spike/lib/models.config.ts` (plan Impact, Landing door 3) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C31:" scripts/synergy-spike/__tests__/impact.test.ts`

**C33** - `pnpm synergy:judge` serves a local page on `127.0.0.1` that shows each sheet row with its card art, rules text and the deck list, and writes each vote straight to `judging-sheet.csv`: a posted `yes` changes only that row's `verdict`; `maybe`, an unknown card, a missing `verdict` and a non-JSON body each answer `400` and leave the file byte-identical; the page payload carries no candidate name, `rank`, `runs` or `candidate` field (owner request 2026-10-04, keeps AC on the blind sheet) · done
Proof: `pnpm exec tsx --test --test-name-pattern "^C33:" scripts/synergy-spike/__tests__/judge.test.ts`

**C32** - The spike scripts typecheck, the whole repo typechecks and lints, and the engine suite is green · done
Proof: `pnpm exec tsc --noEmit -p scripts/synergy-spike/tsconfig.json`
Proof: `pnpm typecheck`
Proof: `pnpm lint`
Proof: `pnpm --filter @rathe-arsenal/engine test`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| step-5 per-card tests in the pool filter (5) | banned format C7 · format-legal C7 · hero scope via legalHeroes C7 · hero scope via legalOverrides C7 · hero scope via specializations C7 · Silver Age rarity C7 | - |
| pool removals (3) | hero cards C8 · tokens C8 · cards already in the deck C8 | - |
| candidates (6) | `gpt-6.1-sol` C16 · `gemini-3.8-flash` C16 · `mimo-v2.6-pro` C16 · `opus-5.5` C16 · `heuristic` C10 · `cooccurrence` C14 | - |
| run statuses (3) | ok C10 · failed C11 · untestable C14 | - |
| candidate output filters in `finalizeTop10` (2) | outside the pool C11 · in the deck C11 | - |
| failed-run triggers of a language-model deck (6) | finish_reason length C19 · finish_reason content_filter C19 · finish_reason error C19 · message.refusal C19 · HTTP 429 C19 · non-JSON content C19 | - |
| language-model candidates and their pinned models (4) | `openai/gpt-6.1-sol` with reasoning high C16 · `google/gemini-3.8-flash` C16 · `xiaomi/mimo-v2.6-pro` C16 · `anthropic/claude-opus-5.5` with reasoning high C16 | - |
| verdict values (5) | `yes` C24 · `no` C24 · blank C24 · `maybe` C24 · missing row C24 | - |
| decks-list size (3) | 3 URLs C4 · 2 URLs C5 · 1 URL C5 | - |
| deck load failures (2) | fetch fails C6 · identifier absent from the catalog C6 | - |
| count at the PASS boundary (2 edges) | 5 yes C25 · 4 yes C25 | - |
| result lines (3) | STOP passed C26 · STOP all tried C27 · CONTINUE C28 | - |
| `synergy:*` scripts (5) | decks C31 · pool C31 · run C31 · sheet C31 · score C31 | - |
| sheet columns (6) | deck C21 · hero C21 · card C21 · pitch C21 · rules C21 · verdict C21 | - |
| one-way doors in plan `Landing` (3) | door 1 `functionalText` C1, C2, C3 · door 2 Anthropic SDK (superseded) C31 · door 3 OpenRouter over `fetch` C15, C16, C31 | - |
| spike commands exit codes (3 non-zero paths) | decks C5 · pool C9 · run C15 | - |
| plan `Surface` routes (0) | none - the plan's Surface is `None - nothing consumed outside` | - |
| startup configuration (0) | none - scripts, no assembled application | - |

- Claims naming a literal value (1,017, 5,139, 10, 25, 5, the four model ids): C1, C7, C10, C16, C25 - each proof asserts that value.
- Live behaviour that cannot run without the owner's key: C20 only; every other language-model claim is proven against an injected fetch.
- No other check claims more than the single case its proof exercises.

## Swept

- validation: C5, C6, C9, C11, C24
- failure modes: C6, C11, C19, C29
- idempotency: C12, C23
- authorization: n/a - no user, no endpoint; the only credential is the owner's environment variable, checked by C15
- concurrency: n/a - single-user scripts run one at a time, one request per deck in sequence
- data lifecycle: C23
- dependency failure: C6, C19
- state transitions: C29, C28
- observability: C17, C18, C30

## Out of scope

- see the plan's `Out of scope` table - this file adds nothing to it.

## Handoff

- S1 = 6k (catalog + its spec); S2 = 12k; S3 = 12k; S4 = 20k; S5 = 20k; S6 = 12k; S7 = 15k; cross-cutting = 6k; total 103k, all in `scripts/synergy-spike/` plus one catalog field, under the 150k budget - one builder

- **Boundary:** C1-C19 and C21-C32 closed at `1ecf093`; C20 stays open for the owner's `ANTHROPIC_API_KEY`
- **Settled mid-build:** the owner moved the catalog to 5.3.0 (#127), which closed the decks 2 and 3 gap; C1, C2, C7 literals renegotiated, see implementation-notes.md
- **Abandoned:** a skip of the Fabrary 403 by credentials (none needed, a browser User-Agent was enough)
- **Boundary (OpenRouter change):** C15-C19, C27, C28, C30, C31 re-closed at `373f57e`; C20 now needs `OPENROUTER_API_KEY`
- **Boundary (Opus 5.5 added):** C15-C19, C27, C28 extended to the fourth candidate; C20 still needs `OPENROUTER_API_KEY`
