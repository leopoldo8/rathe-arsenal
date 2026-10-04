# Implementation notes

## Deviations

- **Decks 2 and 3 cannot be loaded; needs the owner.** The catalog is `@flesh-and-blood/cards` 4.0.8.
  Deck `01M0KJEX07FX04Z07EQ1TESWYP` holds `headstrong-stampede-red`, and deck `01M2GEPE0X50C32E02KZNXAETH` holds nine identifiers (`beckoning-hunger-red`, `blood-harvest`, `cleave-the-heavens-blue`, `cleave-the-heavens-red`, `consuming-lash-yellow`, `fallen-herald-yellow`, `feasting-shadowbeast-red`, `feeding-frenzy-red`, `pull-from-beyond-blue`) that 4.0.8 does not know.
  Plan AC 6 says such a deck writes no file and the command exits 1, so that is what happens.
  Version 5.3.0 of the package (checked in a scratch directory, not installed here) holds all ten identifiers, but it is a major bump that changes the product catalog and the plan's literals (4,835 cards, 4,797 rules texts, 928 pool).
  I did not upgrade it: that is a product change, and the checks C1, C2 and C7 would have to be renegotiated.
  Provisional state: only deck 1 (Jyrem's Azalea, Silver Age) is loaded, so the judging sheet covers one deck.
- **Fabrary answered 403 to `fetchDeck`.** The WAF needs a browser-like `User-Agent`, as `apps/api/src/fabrary/aws-iam.transport.ts` documents.
  I added the same header to `scripts/gold-set/fetch-deck.ts` (commit `fix(gold-set)`); no credential is needed, the Cognito identity pool is unauthenticated.
- **`max_tokens` is 16000, not the plan's 8,000 ceiling.** Adaptive thinking draws on the same budget as the answer, so 8,000 risks a `max_tokens` stop (criterion 19), which would burn paid tokens for a failed deck.
  The worst case is about 0.32 USD of output per deck instead of 0.16.
- **The `llm` candidate skips a deck whose `llm` run is already `ok`** unless `--force` is passed, so a repeated command cannot spend twice.
  Not in the plan.
- **`--deck <ULID>` flag on `synergy:run`** (the plan's C20 names it) and `SYNERGY_OUT_DIR` / `SYNERGY_DECKS_FILE` environment variables (tests point the scripts at temp directories).
- **Two of the owner's decks are Silver Age, one is Classic Constructed.** The plan allowed this; the pool uses the deck's own format.
- **Sheet columns:** `deck` holds the Fabrary ULID and `card` holds the catalog identifier (for example `point-the-tip-blue`), so the (deck, card) join is exact; `hero` and `pitch` and `rules` carry what is needed to read it.
- **`out/judging-key.json` is committed next to the sheet**, as the plan commits all outputs. It is the hidden key: the owner should not open it before scoring.
- **Spike tests** run with `node:test` through `tsx` (no new dependency) and the spike has its own `tsconfig.json`, since the repo has no test runner for `scripts/`.
- **`--dry-run` was not exercised against the real API**: it needs `ANTHROPIC_API_KEY` too. It is proven against a fake client (C17).
- **The first `llm` commit also committed the partial `out/` of the deck-1 heuristic run;** later runs overwrite those files.

## Landing rows added

None.
