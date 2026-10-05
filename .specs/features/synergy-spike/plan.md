# Synergy spike

A throwaway script, outside the product, that answers one question: does any way of judging synergy produce suggestions the owner agrees with?
The design it serves is `.design/card-alternatives.md` (sections Problem, Success, Synergy spike, Recommendations).

## Problem

When a deck is missing a card, the site proposes one stand-in picked by rule-based similarity (same class, same pitch, a shared type and talent).
The owner does not want the closest stand-in, he wants the card that makes the deck's other cards work better and serves its strategy, and today he finds it by reading card text in the library or on Fabrary and judging in his head.
The site cannot say "this card has synergy with this deck" in any form, so it cannot order alternatives by synergy and cannot recommend a card when nothing is missing.
Whether any automated judgment of synergy agrees with the owner is unknown, and building Recommendations (and replacing the similarity order inside Alternatives) before knowing it would put a feature on a judgment nobody has tested.
The design gives no figures on this beyond the pass bar: at least 5 of the top 10 suggestions per deck are cards the owner would consider putting in that deck, on three of his decks.

When this finishes, the owner has a pass or fail per candidate per deck, in a file, and Recommendations has a confirmed basis or a confirmed fallback.

## Flow

Reuses the engine catalog and legality rules for the candidate pool, and `scripts/gold-set/fetch-deck.ts` for loading decks from Fabrary; nothing is added to the product beyond the rules text on the catalog card.

1. `scripts/synergy-spike/fixtures/decks.yaml` (new, no door - placement per conventions) lists the Fabrary URLs -> `fetchDeck` in `scripts/gold-set/fetch-deck.ts` (exists) - loads each deck by Fabrary ULID, `synergy:decks` writes one deck JSON per deck
2. deck JSON -> `catalog` in `packages/engine/src/catalog/catalog.ts` (exists, gains `functionalText`, door 1) - resolves every card, hero and format
3. `synergy:pool` (new, no door - placement per conventions) - keeps the cards legal for the deck's hero in the deck's format, using the same per-card tests as step 5 of `computeDeckLegality` in `packages/engine/src/legality/compute.ts` (exists, not callable per card, see Assumptions), minus hero cards, tokens and cards already in the deck
4. `synergy:run <candidate>` (new, no door - placement per conventions) - for each deck, the chosen candidate returns a ranked top 10 from the pool; the three language-model candidates (`gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro`) call OpenRouter chat completions over `fetch` (door 3)
5. `synergy:sheet` (new, no door - placement per conventions) - merges every candidate's top 10 per deck into one unlabeled judging sheet (CSV, `csv-stringify` exists in the root devDependencies) and a hidden key file mapping rows to candidates, the same blind/key split as `scripts/gold-set/export-csv.ts` (exists)
6. the owner fills the `verdict` column with `yes` or `no` - no tool involved
7. `synergy:score` (new, no door - placement per conventions) - reads the verdicts with `csv-parse` (exists), joins them to the key, writes `result.md` with pass or fail per candidate per deck and the stop-rule line, as `scripts/gold-set/score.ts` (exists) does for the gold set

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `functionalText` on `ICatalogCard` - the card's rules text, copied unchanged from `@flesh-and-blood/cards`, where the field has that name; today `normalizeCard` drops it and the raw card is reachable only through `getRawCard`, typed `unknown` |
| domain | existing term: `ICatalogCard` gains one optional field - the substitution engine, readiness, legality and the API read cards by named field, and none reads the whole object, so no caller changes (verified by the existing engine and API test suites, which must stay green) |
| stored data | nothing to migrate - no table, no column, no deck row is read or written; the owner's decks come from Fabrary, not from the database |
| dependencies | root `package.json` gains five `synergy:*` scripts and no dependency (the Anthropic SDK added first was removed when the owner changed candidates); `.env.example` gains one commented line naming `OPENROUTER_API_KEY` with no value |
| repository | spike outputs are committed under `scripts/synergy-spike/out/`, as `scripts/gold-set/out/` is today, so the verdicts and the result survive the branch |

## Relations

`None - no stored-data shape change`

## Surface

`None - nothing consumed outside`

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. rules text on the catalog card | `readonly functionalText?: string` on `ICatalogCard`, assigned in `normalizeCard` only when the raw card has it, the same way `hero` and `bannedFormats` are assigned today | read it through `getRawCard(id)` cast from `unknown`: untyped, so a renamed field in the package fails at runtime instead of at compile time. Rename to `rulesText`: a second name for a field the package already names, so every reader has to know both |
| 2. Anthropic SDK dependency (superseded by door 3, 2026-10-04) | `"@anthropic-ai/sdk"` in the root `package.json` `devDependencies`, imported only by `scripts/synergy-spike/` | raw `fetch` to the Messages endpoint: loses the SDK's typed errors and automatic retries, which the script would have to rewrite |
| 3. OpenRouter chat completions (added 2026-10-04, replaces door 2) | `POST https://openrouter.ai/api/v1/chat/completions` over Node's global `fetch`, key read only from `OPENROUTER_API_KEY` and sent as `Authorization: Bearer`, body with `response_format` `json_schema` (`strict` true), `provider.require_parameters` true and, for GPT-6.1 Sol only, `reasoning.effort` `high`; the three model ids (`openai/gpt-6.1-sol`, `google/gemini-3.8-flash`, `xiaomi/mimo-v2.6-pro`) pinned in one file, `scripts/synergy-spike/lib/models.config.ts` | one SDK per provider: three dependencies and three request shapes for a throwaway script; keeping `@anthropic-ai/sdk`: the owner dropped the Anthropic candidate |

- Nothing else in this change is hard to reverse: the deck file, pool, run files, sheet and result are scripts and data under `scripts/synergy-spike/`, deleted by deleting the folder

## Criteria

### S1: the catalog carries each card's rules text (P1)

The first step the design names; every candidate reads this field.

**Acceptance Criteria**

1. WHEN the catalog loads THEN the system SHALL set `functionalText` on each `ICatalogCard` to the exact string the package holds for that card, which is 5,139 of the 5,177 cards in `@flesh-and-blood/cards` 5.3.0.
2. IF the package holds no `functionalText` for a card THEN the system SHALL leave the field absent on that card, and not set an empty string.
3. The system SHALL keep every existing `ICatalogCard` field unchanged, and the existing engine and API test suites SHALL pass.

**Independent test:** read `catalog.getCard('dorinthea-ironsong').functionalText` and compare it with the same card in the package; count cards with the field and expect 5,139.

### S2: the owner's three decks are loaded (P1)

**Acceptance Criteria**

4. WHEN `pnpm synergy:decks` runs THEN the system SHALL read the Fabrary deck URLs listed in `scripts/synergy-spike/fixtures/decks.yaml` and write one file `out/decks/<ulid>.json` per deck holding the hero identifier, the format, and each mainboard card identifier with its quantity.
5. IF the list holds fewer than three decks THEN the system SHALL exit 1 with a message saying three are required, and write no file.
6. IF a deck cannot be fetched, or holds a card identifier absent from the catalog THEN the system SHALL print the deck URL and the identifier, write no file for that deck, and exit 1.

**Independent test:** run it with the three real URLs, then with two, then with one URL edited to a non-existent ULID.

### S3: each deck gets a bounded candidate pool (P1)

The catalog has 5,177 cards; scoring all of them per deck is neither affordable for the language-model candidate nor meaningful.

**Acceptance Criteria**

7. WHEN `pnpm synergy:pool` runs THEN the system SHALL write `out/pools/<ulid>.json` per deck holding only cards that pass the per-card tests of step 5 of `computeDeckLegality` (banned format, legal format, hero scope with overrides and specializations, and the Silver Age rarity list) for the deck's hero and format.
8. WHEN the pool is written THEN the system SHALL have removed hero cards, tokens and every card identifier already in the deck, and the file SHALL state the pool size.
9. IF a deck's pool holds fewer than 10 cards THEN the system SHALL exit 1 naming the deck.

**Independent test:** for Dorinthea Ironsong in Classic Constructed, 1,017 non-hero cards pass the hero and format tests before tokens and deck cards are removed (measured on 5.3.0); the pool for her deck is that number minus those removals.

### S4: each candidate produces a top 10 per deck (P1)

**Acceptance Criteria**

10. WHEN `pnpm synergy:run <candidate>` runs, with candidate one of `gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro`, `heuristic`, `cooccurrence`, or `llm-all` (the three language-model candidates in turn), THEN the system SHALL write `out/runs/<candidate>/<ulid>.json` per deck holding exactly 10 distinct card identifiers in rank order, each present in that deck's pool and absent from the deck.
11. IF a candidate returns an identifier outside the pool or in the deck THEN the system SHALL drop it, and IF fewer than 10 remain THEN the system SHALL record that deck's run as failed, write no top 10 for it, and exit 1.
12. WHEN the `heuristic` candidate runs twice on the same decks THEN the system SHALL write byte-identical run files.
13. The system SHALL fix the `heuristic` scoring formula in a commit before the owner records any verdict, and SHALL NOT change it after verdicts exist.
14. WHERE the candidate is `cooccurrence`, WHEN fewer public decklists of the deck's hero than the configured minimum are available THEN the system SHALL write `out/runs/cooccurrence/<ulid>.json` with status `untestable` and the count found, and exit 0.

**Independent test:** run `heuristic` twice and diff; run `llm-all --dry-run` (criterion 17); run `cooccurrence` against a hero with no decklists.

### S5: the three language-model candidates run safely and show their cost (P1)

Owner's change, 2026-10-04: three models through OpenRouter replace the single Claude Opus candidate; each is its own blind candidate.

**Acceptance Criteria**

15. WHERE the candidate is `gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro` or `llm-all`, WHEN the environment variable `OPENROUTER_API_KEY` is unset THEN the system SHALL exit 1 before sending any request, and the script SHALL hold no key in any file.
16. WHERE the candidate is one of the three, WHEN a deck runs THEN the system SHALL send one request to OpenRouter, to that candidate's pinned model, holding the hero, the deck list with each card's rules text, and the whole pool with each card's rules text, with `response_format` `json_schema` strict and `provider.require_parameters` true, and SHALL request a ranked list of 25 identifiers with one sentence of reason each, of which the top 10 are kept.
17. WHEN `pnpm synergy:run <candidate> --dry-run` runs THEN the system SHALL print an input token estimate and a cost ceiling for each deck and model, computed locally because OpenRouter offers no token-count endpoint, say so, send no request, need no key, and exit 0.
18. WHEN a response returns THEN the system SHALL store its `usage` prompt, completion and reasoning token counts and its `cost` in that deck's run file.
19. IF the response ends with finish reason `length`, `content_filter` or `error`, carries a refusal, is an HTTP error, or holds content that is not the JSON ranking THEN the system SHALL record that deck's run as failed, not retry, and exit 1.

**Independent test:** run `--dry-run` with the key unset (exit 1), then set; run for one deck and read the token counts in the file.

### S6: the owner judges once, blind (P1)

**Acceptance Criteria**

20. WHEN `pnpm synergy:sheet` runs THEN the system SHALL write `out/judging-sheet.csv` with one row per distinct (deck, card) across the top 10 lists of every candidate run so far, with columns `deck`, `hero`, `card`, `pitch`, `rules`, `verdict` (empty), and no column naming a candidate or a rank.
21. WHEN the sheet is written THEN the system SHALL order the rows by a seeded shuffle, and SHALL write `out/judging-key.json` mapping each (deck, card) to the candidates and ranks that produced it.
22. WHEN `pnpm synergy:sheet` runs and `out/judging-sheet.csv` already holds verdicts THEN the system SHALL keep every existing verdict and add only rows for (deck, card) pairs not yet present.

**Independent test:** run `gpt-6.1-sol`, build the sheet, fill two verdicts, run `heuristic`, rebuild, and check the two verdicts survive and no row repeats.

### S7: the result states pass or fail and whether to stop (P1)

**Acceptance Criteria**

23. IF any card in a candidate's top 10 has a `verdict` other than `yes` or `no` (case-insensitive) THEN the system SHALL write no result, print how many are unjudged or invalid, and exit 1.
24. WHEN `pnpm synergy:score` runs with every verdict recorded THEN the system SHALL write `out/result.md` with, per candidate and per deck, the count of `yes` in the top 10 and PASS when the count is at least 5, otherwise FAIL.
25. WHEN a candidate shows PASS on three decks THEN the system SHALL write the line `STOP: <candidate> passed on 3 decks`.
26. WHEN every candidate has been run once on the same three decks and none passed on three THEN the system SHALL write the line `STOP: all candidates tried once, none passed`.
27. WHEN neither stop line applies THEN the system SHALL write `CONTINUE: next candidate is <candidate>` naming the next one in the agreed order.
28. WHERE a candidate's run for a deck is `untestable` or `failed` THEN the system SHALL print that status in `result.md` in place of a count, and SHALL count the candidate as tried.
29. WHERE a language-model candidate ran THEN the system SHALL print the total input tokens, output tokens and cost in USD it used in `result.md`.

**Independent test:** score a sheet filled with all `yes`, then one with a blank, then one with `maybe`.

## Out of scope

| Excluded | Why |
| --- | --- |
| any change to the site, API, database or screens | the spike is a script outside the product; Alternatives and Recommendations are separate work, decided on this result |
| using the owner's collection or store stock in the judgment | the question is whether a card suits the deck, not whether he owns it; ownership is applied later by the feature that consumes the score |
| prices and the Cúpula DT store | same reason, and only one store exists |
| tuning a candidate after seeing verdicts | the stop rule is "each candidate tried once"; a retuned candidate is a new candidate and needs the owner's decision |
| searching Fabrary for decklists by hero | no such call exists in `fetch-deck.ts`, which fetches one deck by ULID; whether the co-occurrence candidate is testable depends on this and is open question 4 |
| hero-less pools (Blitz and Silver Age exact 40-card rules) | the spike judges which cards suit a deck; how a pick fits a 40-card format is a Recommendations question |
| a judge other than the owner | the pass bar is his agreement; the design says he judges the lists himself |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| the three decks | `https://fabrary.net/decks/01M2EA2J62QDE6ZZYP0YPXEBG4`, `https://fabrary.net/decks/01M0KJEX07FX04Z07EQ1TESWYP`, `https://fabrary.net/decks/01M2GEPE0X50C32E02KZNXAETH`, listed in `scripts/synergy-spike/fixtures/decks.yaml` | owner's answer, 2026-10-04 | y |
| language-model spend | about 1 USD per full pass is acceptable; the key comes only from the owner's shell and is never written to a file | owner's answer, 2026-10-04; the key variable is now `OPENROUTER_API_KEY` (see the candidates row); the new ceiling is 1.74 USD for all three models, expected 0.68 USD | y |
| order of candidates | `gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro`, then `heuristic`, then `cooccurrence` (was `llm`, `heuristic`, `cooccurrence`; the single `llm` became the three) | the language models are the only candidates that can read "serves the strategy" from rules text and need no new data, ordered ceiling model first, then cheapest big-provider, then best value; the rest as before | n |
| judgment unit | `yes` means "I would consider putting this card in this deck", `no` otherwise; no scale | matches the wording of the pass bar, and one binary column keeps the sheet quick to fill | n |
| what counts as the top 10 | the 10 highest-ranked cards of the pool, one entry per card identifier (pitch variants are separate cards, as in the catalog) | the catalog treats each pitch as its own identifier | n |
| which deck cards the language model sees | mainboard entries only, with quantities; the hero's rules text is included | equipment and weapons are in the deck JSON but the suggestions are for the mainboard, since the pool excludes hero cards and the design speaks of cards in a deck | n |
| pool filter implementation | the script copies the step-5 per-card tests of `computeDeckLegality` into the spike, because the engine exposes only the deck-level function, which returns `incomplete` for a deck smaller than the format minimum before it reaches step 5 | extracting an engine predicate is a product change; if the spike passes, the feature extracts it then | n |
| format of the three decks | Classic Constructed unless the owner's decks say otherwise (the format comes from the deck itself) | the design's measurement was over Classic Constructed; any of the four formats works since the pool uses the deck's own format | n |
| language-model run shape | model `claude-opus-5-5`, adaptive thinking, effort `high`, structured JSON output, streaming with the final message, one request per deck; Anthropic's server-side refusal fallback is not enabled | the claude-api skill names `claude-opus-5-5` as the current default; a spike prefers one model with no second route; a refusal on a card-game ranking is recorded under criterion 19 | superseded 2026-10-04 by the language-model candidates row and the arithmetic below |
| token and cost estimate | about 41,000 input tokens and at most 8,000 output tokens per deck, about 1 USD per full pass of three decks at the Opus 5.5 rates in the claude-api skill's price table (cached 2026-09-25: $4 and $20 per million tokens in and out) | arithmetic below; the real figure comes from criterion 17 before any spend, so the estimate is replaceable | superseded 2026-10-04 by the language-model candidates row and the arithmetic below |
| language-model candidates | three models through OpenRouter, each a separate blind candidate: `openai/gpt-6.1-sol` with `reasoning.effort` `high` ($2 and $10 per million tokens in and out), `google/gemini-3.8-flash` ($0.75 and $3.75), `xiaomi/mimo-v2.6-pro` ($0.435 and $0.87); one request per deck, `max_tokens` 32000 because reasoning shares that budget | owner's answer, 2026-10-04: a near-frontier ceiling, a cheap big-provider model and the best quality-per-dollar model found; ids, prices and capability flags read from `https://openrouter.ai/api/v1/models` on 2026-10-04 | superseded 2026-10-04 by the four-model row below |
| language-model candidates (four) | the three above plus `anthropic/claude-opus-5.5` as candidate `opus-5.5` (`reasoning.effort` `high`, $4 in and $20 out per million tokens), same OpenRouter key and request path, as the ceiling reference for the cheaper models; `llm-all` runs all four in the order `gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro`, `opus-5.5` | owner's answer, 2026-10-04; id, price and flags read from `https://openrouter.ai/api/v1/models` on 2026-10-04 (`structured_outputs` and `reasoning_effort` supported, reasoning mandatory, efforts max to low) | y |
| minimum decklists for co-occurrence | 20 public decklists of the same hero, per hero | below that, co-occurrence counts are mostly noise; the number is a guess and the owner may change it | n |
| outputs | committed under `scripts/synergy-spike/out/` | precedent: `scripts/gold-set/out/` is committed; the owner's verdicts are the only record of the spike's answer | n |

Token and cost arithmetic, from the catalog on 5.3.0 for the owner's three decks (the input figures come from `pnpm synergy:run llm-all --dry-run`, which estimates locally at 4 characters per token; the real counts come back in each response's `usage`):

- Input per deck: Kayo SAGE 28,826 tokens (pool 673), Jyrem's Azalea 27,429 (pool 628), Big Number Better 48,276 (pool 1,076); three decks: 104,531 tokens per model.
- Output per deck: 25 identifiers with a sentence each is about 1,500 tokens, plus reasoning; expected 8,000 per deck (24,000 for three), ceiling 32,000 per deck (96,000 for three), the `max_tokens` set on every request.
- GPT-6.1 Sol ($2 in, $10 out per million): input 104,531 x 2 / 1e6 = $0.209; output $0.240 expected, $0.960 ceiling; full pass $0.45 expected, $1.17 ceiling.
- Gemini 3.8 Flash ($0.75 in, $3.75 out): input $0.078; output $0.090 expected, $0.360 ceiling; full pass $0.17 expected, $0.44 ceiling.
- MiMo-V2.6-Pro ($0.435 in, $0.87 out): input $0.045; output $0.021 expected, $0.084 ceiling; full pass $0.07 expected, $0.13 ceiling.
- All three models, three decks: $0.68 expected, $1.74 ceiling (0.449 + 0.168 + 0.066 and 1.169 + 0.438 + 0.129).
- GPT-6.1 Sol's price doubles above 272,000 prompt tokens; the largest request here is about 48,000, so the base rate applies.
- Prices are per token as listed on `https://openrouter.ai/api/v1/models` on 2026-10-04 (`pricing.prompt`, `pricing.completion`); OpenRouter reports the charged amount in `usage.cost`, which `result.md` sums per candidate.
Four-model update, 2026-10-04 (Claude Opus 5.5 through OpenRouter, `anthropic/claude-opus-5.5`, $4 in and $20 out per million):

- Opus 5.5: input 104,531 x 4 / 1e6 = $0.418; output $0.480 expected (24,000 x 20 / 1e6), $1.920 ceiling (96,000 x 20 / 1e6); full pass $0.90 expected, $2.34 ceiling.
- Four models, three decks: $1.58 expected (0.449 + 0.168 + 0.066 + 0.898), $4.07 ceiling (1.169 + 0.438 + 0.129 + 2.338). The owner's earlier "about 1 USD per full pass" assumption covered three models; with Opus the expected figure is above it and the ceiling is four times it.
- A cheaper first step is `pnpm synergy:run opus-5.5` alone, or any one candidate by name, since `llm-all` is only a convenience.

**Open questions:** two left, neither blocks; the two blocking ones were answered by the owner on 2026-10-04 and are recorded as confirmed rows above.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 3 | open | Do you agree with the candidate order `gpt-6.1-sol`, `gemini-3.8-flash`, `mimo-v2.6-pro`, `heuristic`, `cooccurrence`? | the order in criterion 27 defaults to this one |
| 4 | open | If the first two fail, can decklists of the same hero be listed on Fabrary without a login (the current loader only fetches one deck by ULID), and is 20 decklists per hero the right minimum? | the co-occurrence run is recorded as `untestable` (criterion 14), which counts it as tried |

## Observable

Worksheet, not the review.

| Surface | Decision | Landing |
| --- | --- | --- |
| command `pnpm synergy:decks` | output format and verbosity | AC 4 |
| command `pnpm synergy:decks` | exit codes, failure halfway | AC 5, AC 6 |
| command `pnpm synergy:pool` | exit codes, failure halfway | AC 9 |
| command `pnpm synergy:run <candidate>` | flags and defaults | AC 10, AC 17 |
| command `pnpm synergy:run <candidate>` | exit codes, failure halfway | AC 11, AC 15, AC 19 |
| command `pnpm synergy:run <llm candidate>` | cost visibility before spend | AC 17, AC 18 |
| command `pnpm synergy:sheet` | output format and verbosity | AC 20 |
| command `pnpm synergy:sheet` | rerun after verdicts exist | AC 22 |
| command `pnpm synergy:score` | exit codes, failure halfway | AC 23 |
| document `out/result.md` | structure, and what the reader does next | AC 24 to AC 27 |
| document `out/result.md` | candidate that could not be judged | AC 28 |
| collection `out/judging-sheet.csv` | grouping criterion, ordering, duplicates | AC 20, AC 21 |
| collection `out/judging-sheet.csv` | the card that appears in two candidates' lists | AC 20, AC 21 |
| all `synergy:*` commands | versioning, rate limits | n/a - local scripts run by one person; the model request is one call per deck and the SDK retries rate-limit responses by default |

## Sources

- `.design/card-alternatives.md` - sections Problem, Success, Synergy spike and Recommendations: the question, the pass bar, the stop rule and the fail fallback; confirmed by Rodrigo, 2026-10-04.
- `packages/engine/src/catalog/catalog.ts` and `@flesh-and-blood/cards` 5.3.0 - `functionalText` is the package's field for rules text, dropped by `normalizeCard`.
- `scripts/gold-set/` - the precedent for an offline workflow with a blind sheet, a hidden key and a scoring script.
