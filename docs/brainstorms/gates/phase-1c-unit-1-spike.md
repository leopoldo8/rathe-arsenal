---
title: "Phase 1c Unit 1 spike — Fabrary trending discovery"
type: spike-report
status: blocking
date: 2026-04-19
plan: docs/plans/2026-04-18-001-feat-phase-1c-discover-history-telemetry-plan.md
---

# Phase 1c Unit 1 spike — Fabrary trending discovery

**Verdict: NO-GO on the plan as written. Fabrary does not have a "trending" GraphQL query — it has an Algolia-powered public deck index with no popularity signal.** The plan's R11 ("automatic ingestion of Fabrary trending decks") needs revision before U1 implementation can begin.

## Part A — GraphQL discovery

### What the plan assumed

The plan assumed `https://fabrary.net/decks/trending` would render a trending page firing an AppSync GraphQL query like `listTrending` or `getTrendingDecks`. Unit 1 would extract the operation name and shape from the live network capture.

### What was found

1. **`https://fabrary.net/decks/trending` does NOT exist as a Fabrary route.** The app interprets `trending` as a deck ULID and renders "Deck not found". A `getDeck` GraphQL request fires with literal `variables: { deckId: "trending" }` — confirming the route is a 404 fallback, not a trending page.
2. **There is no "Trending" tab anywhere on Fabrary.** The `/decks` page exposes 5 tabs only: Favoritos, Metafy, Mais recentes (latest), Torneio (tournament), Precons. None of them are "trending".
3. **The deck list is NOT fetched via AppSync GraphQL.** It comes from **Algolia**:
   - **Endpoint:** `https://4e2ysy5y4i-dsn.algolia.net/1/indexes/*/queries`
   - **App ID:** `4E2YSY5Y4I`
   - **Public read-only API key:** `63c7b6aa56d38399d37df3c341b982c3` (visible client-side, embedded in the bundle)
   - **Index:** `public_decks` (~28,767 decks total at capture time)
4. **Algolia hit shape (each deck):**
   ```json
   {
     "deckId": "01JZAYPEXAAKT1KAF9RRCQZ17R",
     "objectID": "01JZAYPEXAAKT1KAF9RRCQZ17R",
     "name": "Reach Out And Stab Someone",
     "author": "Xaliver",
     "authorParts": ["Xaliver"],
     "userId": "510e8954-...",
     "format": "Classic Constructed",
     "hero": "Arakni, Marionette",
     "heroIdentifier": "arakni-marionette",
     "cards": ["Amulet of Echoes", "Art of Desire: Body", ...],
     "tags": [],
     "hasMatchups": true,
     "hasNotes": false,
     "hasResults": true,
     "hasYoutube": false,
     "isPrecon": false,
     "isTournament": false,
     "youtube": null,
     "createdAt": "2025-07-04T14:50:52.713Z",
     "updatedAt": "2026-04-19T06:19:58.536Z"
   }
   ```
5. **Important field-level facts:**
   - `cards` is an array of card **NAMES** (display strings), not card identifiers. Useful for substring/text filtering, but the engine cannot consume names directly — quantities and identifiers come from the existing `getDeck(deckId)` GraphQL call.
   - There is **no `deckCards` (quantity + identifier + sideboard)** in Algolia. The plan's R14 quality filter (`mainboardCount ≥ 60`) cannot be evaluated from Algolia alone.
   - There is **no archetype** field. R11's archetype filter is unavailable.
   - There is **no `popularityRank`, `plays`, `favoritesCount`, or any popularity signal**. The plan's `popularityRank` column has no source data.

### Available facets / filters
- `format` (full strings: "Classic Constructed", "Blitz", "Silver Age", "Open", "Living Legend", "Ultimate Pit Fight", "Clash", "Draft", "Sealed")
- `heroIdentifier` (kebab-case)
- `hasMatchups`, `hasNotes`, `hasResults`, `hasYoutube`, `isPrecon`, `isTournament`

### Available sort
- **Default sort: `updatedAt DESC`** — the only sort the public Algolia exposes.
- I probed for replica indices (`public_decks_plays_desc`, `public_decks_favorites_desc`, `public_decks_createdAt_desc`, `public_decks_updatedAt_desc`) — all return 404. There is no Algolia replica with a popularity sort.

### Distribution of relevant filters
- Total: 28,767 decks
- `isTournament:true`: 1,421 decks (~5%) — curated competitive decks reported by tournament organizers
- `hasResults:true`: 14,647 decks (~51%) — decks the author has logged as actually played
- Format CC: 16,653 — Blitz: 5,177 — Silver Age: 3,917 — Open: 1,419 — Living Legend: 725

## Part A.5 — Deck URL template verification

Verified: `https://fabrary.net/decks/01JZAYPEXAAKT1KAF9RRCQZ17R` returns HTTP 200 with no redirect (no format-scoped path). The plan's "Track this deck" URL template (`https://fabrary.net/decks/${fabraryUlid}`) works as designed.

## Part B — Relevance probe

**Status: NOT EXECUTED in this spike** — requires staging API access + closed-beta tester collections. Pre-conditions for Part B:
- A working `PreviewReadinessService` against an arbitrary deck-card array (Phase 1c Unit 3 — does not yet exist)
- 2-3 closed-beta tester accounts with non-trivial collections seeded in dev/staging (Phase 0 baseline — exists but not reachable from the orchestrator)

This must be run manually by the user against staging once Unit 3 ships, OR delayed until the first ingestion has populated `discover_deck` so the probe can run against real data.

## Implications for the plan

The plan's central assumption — "Fabrary has a trending GraphQL query, we extend `FabraryService` with `fetchTrending`" — is invalid. Three concrete consequences:

### 1. The Discover source surface needs a new definition

There is no Fabrary trending. The closest realistic substitutes, in order of curatorial signal strength:

| Substitute | nbHits | Pros | Cons |
|------------|--------|------|------|
| `isTournament:true`, sorted by `updatedAt DESC`, format ∈ {CC, Blitz} | ~1,000 | Curated competitive content; matches the engine's CC/Blitz scope | Smaller pool; lags real-time meta by tournament submission cadence |
| `hasResults:true`, sorted by `updatedAt DESC`, format ∈ {CC, Blitz} | ~14k | Larger pool; "decks people actually played" | Lower signal — `hasResults` is author-self-reported and includes casual decks |
| Default sort (most-recently-updated public decks), format ∈ {CC, Blitz} | ~22k | Most data; same source the Fabrary UI shows on `/decks?tab=latest` | No quality signal at all; includes brews, jokes, and one-card test decks |

**Recommendation: ingest `isTournament:true` first, fall back to `hasResults:true` if tournament volume is too sparse for the user's audience.** Re-frame R11 from "trending" to "curated tournament + recent" — the user-facing copy can still call this "Discover" without claiming "trending".

### 2. The data layer requires a two-step ingestion

Algolia returns metadata + card names but not quantities or identifiers. To populate `discover_deck_card` with engine-ready data, ingestion must:
1. Query Algolia for the candidate `deckId` list.
2. For each `deckId`, call the **existing** `getDeck(deckId)` GraphQL via `AwsIamTransport` to get `deckCards: [{ cardIdentifier, quantity, sideboardQuantity }, ...]`.

This is exactly the contingency path the plan's Unit 1 already documents ("Contingency for thin trending response shape ... batch per-deck `getDeck` calls at concurrency 5 with a 200ms inter-batch delay"). With Algolia, the contingency becomes the **default path**, not a contingency. Update the Unit 1 PR description accordingly.

Wall-clock estimate update: 50 trending decks × (1 Algolia call ≈ 200ms + 50 × 1 getDeck call ≈ 300ms each, batched at concurrency 5 with 200ms inter-batch) ≈ **~3.5s for 50 decks**, comfortably inside the cron worker budget. **Per-day Fabrary GraphQL load: 50 requests/day, well below any plausible rate limit.**

### 3. Schema adjustments

- **`discover_deck.popularityRank`**: rename to `ingestionRank` (1 = first in the Algolia response, N = last). It encodes recency, not popularity. Drop the implication that it's a popularity proxy.
- **`discover_deck.archetype`**: omit (Algolia has no archetype). R11's archetype filter cannot ship in Phase 1c. Update the filter UI in Unit 5a accordingly.
- **R14 quality filter unchanged**: still applies after the per-deck `getDeck` follow-up populates `mainboardCount` from the GraphQL `deckCards` array.

### 4. Transport layer

A new `AlgoliaTransport` peer to `AwsIamTransport` is required. Minimal shape:
- POST to `${ALGOLIA_ENDPOINT}/1/indexes/*/queries` with `x-algolia-api-key` and `x-algolia-application-id` query-string params.
- No AWS SigV4. No Cognito. Just an HTTP client through `FetchGuardService` with the existing fetch guard envelope.
- Add env vars: `ALGOLIA_APP_ID`, `ALGOLIA_API_KEY`, `ALGOLIA_DECKS_INDEX` (default `public_decks`), `ALGOLIA_ALLOW_HOSTS` (the `*-dsn.algolia.net` host).

The plan's Unit 1 file list needs a new `apps/api/src/fabrary/algolia.transport.ts` and corresponding env-vars. The current `FabraryService` either splits into `FabraryGraphQLService` + `FabraryAlgoliaService`, or the `fetchTrending` method composes both transports internally. Either is fine — split is cleaner for testing.

### 5. Spike Part B is now blocked on Unit 3 (or on running U1+U2 first to seed `discover_deck`)

The plan put Part B as a U1 gate. With the Algolia substitution, Part B can only run after Unit 3 (`PreviewReadinessService`) is ready — Algolia returns card names, not the engine-ready data, so without `getDeck` follow-up + the engine, the relevance probe cannot fire. Recommendation:
- Loosen the gate: U1+U2 can ship behind a feature flag (`DISCOVER_INGESTION_ENABLED=false` by default) without Part B.
- Run Part B **after Unit 3 lands**, against the first real ingestion, and use the result to confirm the source choice (tournament vs. has-results vs. latest) before flipping the flag in staging.
- If Part B fails on tournament-only, the operator can rerun ingestion against a broader filter without code change (the source filter is a constructor input, not hardcoded).

## What you (operator) need to test before unblocking

1. **Confirm the source choice.** Is `isTournament:true` the right Discover surface for the Pelotas audience, or should we widen to `hasResults:true`? My recommendation is tournament-first; deferring to you because audience expectations are owned product-side, not engineering-side.
2. **Confirm the framing change.** R11/R12/R13/R14 originally said "trending". The Discover UI copy needs to say "Tournament decks" or "Featured decks" or "Recent competitive decks" — not "trending". Decide the user-facing label.
3. **Confirm the Algolia API key is acceptable to use.** It's a public read-only key embedded in the Fabrary client bundle, so technically anyone scraping Fabrary already has it — but our use-case is heavier (programmatic ingestion daily). Worth a one-line note in the Phase 1c compliance log alongside the existing Fabrary ToS quoting.
4. **Confirm `archetype` is acceptable as deferred to Phase 2.** The plan made archetype conditional ("when Fabrary provides it"). Algolia does not provide it, so the filter is omitted from Phase 1c. R11's archetype filter ships in Phase 2 only if a different source surfaces it.

## Captured artifacts

- Algolia request from a real Fabrary `/decks?tab=latest` page load:
  ```json
  POST https://4e2ysy5y4i-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=...&x-algolia-api-key=63c7b6aa56d38399d37df3c341b982c3&x-algolia-application-id=4E2YSY5Y4I
  Body: {"requests":[{"indexName":"public_decks","params":"analytics=true&facets=%5B%22format%22%2C%22hasMatchups%22%2C%22hasNotes%22%2C%22hasResults%22%2C%22hasYoutube%22%2C%22heroIdentifier%22%2C%22isPrecon%22%5D&highlightPostTag=__%2Fais-highlight__&highlightPreTag=__ais-highlight__&hitsPerPage=21&maxValuesPerFacet=10&page=0&query=&tagFilters="}]}
  ```
- Sample hit (truncated) — see Part A above.
- Verified `https://fabrary.net/decks/01JZAYPEXAAKT1KAF9RRCQZ17R` → HTTP 200, no redirect.

## Next action

The plan needs an addendum (or a small edit pass) covering items 1-4 above before Unit 1 implementation begins. Nothing in Units 2-7 is blocked by these findings except indirectly through U1's outputs. R27 (Unit 6) and outbound click telemetry (Unit 7) are entirely unaffected — they can proceed in parallel today.
