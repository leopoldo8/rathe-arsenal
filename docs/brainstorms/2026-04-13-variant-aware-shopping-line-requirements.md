---
date: 2026-04-13
topic: variant-aware-shopping-line
---

# Variant-Aware Shopping Line

## Problem Frame

The current store scraper only parses Sbrauble listing pages, which show one aggregated price and quantity per card. In reality, each card has multiple variants on the detail page -- separated by condition (Near Mint, Lightly Played, etc.) and finish (foil / non-foil) -- each with its own price and stock count.

This creates misleading shopping line data. Real example: a card listed at R$0.05 with 3 copies available. On the detail page, only 1 copy was non-foil at R$0.35; the other 2 were foil at ~R$3-4 each. The actual cost to buy 3 copies was ~R$10, not R$0.15.

The user who acts on these estimates will be surprised at checkout, which erodes trust in the shopping line feature.

**Who is affected:** Any user viewing a deck's shopping line (Phase 1b, currently single-store: Cupula DT).

**Why it matters:** The shopping line's core value proposition ("with R$ X you close N cards") is undermined when prices can be 50-100x off. First-time surprises at checkout will destroy feature credibility.

## User Flow

```
Shopping Line (listing data)         "Get Exact Prices"              Variant-Level View
+-------------------------------+    +------------------------+    +-------------------------------+
| With ~R$ 12 you close 8 of   |    | User clicks CTA        |    | With R$ 47 you close 6 of    |
| 10 missing cards  [estimated] |    |                        |    | 10 missing cards              |
|                               | -> | Cards update one by    | -> |                               |
| Card A  ~R$ 0,25  3 avail    |    | one as detail pages    |    | Card A  R$ 0,35 (NM) 1 avail |
| Card B  ~R$ 5,00  1 avail    |    | are scraped            |    |   + R$ 3,90 (NM Foil) 2 more |
| Card C  unavailable           |    | ~10-25 seconds total   |    | Card B  R$ 5,00 (NM) 1 avail |
| ...                           |    |                        |    | Card C  unavailable           |
| [Get exact prices]            |    |                        |    | ...                           |
+-------------------------------+    +------------------------+    +-------------------------------+
```

## Requirements

**Scraping & Data**

- R1. The daily bulk scrape continues to parse listing pages only (no change to existing behavior).
- R2. A new "detail scrape" action fetches the detail page for a specific set of cards, parsing all in-stock variants (condition + finish, price, quantity). Zero-stock variants are excluded.
- R3. Detail scraping respects the existing per-store rate limit (1.5s between requests) and the `FetchGuardService` allow-list.
- R4. Detail-level variant data is persisted so it survives across sessions. A card's variant data is considered fresh as long as the listing row's `priceCents` or `quantity` have not changed since the variant data was fetched. The staleness check compares content (price + quantity), not timestamps -- because the daily bulk scrape updates `lastFetchedAt` on every run regardless of whether data changed. Each variant record carries its own `detailFetchedAt` timestamp.

**User-Initiated Detail Fetch**

- R5. The shopping line UI shows a CTA ("Get exact prices" or similar) that triggers a detail scrape for all missing cards of that specific deck.
- R6. The detail scrape runs with progressive updates: cards update one-by-one from estimate to exact as each detail page completes. Updates are visible within a few seconds of each card completing (polling is acceptable; true real-time push is not required).
- R7. During the detail fetch, the CTA is replaced by a progress indication (e.g., "Checking card 3 of 12..."). The user can navigate away; data persists for next visit.
- R7a. If some detail pages fail (network error, parse error), successfully fetched cards keep their variant data. Failed cards remain at listing-level estimates with a per-card error indicator and a "Retry failed" action. The headline total uses the best available data (variant where available, listing estimate for failures) and keeps the "estimated" badge.

**Pricing & Display Logic**

- R8. When variant-level data exists for a card, the shopping line uses the cheapest in-stock variant's price instead of the listing price.
- R9. When at least one card in the shopping line lacks variant-level data (only has listing-level estimates), the headline total displays an "estimated" indicator/badge.
- R10. When all cards have variant-level data, the "estimated" indicator is removed and the headline total is exact.
- R11. Each card line shows the cheapest variant's price as the primary display. If additional in-stock variants exist, a "N more variants" expandable section reveals the full breakdown (condition, finish, price, quantity per variant). Collapsed by default to keep the shopping line scannable.
- R12. The headline cost ("With R$ X you close N cards") computes using greedy cheapest-first allocation per card: sort the card's in-stock variants by `unitPriceCents` ascending, then fill `quantityNeeded` from the cheapest variant first, spilling into the next variant when the cheapest is exhausted. Example: need 3 copies; variant A has 1 at R$0.35, variant B has 2 at R$3.50. Cost = (1 x 0.35) + (2 x 3.50) = R$7.35. The headline sums these per-card costs.
- R12a. If the total in-stock variant quantity for a card is less than `quantityNeeded`, the card is counted as "partially available." The headline "N cards" counts only fully satisfiable cards. Partially available cards appear in the shopping line with a note like "1 of 3 copies available" and their cost contributes to the total.
- R12b. When detail data reveals zero in-stock variants for a card that was listed as available, the card moves to "unavailable" status with an indicator distinguishing it from cards that were never available (e.g., "out of stock (verified)" vs. "unavailable").

**Rate Limiting & Courtesy**

- R13. The detail scrape for a single deck is bounded by the deck's missing card count (typically 5-15 cards). At 1.5s rate limit, this is ~8-22 seconds -- acceptable as a user-initiated action.
- R14. No automatic background detail scraping. All detail fetches are explicitly triggered by a user action.
- R15. A cooldown of 1 hour prevents re-triggering detail scrape for the same deck. The CTA is disabled during cooldown with a "last checked N min ago" indicator. The detail fetch skips cards that already have fresh variant data (including from another deck's fetch), only fetching cards that are truly missing detail data.

## Success Criteria

- A user viewing a shopping line sees listing-level estimates with a clear "estimated" badge and a CTA to get exact prices
- After clicking "Get exact prices", cards progressively update with variant-level data (condition, finish, price, quantity)
- The headline total recalculates using cheapest-variant-per-card logic, becoming more accurate with each card update
- When all cards are detailed, the "estimated" badge disappears
- Returning to the same deck later shows the previously-fetched variant data without re-scraping (unless listing data changed)
- The store owner does not notice increased load (detail scrapes are user-initiated and bounded)

## Scope Boundaries

- **Single store only (Cupula DT).** Multi-store variant scraping is Phase 2.
- **No automatic detail pre-fetching.** All detail scrapes are user-triggered via the CTA.
- **No cart/checkout integration.** The shopping line links to the store; it does not build a cart.
- **No variant preference persistence.** The user cannot save "I only want NM non-foil" as a filter (Phase 2 candidate).
- **No detail scraping from the aggregate home-page shopping line.** Only per-deck detail view has the CTA. The aggregate view remains estimate-only in this phase; it does not display an "estimated" badge (it is always an estimate by nature).
- **Detail page HTML parsing is Sbrauble-specific.** The detail parser is scoped to the same platform as the listing parser.

## Key Decisions

- **User-initiated over automatic:** Detail scraping is triggered by a CTA rather than background pre-fetch. This keeps the request budget under user control, simplifies architecture, and avoids wasting requests on cards nobody is looking at. Trade-off: the user has to wait ~10-25 seconds, but progressive reveal makes this feel fast.
- **Variant data available on demand, collapsed by default:** Show the cheapest variant price as the primary display with an expandable "N more variants" section. This keeps the shopping line scannable while making full detail available.
- **Cheapest-variant headline with staleness disclaimer:** The headline always uses the best available data (cheapest variant if detailed, listing price if not). An "estimated" badge appears when any card lacks detail data, disappears when all are detailed. This is honest without being noisy.
- **Listing data as first-class fallback:** Listing-level data is never discarded. It remains the baseline that loads instantly, with detail data layered on top.

## Dependencies / Assumptions

- **VERIFIED:** The Sbrauble detail page HTML is server-rendered (no client-side JS loading) and contains variant-level data. Structure: `div.table-cards > div.table-cards-body > div.table-cards-row` per variant. Each row has cells for: Edition (`span.siglaEdicao`), Language (flag img), Quality (text like "NM" with tooltip "Near Mint (NM)"), Extras ("-" for non-foil, "Foil" for foil), Stock ("N unid."), Price ("R$ X,XX"). A real fixture is saved at `apps/api/src/stores/__fixtures__/cupula-dt-detail-page.html` (Adrenaline Rush Yellow -- 3 variants: 2 non-foil editions at R$0.20, 1 foil at R$2.00).
- The existing `FetchGuardService` host allow-list works unchanged for detail pages. However, the `LISTING_PATH_REGEX` in `SbraubleScraperService` is listing-specific; the detail scraper needs its own URL validation (or can rely on the already-validated `productUrl` from `store_stock`).
- The detail page URL pattern (`/?view=ecom/item&tcg=8&edicao=...&cardID=...&card=...`) is already captured in `store_stock.productUrl`.

## Outstanding Questions

### Resolve Before Planning

(None -- all product decisions resolved.)

### Deferred to Planning

- [Affects R2, R4][RESOLVED] Sbrauble detail page HTML structure verified and fixture saved. Selectors: `.table-cards-row` for variant rows; Edition in `span.siglaEdicao`, Quality as text in `.table-cards-body-cell` (e.g., "NM"), Extras text ("-" or "Foil"), Stock text ("N unid."), Price text ("R$ X,XX") in `.card-preco`. Server-rendered, no JS hydration needed.
- [Affects R4][Technical] Schema design: separate `store_stock_variant` table vs. JSONB column on `store_stock` vs. expanding the existing row model. Planning should evaluate trade-offs against query patterns in `ShoppingLineService`. The staleness check needs content-based comparison (price + quantity) with a separate `detailFetchedAt` timestamp.
- [Affects R6][Technical] Progressive update delivery mechanism: polling interval vs. SSE. Polling is acceptable per R6; SSE is optional. Consider what the current stack supports (NestJS + TanStack Query on the frontend).
- [Affects R15][Technical] Cooldown implementation: per-deck timestamp in the database vs. client-side throttle vs. server-side rate limiter.

## Next Steps

✅ Plan executed: `docs/plans/2026-04-13-001-feat-variant-aware-shopping-line-plan.md` (status `completed`). Feature shipped via PRs #10–#12 on `main`.
