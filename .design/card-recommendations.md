# Card recommendations

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: confirmed by Rodrigo, 2026-10-05 - plan after card-alternatives is merged to main, since Adopt builds on its `card_replacement` record.

## Situation

- Project: in steady use, with one user (the owner).
- Decision: committed by Rodrigo on 2026-10-04 in `.design/card-alternatives.md` (Recommendations is built once the Synergy spike passes); the spike passed, recorded as AD-010.
- In flight: copies the job table and long-lived worker of the variant fetch queue, the `card_replacement` record and its stand-in protection from card-alternatives (AD-009), and the card shape with ownership and store price from the alternatives sheet; card-alternatives itself is still under verification and is not reopened here.
- At stake: medium - three new tables, a second job kind in the worker and a paid or rate-limited external call; being wrong costs a migration and a rewrite of the deck panel, not data loss.

## Problem

The site tells the owner which cards a deck is missing, but never which cards would make a deck play better, whether or not anything is missing.
To find an upgrade he browses the library or Fabrary by hand, reads rules text and judges in his head whether a card works with the rest of the deck; nothing tells him when a card he already owns, or one the store has, would be a clear improvement.
The synergy spike measured that a language model can make that judgment on his decks: blind-judged, Gemini 3.8 Flash had 5, 7 and 10 of its top 10 accepted on his three decks, against 3, 4 and 4 for a keyword heuristic (AD-010).

## Success

- Worked if: across the owner's next decks, upgrades are found inside the site - clear upgrades get adopted - and he stops browsing Fabrary or the library to look for them.
- Going wrong: most clear upgrades are dismissed rather than adopted, or the deck notice fires on decks where he finds nothing worth changing; both are read from the adoption and dismissal records (slices Adopt and Dismiss).
- Review: after 20 clear-upgrade notices, or four weeks of use, whichever comes first - Rodrigo.

## Boundary

In: per-deck recommendations computed by the language model of AD-010, automatic on deck changes and on request; the notice of a clear upgrade on the home deck tile and the deck page; dismissing and adopting a recommendation; using the deck's recommendations to order card alternatives inside each group.

Out: recommending cards across decks or for a new deck - per deck only. Out: changing which cards count toward readiness - adoption is an ordinary deck change. Out: a second model or provider fallback - one model, per AD-010. Out: validating the clear-upgrade label or the suggested cut by another judging round - measured through use instead (Success). Out: more than one store - only Cúpula DT exists.

Unchanged: `swap_suggestion` and `/api/swaps`; the alternatives groups and their legality rules (only the order inside a group changes); readiness and its stand-in search; `variant_fetch_job` and its drainer.

## Prior art

- Deck builders for Flesh and Blood show statistics and none recommends by synergy (recorded in `.design/card-alternatives.md`); the seam we take is our own variant fetch queue - a database job table drained by a long-lived worker that survives deploys.
- The failure that queue was built to stop - work lost when an in-process task dies on restart - is why recommendations do not run inside the API process (Key decision 2).

## Shape

A recommendation run is one model judgment of one deck, stored with its ranked cards; the deck shows its latest finished run, flagged stale when the deck list has changed since.
Runs are queued as jobs and drained by the existing worker process: automatically, a few minutes after the last change to the deck list, and on request from a button.
The door is the stored run: every surface - the panel, the home notice, the alternatives order - reads that record, and none calls the model itself.
The heavier alternative scores every legal card against every deck, so alternatives could be ordered by synergy for any card; it wins only if the deck's top list turns out too short to reorder alternatives, which the share of alternatives found in it will show.

## Key decisions

1. **The model is never called on a request path.** Every call happens in the worker; requests read stored runs only. A run takes on the order of a minute per deck (the spike's passes took minutes per model for three decks), so no screen waits on it.
2. **Runs are database jobs drained by the existing worker, as the variant fetch queue does; never an in-process task in the API.** A job survives restarts and deploys, an orphaned job is reclaimed, and at most one job per deck is pending or running.
3. **Only a change to the deck list enqueues an automatic run, and changes coalesce.** A composition save, an import, a pick, a revert and an adoption move the deck list; collection changes do not, because synergy depends only on the deck list, the hero and the format. A pending automatic job is pushed back on each change and runs 5 minutes after the last one; decks with status `retired` never get an automatic run.
4. **Ownership and store price are read when the deck is read, never stored with the run.** A recommendation says which card and why; whether the owner has it and what it costs are joined live, as the alternatives sheet does.
5. **A dismissal is permanent for that deck and card, and dismissed cards are removed from the pool before the model sees it.** It is undone only by an explicit undo, and the next run cannot propose the card again.
6. **Adopting a recommendation is a `card_replacement` with `pickedFrom = 'recommendation'`.** It moves every copy of the cut card in that slot to the recommended card, capped by the format's copy limit, protects those copies from engine stand-ins and is undone by revert, exactly as a picked alternative (AD-009). The "you now have the original" prompt never applies to it, because the cut card was never missing.
7. **The run records only what the model says; the server validates it.** A recommended card outside the legal pool, already in the deck or dismissed is dropped; a suggested cut that is not in the deck is stored as no cut. The clear-upgrade label is the model's, unvalidated by the spike, and is judged by the adoption and dismissal records (Success).
8. **The model sees how often players run each card, not only its text (AD-028, superseding the text-only part of AD-010).** When at least 5 synced tournament decks of the deck's hero and format exist (`tournament_deck`, the 40 most recent within two years), the prompt lists the share of them that play each pool and deck card (cards under 10% left out) and tells the model to weigh it with the rules text. With fewer tournament decks, the share comes from public player decks on Fabrary (decision 10); with neither, the prompt is the text-only one, unchanged. Only identifiers that are in the pool or the deck reach the prompt, so nothing from Fabrary but catalog ids and numbers is written into it. A failed read runs without the signal.
9. **Other pitch versions of a card the deck already plays are not candidates when usage data exists (AD-028, AD-029).** The pool leaves out a card whose name the deck already plays in another pitch, unless at least half of the usage decks play that version; it is a pool rule, not a prompt rule, so the model cannot spend its list on them. Without any usage data nothing says which pitches players run together, so no version is left out.
10. **Public Fabrary decks are the usage source when tournament decks are too few (AD-029).** The worker reads the newest complete public player deck of each author for the deck's hero and format (not a tournament list, not a precon; at least 40 cards; edited within three years; at most 40 decks, at least 5). The prompt names the source: "public decks on Fabrary for this hero and format, one per player". The decks are cached in `public_deck`, `public_deck_card` and `public_deck_refresh` and re-read from Fabrary at most once a week per hero and format, on the first run that needs them; only decks edited since are fetched, and a failed refresh keeps the stored decks and waits an hour before asking again. Only the deck ULID, a SHA-256 of the author id, the last edit and catalog-shaped identifiers with 1 to 99 copies are stored.

## Work

| Slice | Delivers | Status |
|---|---|---|
| [Recommendation run](#recommendation-run) | queued, coalesced runs drained by the worker, storing ranked cards per deck | open — 3 defaults taken |
| [Recommendations panel](#recommendations-panel) | the panel on the deck page, with the generate button and the stale flag | open — 2 defaults taken |
| [Clear upgrade notice](#clear-upgrade-notice) | the marker on the home deck tile and the highlighted upgrades in the panel | clear |
| [Dismiss](#dismiss) | dismissing a recommendation for good, with undo | clear |
| [Adopt](#adopt) | swapping a chosen deck card for the recommended card | clear |
| [Alternatives order](#alternatives-order) | alternatives found in the deck's latest run rise inside their group | open — 1 default taken |

Order: Recommendation run → Recommendations panel → Dismiss → Adopt → Clear upgrade notice → Alternatives order.

Already handled by existing code: the owner acquiring a recommended card → ownership is read live (Key decision 4); a deck deleted → its runs, recommendations and dismissals go with it by cascade, as `card_replacement` does.

Derivable from the repository, left to the plan: localized copy and error codes - as AD-003 and the alternatives sheet do them; deck-scoped authorization and `404` for another user's deck - as `GET /api/decks/:deckId` does it; the card's art, ownership mark and store price - as the alternatives sheet shows them; job claiming, orphan reclaim and worker logging - as `variant_fetch_job` does them.

### Recommendation run

**Delivers** one stored model judgment per deck, queued automatically or on request and run by the worker. **Status: open.** Holds Key decisions 1, 2, 3 and 7.

| State | What should happen | Caller sees |
|---|---|---|
| Deck list changes on a deck not `retired` | An automatic job is created, or the pending one is pushed back to 5 minutes from now | nothing - the panel shows the previous run, flagged stale |
| Owner presses Generate | A manual job is created to run as soon as the worker is free; a pending automatic job is promoted to it | `202` with the run, `status: pending` |
| A job for the deck is already running | No second job; the request returns the running one | `202` with that run |
| Model answers | Ranked cards stored (at most 25), each with its label, reason and suggested cut; run `done` | panel shows the new list |
| Model refuses, times out or answers off-schema | Run `failed` with the reason; the previous `done` run stays current | panel keeps the old list and shows the failure |
| Provider rate limit | Job back to `pending` with a later start, at most 3 attempts | nothing until it runs or fails |
| Deck changes while its run is running | The finished run is stored, then flagged stale; the pending automatic job runs after it | stale flag |

`POST /api/decks/:deckId/recommendations/runs` → `202` `{ run: { id, status, trigger, createdAt } }`

Table `recommendation_run`; no existing table changes.

| Column | Type | Null | References | Note |
|---|---|---|---|---|
| `id` | uuid | no | | primary key |
| `trackedDeckId` | int | no | `tracked_deck.id` | cascade delete; index with `status` |
| `trigger` | varchar(16) | no | | `auto` \| `manual`, varchar plus CHECK |
| `status` | varchar(16) | no | | `pending` \| `running` \| `done` \| `failed`, varchar plus CHECK |
| `runAfter` | timestamptz | no | | when the worker may claim it; pushed back by each deck change |
| `deckFingerprint` | varchar(64) | yes | | hash of the deck list the run judged; stale when it differs from the deck's current one |
| `model` | varchar(64) | yes | | model id used |
| `attempts` | int | no | | default 0 |
| `inputTokens`, `outputTokens` | int | yes | | from the provider's usage |
| `error` | text | yes | | failure reason |
| `createdAt`, `startedAt`, `finishedAt` | timestamptz | `createdAt` no | | |

Table `recommendation`.

| Column | Type | Null | References | Note |
|---|---|---|---|---|
| `id` | uuid | no | | primary key |
| `runId` | uuid | no | `recommendation_run.id` | cascade delete |
| `cardIdentifier` | varchar(128) | no | | the recommended card |
| `rank` | int | no | | 1 to 25 (runs stored before 2026-11-02 hold 1 to 10); unique with `runId` |
| `strength` | varchar(16) | no | | `clear_upgrade` \| `consider`, varchar plus CHECK |
| `cutCardIdentifier` | varchar(128) | yes | | the deck card the model would replace; null when absent or invalid (Key decision 7) |
| `cutSlot` | varchar(64) | yes | | slot of the suggested cut |
| `reason` | text | no | | one sentence from the model |

```mermaid
erDiagram
  tracked_deck ||--o{ recommendation_run : "judged by"
  recommendation_run ||--o{ recommendation : "ranks"
  tracked_deck ||--o{ recommendation_dismissal : "excludes"
  tracked_deck ||--o{ card_replacement : "records adoptions in"
```

```mermaid
stateDiagram-v2
  [*] --> pending: deck list changes or Generate
  pending --> pending: another change pushes runAfter back
  pending --> running: worker claims after runAfter
  running --> done: valid answer stored
  running --> pending: rate limited, attempts left
  running --> failed: refusal, timeout, off-schema, attempts spent
  done --> [*]
  failed --> [*]
```

Alternatives considered: Google's Batch API at half price - wins if runs stop being wanted within minutes, since batch answers arrive asynchronously over hours.

1. Coalescing delay - 5 minutes after the last deck-list change.
2. Provider - Gemini 3.8 Flash called directly on Google's API with an AI Studio key, free tier first, billing linked only if its limits bite; the key lives only in the worker's environment.
3. Ranked cards kept per run - all 25 the model is asked for (owner's call, 2026-11-02). It was 10, the size the spike measured, until ranks 11 to 25 turned out to be lost with no way to see them; the panel lists every stored card in its sideways rail.

### Recommendations panel

**Delivers** the panel on the deck page that shows the latest run and the Generate button. **Status: open.**

| State | What should happen | Caller sees |
|---|---|---|
| No run yet | Empty state with Generate | panel with the button |
| Run pending or running, none done before | Waiting state; the page polls until done or failed | "generating" |
| Latest `done` run, deck list unchanged since | The ranked cards, each with art, reason, ownership or store price, and the suggested cut | list |
| Latest `done` run, deck list changed since | Same list, flagged stale, with Generate | list plus stale flag |
| Latest run `failed` | The last `done` list if any, plus the failure and Generate | list or empty, plus error |
| A recommended card is dismissed or adopted | It leaves the list | list without it |

`GET /api/decks/:deckId/recommendations` → `200` `{ run: { id, status, trigger, finishedAt, stale } | null, pending: boolean, recommendations: [{ id, rank, cardIdentifier, name, pitch, imageUrl, strength, reason, cutCardIdentifier, cutSlot, freeCopies, priceCents, productUrl }] }`

1. Placement - in the column of the swaps panel, under it, on the deck page.
2. Polling - every 10 seconds while a run is pending or running, stopping when it ends.

### Clear upgrade notice

**Delivers** the proactive notice: a marker on the home deck tile and the clear upgrades first in the panel. **Status: clear.**

| State | What should happen | Caller sees |
|---|---|---|
| Latest `done` run has at least one `clear_upgrade` not dismissed or adopted | Home deck tile shows "N upgrades suggested"; panel shows clear upgrades first, highlighted | marker and highlight |
| No clear upgrade left | No marker; the panel shows the list without highlight | no marker |
| Deck `retired` | No marker | no marker |

`GET /api/decks` gains `clearUpgradeCount` per deck.

### Dismiss

**Delivers** dismissing a recommendation for good, with undo. **Status: clear.** Holds Key decision 5.

| State | What should happen | Caller sees |
|---|---|---|
| Owner dismisses a recommendation | A dismissal for (deck, card) is recorded; the card leaves the list and the notice count | `201` |
| Same card already dismissed | Nothing new is recorded | `200` |
| Owner undoes the dismissal | The dismissal is removed; the card reappears if the latest run has it | `204` |
| Next run | Dismissed cards are not in the pool the model sees | never proposed again |

`POST /api/decks/:deckId/recommendations/dismissals` `{ cardIdentifier }` → `201` `{ dismissal }`
`DELETE /api/decks/:deckId/recommendations/dismissals/:cardIdentifier` → `204`

Table `recommendation_dismissal`: `id` uuid, `trackedDeckId` int not null → `tracked_deck.id` cascade, `cardIdentifier` varchar(128) not null, `createdAt` timestamptz not null; unique (`trackedDeckId`, `cardIdentifier`).

### Adopt

**Delivers** swapping a deck card for the recommended card. **Status: clear.** Holds Key decision 6.

| State | What should happen | Caller sees |
|---|---|---|
| Owner adopts with the suggested cut | Every copy of the cut card in its slot moves to the recommended card, up to the copy limit; a `card_replacement` with `pickedFrom = 'recommendation'` records it | `201`, deck shows "in place of" with Undo |
| Owner picks another card to cut | Same, with the chosen card | `201` |
| Recommended card would break legality | Refused, deck untouched | `409` `REPLACEMENT_ILLEGAL` |
| Cut card no longer in that slot | Refused, deck untouched | `409` `NOTHING_TO_REPLACE` |
| Owner undoes | As a revert of a picked alternative | `200` |
| Adopted card later owned | No "you now have the original" prompt (Key decision 6) | no prompt |

`POST /api/decks/:deckId/recommendations/:recommendationId/adopt` `{ cutCardIdentifier, cutSlot }` → `201` `{ replacement }`

`card_replacement`: `pickedFrom` gains `recommendation` (CHECK replaced, entity and migration both).

### Alternatives order

**Delivers** synergy as the in-group order of card alternatives. **Status: open.**

| State | What should happen | Caller sees |
|---|---|---|
| Deck has a `done` run, stale or not | Inside each group, alternatives present in the run come first, by run rank; the rest keep the similarity order with the owned bonus | reordered group |
| Deck has no `done` run | Today's order | unchanged |

Groups and their membership never change; only the order inside one does (card-alternatives Key decision 6 still holds).

1. A stale run still orders alternatives - synergy with a slightly older list beats no synergy, and the panel already flags staleness.

## Quality eval

`apps/api/src/recommendations/eval/` measures whether the model ranks the cards that players actually run.
Each scenario is a hero, a format and a deck; its expected cards are never hand-picked: they are the cards at least 80% of the scenario's reference decks play, that the deck lacks and that the candidate pool holds.
Reference decks are a committed snapshot of public Fabrary decks (`recommendation-eval-reference-decks.ts`).
Scenarios: the owner's Kayo Living Legend deck (deck 21 on staging), which must get Berserk, and four ablations that take the best placed recent tournament deck of a hero, remove its three most played staples and expect them back.
The score is the share of runs that rank each expected card in the top 10, with top 5, top 25 and the rank per run, read from the full ranked answer of 25 cards.

Run it (paid, about one cent per call, never in CI; the key is read from the environment and never printed):

```
pnpm --filter @rathe-arsenal/api build
OPENROUTER_API_KEY=... pnpm --filter @rathe-arsenal/api recommendations:eval --runs 5 --max-usd 1 [--only kayo-ll-owner-deck] [--effort high] [--model openrouter/id]
OPENROUTER_API_KEY=... USAGE_DATABASE_URL=... USAGE_DATABASE_CA_FILE=... USAGE_DATABASE_TLS_SERVERNAME=localhost \
  pnpm --filter @rathe-arsenal/api recommendations:eval --runs 10 --max-usd 1.2 [--usage] [--drop-siblings]
pnpm --filter @rathe-arsenal/api recommendations:eval:snapshot   # refresh the reference decks from Fabrary
```

`--usage` reads the synced tournament decks at `USAGE_DATABASE_URL`, holding out the eval's reference decks, and, where those are too few, public decks read live from Fabrary, holding out the reference decks and their authors.
Point it at a **read-only database role** that can only `SELECT` from `tournament_deck` and `tournament_deck_card`, never at the owner role in Railway's `DATABASE_PUBLIC_URL`.
The connection verifies the server certificate, and TLS parameters in the URL are ignored.
Railway's public proxy presents a certificate for `localhost` signed by the database's own CA, so pass that CA as a PEM file in `USAGE_DATABASE_CA_FILE` and `USAGE_DATABASE_TLS_SERVERNAME=localhost`; the chain is then checked against that CA and the name against `localhost`.
The CA lives in the Postgres service's data directory (the `postgres-ssl` image generates it); a copy read from the server's own handshake is trust on first use, so prefer the file from the service.
`USAGE_DATABASE_INSECURE_TLS=i-understand` turns verification off with a warning, for a one-off local run only; no other value does.

Baseline on 2026-11-02, `openai/gpt-6-luna` with no reasoning effort, as the worker runs it: 12 of 70 expected cards in the top 10 over five runs per scenario (17%).
Berserk reached the top 10 in 2 of 5 runs and was not ranked at all in the other 3.
With `--effort high` (three runs per scenario) the total stayed at 17%, while each call took about twice as long.

Usage signal and pitch-version filter (AD-028), 2026-11-02, 10 runs per scenario and variant, all four variants run at the same time:

| Variant | Expected cards in the top 10 | Per-run mean (SD) | Pitch versions of deck cards in the top 10, per run |
| --- | --- | --- | --- |
| Baseline (main's prompt, byte for byte) | 25/140 (18%) | 17.9% (7.7) | 1.74 |
| Usage signal | 80/140 (57%) | 57.1% (6.7) | 1.28 |
| Pitch versions dropped | 26/140 (19%) | 18.6% (10.8) | 0 |
| Both (shipped) | 81/140 (58%) | 57.9% (11.4) | 0.10 |

| Scenario | Baseline | Usage | Pitch versions dropped | Both |
| --- | --- | --- | --- | --- |
| Kayo LL, owner's deck | 4/20 | 3/20 | 4/20 | 3/20 |
| Oscilio CC | 15/30 | 5/30 | 16/30 | 6/30 |
| Cindra CC | 5/30 | 30/30 | 4/30 | 29/30 |
| Arakni CC | 1/30 | 30/30 | 2/30 | 28/30 |
| Ira SA | 0/30 | 12/30 | 0/30 | 15/30 |

How the eval keeps the usage signal from seeing its own answers (`usageHoldout`):
- Every reference deck is left out of the usage data by its Fabrary id.
- For the four tournament scenarios, every deck created on or after the oldest reference deck is left out too, so the signal only knows earlier decks.
- Kayo's reference decks are community decks, which the tournament table never holds, so the ids are enough. Staging has no Kayo Living Legend tournament deck, so Kayo gets no signal. Its Classic Constructed decks were not used, because none of them plays Berserk.

The date cutoff is stricter than production, which reads the newest decks, and it cost Oscilio: 15/30 on the baseline, 6/30 with both changes.
Oscilio's expected cards became staples on the national championships weekend of 2026-06-28: all 14 synced Oscilio decks from that weekend play Comet Collision, against 5 of the 26 before it.
The strict holdout keeps only the decks before that weekend, so its signal describes the old meta (Comet Collision at 14%).
Holding out only the reference ids reads those 14 decks too (different decks from the same weekend as the oldest reference decks), and Oscilio got 21/30 with both changes (10 runs, from a one-off script, not the committed CLI).
The two numbers bound what production would see: 6/30 when the data trails a meta shift, 21/30 when it has caught up.

Public deck fallback and pitch filter only with data (AD-029), 2026-11-02, 10 runs per scenario, main (dbb38149, built from its own tree) and this change run at the same time:

| Scenario | Main | Public fallback |
| --- | --- | --- |
| Kayo LL, owner's deck (strict holdout: no signal on either side) | 5/20, Berserk in the top 10 in 3/10 runs | 3/20, Berserk 3/10 |
| Oscilio CC | 3/30 | 6/30 |
| Cindra CC | 30/30 | 27/30 |
| Arakni CC | 30/30 | 29/30 |
| Ira SA | 16/30 | 18/30 |
| Total | 84/140 (60%) | 83/140 (59%) |
| Kayo fold 1 (signal from 6 decks, expected from the other 5) | - | 36/50, Berserk 9/10 |
| Kayo fold 2 (signal from 5 decks, expected from the other 6) | - | 16/30, Berserk 6/10 |

- The four tournament scenarios send the same prompt byte for byte on both sides (checked with `--prompts-only` before any paid call), so their differences are run-to-run noise.
- Kayo under the strict holdout has no usage data, so every other pitch version of a deck card is back in the pool (yellow Pulping among them). They took 4.2 of the top 10 places per run, against 0 on main, which explains the drop from 5/20 to 3/20; with a fold's signal they took 0.5 and 0.2. Production has the 11 public decks for Kayo Living Legend, so it gets the filter.
- Production code run against live Fabrary (`PublicDecksService.usage`, 2026-11-02): 11 decks from 11 authors, Berserk 91%, Apex Bonebreaker 82%, yellow Pulping 73%.
- How the public signal is kept from seeing its own answers (`publicHoldout`): every reference deck is left out by id, and every deck of a reference author, read from the live index. All 11 public Kayo Living Legend decks are reference decks, so nothing is left.
- The fold diagnostic (`--public-folds`, `publicFoldScenarios`) splits the reference decks into two folds with no author in common. Each fold's signal goes through the production selection and minimum; its expected cards come from the other fold only. Berserk in the top 10 is the headline, since it does not depend on how each fold's expected set comes out.

```
OPENROUTER_API_KEY=... USAGE_DATABASE_URL=... USAGE_DATABASE_CA_FILE=... USAGE_DATABASE_TLS_SERVERNAME=localhost \
  pnpm --filter @rathe-arsenal/api recommendations:eval --runs 10 --usage --drop-siblings [--public-folds] [--prompts-only]
```

## Migration

`1778533615000-AddPublicDecks` creates `public_deck` (ULID unique, hero, format, `authorKey` SHA-256, `deckUpdatedAt`, `fetchedAt`), `public_deck_card` (cascade from the deck, unique per card, quantity 1 to 99) and `public_deck_refresh` (hero and format as the key, `refreshedAt`, decks); no existing table changes and nothing to backfill.

Three new tables and a replaced CHECK on `card_replacement.pickedFrom`; no backfill - no deck has runs, and no existing row uses the new origin.
The worker service needs the Gemini key in its environment and is redeployed with the API; until the key is set, runs fail with a clear reason and nothing else changes.
API and SPA deploy together, so no old client exists.

## Sources

- `.design/card-alternatives.md` - the committed decision to build Recommendations after the spike, the `card_replacement` record and the alternatives groups.
- `.specs/STATE.md` AD-009 and AD-010 - picks as deck changes; the model that judges synergy and the spike evidence.
- `docs/superpowers/specs/2026-06-03-variant-fetch-queue-design.md` - the job table and worker this copies.
- https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/terms - Gemini 3.8 Flash prices, free tier and its data-use terms (read 2026-10-05).
