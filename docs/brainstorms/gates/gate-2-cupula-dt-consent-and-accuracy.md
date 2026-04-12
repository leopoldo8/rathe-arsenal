---
gate: 2
title: Cúpula DT Scraping Consent and Data Accuracy
status: PASSED (consent + crawl-rate exception done; accuracy verification is a Phase 0 follow-up task)
date: 2026-04-08
owner: Rodrigo
---

# Gate 2 — Cúpula DT Scraping Consent and Data Accuracy

## Consent status

**PASSED.** Consent from the Cúpula DT owner has been captured. The owner is a personal friend of the project owner and has explicitly agreed to allow a polite scraper to read FaB product pages from the store's public catalog.

No manual work (CSV, feed, dashboard upload) is being asked of the owner. The partnership is friendship-based, not contractual.

## Data accuracy verification status

**PENDING.** Cannot be executed until the Sbrauble scraper (from Gate 3c) is built. The protocol is:

1. Point the scraper at `https://www.cupuladt.com.br/?view=ecom/itens&tcg=8` (and the paginated results).
2. Save the first ingestion snapshot to `docs/brainstorms/gates/gate-2-snapshot.json` (or similar).
3. Show the snapshot to the owner in person, walk through 10 randomly-chosen cards, and verify:
   - Is the card listed at the correct price?
   - Does the stock quantity look reasonable?
   - Are there cards on the shelves that are missing from the snapshot?
4. Record corrections in `gate-2-accuracy-verification.md` as a follow-up artifact.

## Crawl-delay exception — GRANTED

Discovered during Gate 3c: the Cúpula DT `robots.txt` declares `Crawl-delay: 360` (6 minutes per request) as the Sbrauble platform default. At 360s per request, a daily full catalog scrape would be infeasible (50+ hours per run).

**Exception granted (2026-04-08).** The project owner asked the Cúpula DT owner directly: "Your platform's default says 6 minutes between requests. For my app to refresh daily, I'd want to go at ~1-2 seconds per request specifically against your store. Since you're OK with the scraping, can I treat your store as an exception to that default?" The owner agreed.

The owner's explicit permission for a higher rate supersedes the platform-level default for this specific relationship. The scraper may operate against `https://www.cupuladt.com.br/?view=ecom/*` at 1-2 seconds per request (approximately 30-60 requests per minute), which makes daily full catalog refresh feasible in ~10-15 minutes.

**Scraper architecture implications:**
- Phase 1 uses the fast-rate mode by default for Cúpula DT.
- Differential-update mode is *not* needed for Phase 1 (deferred to Phase 2 as a fallback for non-partner stores that have not granted exceptions).
- The exception must be recorded in code as a per-store configuration flag, not hardcoded globally, so that non-partner stores added in Phase 2 default to respecting their platform's Crawl-delay.

## Decision

**PASSED.** Consent documented, crawl-rate exception granted by the store owner. Accuracy verification remains as a Phase 0 follow-up task — it runs after the scraper prototype exists (built during Phase 0 / early Phase 1) but does not block Phase 0 kickoff. The Phase 0 implementation has no store data dependency; the scraper and the accuracy verification are Phase 1 prerequisites.
