---
title: "feat: Add variant-aware shopping line with detail-page scraping"
type: feat
status: completed
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-variant-aware-shopping-line-requirements.md
---

# feat: Add variant-aware shopping line with detail-page scraping

## Overview

Extend the Phase 1b shopping line to show variant-level pricing (condition, finish, edition) instead of only listing-level aggregates. The current scraper parses listing pages, which show one price and one quantity per card. In reality, each card has multiple variants on the detail page with vastly different prices (e.g., R$0.35 non-foil vs R$3.90 foil). A user-triggered "Get exact prices" CTA fetches detail pages for missing cards and progressively updates the shopping line with accurate variant data.

## Problem Frame

The shopping line's headline ("With R$ X you close N cards") can be 50-100x off because listing prices conflate cheap non-foil and expensive foil variants. Users who click through to the store discover prices are wildly different, eroding trust in the feature. (see origin: `docs/brainstorms/2026-04-13-variant-aware-shopping-line-requirements.md`)

## Requirements Trace

- R1. Daily bulk scrape unchanged (listing pages only)
- R2. New detail scrape parses in-stock variants from detail pages
- R3. Detail scraping respects rate limit (1.5s) and FetchGuardService
- R4. Variant data persisted with content-based staleness (price + quantity snapshot)
- R5. CTA triggers detail scrape for a deck's missing cards
- R6. Progressive updates via polling (cards update one-by-one)
- R7/R7a. Progress indication + partial failure handling with retry
- R8. Cheapest in-stock variant price replaces listing price
- R9/R10. "Estimated" badge when any card lacks variant data; removed when all detailed
- R11. Collapsed variant breakdown ("N more variants" expandable)
- R12/R12a/R12b. Greedy cheapest-first allocation; partial availability; zero-variant detection
- R13-R15. User-initiated only, 1-hour cooldown, skip already-fresh cards

## Scope Boundaries

- Single store only (Cupula DT) -- multi-store is Phase 2
- No automatic background detail scraping -- all user-triggered
- No cart/checkout integration
- No variant preference persistence (Phase 2 candidate)
- No detail scraping from aggregate home-page shopping line
- Aggregate view remains estimate-only (no "estimated" badge)

## Context & Research

### Relevant Code and Patterns

- **Scraper pattern**: `apps/api/src/stores/sbrauble-scraper.service.ts` -- async generator yielding `IScrapedProduct`, cheerio parsing, rate limit enforcement via `store.rateLimitMs`, all fetches through `FetchGuardService`
- **Ingestion pattern**: `apps/api/src/stores/store-ingestion.service.ts` -- stages products in memory, deduplicates, delta-guard, transactional persist via TypeORM `orUpdate`
- **Shopping line service**: `apps/api/src/stores/shopping-line.service.ts` -- joins breakdown.missing against store_stock, computes totalCostCents as `sum(min(quantityNeeded, quantityAvailable) * unitPriceCents)`
- **Response DTO**: `apps/api/src/stores/dtos/shopping-line.response.dto.ts` -- discriminated union `IShoppingLinePopulated | IShoppingLineUnscraped | IShoppingLineError` with flat `IShoppingLine` per card
- **Frontend component**: `apps/web/src/components/ShoppingLine.tsx` -- renders 6 UI states, uses `IShoppingLineProps { data }`, aria-live headline, freshness color coding
- **Deck detail endpoint**: `GET /api/decks/:deckId` in `apps/api/src/decks/decks.controller.ts` -- calls `ShoppingLineService.computeForBreakdown()`, returns `shoppingLine?` on `IDeckDetailResponse`
- **Frontend API hooks**: `apps/web/src/api/deck-detail.ts` -- TanStack Query hook with queryKey `['decks', deckId]`, no polling configured
- **Admin endpoint pattern**: `apps/api/src/stores/admin/admin-stores.controller.ts` -- `@Public()` + `AdminApiKeyGuard` + `@Throttle()`, fire-and-forget scrape
- **Migration pattern**: `apps/api/src/database/migrations/` -- `{timestamp}-{PascalCase}.ts`, TypeORM `MigrationInterface`
- **Fixture testing**: `apps/api/src/stores/__fixtures__/` -- real HTML fixtures for scraper tests
- **Detail page fixture (VERIFIED)**: `apps/api/src/stores/__fixtures__/cupula-dt-detail-page.html` -- real Cupula DT page with 3 variants; CSS selectors: `.table-cards-row` for rows, `span.siglaEdicao` for edition, `.card-preco` for price, `"N unid."` for stock, extras text for foil

### Institutional Learnings

- **Compliance**: Liga FaB Section 17 IP clause applies equally to detail pages. Same mitigation as listing scraping (robots.txt permits `/?view=ecom/*`, non-commercial use, kill-switch protocol). No additional escalation needed.
- **Card name matcher reuse**: Detail pages are fetched via `store_stock.productUrl` which already has a matched `cardIdentifier`. No need to re-run the matcher -- the variant rows inherit the card identity from the listing row.
- **LISTING_PATH_REGEX is listing-only**: The `SbraubleScraperService` validates listing paths with a strict regex. Detail page URLs (from `store_stock.productUrl`) follow a different pattern. The detail scraper must NOT apply `LISTING_PATH_REGEX` -- it should rely on the already-validated productUrl.
- **Rate limit is process-level**: `store.lastFetchedAt` tracks the last outbound fetch. Both bulk scrape and detail scrape share this timestamp. If a bulk scrape runs concurrently with a user's detail fetch, they will coordinate via the same rate limit check.

## Key Technical Decisions

- **Separate `store_stock_variant` table** over JSONB or expanded rows: Clean separation between listing data (bulk scrape) and detail data (user-triggered). The existing `store_stock` table and ingestion service remain untouched (R1). ShoppingLineService queries both tables and merges at read time. Trade-off: extra join, but the join is on (storeId, cardIdentifier) which is already indexed.

- **Content-based staleness via snapshot columns**: Each variant row stores `listingPriceCentsSnapshot` and `listingQuantitySnapshot` -- the listing row's values at detail-fetch time. At read time, if `store_stock.priceCents != snapshot` or `store_stock.quantity != snapshot`, variant data is considered stale and falls back to listing estimate. This avoids invalidating all variants on every daily scrape.

- **Fire-and-forget + polling over SSE**: No SSE/WebSocket infrastructure exists. The POST endpoint starts the detail scrape as an async operation (not awaited) and returns 202 immediately. An in-memory progress tracker keyed by **deckId** (not fetchId) records per-card completion, so `GET /decks/:deckId` can look it up without needing the fetchId. The frontend polls the deck detail endpoint at 3-second intervals with explicit stop conditions including the pod-restart case (`variantFetchProgress` absent) and a 5-minute safety timeout. The async loop is wrapped in top-level try/catch/finally to prevent unhandled-rejection process crashes. A concurrent-fetch Set prevents duplicate loops for the same deck when the user double-clicks. Progress entries are cleaned up 5 minutes after completion with an LRU cap of 100 entries.

- **Data-driven cooldown over explicit tracking table**: The cooldown check queries variant rows: if all missing cards for this deck have `detailFetchedAt` within 1 hour, the fetch is skipped. No separate tracking table. Natural benefit: new cards added to a deck won't have variant data, so the CTA activates for them.

- **Variant rows carry `productUrl` from listing row**: The detail page is fetched using `store_stock.productUrl`. Each variant row in `store_stock_variant` inherits this same URL (since all variants share the same detail page). This keeps S10 validation consistent.

- **Rate limit coordination via database, not in-memory entity**: The existing `SbraubleScraperService.enforceRateLimit` reads from and mutates an in-memory `StoreEntity` copy. If two services load their own entity copies, they cannot coordinate through memory. The `VariantFetchService` re-reads `store.lastFetchedAt` from the database before each card fetch and writes back `now` immediately after. This trades one lightweight SELECT per card for correct coordination with any concurrent bulk scrape. Daily bulk scrape runs at 04:00 (low user activity) so true concurrency is rare, but the coordination claim must be backed by implementation.

- **Atomic upsert over delete-then-insert**: Each card's variant rows are persisted via TypeORM's `.insert().orUpdate()` on the composite unique index `(storeId, cardIdentifier, edition, condition, finish)`. A separate DELETE (within the same transaction) removes rows for variants that disappeared since the last fetch. This is wrapped in `dataSource.transaction()` per card -- if any step fails, the prior variant data remains intact. The previous "delete-then-insert" pattern risked losing data if the insert failed after the delete.

- **Per-card cost uses `lineCostCents` not `unitPriceCents * quantity`**: With variant data, a card's copies can span multiple price tiers (e.g., 1 non-foil + 2 foil). The `unitPriceCents * quantityAvailable` formula undercounts the total. A new `lineCostCents` field holds the greedy-allocated total per card. The headline `totalCostCents` sums `lineCostCents` across lines. `unitPriceCents` remains as a display field showing the cheapest variant price.

## Open Questions

### Resolved During Planning

- **Schema design**: Separate `store_stock_variant` table with content-based staleness snapshots. See Key Technical Decisions.
- **Progressive update mechanism**: Fire-and-forget POST + 3s polling on deck detail. See Key Technical Decisions.
- **Cooldown implementation**: Data-driven (check `detailFetchedAt` on variant rows). See Key Technical Decisions.
- **Detail page URL validation**: Reuse `store_stock.productUrl` (already S10-validated at write time). No new regex needed.
- **Persistence semantics**: Atomic upsert on composite unique index within a transaction, not delete-then-insert. See Key Technical Decisions.
- **Cost computation**: New `lineCostCents` field per line; `totalCostCents` sums line-level costs. `unitPriceCents` remains as display-only. See Key Technical Decisions.
- **Progress tracker keying**: Keyed by `deckId` (not `fetchId`) so `GET /decks/:deckId` can look up progress without needing fetchId round-trip.
- **Rate limit coordination**: DB-based (re-read `store.lastFetchedAt` per card), not in-memory entity mutation. See Key Technical Decisions.
- **Concurrent-fetch guard**: In-memory Set of active deckIds prevents duplicate async loops on double-click.
- **Unhandled-rejection safety**: Top-level try/catch/finally around the orchestration loop + `.catch()` at call site.
- **Progress cleanup**: 5-minute TTL via `setTimeout` + 100-entry LRU cap; timers cleared in `onModuleDestroy`.
- **Aggregate DTO scope**: Variant fields apply only to `IShoppingLinePopulated` (deck detail). `IShoppingLineAggregate` is unchanged.
- **Verified-zero discrimination**: Explicit `verificationStatus` enum on IShoppingLine (`'never_checked' | 'verified_zero'`) instead of inferring from variant array.

### Deferred to Implementation

- Exact cheerio selector refinement may need adjustment after testing against more detail page variations
- Whether `condition` and `finish` should be enums or free-text varchars (start with varchars, normalize during parsing -- trim whitespace, uppercase condition codes)
- Whether "Retry failed" button re-fetches only failed cards or the entire deck (UX decision; affects VariantFetchService.startFetch signature if per-card retry is needed)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
sequenceDiagram
    participant User
    participant Web as Frontend (React)
    participant API as NestJS API
    participant DB as PostgreSQL
    participant Store as Cupula DT

    User->>Web: Click "Get exact prices"
    Web->>API: POST /decks/:id/fetch-variants
    API->>API: Check concurrent-fetch Set (no duplicate spawn)
    API->>DB: Check cooldown (variant rows freshness)
    API->>API: Register deckId in progress Map + Set
    API-->>Web: 202 Accepted { fetchId, total: 12, status: 'started' }
    Web->>Web: Enable polling (refetchInterval: 3s, stop conditions)

    loop For each missing card (async, fire-and-forget with top-level try/catch)
        API->>DB: SELECT store.lastFetchedAt (coordinate rate limit)
        API->>API: Sleep if elapsed < rateLimitMs
        API->>Store: GET detail page (via FetchGuard)
        API->>DB: UPDATE store.lastFetchedAt = now
        Store-->>API: HTML with variant table
        API->>API: Parse variants (cheerio)
        API->>DB: Transaction { upsert + delete-missing store_stock_variant rows }
        API->>API: Update progress Map[deckId]
    end

    API->>API: setTimeout(5min) to evict progress entry

    loop Polling (every 3s, stops on: absent progress | !inProgress | !isEstimated | 5min timeout)
        Web->>API: GET /decks/:id
        API->>API: Lookup progress Map[deckId]
        API->>DB: Query store_stock + store_stock_variant
        API->>API: Merge: cheapest-variant (if fresh) or listing fallback; compute lineCostCents
        API-->>Web: Deck detail with updated shopping line + progress
        Web->>Web: Update UI (progressive reveal per card)
    end

    Web->>Web: All cards detailed → remove "estimated" badge, stop polling
```

## Implementation Units

- [ ] **Unit 1: store_stock_variant entity and migration**

**Goal:** Create the database table for variant-level stock data.

**Requirements:** R2, R4

**Dependencies:** None

**Files:**
- Create: `apps/api/src/database/entities/store-stock-variant.entity.ts`
- Create: `apps/api/src/database/migrations/{timestamp}-AddStoreStockVariant.ts`
- Modify: `apps/api/src/stores/stores.module.ts` (register entity)
- Test: `apps/api/src/stores/__tests__/store-stock-variant.entity.spec.ts`

**Approach:**
- Table `store_stock_variant` with columns: `id` (PK), `storeId` (FK to store), `cardIdentifier` (varchar 150), `edition` (varchar 50), `condition` (varchar 50), `finish` (varchar 50), `priceCents` (int), `quantity` (int), `detailFetchedAt` (timestamptz), `listingPriceCentsSnapshot` (int nullable), `listingQuantitySnapshot` (int)
- Composite unique index on `(storeId, cardIdentifier, edition, condition, finish)` to enable upsert
- Non-unique index on `(storeId, cardIdentifier)` for efficient per-card variant lookups
- FK cascade on storeId (consistent with StoreStockEntity)
- No FK to store_stock -- variant rows reference cards conceptually but are persisted independently

**Patterns to follow:**
- `apps/api/src/database/entities/store-stock.entity.ts` for entity structure
- `apps/api/src/database/migrations/1744329600000-AddStoreTables.ts` for migration structure

**Test scenarios:**
- Happy path: entity can be created and saved with all required fields
- Happy path: composite unique constraint prevents duplicate (storeId, cardIdentifier, edition, condition, finish) rows
- Edge case: nullable listingPriceCentsSnapshot is accepted (for "Sob consulta" cards)
- Edge case: cascade delete -- deleting a store removes all associated variant rows

**Verification:**
- Migration runs cleanly up and down
- Entity is registered in StoresModule
- Unique index enforces the composite key

---

- [ ] **Unit 2: Detail page parser (SbraubleDetailParserService)**

**Goal:** Parse a Sbrauble detail page HTML into structured variant records.

**Requirements:** R2

**Dependencies:** None (Unit 2 creates its own `IScrapedVariant` type in `types/scraped-variant.ts`)

**Files:**
- Create: `apps/api/src/stores/sbrauble-detail-parser.service.ts`
- Create: `apps/api/src/stores/types/scraped-variant.ts`
- Create: `apps/api/src/stores/utils/price-stock-parsers.ts` (extract shared parsePriceCents + parseQuantity)
- Modify: `apps/api/src/stores/sbrauble-scraper.service.ts` (import parsers from shared utility)
- Create: `apps/api/src/stores/__tests__/sbrauble-detail-parser.service.spec.ts`

**Execution note:** Fixture-driven development. Write tests against `cupula-dt-detail-page.html` first, then build the parser to pass them.

**Approach:**
- New `IScrapedVariant` interface: `{ edition, condition, finish, priceCents, quantity }`
- Service method: `parseDetailPage(html: string): IScrapedVariant[]`
- Select `.table-cards-row` elements, extract from each row:
  - Edition: text from `span.siglaEdicao` (e.g., "HVY", "U-MON")
  - Condition: text content of the quality cell (e.g., "NM", "LP")
  - Finish: text from extras cell ("-" → "non-foil", "Foil" → "foil")
  - Stock: parse "N unid." pattern (reuse existing regex from listing scraper)
  - Price: parse "R$ X,XX" pattern from `.card-preco` (reuse existing `parsePriceCents` logic)
- Filter out rows where quantity = 0 or price is unavailable
- No database writes -- pure parsing, same pattern as `SbraubleScraperService.parsePage()`

**Patterns to follow:**
- `apps/api/src/stores/sbrauble-scraper.service.ts` `parsePage()` method for cheerio parsing patterns
- Reuse `parsePriceCents()` and `parseQuantity()` logic (extract to shared utility or import)

**Test scenarios:**
- Happy path: parse the 3-variant fixture (`cupula-dt-detail-page.html`) and verify edition (HVY, U-MON, U-MON), condition (NM, NM, NM), finish (non-foil, non-foil, foil), prices (20, 20, 200 cents), quantities (72, 39, 2)
- Edge case: detail page with zero in-stock variants returns empty array
- Edge case: variant with "Sob consulta" or "Esgotado" is excluded
- Edge case: variant with unknown condition text (e.g., "HP") is parsed as-is (free-text, no enum validation)
- Error path: malformed HTML (missing `.table-cards-row`) returns empty array with warning log
- Error path: unparseable price throws ScraperError (consistent with listing scraper behavior)

**Verification:**
- All fixture-based tests pass
- Parser extracts correct variant data from the real Cupula DT fixture

---

- [ ] **Unit 3: Variant fetch orchestrator (VariantFetchService)**

**Goal:** Coordinate detail-page fetching for a set of cards, persisting variant data as each card completes.

**Requirements:** R2, R3, R4, R7a, R13, R14, R15

**Dependencies:** Unit 1 (entity), Unit 2 (parser)

**Files:**
- Create: `apps/api/src/stores/variant-fetch.service.ts`
- Create: `apps/api/src/stores/types/variant-fetch-progress.ts`
- Create: `apps/api/src/stores/__tests__/variant-fetch.service.spec.ts`
- Modify: `apps/api/src/stores/stores.module.ts` (register service)

**Approach:**
- Main method: `startFetch(deckId, storeId, cards: Array<{ cardIdentifier, productUrl, listingPriceCents, listingQuantity }>): string` -- returns a fetchId (generated via `crypto.randomUUID()`), starts async processing
- **Concurrent fetch guard:** Maintain `Set<deckId>` of active fetches. If `startFetch` is called for a deck already fetching, return the existing fetchId and do NOT spawn a new async loop. Prevents double-click duplication.
- For each card in sequence (respecting rate limit):
  1. **Re-read** `store.lastFetchedAt` from database (not in-memory entity) and enforce rate limit via `setTimeout`
  2. Fetch detail page HTML via `FetchGuardService.guardedFetch(productUrl, { allowHosts: [storeHostname] })`
  3. Persist `now` to `store.lastFetchedAt` in DB
  4. Parse with `SbraubleDetailParserService.parseDetailPage(html)`
  5. **Upsert variant rows atomically**: use TypeORM `.insert().orUpdate()` on composite unique index `(storeId, cardIdentifier, edition, condition, finish)` with updated columns (priceCents, quantity, detailFetchedAt, listing snapshots). Delete rows matching `(storeId, cardIdentifier)` that are NOT in the current detail page result (e.g., variant that disappeared from the store). All inside `dataSource.transaction()`.
  6. Update in-memory progress tracker
- **Unhandled rejection safety:** The entire orchestration loop is wrapped in a top-level `try/catch/finally`. On unhandled error, mark the fetch as `globalFailed` in progress tracker and log. The `finally` block removes the deckId from the concurrent-fetch Set and schedules progress cleanup. The fire-and-forget call site also attaches `.catch(err => logger.error(...))` as a belt-and-suspenders guard.
- On per-card failure: log error, mark card as failed in progress, continue to next card (R7a). Per-card try/catch does NOT abort the loop.
- **In-memory progress tracker**: `Map<deckId, IVariantFetchProgress>` keyed by **deckId** (not fetchId) so GET /decks/:deckId can look it up directly. `fetchId` is still generated and returned to the POST caller for client correlation but stored inside the progress record: `{ fetchId, total, completed, failed, inProgress, startedAt, cards: Map<cardIdentifier, 'pending' | 'done' | 'failed'> }`.
- **Progress cleanup**: On fetch completion (success or globalFailed), schedule `setTimeout(() => progressMap.delete(deckId), 5 * 60 * 1000)`. Timer is cleared in `onModuleDestroy` to avoid dangling timers in tests. Max map size cap of 100 entries with LRU eviction as safety net.
- Rate limit: **NOT** the in-memory `enforceRateLimit` pattern from SbraubleScraperService (which reads from a mutated in-memory entity and does not coordinate across services). Instead, re-read `store.lastFetchedAt` from the database before each card fetch and update it immediately after. This guarantees coordination with the bulk scrape process.
- Cooldown check method: `isFreshForDeck(storeId, cardIdentifiers): Promise<boolean>` -- queries variant rows where `detailFetchedAt > now - 1 hour` for all given cards; returns true if ALL cards have fresh data. **Also checks the concurrent-fetch Set**: if a fetch is already in progress for this deck, returns a distinct `{ inProgress: true }` result so the endpoint can return 409/202 with the existing fetchId instead of spawning a duplicate.

**Patterns to follow:**
- `apps/api/src/stores/sbrauble-scraper.service.ts` for rate limit enforcement
- `apps/api/src/stores/store-ingestion.service.ts` for transactional upsert pattern

**Test scenarios:**
- Happy path: fetch 3 cards, all succeed, progress shows 3/3 completed, variant rows persisted
- Happy path: listing snapshot values correctly captured on variant rows
- Happy path: upsert on second fetch of same card updates existing variant rows (no duplicates) via composite unique index
- Edge case: card with zero in-stock variants on detail page → no variant rows persisted, card marked as 'done' (not 'failed')
- Edge case: card that previously had 3 variants now has 2 → the removed variant's row is deleted within the same transaction
- Error path: one card's fetch fails (network error) → other cards still processed, failed card marked in progress, variant data from successful cards persisted
- Error path: parse failure on one card → same as above, graceful continuation
- Error path: insert fails mid-transaction → transaction rolls back, existing variant rows for that card remain unchanged (no data loss)
- Error path: unexpected error in orchestration loop (e.g., DB connection drop) → fetch marked as globalFailed, deckId removed from concurrent-fetch Set, process does NOT crash
- Integration: rate limit respected between consecutive card fetches (store.lastFetchedAt re-read from DB, not in-memory)
- Integration: concurrent bulk scrape + detail fetch share rate limit via DB (simulate bulk scrape updating lastFetchedAt mid-detail-fetch; verify detail fetch waits appropriately)
- Happy path: cooldown check returns true when all cards have fresh variant data
- Happy path: cooldown check returns false when any card lacks variant data or data is older than 1 hour
- Edge case: second startFetch call for a deck with fetch already in progress returns existing fetchId (no duplicate async loop spawned)
- Edge case: progress entry is removed from Map 5 minutes after completion via setTimeout; timer cleared on onModuleDestroy
- Edge case: progress Map size capped at 100 entries with LRU eviction (oldest completed entries dropped first)

**Verification:**
- Variant rows are persisted per-card as the fetch progresses (not batched at the end)
- Failed cards do not block subsequent cards
- Progress tracker accurately reflects completion state

---

- [ ] **Unit 4: Shopping line service variant integration**

**Goal:** Update ShoppingLineService to use variant data when available, with greedy cheapest-first allocation and estimated badge logic.

**Requirements:** R8, R9, R10, R12, R12a, R12b

**Dependencies:** Unit 1 (entity for querying variants)

**Files:**
- Modify: `apps/api/src/stores/shopping-line.service.ts`
- Modify: `apps/api/src/stores/__tests__/shopping-line.service.spec.ts`

**Approach:**
- In `computeForBreakdown()`, after loading `stockRows` from `store_stock`, also load variant rows from `store_stock_variant` for the same (storeId, cardIdentifiers)
- For each card, determine data source:
  - If variant rows exist AND are fresh (staleness check below passes): use variant data
  - Otherwise: use listing data (fallback)
- **Staleness check (content-based with tolerance):** variant data is fresh when `listingPriceCentsSnapshot == store_stock.priceCents AND listingQuantitySnapshot == store_stock.quantity`. Strict equality is used (not a tolerance threshold) because: (a) price changes are infrequent on this store, (b) tolerance introduces hidden inaccuracy, (c) the user can re-trigger fetch via the CTA to refresh. When stale, the card falls back to listing estimate AND the CTA becomes active again for this deck (because `isFreshForDeck` returns false).
- **Greedy cheapest-first allocation**: Sort variants by priceCents ascending; fill quantityNeeded from cheapest variant first, spill to next variant when cheapest is exhausted. Compute `lineCostCents` as sum of (allocated quantity * variant price) -- this is a new field distinct from `unitPriceCents * quantityAvailable`.
- **DTO semantic change for cost computation:** The existing `totalCostCents = sum(quantityAvailable * unitPriceCents)` formula is WRONG for variant-allocated cards because allocation can span multiple price tiers. Replace with `totalCostCents = sum(line.lineCostCents)` where `lineCostCents` is:
  - For variant lines: result of greedy allocation (e.g., 1*35 + 2*350 = 735)
  - For listing lines: `quantityAvailable * unitPriceCents` (backward compatible)
  - `unitPriceCents` on IShoppingLine remains the cheapest variant price (or listing price) for display, but is NOT used for cost rollup anymore.
- Track `hasVariantData` per line and `isEstimated` on the response (true if any line lacks variant data)
- Handle R12a: if total variant quantity < quantityNeeded, card is "partially available"
- Handle R12b: if variant data exists but all variants have quantity 0, card gets explicit `verificationStatus: 'verified_zero'`. Cards without variant data are implicitly `'never_checked'` (field absent or `'never_checked'`). This is a discriminator field on IShoppingLine so the frontend can render distinct states without inferring from `variants.length`.

**Patterns to follow:**
- Existing `buildLine()` and `buildLines()` private methods for line construction
- Existing `sortLines()` for deterministic ordering

**Test scenarios:**
- Happy path: card with 3 variants, need 2 copies → allocates from cheapest variant first, correct totalCostCents
- Happy path: worked example from R12 — need 3, variant A has 1 at 35 cents, variant B has 2 at 350 cents → cost = 35 + 700 = 735 cents
- Happy path: all cards have fresh variants → isEstimated = false
- Happy path: mix of variant and listing data → isEstimated = true, variant cards use variant prices, listing cards use listing prices
- Edge case: variant data exists but is stale (listing price changed) → falls back to listing price for that card
- Edge case: R12a — need 3 copies, total variant quantity = 1 → partially available, quantityAvailable = 1, cost = 1 * cheapest price
- Edge case: R12b — variant data exists with zero total quantity → card status "unavailable (verified)"
- Edge case: card has variant data but all variants are null priceCents → falls back to listing data
- Integration: totalCostCents sums correctly across a mix of variant-allocated and listing-estimated cards
- Happy path (regression): when no variant data exists for any card, shopping line behavior is identical to pre-variant implementation -- totalCostCents uses listing prices, isEstimated = true, no new fields populated. Verifies backward compatibility claim.
- Happy path: `lineCostCents` field is populated for both variant and listing cards (uniform response shape)
- Edge case: multi-tier allocation -- need 5 copies; variant A has 2 at 10c, variant B has 1 at 50c, variant C has 3 at 100c → allocates 2@10 + 1@50 + 2@100 = 270c, quantityAvailable = 5, verificationStatus absent
- Edge case: verified_zero -- card has variant rows but all quantities are 0 → `verificationStatus: 'verified_zero'`, lineCostCents = 0, quantityAvailable = 0

**Verification:**
- Shopping line response correctly reflects variant data when available
- Headline totalCostCents matches greedy cheapest-first allocation
- isEstimated flag is accurate

---

- [ ] **Unit 5: API endpoint and response DTO evolution**

**Goal:** Add the variant fetch trigger endpoint and extend the shopping line response to include variant data and fetch progress.

**Requirements:** R5, R6, R7, R9, R11, R15

**Dependencies:** Unit 3 (VariantFetchService), Unit 4 (updated ShoppingLineService)

**Files:**
- Create: `apps/api/src/decks/variant-fetch.controller.ts` (or add to existing decks controller)
- Modify: `apps/api/src/stores/dtos/shopping-line.response.dto.ts`
- Modify: `apps/api/src/decks/decks.controller.ts` (include progress in response)
- Modify: `apps/api/src/decks/decks.service.ts` (pass progress to response)
- Create: `apps/api/src/decks/__tests__/variant-fetch.controller.e2e-spec.ts`

**Approach:**
- **New endpoint**: `POST /api/decks/:deckId/fetch-variants`
  - Guarded by `OwnsTrackedDeckGuard` (same as deck detail) + `ThrottlerGuard`
  - Loads the deck's latest snapshot → extracts missing cardIdentifiers
  - Queries store_stock for these cards → gets productUrls
  - Calls `VariantFetchService.getProgress(deckId)` — if a fetch is already in progress for this deck, return 202 with the existing fetchId (no duplicate spawn)
  - Calls `VariantFetchService.isFreshForDeck()` for cooldown check → if fresh, return 200 with "already up to date"
  - Calls `VariantFetchService.startFetch(deckId, storeId, cards)` → fire-and-forget, return 202 with `{ fetchId, total, status: 'started' }`
- **DTO evolution (deck-detail only)**:
  - Add `IShoppingLineVariant` interface: `{ edition, condition, finish, priceCents, quantity }`
  - Add `EVariantVerificationStatus` enum: `'never_checked' | 'verified_zero'`
  - Extend `IShoppingLine` with new fields: `variants?: readonly IShoppingLineVariant[]`, `hasVariantData: boolean`, `dataSource: 'listing' | 'variant'`, `lineCostCents: number`, `verificationStatus?: EVariantVerificationStatus`
  - Extend `IShoppingLinePopulated` with: `isEstimated: boolean`, `variantFetchProgress?: IVariantFetchProgressDto`
  - `IVariantFetchProgressDto`: `{ fetchId: string, total: number, completed: number, failed: number, inProgress: boolean }`
- **Aggregate scope (explicit)**: The new fields (`variants`, `hasVariantData`, `verificationStatus`, `variantFetchProgress`, `isEstimated`) apply ONLY to `IShoppingLinePopulated` used in deck detail responses. `IShoppingLineAggregate` (home-page) is NOT extended and remains a listing-level summary. This is encoded by keeping the two interfaces independent -- no shared base type adds variant fields.
- **Deck detail integration**: `DecksService.getDetail()` calls `VariantFetchService.getProgress(deckId)` (keyed by **deckId**, not fetchId) to retrieve any active fetch state. If progress exists, include it in `shoppingLine.variantFetchProgress`. This removes the need for the frontend to pass fetchId on polls.

**Patterns to follow:**
- `apps/api/src/stores/admin/admin-stores.controller.ts` for endpoint with guard + throttle pattern
- `apps/api/src/decks/decks.controller.ts` for deck-scoped endpoints with `OwnsTrackedDeckGuard`

**Test scenarios:**
- Happy path: POST triggers variant fetch, returns 202 with card count
- Happy path: POST when all cards already have fresh variants → returns 200 "already fresh"
- Error path: POST for deck user doesn't own → 403
- Error path: POST for deck with no missing cards → 200 "nothing to fetch"
- Happy path: GET deck detail includes variantFetchProgress when a fetch is active
- Happy path: GET deck detail returns isEstimated=true when mix of data sources
- Edge case: GET deck detail after fetch completes → no progress field, variant data reflected
- Happy path: second POST for same deck while first is still running returns 202 with the existing fetchId (no duplicate async loop)
- Happy path (regression): GET /api/decks (aggregate list) response does NOT include `variants`, `hasVariantData`, `variantFetchProgress`, or `isEstimated` on any shoppingLine field -- aggregate responses remain listing-level only
- Edge case: authenticated user B tries POST on user A's deck → 403 (OwnsTrackedDeckGuard enforced)

**Verification:**
- Endpoint correctly validates ownership and cooldown
- Response DTO includes variant data and progress metadata
- Existing deck detail response remains backward-compatible (new fields are optional)

---

- [ ] **Unit 6: Frontend - estimated badge, CTA, and polling**

**Goal:** Add the "estimated" badge to the shopping line headline, the "Get exact prices" CTA button, and implement polling during variant fetch.

**Requirements:** R5, R6, R7, R9, R10, R15

**Dependencies:** Unit 5 (API endpoint and DTO)

**Files:**
- Create: `apps/web/src/api/variant-fetch.ts` (mutation hook)
- Modify: `apps/web/src/api/deck-detail.ts` (add refetchInterval support)
- Modify: `apps/web/src/components/ShoppingLine.tsx` (badge, CTA, polling logic)
- Create: `apps/web/src/components/__tests__/shopping-line-variants.test.tsx`

**Approach:**
- **Mutation hook**: `useVariantFetchMutation(deckId)` -- POST to `/decks/:deckId/fetch-variants`, on success enable polling
- **Polling**: When variant fetch is active, set `refetchInterval: 3000` on the deck detail query via TanStack Query's dynamic `refetchInterval` option. Polling stop conditions (any of the following halts polling):
  1. `variantFetchProgress` is absent/undefined (pod restart, fetch completed and cleaned up, or never started)
  2. `variantFetchProgress.inProgress === false`
  3. `isEstimated === false` (all cards have variants)
  4. Polling has been active for more than 5 minutes (hard timeout safety net against runaway polls)
  Note: the `undefined` check is critical -- if the pod restarts, `variantFetchProgress` will be absent on the next poll, NOT set to `{ inProgress: false }`. Without this explicit check, polling could continue indefinitely.
- **Estimated badge**: When `shoppingLine.isEstimated === true`, render a subtle badge next to the headline total (e.g., "~R$ 12 [estimated]"). Use the tilde prefix on the price for visual clarity.
- **CTA button**: Below the shopping line, render "Get exact prices" button. Disabled during cooldown with "Last checked N min ago" text. On click, trigger mutation → replace CTA with progress indicator.
- **Progress indicator**: "Checking card 3 of 12..." derived from `variantFetchProgress.completed / variantFetchProgress.total`. Show retry button if `variantFetchProgress.failed > 0`.
- **Per-card states during fetch**: Cards update from "~R$ 0.25" to "R$ 0.35 (NM)" as each detail page completes. Cards currently being fetched show a subtle loading indicator.

**Patterns to follow:**
- `apps/web/src/api/decks.ts` `useImportDecksMutation()` for mutation + invalidation pattern
- `apps/web/src/components/ShoppingLine.tsx` existing state handling and aria-live patterns

**Test scenarios:**
- Happy path: CTA renders when isEstimated is true
- Happy path: clicking CTA triggers mutation and shows progress indicator
- Happy path: estimated badge appears with listing-only data, disappears after all cards have variants
- Edge case: CTA is disabled during cooldown with "last checked" text
- Edge case: progress shows "Checking card 3 of 12..." during fetch
- Error path: partial failure shows "8 of 12 updated" with retry button
- Happy path: polling stops when fetch completes (inProgress === false)
- Edge case: polling stops when `variantFetchProgress` is absent from response (simulates pod restart mid-fetch)
- Edge case: polling stops after 5-minute safety timeout even if response never signals completion

**Verification:**
- CTA triggers variant fetch and shows progress
- Polling updates the UI as variant data arrives
- Estimated badge correctly reflects data completeness

---

- [ ] **Unit 7: Frontend - variant breakdown display**

**Goal:** Show the expandable variant breakdown per card line and handle the new card states (partially available, verified unavailable).

**Requirements:** R11, R12a, R12b

**Dependencies:** Unit 6 (CTA and polling infrastructure)

**Files:**
- Modify: `apps/web/src/components/ShoppingLine.tsx` (variant display, new states)
- Modify: `apps/web/src/components/__tests__/shopping-line-variants.test.tsx`

**Approach:**
- **Cheapest variant as primary**: When `line.hasVariantData === true`, show the cheapest variant's price as the main price. Format: "R$ 0,35 (NM)" instead of "~R$ 0,25".
- **"N more variants" expandable**: If `line.variants.length > 1`, show a "N more variants" link that expands to reveal all variants in a sub-table (edition, condition, finish, price, quantity per row). Collapsed by default.
- **Partially available (R12a)**: When `quantityAvailable < quantityNeeded` and variant data exists, show "1 of 3 copies available" with the partial cost.
- **Verified unavailable (R12b)**: When variant data exists but shows zero total quantity, distinguish from never-available: render "Out of stock (verified)" vs "Unavailable".
- **Per-card error indicator (R7a)**: Failed-fetch cards show a warning icon and retain listing estimate. "Retry failed" action re-triggers fetch for just that card (or the whole batch).

**Patterns to follow:**
- Existing `LineItem()` component in `ShoppingLine.tsx` for card row rendering
- Existing muted styling (opacity 0.6) for unavailable cards

**Test scenarios:**
- Happy path: card with variant data shows cheapest variant price as primary
- Happy path: "2 more variants" link expands to show full breakdown table
- Happy path: single-variant card shows variant price directly, no expand link
- Edge case: partially available card shows "1 of 3 copies available"
- Edge case: verified-unavailable card shows "Out of stock (verified)"
- Edge case: failed-fetch card shows warning icon with listing estimate
- Happy path: variant breakdown table shows edition, condition, finish, price, quantity per row

**Verification:**
- Variant breakdown is collapsed by default and expandable
- Card states (partially available, verified unavailable) render correctly
- Failed-fetch cards degrade gracefully to listing estimates

## System-Wide Impact

- **Interaction graph**: `POST /decks/:deckId/fetch-variants` → `VariantFetchService.startFetch()` → `FetchGuardService.guardedFetch()` per card → `SbraubleDetailParserService.parseDetailPage()` → upsert `store_stock_variant` rows. `GET /decks/:deckId` → `ShoppingLineService.computeForBreakdown()` now queries both `store_stock` and `store_stock_variant` and merges at read time.
- **Error propagation**: Per-card fetch failures are isolated inside a per-card try/catch (R7a); a failed card does not block others. Unhandled errors in the outer orchestration loop are caught by a top-level try/catch/finally that marks the fetch as `globalFailed` and cleans up the concurrent-fetch Set -- the process does NOT crash on a fire-and-forget unhandled rejection. The shopping line degrades gracefully to listing-level estimates for failed cards.
- **State lifecycle risks**: In-memory progress tracker is lost on pod restart. Acceptable for single-instance Railway deployment. The variant data in the database is durable -- only the progress display is affected. A restarted pod has no active fetch progress; the frontend must explicitly check for absent/undefined `variantFetchProgress` (not just `inProgress === false`) to stop polling. A 5-minute polling safety timeout prevents runaway polls. Atomic upsert inside a transaction guarantees variant data is never lost mid-persist (no delete-then-insert window).
- **API surface parity**: The deck detail response gains optional fields (`variants`, `hasVariantData`, `isEstimated`, `variantFetchProgress`). These are additive and non-breaking. Existing frontend code that doesn't know about variants continues to work (shows listing-level data as before).
- **Unchanged invariants**: The daily bulk scrape pipeline (SbraubleScraperService → StoreIngestionService → store_stock) is completely unchanged. The Phase 1a engine (tier 1 + tier 2 substitution) is unchanged. The aggregate shopping line computation is unchanged (uses listing data only, no variant integration). The FetchGuardService allow-list mechanism is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Detail page HTML structure changes (Sbrauble platform update) | Fixture-driven tests will catch regressions. Parser errors are logged and per-card (one broken page doesn't break others). Same risk profile as listing scraper. |
| Concurrent bulk scrape + user detail fetch doubles request rate | Rate limit is coordinated via the database (re-read `store.lastFetchedAt` per card instead of in-memory entity). The daily scrape runs at 04:00 (low user activity). Integration test verifies the coordination. |
| In-memory progress tracker lost on pod restart | Variant data persists in DB via atomic upsert transactions. Only the progress UI is affected. Frontend explicitly handles absent `variantFetchProgress` as a stop condition (not just `inProgress === false`) and has a 5-minute polling safety timeout. |
| Fire-and-forget async loop crashes process on unhandled rejection | Entire orchestration loop wrapped in top-level try/catch/finally. Call site also attaches `.catch()` as belt-and-suspenders. Progress is marked `globalFailed` on unexpected errors. Covered by explicit test scenario. |
| Double-click on CTA spawns duplicate fetch loops | Concurrent-fetch `Set<deckId>` check before `startFetch` spawns the async loop. Second call returns the existing fetchId with 202. |
| In-memory progress Map grows unbounded over time | Each fetch registers a 5-minute TTL via `setTimeout` that removes the entry from the Map. LRU cap of 100 entries as additional safety. Timers cleared in `onModuleDestroy`. |
| Variant data grows unbounded | Detail scraping is user-initiated (not automatic). At ~5-15 variants per card, ~500-1000 cards in a store, worst case is ~5000-15000 rows -- trivial for Postgres. |
| Content-based staleness check causes unnecessary re-fetches when price fluctuates between scrapes | The daily scrape updates listing price. If price changes back and forth, variants will be invalidated. Acceptable trade-off: price fluctuation = genuine change worth re-checking. |
| User triggers fetch for a deck with 50+ missing cards (atypical) | At 1.5s per card, this takes ~75 seconds. The progress indicator keeps the user informed. The fire-and-forget model means the user can navigate away. No timeout on the server-side fetch loop. |

## Documentation / Operational Notes

- No new env vars required. Detail scraping reuses existing `FetchGuardService` and store configuration.
- The `POST /decks/:deckId/fetch-variants` endpoint is authenticated (JWT) and throttled (global ThrottlerGuard). No admin key needed -- it's a user-facing action.
- To manually inspect variant data: `SELECT * FROM store_stock_variant WHERE cardIdentifier = 'card-id' ORDER BY priceCents ASC;`
- To check staleness: compare `listingPriceCentsSnapshot` against `store_stock.priceCents` for the same card.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-13-variant-aware-shopping-line-requirements.md](docs/brainstorms/2026-04-13-variant-aware-shopping-line-requirements.md)
- **Phase 1b plan:** [docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md](docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md)
- **Detail page fixture:** `apps/api/src/stores/__fixtures__/cupula-dt-detail-page.html`
- **Compliance log:** `docs/research/phase-1b-compliance-log.md`
