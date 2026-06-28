# Scraper Cost Scaling — Multi-Store Strategy

> **Status:** decision reference for the future. As of this writing the app
> tracks **one store** (Cúpula DT). This doc captures how the scraper's cost
> behaves as stores are added, and which architecture to reach for **before**
> going multi-store. Consult alongside [`ip-posture.md`](./ip-posture.md).

## TL;DR

- The store sits behind a **Cloudflare bot challenge** that blocks datacenter
  IPs (the Railway worker gets a ~5.5 KB "Just a moment…" page; a residential
  IP gets the real ~95 KB HTML). We bypass it with **Firecrawl** (residential
  proxies), which costs **credits per page**.
- There are **two** Firecrawl cost drivers, and they scale in **opposite** ways:
  - **Detail fetch** (price/stock per card) — scales with **user demand**.
    Bounded and value-aligned. Adding a store adds *no* recurring cost.
  - **URL-sync** (full catalog crawl to discover card→URL mappings) — scales as
    `O(stores × catalog_pages × frequency)`, **independent of usage**. This is
    the one that explodes at multi-store.
- **Do not run periodic full-catalog crawls through Firecrawl at scale.** Reach
  for demand-driven discovery or a free residential crawl instead. Details below.

---

## Firecrawl pricing (reference, ~mid-2026)

| Plan | Price/mo | Credits/mo | Notes |
|---|---|---|---|
| Free | $0 | 1,000 | validation only |
| Hobby | $16 | 5,000 | |
| Standard | $83 | 100,000 | |
| Growth | $333 | 500,000 | |

- Credits **do not roll over**.
- `/scrape` credit cost by proxy mode:
  - `basic` = **1 credit** (datacenter proxies; fails on Cloudflare).
  - `enhanced` = **5 credits** (residential proxies; clears the challenge).
  - `auto` (our default) = 1 if `basic` succeeds, **5** if it escalates to
    `enhanced`. For a Cloudflare-gated store, assume **5**.
- `formats: ['rawHtml']` adds no extra cost.

We use `auto` + `rawHtml`, then run the **existing parser** on the returned HTML
(see `FirecrawlClientService`).

---

## Cost model

Let:
- `P` = listing pages per store (Cúpula DT ≈ **106**)
- `C` = credit cost per Firecrawl page ≈ **5** (Cloudflare → enhanced)
- `S` = number of stores
- `F` = url-syncs per month

**URL-sync cost/month** = `P × C × F × S`

**Detail-fetch cost/month** = `(unique card-prices requested) × C` — driven by
real usage, *not* by `S` directly (a card is only fetched from the store(s) a
user actually prices against).

### Concrete scenarios (one store, Cúpula DT, P=106, C=5)

| url-sync cadence | Credits/mo | Smallest plan |
|---|---|---|
| Daily | ~16,000 | Standard ($83) |
| Weekly | ~2,300 | Hobby ($16) |
| Monthly | ~530 | Free (barely) |
| Per set release (~every 6–8 wk) | ~350–530 | Free |

### Why it hurts at multi-store

`× S` multiplies the **whole table**. 10 stores, weekly = ~23,000 credits/mo of
**fixed** spend *before anyone uses the app*. That is the wrong thing to scale.

Detail fetch, by contrast, only spends when a user clicks "Get exact prices",
and only for the cards in that deck. (Caveat: if you add **multi-store price
comparison**, a single price request fans out `× S` on the *detail* side too —
still demand-driven, but budget for it.)

---

## The options (ranked for multi-store)

The url-sync exists **only** to discover the `cardIdentifier → store productUrl`
mapping (+ product name). That mapping is **very stable** — a product page URL
almost never changes; what changes is "the store added new cards" (mainly at FaB
set releases, ~every 6–8 weeks). So we do **not** need a frequent full crawl.

### 1. Lazy / on-demand URL discovery — *best long-term*

Stop bulk-crawling. Discover a card's `productUrl` the **first time** someone
tries to price it and we don't already have it cached, then cache it forever
(via the store's search endpoint or a constructable URL pattern).

- **Cost behavior:** all Firecrawl spend becomes demand-driven,
  `O(unique cards ever priced)` — **independent of store count or catalog size**.
  Adding a store costs **zero** until someone prices a card from it.
- **Pros:** scales with value delivered; no fixed cost; no stale full-catalog
  crawls.
- **Cons:** needs a per-store way to resolve one card → its product page
  (search-by-name endpoint, or a URL pattern). More integration work per store
  (each store's search/match differs). First price of an uncached card pays a
  one-time discovery fetch.
- **Sketch:** in the variant-fetch resolve step, when a missing card has no
  `store_stock.productUrl`, enqueue a "discover URL" sub-step that Firecrawl-
  scrapes the store's search results for the card name, matches via
  `CardNameMatcherService`, and upserts the `productUrl`. Then proceed to the
  normal detail fetch.

### 2. Rare + "new arrivals only" crawl — *simple, cheap*

Keep a crawl, but (a) run it **only at set releases** (manual/owner-triggered or
a sparse cron), and (b) crawl just the first 1–2 "newest products" pages instead
of all 106.

- **Cost behavior:** a few pages × a few times/year × `S`. Negligible.
- **Pros:** trivial to implement (cap the page count); reuses the existing
  pipeline.
- **Cons:** relies on the store sorting new arrivals to the front; a card not on
  the crawled pages stays undiscovered until a full crawl. Less precise than #1.

### 3. Bulk crawl from a residential IP — *free, decouples cost*

Run the **full** catalog crawl (the rare, structural, in-bulk work) from a
**residential IP** — the owner's machine or a small home box — which clears
Cloudflare for free, and push the `card→URL` mapping to the DB. Firecrawl is then
used **only** for the on-demand detail fetch.

- **Cost behavior:** url-sync becomes **$0** (no Firecrawl credits); detail fetch
  stays demand-driven.
- **Pros:** removes the entire scaling-bad cost driver from Firecrawl; the bulk
  crawl is exactly the kind of rare/structural job that tolerates being manual.
- **Cons:** operationally manual — you run a script (`pnpm scrape ...` from a
  residential network) occasionally; not "hands-off" automated. Could be
  semi-automated with a cheap home cron.

### 4. Per-store fetch provider — *orthogonal*

Make `SCRAPER_FETCH_PROVIDER` a **per-store** setting, not global. Stores **not**
behind Cloudflare use the free `direct` fetch; only protected stores spend
Firecrawl credits.

- **Pros:** you only pay for stores that actually need unblocking.
- **Cons:** small schema change (provider column on `store`).

### 5. Monthly credit budget guard — *safety net*

Track Firecrawl credits spent and **hard-stop** new fetches when a configured
monthly ceiling is hit (log what was skipped). Prevents any of the above from
running away. Pairs with all options.

---

## Recommended path

1. **Now (single store):** url-sync is **admin-button-triggered only** (no
   automatic periodic crawl). The owner runs it when a set drops. Cached URLs +
   demand-driven detail fetch cover everything else. *(This is what's implemented
   — see "Current state".)*
2. **First extra store:** add **#4 (per-store provider)** so free stores stay
   free, and keep url-sync owner-triggered.
3. **When stores/usage grow:** invest in **#1 (lazy discovery)** so Firecrawl
   spend tracks usage, not store count. Fall back to **#3 (residential bulk
   crawl)** for any store where lazy discovery is impractical.
4. **Always:** add **#5 (budget guard)** before the spend matters.

Avoid: scheduled full-catalog Firecrawl crawls (daily/weekly) across many stores.
That is the `O(stores × pages × frequency)` trap this doc exists to prevent.

---

## Current state (keep this section updated)

- **Detail fetch:** routed through Firecrawl when `SCRAPER_FETCH_PROVIDER=firecrawl`
  (set on the `scrapper-worker` service). Working; ~5 credits/card.
- **URL-sync:** also Firecrawl-capable, but **not** on an automatic cadence — it
  is triggered **on demand by the owner** via an admin control. This is the
  cost-control posture above: no hands-off full crawls.
- **One store** (Cúpula DT), ~106 listing pages, ~3,200 cached product URLs.
