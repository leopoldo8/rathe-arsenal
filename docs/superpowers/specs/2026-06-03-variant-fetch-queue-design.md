# Variant-Fetch Queue — Design

Date: 2026-06-03
Status: Approved (pending implementation plan)

## 1. Context & problem

Store price/stock for the only store (`cupula-dt`, Sbrauble platform) has two
data paths today:

- **Listing scrape** — a cron one-shot (`scrape-stores.js` on the
  `scrapper-worker` Railway service) parses the listing pages and populates
  `store_stock` (one representative price/stock per card, whole catalog).
- **Detail/variant fetch** — on-demand, triggered by the "Get exact prices"
  CTA in a deck's shopping line. `POST /decks/:deckId/fetch-variants` runs an
  in-process async loop (`VariantFetchService`) that fetches each card's
  detail page, parses plain-text variants, and populates `store_stock_variant`.

The store deployed **anti-scraping obfuscation on the listing** (~Apr 23): card
names/URLs still parse, but price and stock are now rendered as CSS-sprite
glyphs with `&nbsp;` text and per-request-randomized class names AND a
per-request-randomized sprite image (digit layout shuffles every load).
Decoding requires per-request sprite download + OCR — fragile, heavy, and an
arms race. The delta guard correctly paused the listing scrape (a 0-product
result would zero out all 3205 stock rows; `deltaPercent=100` →
`paused_delta_guard`), which is the source of the failure emails.

The **detail page is NOT obfuscated** for the main card: it exposes plain-text
`Estoque N unid.` / `Preço R$ X,YY` per variant, and we already have a working
parser (`SbraubleDetailParserService.parseDetailPage`). So the detail path is
the durable source of truth going forward.

## 2. Goals & non-goals

**Goals**
- Make the (already-working) detail fetch the source of `store_stock` and
  `store_stock_variant` PRICE/STOCK.
- Repurpose the listing scrape into a **URL/name catalog sync**: it still
  enumerates products and their plain-text detail URLs + names (NOT obfuscated),
  but stops parsing the obfuscated `.price`/`.qty` fields and stops the
  stock-reconciliation delta guard. This keeps `store_stock.productUrl` fresh so
  the detail queue knows where to fetch — the listing is the only source of each
  card's sbrauble detail URL, so it cannot be fully retired.
- Replace the ephemeral, single-page, in-memory progress with a **robust,
  DB-backed work queue** that:
  - is visible across pages (global header pill → expandable panel),
  - supports multiple decks triggered at once,
  - shows per-deck progress and an aggregate ETA,
  - survives server restarts/deploys.

**Non-goals**
- Decoding the listing sprite (OCR). Out of scope; the detail path replaces it.
- Removing `store_stock` entirely / reworking readiness to read variants
  directly. We keep `store_stock` and only change its writer.
- Multi-store generalization. Single store (`cupula-dt`) today; the rate-limit
  is global per store, which the design leans on.
- Auto-triggering fetches on deck open. The manual "Get exact prices" CTA stays
  the trigger.

## 3. Architecture overview & data flow

```
[Web/API]  user clicks "Get exact prices" on a deck
   → POST /decks/:deckId/fetch-variants
   → resolve missing cards, apply <1h freshness, INSERT a variant_fetch_job
     (status=pending) — or return the existing pending/running job for the deck.
     Returns immediately ({ jobId, status }). No in-process fetching.
        │
        ▼
[variant_fetch_job]  Postgres table = queue + progress (source of truth)
        │
        ▼
[scrapper-worker]  continuous loop (poll ~3s):
   - claim 1 pending job atomically (SELECT ... FOR UPDATE SKIP LOCKED)
   - for each card (serialized by the store's 1.5s rate limit):
       · skip if already fresh (<1h) → natural cross-deck dedup
       · fetch detail → parseDetailPage → upsert store_stock_variant
       · derive + upsert store_stock (representative price/stock)
       · job.completed++ / job.failed++ (persisted)
   - mark job done/failed; move to next
        │
        ▼
[Web]  global header pill polls GET /variant-jobs (the user's jobs)
   → per-deck progress + aggregate ETA (remaining cards × ~1.5s)
```

Because there is a single store, the 1.5s rate limit is global: all jobs from
all decks converge into one serialized stream. "Multiple decks at once" simply
means more cards in the same queue (deduped by freshness). ETA is global and
predictable.

## 4. Data model

### `variant_fetch_job` (new)

| field | type | notes |
|---|---|---|
| `id` | uuid (PK) | |
| `userId` | int | owner — per-user queue view + auth |
| `deckId` | int | |
| `storeId` | int | |
| `status` | enum | `pending` / `running` / `done` / `failed` / `canceled` |
| `cards` | jsonb | `[{ cardIdentifier, status: 'pending'|'done'|'failed' }]` |
| `total` | int | denormalized counters (cheap polling) |
| `completed` | int | |
| `failed` | int | |
| `enqueuedAt` | timestamptz | FIFO ordering |
| `startedAt` | timestamptz \| null | |
| `finishedAt` | timestamptz \| null | |
| `claimedAt` | timestamptz \| null | orphan reclaim |
| `claimedBy` | text \| null | worker instance id |
| `error` | text \| null | |

Indexes: `(status, enqueuedAt)` (FIFO claim), `(userId, status)` (pill view),
`(deckId, status)` (re-enqueue dedup).

### `store_stock` derivation (writer changes; schema unchanged)

When the worker finishes a card's variants, it derives the representative row:
- `priceCents` = **min `priceCents` among the card's in-stock variants**.
- `quantity` = **sum of in-stock variant quantities**.
- Upsert into `store_stock` (keep the table; shopping-line and readiness keep
  reading it unchanged — only its source changes from listing to detail).

### Dedup / freshness

The existing `<1h` freshness rule (`isFreshForDeck`) becomes the dedup rule:
when Deck A's job fetches card X, Deck B's job sees X fresh and skips. No global
card table needed.

### Re-enqueue

If a `pending`/`running` job already exists for a deck, `POST` returns it
(mirrors today's `activeFetchSet`), no duplicate.

## 5. Worker (continuous drainer)

The `scrapper-worker` service changes from a cron one-shot to a long-lived
process (`variant-queue-worker.js`).

- **Loop:** every ~3s, claim one job:
  `UPDATE variant_fetch_job SET status='running', claimedAt=now(), claimedBy=$id
   WHERE id = (SELECT id FROM variant_fetch_job WHERE status='pending'
   ORDER BY enqueuedAt FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`.
- **Process:** for each card, reuse `FetchGuardService` + `parseDetailPage`,
  honoring the store rate limit (1.5s, persisted via `store.lastFetchedAt`).
  Upsert `store_stock_variant`, derive + upsert `store_stock`, bump counters.
- **Single instance.** One worker; `SKIP LOCKED` keeps claims safe regardless.
- **Orphan reclaim:** a `running` job whose `claimedAt` is older than N minutes
  (crash/deploy mid-run) is reset to `pending`.
- **Partial failure:** a card fetch failure bumps `failed` and marks the card;
  the job still completes `done` with partial failures (mirrors the existing
  `PartialFailureNotice` semantics).

## 6. API surface

- `POST /decks/:deckId/fetch-variants` — resolve missing cards, apply freshness,
  insert the job (or return the existing one). Returns `{ jobId, status }`.
  No in-process work. Auth unchanged (JWT + `OwnsTrackedDeckGuard`, throttle).
- `GET /variant-jobs` — the user's active + recently-completed jobs. Each entry:
  `{ jobId, deckId, deckName, status, total, completed, failed }` plus a
  top-level `etaSeconds` (remaining cards across pending+running × ~1.5s).
- Removed: in-memory `progressMap` / `activeFetchSet` / `startFetch`
  fire-and-forget in `VariantFetchService`. The job table replaces them.
  (The detail-fetch mechanics — fetch + parse + persist — are reused by the
  worker.)

## 7. Frontend

- **`useVariantJobsQuery`** — polls `GET /variant-jobs` while any job is active
  (~4s), stops when idle.
- **`VariantQueuePill`** — mounted in `apps/web/src/components/shell/AppShell.tsx`
  (global header). Shows `◐ {completed}/{total} · ~{eta}`. Click toggles the
  panel. Hidden when no active/recent jobs.
- **`VariantQueuePanel`** — per-deck rows (deck name, progress bar,
  `completed/total`, link to the deck), aggregate ETA footer. Partial-failure
  language reuses `PartialFailureNotice`.
- **Trigger unchanged:** the shopping-line "Get exact prices" CTA still fires;
  its mutation now only enqueues (`{ jobId, status }`). The deck-detail page
  reflects progress via the same `useVariantJobsQuery` (its deck's job),
  retiring the in-memory `variantFetchProgress` path.
- **Cleanup:** remove the in-memory progress wiring from deck-detail,
  `ShoppingLine`, and `ShoppingPanel` that depended on `getProgress(deckId)`.

## 8. Repurposing the listing scrape (URL/name sync)

The listing is the ONLY source of each card's sbrauble detail URL (the
plain-text `<a href=…?view=ecom/item&edicao=…&cardID=…&card=…>` on every
`.card-item`). It therefore cannot be retired — it is repurposed:

- `SbraubleScraperService` stops parsing the obfuscated `.price`/`.qty` fields.
  It parses only name + product (detail) URL per card, keeps the existing
  name→cardIdentifier matcher, and upserts `store_stock` rows with a fresh
  `productUrl` (and name), WITHOUT touching `priceCents`/`quantity` and WITHOUT
  the stock-reconciliation delta guard (no zeroing → no `paused_delta_guard` →
  no failure emails).
- Price/stock for those rows are filled by the detail queue/worker.
- The continuous worker process runs BOTH: the queue drainer (every ~3s) and a
  periodic URL-sync (e.g. every 24h) that runs the simplified listing parse.
- **Legacy `store_stock`:** the 3205 rows from Apr 22 already carry `productUrl`,
  so detail fetches work for them immediately. Their price/stock refresh lazily
  as cards are fetched; the URL-sync keeps URLs current and discovers new cards.

## 9. Edge cases & failure handling

- **Card detail fetch fails:** count `failed`, mark the card, continue; job
  finishes `done` with partial failures. Retry path reuses the existing
  partial-failure UI (re-enqueue the failed cards).
- **Worker crash / deploy mid-job:** orphan reclaim returns the job to
  `pending`; already-persisted cards are skipped on reprocess (freshness).
- **Empty job (all cards already fresh):** `POST` returns a "nothing/fresh"
  status without creating a job (mirrors current `already_fresh`).
- **Store rate-limit contention:** none — single serialized stream by design.
- **Never-fetched card in shopping line:** the row exists (URL-sync keeps a
  `store_stock` row with `productUrl` but possibly stale/empty price/stock) →
  shown as "price not loaded — Get exact prices" until the detail fetch fills it.
- **Card with no `store_stock` row at all (URL unknown):** cannot be detail-
  fetched (no detail URL). The enqueue endpoint skips it (logs how many were
  skipped); it is surfaced as unavailable until the next URL-sync discovers it.

## 10. Testing strategy (TDD)

- **Unit:** atomic claim (`SKIP LOCKED`); `store_stock` derivation (min in-stock
  price + summed quantity); ETA calc; freshness dedup; orphan reclaim.
- **Integration:** `POST /fetch-variants` creates/returns a job;
  `GET /variant-jobs` shape; worker processes a job with mocked fetch/parse →
  writes variant + stock rows and updates counters.
- **Frontend:** pill/panel render from a mocked jobs query; polling lifecycle;
  ETA formatting; auto-hide.
- **E2E / visual:** enqueue → pill appears → progresses → hides (Playwright with
  a stubbed worker/queue).

## 11. Rollout

- TypeORM migration creates `variant_fetch_job` (+ indexes).
- Deploy API (enqueue + `GET /variant-jobs`) and worker (drainer) together.
- Flip the `scrapper-worker` start command to the continuous drainer; the
  listing cron stops.
- Legacy `store_stock` rows remain; refreshed lazily.

## 12. Resolved decisions

- **Durability:** DB-backed jobs (survives restart/deploy; cross-page,
  cross-device per user).
- **Drainer location:** the existing `scrapper-worker` service, **continuous**
  (long-lived), repurposed from the listing cron.
- **Queue widget:** global header pill → expandable per-deck panel with
  aggregate ETA; auto-hides when idle.
- **`store_stock`:** kept. Price/stock written by the detail worker (min
  in-stock price + summed quantity); `productUrl`/name kept fresh by the
  repurposed listing URL-sync.
- **Listing:** repurposed to URL/name sync (no obfuscated price/stock parse, no
  delta guard), NOT retired — it is the only source of detail URLs.
- **Worker:** single-instance, long-lived, `SKIP LOCKED` claims + orphan
  reclaim.
- **Trigger:** unchanged — manual "Get exact prices" CTA, which now enqueues.
