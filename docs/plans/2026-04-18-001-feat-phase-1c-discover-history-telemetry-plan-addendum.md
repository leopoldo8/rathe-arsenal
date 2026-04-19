---
title: "Phase 1c plan addendum — Algolia source pivot + spike findings"
type: plan-addendum
status: active
date: 2026-04-19
parent-plan: docs/plans/2026-04-18-001-feat-phase-1c-discover-history-telemetry-plan.md
spike-report: docs/brainstorms/gates/phase-1c-unit-1-spike.md
---

# Phase 1c plan addendum — Algolia source pivot + spike findings

> **When this addendum conflicts with the parent plan, the addendum wins.** The parent plan was written assuming Fabrary exposed a "trending" GraphQL query. The 2026-04-19 Unit 1 spike (linked above) proved that assumption false. This addendum captures the user-approved overrides; the rest of the parent plan stands.

## Decisions confirmed by the user (2026-04-19)

1. **Source = `isTournament:true`.** Discover ingests Algolia `public_decks` filtered by `isTournament:true` AND `format ∈ {Classic Constructed, Blitz}`, sorted by `updatedAt DESC`. ~1,400 decks total at probe time; ample for the Pelotas audience. The filter expression is wired through an env var (`DISCOVER_ALGOLIA_FILTER`, default `isTournament:true AND format:"Classic Constructed" OR isTournament:true AND format:"Blitz"`) so the operator can widen to `hasResults:true` or default-sort without a code change.
2. **Reframe R11/R12/R13/R14 from "trending" to "tournament" / "curated featured decks".** The user-facing Discover copy says "Tournament & featured decks" (not "trending"). The parent plan's narrative wording ("trending", "trending decks", "Fabrary trending") is replaced wherever it appears in the implementation; the requirements still trace to R11–R14 as the same R-IDs.
3. **`archetype` is deferred to Phase 2.** Algolia does not expose archetype, and `getDeck` does not either. The parent plan's conditional already permitted this outcome ("if archetype is unavailable, drop the column and the filter"); this addendum makes it definitive: no `archetype` column on `discover_deck`, no `archetype` filter in the DTO, no archetype dropdown in the UI, no archetype tag on `<DiscoverCard>`. R24 (archetype-aware engine weighting) remains Phase 2 as before.

## Items applied without separate user approval (technical follow-through)

These follow directly from items 1–3 above; no product decision involved.

4. **New `AlgoliaTransport` peer to `AwsIamTransport`.** File: `apps/api/src/fabrary/algolia.transport.ts`. Posts to `${ALGOLIA_ENDPOINT}/1/indexes/*/queries` with `x-algolia-api-key` and `x-algolia-application-id` query-string params. No AWS SigV4. Uses the existing `FetchGuardService` (allow-list, byte cap, timeout). Returns parsed `IRawAlgoliaResponse`.
5. **New env vars (in addition to the seven already in the parent plan):**
   - `ALGOLIA_APP_ID` (string, required when `DISCOVER_INGESTION_ENABLED=true`) — Fabrary's public Algolia app id, currently `4E2YSY5Y4I`. Treated as configuration, not a secret.
   - `ALGOLIA_API_KEY` (string, required when `DISCOVER_INGESTION_ENABLED=true`) — Fabrary's public read-only Algolia API key, currently `63c7b6aa56d38399d37df3c341b982c3`. Treated as configuration, not a secret (it is literally embedded in Fabrary's client bundle).
   - `ALGOLIA_DECKS_INDEX` (string, default `public_decks`) — index name, parameterized in case Fabrary renames or splits.
   - `ALGOLIA_ENDPOINT` (string, default `https://4e2ysy5y4i-dsn.algolia.net`) — base host. Default is the same DSN host the public bundle uses; can be overridden if Fabrary moves to a different region.
   - `ALGOLIA_ALLOW_HOSTS` (string CSV, default `4e2ysy5y4i-dsn.algolia.net`) — `FetchGuardService` allow-list for the new transport.
   - `DISCOVER_ALGOLIA_FILTER` (string, default `isTournament:true AND (format:"Classic Constructed" OR format:"Blitz")`) — Algolia `filters` parameter literal. Operator-tunable without redeploy.
6. **Two-step ingestion is now the default path, not a contingency.** The parent plan's Unit 1 had a contingency clause for "thin trending response shape requires per-deck `getDeck` follow-ups". With Algolia, every ingestion run does:
   1. `algoliaTransport.search(filter, hitsPerPage = DISCOVER_INGESTION_LIMIT)` → `IAlgoliaDeckHit[]` (id + metadata + card names, no quantities).
   2. For each hit, `fabraryGraphQL.fetchDeck(hit.deckId)` to get `deckCards: [{ cardIdentifier, quantity, sideboardQuantity }]` — batched at concurrency 5 with a 200ms inter-batch delay.
   3. Apply R14 quality filter (hero in catalog, mainboardCount ≥ 60, format ∈ {CC, Blitz}) — `mainboardCount` only knowable AFTER step 2.
   4. Upsert into `discover_deck` + `discover_deck_card`.

   Total wall-clock estimate: 50 decks → 1 Algolia call (~200ms) + 50 getDeck calls batched at concurrency 5 (~3.5s). Comfortably inside the cron worker budget.
7. **Schema deltas relative to the parent plan's `discover_deck` shape:**
   - **Drop column `archetype`** (per item 3 above).
   - **Rename column `popularityRank` → `ingestionRank`** — encodes the order the deck arrived in the Algolia response (1 = first hit), not popularity. Index `(isActive, ingestionRank)` in addition to the parent plan's `(isActive, hero)` and `(isActive, format)`.
   - All other columns unchanged.
8. **`fetchTrending(limit)` becomes `fetchAndExpandTournamentDecks(limit, filter)`** on a new `FabraryDiscoverySource` service that composes both transports. The existing `FabraryService.fetchDeck(ulid)` is unchanged and gets reused as the per-deck expansion call. Naming the new method around what it does (fetch metadata via Algolia, expand via getDeck) avoids the lie of calling it `fetchTrending` when there is no trending source.
9. **Spike Part B (relevance probe) is deferred to post-Unit-3.** Cannot run without `PreviewReadinessService` (Unit 3) and seeded `discover_deck` data (Unit 2). Decision: ship Units 1 + 2 with `DISCOVER_INGESTION_ENABLED=false` default in production env; once Unit 3 lands, run Part B against the first staging ingestion before flipping the flag. The Unit 1 PR description includes a "Part B: deferred — see U3 follow-up" note rather than a captured probe table.
10. **Compliance log entry.** Add `docs/research/phase-1c-compliance-log.md` (new file, modeled on the Phase 1b compliance log) covering: (a) the Algolia public API key usage rationale, (b) Fabrary ToS re-quoted in the Phase 1c context for programmatic Algolia + GraphQL access, (c) once-daily cron cadence + Pelotas-scale request volume estimate. Owned by Unit 2 (where the cron worker first hits production).

## Surfaces explicitly affected

| Parent-plan section | Addendum override |
|---|---|
| Overview bullet 1 | "Discover surface" still owns R11–R14, but reads "tournament & curated featured decks" (not "trending") |
| Requirements Trace R11 | Drop "archetype when available" from the carried text; only `hero` + `format` in the filter set |
| Scope Boundaries | Add an explicit non-goal: "No archetype filter / column / dropdown — Algolia + Fabrary GraphQL do not expose this metadata. Phase 2 may revisit via in-house heuristic or alternate source" |
| Context & Research → External References | Replace the "Fabrary trending UI" reference with "Fabrary `/decks` page (Algolia-backed) + Fabrary `getDeck` GraphQL". Add: "Algolia search REST API — `https://www.algolia.com/doc/rest-api/search/`" |
| Key Technical Decisions → `discover_deck` schema | Apply item 7 above (drop `archetype`, rename `popularityRank` → `ingestionRank`) |
| Key Technical Decisions → "Env vars added in Phase 1c" | Append items 5 above (six new vars). The note about `FABRARY_ALLOW_HOSTS` still applies for the GraphQL `fetchDeck` follow-up call; `ALGOLIA_ALLOW_HOSTS` is the parallel allow-list for the new transport |
| Unit 1 → Pre-implementation spike-first gate | Already executed and documented in `docs/brainstorms/gates/phase-1c-unit-1-spike.md`. Unit 1's PR description references the spike file rather than re-deriving the artifacts |
| Unit 1 → Files | Add `apps/api/src/fabrary/algolia.transport.ts` and `apps/api/src/fabrary/discovery-source.service.ts`. The previously planned `apps/api/src/fabrary/queries/list-trending.query.ts` is **dropped** (no GraphQL trending query exists). Add `apps/api/src/fabrary/dtos/algolia-deck-hit.dto.ts` for the Algolia response shape |
| Unit 1 → Approach `fetchTrending` | Replaced by `fetchAndExpandTournamentDecks` per item 8. R14 filter still owned by Unit 2 (`DiscoverIngestionService`), not the transport |
| Unit 2 → Approach step 5 | "Call `fabraryService.fetchTrending(...)`" becomes "Call `fabraryDiscoverySource.fetchAndExpandTournamentDecks(env.DISCOVER_INGESTION_LIMIT, env.DISCOVER_ALGOLIA_FILTER)`" |
| Unit 2 → Files | Add `docs/research/phase-1c-compliance-log.md` (per item 10). Cron schedule unchanged (`0 4 * * *` UTC) |
| Unit 3 → Filter DTO | Drop `archetype?` from `discover-list.query.ts`. Drop the `?archetype=Aggro` test scenario |
| Unit 3 → Approach `DiscoverService.list` | "apply filter `WHERE` clauses (`hero`, `format`, `archetype`)" → drop `archetype`. Sort by `ingestionRank ASC` (was `popularityRank ASC`) |
| Unit 4 → suggestion DTO | "Each suggestion DTO carries: `fabraryUlid, name, hero, format, archetype, previewReadiness ...`" → drop `archetype` |
| Unit 5a → `<DiscoverCard>` | Drop the archetype tag display |
| Unit 5b → `<DiscoverFilterBar>` | Drop the conditional archetype dropdown |
| All sequence diagrams | `FabraryService.fetchTrending` participants → `FabraryDiscoverySource.fetchAndExpandTournamentDecks`. The diagrams' overall shape is unchanged |
| Risks → "Fabrary trending GraphQL query name not discoverable" | Replaced by: "Fabrary changes Algolia index name or rotates the public key without notice — mitigation: env-var-driven app id + key + index name; cron alarm fires on three consecutive failed runs". Original risk is closed by the spike |
| Risks → "Trending response shape requires per-deck `getDeck` follow-ups" | Closed (per-deck `getDeck` is now the default path, not a contingency). Wall-clock estimate updated to ~3.5s for 50 decks |

## Surfaces NOT affected by this addendum

- Unit 6 (R27 history chart): zero overlap — independent of Discover ingestion.
- Unit 7 (click telemetry): zero overlap — independent of Discover ingestion.
- R9 home state machine derivation logic (Unit 4): unchanged. The home modes consume `discover_deck` rows the same way regardless of source.
- Preview readiness engine (Unit 3): unchanged. Operates on arbitrary deck-card arrays — does not care whether the cards came from Algolia + getDeck or directly from a trending query.
- Cache-Control posture, admin endpoint guard, dismissal table, ingestion-run audit table, suggestion pre-filter SQL: all unchanged.

## Implementation-time gates updated

- **Unit 1 PR cannot merge without:** the Algolia transport unit tests, the `FabraryDiscoverySource` integration test (mocking both transports), an end-to-end smoke test that calls real Algolia + a real `getDeck` against one fixture-seeded deck (one-shot manual verification documented in the PR description).
- **Unit 2 PR cannot merge without:** the new `docs/research/phase-1c-compliance-log.md` (item 10).
- **Discover ingestion remains feature-flagged off by default** (`DISCOVER_INGESTION_ENABLED=false`) until Spike Part B passes against a real staging ingestion. Operator flips the flag manually post-U3 + post-probe.

## Open questions resolved by this addendum

- Source choice (item 1) — resolved: `isTournament:true`, env-tunable filter.
- Reframing wording (item 2) — resolved: "tournament & featured decks", not "trending".
- Archetype availability (item 3) — resolved: not available, deferred to Phase 2.
- Compliance log scope (item 10) — resolved: new Phase 1c log file.

## Open questions still open (passed through unchanged from parent plan)

- The Recharts vs hand-rolled SVG chart decision (Unit 6).
- The Phase 2 retention policy for `outbound_click_event` and `discover_dismissal`.
- The Phase 2 archetype source (in-house heuristic vs alternate provider).

## Source-of-truth ordering

When in doubt during implementation:
1. This addendum
2. The parent plan (`docs/plans/2026-04-18-001-feat-phase-1c-discover-history-telemetry-plan.md`)
3. The spike report (`docs/brainstorms/gates/phase-1c-unit-1-spike.md`) — for raw evidence
4. The origin brainstorm (`docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md`) — for product intent

If 1 conflicts with 2, 1 wins. If 2 conflicts with 3 on a factual claim about Fabrary, 3 wins. 4 only governs questions of product intent that 1–3 do not address.
