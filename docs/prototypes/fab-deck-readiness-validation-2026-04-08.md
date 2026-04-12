---
date: 2026-04-08
topic: fab-deck-readiness
source_requirements: docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md
prototype_scope: Standard
prototype_duration: ~1h
outcome: all-proved
---

# Validation Report: FaB Deck Readiness — Phase 0 Foundations

## Why This Prototype Existed

Three foundational assumptions had to hold before the Phase 0 plan could be trusted:

1. **`@flesh-and-blood/cards` must expose engine-relevant attributes as structured fields**, not free text — otherwise gate 3's "engine needs a text-parser pre-pass" warning becomes real work blocking the substitution engine.
2. **Fabrary deck contents must be fetchable from a public deck URL without Playwright**. Gate 3 claimed the AppSync GraphQL path with anonymous IAM works; nobody had actually executed it end-to-end.
3. **A viable scraper for Cúpula DT stock must exist** — per the project owner, this is the *kill-switch*: if stock data is not reliably ingestable from the local store, the entire "connect collection ↔ local stock ↔ desired decks" thesis collapses and the product devolves into just another collection tracker.

The substitution engine's *quality* was deliberately excluded from this prototype — per the project owner, engine quality is a refinement axis, not a feasibility risk, and its validation is the entire point of the Phase 0 gold set.

## Validation Goals & Results

### Goal 1 — `@flesh-and-blood/cards` field coverage — PROVED

**Method.** Install the npm package (v3.6.242), iterate all 4583 cards, count non-null/non-empty coverage across engine-required fields.

**Evidence (all 4583 cards):**

| Field | Coverage | Interpretation |
|---|---|---|
| name | 4583/4583 (100%) | — |
| cardIdentifier | 4583/4583 (100%) | canonical slug, e.g. `act-of-glory-red` |
| setIdentifiers | 4583/4583 (100%) | `string[]` of printing codes, e.g. `["SUP195"]` |
| types | 4562/4583 (99.5%) | structured `Type[]` |
| classes | 4583/4583 (100%) | structured `Class[]` |
| talents | 1380/4583 (30.1%) | only for talent-linked cards, expected |
| keywords | 3107/4583 (67.8%) | structured `Keyword[]`, not free text |
| pitch | 3749/4583 (81.8%) | missing on hero/equipment/weapon/token, expected |
| cost | 3661/4583 (79.9%) | missing on the same categories |
| power | 2012/4583 (43.9%) | only on attack cards, expected |
| defense | 3770/4583 (82.3%) | missing on heroes/tokens |
| specializations | 108/4583 (2.4%) | only on specialization cards, expected |

**Key finding.** Keywords are exposed as `Keyword[]` (enum-typed), **not free text**. Gate 3's concern that the engine would need a text-parser pre-pass for keywords is **unfounded** for this package. Classes, talents, types are all enum-typed the same way. This collapses a real engineering risk.

**Constraints discovered.** None material. The fields that are "missing" are missing semantically — `power` only exists on Attack cards, `specializations` only on specialization cards, etc. A hero card without pitch is not a gap.

### Goal 2 — Fetch Fabrary deck via public URL — PROVED

**Method.** Reverse-engineer the Fabrary SPA bundle to extract the AppSync GraphQL endpoint and the `getDeck` query. Obtain anonymous AWS credentials from the Cognito Identity Pool, sign the request with SigV4 (service `appsync`), POST to the endpoint with the deck ID.

**Test subject.** `https://fabrary.net/decks/01KNQ1FHZ77B3FHT33DJY3RDX3` (Kassai SAGE deck).

**Evidence:**
```
Deck name: Kassai SAGE
Format: Silver Age
Hero: Kassai (cardIdentifier: kassai)
Total deckCards entries: 32
Total main-deck quantity: 46
```

Full response at `fabrary-deck.json` in prototype dir (archived before cleanup).

**Technical details documented for the implementer:**
- **AppSync endpoint:** `https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql`
- **Region:** `us-east-2`
- **Auth mode:** `AWS_IAM` via Cognito Identity Pool **anonymous identity**
- **Identity Pool ID:** `us-east-2:e50f3ed7-32ed-4b22-a05e-10b3e7e03fe0`
- **Minimum viable query** for readiness use case:
  ```graphql
  query getDeck($deckId: ID!) {
    getDeck(deckId: $deckId) {
      deckId
      name
      format
      heroIdentifier
      hero { cardIdentifier name }
      deckCards {
        cardIdentifier
        quantity
        sideboardQuantity
      }
    }
  }
  ```
- **Client flow:** `CognitoIdentityClient.GetId` → `GetCredentialsForIdentity` → `aws4.sign({ service: 'appsync', region: 'us-east-2', ... })` → `POST /graphql`. No user auth, no Playwright, no headless browser.
- **Dependencies validated:** `@aws-sdk/client-cognito-identity`, `aws4`. Credentials are temporary session tokens (expire ~1h); cache-and-reuse with refresh-on-expiry is a Phase 1 concern, not a blocker.

**Critical finding.** The `cardIdentifier` field returned by the Fabrary API is *exactly* the canonical slug used by `@flesh-and-blood/cards` (e.g. `blade-runner-red`, `draw-swords-blue`, `kassai`). **32/32 deckCards from the test deck resolved against the canonical card package**. There is no adapter layer needed between Fabrary and the card database.

### Goal 3a — Parse Cúpula DT listing HTML — PROVED

**Method.** Fetch `?view=ecom/itens&tcg=8&txt_estoque=1&...&page=N` pages for `N=1` and `N=109` (first and last), inspect structure, build a regex-based parser, confirm 100% field coverage.

**Evidence:**
- HTML is **server-side rendered XHTML 1.0 Strict** — no client-side React/Vue hydration required. Raw curl returns the full product grid.
- Each product is a `<div class="card-item">` block containing:
  - **Product anchor** `href="...?view=ecom/item&tcg=8&edicao=NN&cardID=XXX###&card=NNNN"` — encodes edition ID, canonical FaB printing code, and internal SKU ID.
  - **Title** `<div class="title"><a>NAME</a></div>` — English canonical name with pitch suffix `(Red)/(Blue)/(Yellow)`; DFCs concatenated as `"Front // Back"`.
  - **Quantity** `<div class="qty"><span>N</span>unid.</div>` — integer unit count.
  - **Price** `<span class="align-price">R$ X,XX</span>` — BRL, comma decimal.
  - **Cold Foil** detectable via `alt="COLD FOIL"` on the product image.
- Coverage on page 1 (30 items): qty 30/30, price 30/30, editions 13.
- Coverage on page 109 (22 items, last page): qty 22/22, price 22/22, editions 7.
- Total items reconcile: 108 × 30 + 22 = **3262** ✓ matches `itens_total` URL param.

**Constraint discovered.** DFC (double-faced card) names come as `"Front Name (Pitch) // Back Name (Pitch)"` — e.g. `"A Drop in the Ocean (Blue) // Inner Chi (Blue)"` (MST095). The canonical card package stores only one face per `setIdentifier`. Downstream normalizer must handle this split OR rely on the `cardID` join (which does not care about the display name). **Recommendation: rely on `cardID` join, treat the store display name as cosmetic only.**

### Goal 3b — Fullcrawl feasibility — PROVED

**Method.** After a cold-start warmup request, fetch 5 pages spread across the catalog (10, 20, 40, 60, 80) at 1.5s polite delay, measure per-request latency.

**Evidence:**
| Page | Status | Latency |
|---|---|---|
| 10 | 200 | 944ms (warmup) |
| 20 | 200 | 260ms |
| 40 | 200 | 305ms |
| 60 | 200 | 295ms |
| 80 | 200 | 230ms |

- **Steady-state latency:** ~270ms (excluding warmup).
- **Average (with warmup):** 407ms.
- **Extrapolated fullcrawl (109 pages, 3262 SKUs):** ≈ **3.46 min** at 1.5s polite delay between requests.

**Constraint discovered / re-confirmed.** Gate 2 obtained an explicit crawl-rate exception from the Cúpula DT owner for 1-2s/req against his store specifically (Sbrauble default is `Crawl-delay: 360`). **This prototype used 1.5s.** Fullcrawl completes in well under the 10-15 min envelope gate 2 assumed. At 1s delay the number drops to ~2.3 min.

**Operational note.** The scraper should identify itself with a clear User-Agent (used during prototyping: `fab-deck-readiness-prototype/0.1 (contato: rodrigo@local; consent via cupula-dt owner)`), and the exception conversation should be logged in `gate-2-cupula-dt-consent-and-accuracy.md` for future reference.

### Goal 3c — Card-SKU name reconciliation — PROVED (with a very positive surprise)

**Method (original plan).** Sample 20-30 scraped product names, attempt deterministic then fuzzy match against `@flesh-and-blood/cards` canonical names, present to user for visual validation.

**Method (actual).** Discovered during Goal 3a that the Cúpula DT product URL embeds `cardID=XXX###` — the canonical FaB printing code (e.g. `TCC108`, `MST095`, `SUP195`, `FAB334`). Tested the reverse join `cards.find(c => c.setIdentifiers.includes(scrapedCardID))` across 7 pages spread throughout the catalog.

**Evidence:**
- **195/195 scraped items joined deterministically** across pages 1, 10, 20, 40, 60, 80, 109. Zero join failures. Zero fuzzy matching necessary.
- End-to-end validation: a real deck card (`goblet-of-bloodrun-wine-blue` from the test deck) was matched to live store stock (43 unid, R$0.25) via the full chain Fabrary → canonical → store, in the 6% sample.

**Key finding.** The assumption that this goal would need fuzzy/normalized name matching was **wrong**. The Sbrauble schema stores the canonical FaB printing code as a URL parameter on every product, making the join trivially deterministic. This is a better outcome than the prototype plan anticipated.

## Surprises

1. **The reconciliation problem doesn't exist.** The silent risk behind Goal 3c — that the store would expose only fuzzy-matchable free-text names — was obviated by the `cardID=XXX###` URL parameter. This is a structurally better outcome than gate 2 assumed.

2. **Fabrary's `cardIdentifier` is a direct key into `@flesh-and-blood/cards`.** No adapter, no aliasing, no normalization. The deck import pipeline is one lookup, not a resolver.

3. **Sbrauble renders server-side.** No Playwright fallback is needed for the scraper. This cuts the scraper implementation complexity roughly in half versus what gate 3 expected.

4. **Keywords are structured enums.** Gate 3 explicitly flagged a risk that "engine needs a text-parser pre-pass" if keywords were hidden in card text. They aren't. The substitution engine can consume `Keyword[]` directly.

5. **DFC naming in the store.** Cúpula DT concatenates both faces of double-faced cards with `//` in the display name. This is cosmetic only if the scraper uses the `cardID` join (recommended) and ignores the display name for matching.

## Constraints Discovered (load-bearing for the plan)

1. **Anonymous AppSync credentials are short-lived.** Cognito Identity Pool temporary credentials expire ~1h after issuance. The scraper/importer must cache creds and refresh on expiry. **Phase 1 concern, not a Phase 0 blocker** — Phase 0 deck import is user-triggered and can fetch creds per-call.

2. **Crawl-rate exception is per-store.** The 1-2s/req exception was granted for Cúpula DT specifically. When Phase 2 expands to other Sbrauble stores, the default `Crawl-delay: 360` applies unless each store grants an exception.

3. **Edition ID (`edicao=NN`) is internal Sbrauble numbering**, not FaB set code. If the plan wants to filter the listing URL by set (e.g., "only show HVY printings"), it needs a mapping table from Sbrauble edition IDs to FaB set codes. The `cardID` join makes this unnecessary for the readiness use case, but it may matter for a "browse store by set" surface.

4. **The store catalog covers 3262 SKUs (FaB only).** This number was in the URL and confirmed by the pagination math. A fullcrawl captures the entire FaB catalog in one pass. Differential updates are unnecessary at this catalog size — always-fullcrawl is simpler and cheaper than incremental.

5. **DFC normalization.** `A Drop in the Ocean // Inner Chi` style products scrape as one row in the store but are two distinct cards in the canonical package. The substitution engine should resolve each side independently via its own `setIdentifier`.

## Constraints That Did NOT Materialize

- Fabrary ToS blocking automated ingestion → **not triggered** (public deck URLs return data via anonymous IAM).
- FaBDB keyword text parsing → **not needed** (FaBDB replaced, keywords are structured).
- Sbrauble client-side rendering → **not the case** (server-side XHTML).
- Fuzzy card name matching → **not needed** (deterministic `cardID` join).
- Crawl-rate bottleneck → **not binding** (3.46 min fullcrawl at approved rate).

## What's Next

**Recommendation: proceed to `/ce:plan` review / update.**

A Phase 0 plan already exists at `docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`. It should be reviewed against this validation report and updated where the assumptions here shift the design:

- Scraper design section should explicitly encode the `cardID` → `setIdentifier` join as the primary reconciliation strategy (not fuzzy name matching).
- Fabrary import section should reference the Cognito anonymous + SigV4 flow with a minimum viable query, not Playwright.
- Engine design section can drop any "keyword text pre-parser" work item that may have been included as a hedge against gate 3's concern.
- DFC handling should appear as an explicit edge case in the card normalizer.

## Reusable Artifacts (flagged before cleanup)

The prototype scaffold contains three small files that encode non-trivial findings and would save implementation time if preserved:

1. **`parse-cupula.mjs`** — working regex-based parser for Cúpula DT listing pages. 40 lines, no dependencies.
2. **`fetch-fabrary.mjs`** — working anonymous Cognito + SigV4 + AppSync fetch for a Fabrary deck. 70 lines, deps: `@aws-sdk/client-cognito-identity`, `aws4`.
3. **`full-loop-v2.mjs`** — the end-to-end Fabrary → canonical → store join demo. 40 lines.

These files encode the reverse-engineering work (AppSync endpoint, identity pool ID, query shape, HTML selectors) that should not have to be redone.

**Preserved location:** `prototypes/fab-deck-readiness/` (moved out of ephemeral `.context/` scratch space per user decision 2026-04-08). Contents:

- `parse-cupula.mjs` — regex parser for Cúpula DT listing pages, zero dependencies
- `fetch-fabrary.mjs` — Cognito anonymous + SigV4 + AppSync GraphQL fetch for a Fabrary deck
- `full-loop-v2.mjs` — end-to-end Fabrary → `@flesh-and-blood/cards` → Cúpula DT join demo
- `fabrary-deck.json` — reference response payload for the Kassai SAGE test deck (deck ID `01KNQ1FHZ77B3FHT33DJY3RDX3`)
- `package.json` — `{"type":"module"}` + pinned deps `@aws-sdk/client-cognito-identity`, `aws4`, `@flesh-and-blood/cards`

These are *not* production code. They are reference implementations that prove the data flows work and can be consulted or copied from when building the Phase 0 import pipeline. They have no tests, no error handling, no retry logic.

## Archived Evidence (deleted after report)

Scratch dir (now deleted): `.context/compound-engineering/ce-prototype/fab-deck-readiness-20260408-225554/`
- 7 raw listing page snapshots (pages 1, 10, 20, 40, 60, 80, 109)
- Parsed JSON outputs for each
- `join-results.json` — 30 successful canonical joins from page 1
- `audit-cards.mjs`, `full-loop.mjs`, `crawl-sample.mjs` — one-shot audit scripts (logic documented inline above)
- `bundle.js` — Fabrary's 7.2MB minified JS bundle (endpoint/query/pool ID extraction documented inline above, no need to keep)
