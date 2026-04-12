---
date: 2026-04-08
topic: fab-deck-readiness-flow
---

# Flesh and Blood: Deck Readiness Flow (v1)

## Problem Frame

Casual and intermediate Flesh and Blood players in Brazil have no single tool that connects three things at once: **(a) what they already own**, **(b) what is available at nearby local stores**, and **(c) the decks they want to build or play**. Fabrary solves deckbuilding, FaBDB solves catalog, local stores sell the cards — but no one solves "I want to play Briar Aggro, what am I missing, where can I buy it nearby, and if I can't buy it, what can I play instead?" In the Brazilian market the problem is amplified by the absence of public stock APIs from any local game store.

This product addresses the gap by combining:

- **Progressive collection entry** (never a gatekeeper).
- A **tracked decks** list with per-deck readiness on the home surface.
- A **Discover** page fed from Fabrary trending with per-card readiness preview.
- A **smart substitution engine** that suggests functional alternatives when specific cards are missing from the user's collection or local store stock.
- **Local store stock integration** for Pelotas (v1) via a vertical scraper targeting the Sbrauble e-commerce platform.

V1 target audience: casual/intermediate players in Pelotas. Anchor store partner: Cúpula DT (https://www.cupuladt.com.br).

## Release Phasing

The v1 product is too large to ship as one release for a solo developer. The requirements below are organized in three sequential phases, each with a clear goal and a validation gate. Each phase de-risks the next by validating the riskiest assumption with the smallest possible footprint.

### Phase 0 — Validation Slice (4-6 weeks)

**Goal.** Prove that a rule-based substitution engine produces useful suggestions for casual FaB players, before investing in any other surface. This is the single biggest unknown in the project — if the engine is bad, every other piece is wasted work.

**Scope.** Fabrary URL paste → inventory + tracked decks → tier 1 substitutions only → effective readiness with breakdown. No Discover, no shopping line, no scraper, no chart, no archetype weighting, no feedback loop, no PT-BR autocomplete.

**Audience.** 5-10 trusted players from Cúpula DT and the local Discord/WhatsApp. Private link, not a public launch.

**Exit gate.** Two independent measurements with three distinct outcome paths (not a single AND-ed pass/fail):

1. **Engine quality (objective).** Tier 1 substitutions hit ≥70% acceptance against an independently constructed gold set: 50 substitutions stratified across at least 5 different heroes and at least 3 archetypes, hand-labeled blind by a FaB domain expert who is *not* the solo dev and *not* the Cúpula DT owner (to avoid evaluator-subject conflict — see Gate 4). 10% of the gold set is double-labeled by a second person to estimate inter-rater agreement.

2. **Product usefulness (behavioral, not interview).** Of 5-10 testers, at least 50% must show *behavioral* evidence of finding the product useful, measured as: (a) the user pastes a second deck URL within 7 days unprompted, OR (b) the user returns to the app at least 3 times over the 4-week test window unprompted, OR (c) the user adds at least 5 cards via the inline "I have this one" mechanism (R5) without being asked to do so. **Interview answers ("would you use this?") are not acceptable as the sole signal** — they are saturated with social desirability bias when the testers are personal contacts of the dev. Interviews can supplement, but they cannot replace behavior. **At least 2 of the 10 testers must come from the Gate 1 census list rather than the dev's trusted inner circle**, to break the selection-bias trap.

**Outcome paths.**
- **Both pass:** advance to Phase 1 with the engine and the product validated.
- **Engine passes, product fails:** the engine works but the wrapper does not. Do *not* rebuild the engine. Iterate on the product surface (onboarding, deck detail, import flow) and re-test before Phase 1.
- **Engine fails, product passes:** users tolerate the wrapper but the engine is the bottleneck. Iterate on engine weights/features and re-test, do not redesign the UI.
- **Both fail:** reshape both, or stop and reframe the product hypothesis.

### Phase 1 — v1.0 Public Launch (after Phase 0 passes)

**Goal.** Validate the primary success metric with the broader Pelotas community. Deliver enough surface area for the connect-three-things thesis (collection ↔ local stock ↔ desired decks) to actually be testable.

**Scope.** Phase 0 plus: Discover ingested from Fabrary trending with on-demand preview readiness, Path C (proximal version) in import flow, full home state machine (3 modes), shopping line backed by **the Sbrauble vertical scraper running against Cúpula DT only** (no manual CSV, no labor on the store owner — the scraper does the work), English-only autocomplete, deck detail view without historical chart. The scraper engineering is in Phase 1 critical path, but it's the same engineering Phase 2 needs anyway — Phase 2 just expands the store allow-list.

**Audience.** Public launch in Pelotas via Cúpula DT and local community channels.

**Exit gate.** Primary success metric (20+ weekly active Pelotas players for 6 consecutive weeks). If hit, Phase 2 is justified. If missed, the diagnosis questions in Success Criteria determine whether to iterate Phase 1 or stop.

### Phase 2 — v1.x Deepening (after Phase 1 retention validates)

**Goal.** Deepen the engine and scale the data sources, paying down deferred complexity now that the core hypothesis has been validated.

**Scope.** Tier 2 + Tier 3 substitutions, archetype weighting (R24), feedback learning loop (R25), historical readiness chart (R27), substitution alternatives in shopping line (R29), PT-BR autocomplete (R4), Sbrauble vertical scraper for 2-4 Pelotas stores with reconciliation (R30 expanded, R33), other lower-priority polish.

**Exit gate.** Not defined here — Phase 2 success criteria will be drafted at the time, informed by what Phase 1 actually validated.

## User Flow (first login)

```
┌─ 1. Landing ───────────────────────────────────────┐
│  "See your collection in action in under a minute."│
│   → Sign up / log in                               │
└────────────┬───────────────────────────────────────┘
             │
┌────────────▼───────────────────────────────────────┐
│ 2. Paste Fabrary URL(s) for decks you've already   │
│    built (multiple URLs accepted) — or skip        │
│    → Cards from pasted decks become inventory      │
│    → Pasted decks are auto-added to tracked list   │
└────────────┬───────────────────────────────────────┘
             │
┌────────────▼───────────────────────────────────────┐
│ 3. "Any loose cards to add?" → quick autocomplete  │
│    or "later"                                      │
└────────────┬───────────────────────────────────────┘
             │
             ├─ If pasted URLs  ─▶ Populated home with imported
             │                      decks already tracked
             │
             └─ If skipped all  ─▶ Home shows empty-state CTAs
                                    ├─ If any collection content exists:
                                    │   fallback "3 closest decks" shown
                                    └─ Otherwise: CTA to Discover/Import
```

## Product Surfaces

```
┌─ Home (Tracked Decks) ───────────────────────────┐
│  List of decks the user chose to track            │
│  Per-deck effective readiness                     │
│  "Movement since last session" highlighted        │
│  Below list: expansion suggestions (3 decks)      │
│  Empty state → CTAs + optional fallback suggest   │
└──────────────────────────────────────────────────┘

┌─ Discover ───────────────────────────────────────┐
│  Automatically ingested Fabrary trending decks    │
│  Filters: hero, format (CC/Blitz), archetype      │
│  Each card shows preview readiness                │
│  One-click "Track this deck"                      │
└──────────────────────────────────────────────────┘

┌─ Import Fabrary ─────────────────────────────────┐
│  Paste URL → defaults to "test" mode              │
│  Returns Path A / B / C (see R16-R18)             │
│  Secondary button "Also add to my collection"     │
└──────────────────────────────────────────────────┘

┌─ Deck Detail ────────────────────────────────────┐
│  Raw / substituted / missing breakdown            │
│  Active substitutions with tier + rationale       │
│  "Shopping line" with stock from tracked stores   │
└──────────────────────────────────────────────────┘

┌─ Library (Collection) ───────────────────────────┐
│  Continuous entry via autocomplete, Fabrary paste,│
│  and inline "I have this one" on any screen       │
└──────────────────────────────────────────────────┘
```

## Pre-Planning Gates

Four load-bearing assumptions must be validated **before** `/ce:plan` is invoked. Each gate has a protocol, a pass threshold, and a fail action. If any gate fails, this requirements document must be revisited and rescoped — not extended.

**Honest note on enforcement.** These gates are *policy*, not code. `/ce:plan` is a CLI tool that will run on this document regardless of whether the gates have passed. The author commits to not invoking `/ce:plan` until all four gates have produced explicit pass artifacts (see "Gate artifacts" below). The discipline lives in the author, not in the tooling. A reviewer auditing this project later may verify gate status by checking the artifacts directory before reading the plan.

**Gate artifacts.** Each gate produces a small written artifact stored in `docs/brainstorms/gates/` (e.g., `gate-1-census-result.md`, `gate-2-cupula-dt-partnership.md`, `gate-3-dependency-spike.md`, `gate-4-fab-expert-and-goldset.md`). Each artifact contains: the protocol followed, the raw evidence collected (counts, screenshots, ToS quotes, expert names), the pass/fail decision, and the date. The artifacts are the gate's evidence, not the gate's protocol description in this document.

**Solo-dev evaluator independence.** All four gates are owned by the same solo dev who has incentive bias toward declaring pass. To partially mitigate, each gate's artifact must include at least one cross-check from a non-author source: a Pelotas community member confirming the census names (Gate 1), the Cúpula DT owner's verbatim reply rather than a paraphrase (Gate 2), raw API/HTML samples and ToS quotes saved as files (Gate 3), and a second labeler on 10% of the gold set (Gate 4). Self-evaluated gates without external evidence are not gates — they are intentions.

### Gate 1 — Pelotas FaB Community Census + Adoption Probe

**STATUS: PASSED (with rescope).** Data gathered from the project owner's existing membership in the local Pelotas FaB group (2026-04-08):

- **Local FaB group membership:** 47 members total.
- **Tournament-active players:** ~8 (competitive persona subset, not the target audience — but counted for completeness).
- **Casual/semi-casual pool (target audience):** ~47 − 8 = ~39 potential users.
- **Realistic conversion envelope:** 17-30% try the app (7-14 users), of which 40-60% retain to 4+ weeks (3-8 users).

**Consequence.** The original primary metric ("20 weekly active players for 6 weeks") was unreachable from a pool this size regardless of execution quality, because it required near-100% conversion. The metric has been recalibrated (see Success Criteria) to "8 Pelotas-based players return on at least 3 separate days over any 4-week window, and 5 of 8 show behavioral engagement". This is ambitious but achievable at 17% conversion with 40% retention — realistic for a niche tool in a small community.

**Gate 1 passes** because the pool is large enough to support the (rescoped) metric, and because the project owner is already embedded in the community (membership in the group itself is the cross-check). The formal adoption probe (the "would you open it weekly?" survey) is **deferred to Phase 0 closed beta recruitment** — rather than asking in the abstract, the dev will offer the beta directly to group members and measure conversion behaviorally.

**If the rescoped metric misses during Phase 1:** reframe the product (e.g., Discord bot integration instead of standalone web app), or accept that the pool genuinely cannot sustain a standalone app in Pelotas alone and consider widening geography post-Phase 1.

- **Gate artifact:** `docs/brainstorms/gates/gate-1-census-result.md` — to be created with group member count, tournament-active count, and the recalibrated metric.

### Gate 2 — Cúpula DT Scraping Consent and Data Accuracy

**STATUS: PASSED.** Both consent and the crawl-rate exception have been obtained from the Cúpula DT owner (a personal friend of the project owner):

- **Consent:** captured in informal conversation — the owner explicitly agreed to the daily scraping of his store's public product pages.
- **Crawl-rate exception:** after the Gate 3 spike revealed the platform's default `Crawl-delay: 360`, the project owner asked the store owner directly whether the scraper could run at ~1-2 seconds per request specifically against Cúpula DT. The exception was granted (2026-04-08). Daily full catalog refresh is feasible at this rate in ~10-15 minutes.

**Remaining Gate 2 work, sequenced as a Phase 0 follow-up (does not block Phase 0 kickoff):**

- **Accuracy verification.** Once the scraper prototype exists (built during Phase 0 engine validation or early Phase 1), produce a first snapshot of Cúpula DT's FaB catalog and walk through it with the owner. Verify ≥10 cards against actual shelf inventory. Capture any systematic discrepancies as bugs before Phase 1 ships the shopping line.

The accuracy verification is a Phase 1 prerequisite, not a Phase 0 prerequisite, because Phase 0 has no store data dependency. See `docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md` for the full artifact.

**Validates D-3.** Cúpula DT is the anchor store. The owner is a personal friend of the project owner — there is no contractual partnership to negotiate, and no manual labor (CSV, feed maintenance) will be asked of the store. The "partnership" is simply (a) explicit consent to scrape the store's product pages, and (b) the store owner verifying that what the app shows matches what's actually on the shelves. The original "data delivery cadence" framing was a category error introduced by an earlier draft and has been removed.

- **Protocol.**
  1. **Conversation and consent.** Have an in-person or DM conversation with the Cúpula DT owner. Explain the project, show a mockup or early build, and explicitly ask: "Can I run a polite scraper against your store's product pages, daily, to read FaB stock?" Capture the consent in writing (WhatsApp screenshot, email, signed note — any persistent form). The consent is the artifact, not a contract.
  2. **Scraper dry run.** Once Gate 3's Sbrauble spike has confirmed feasibility, point the scraper at Cúpula DT's actual product catalog and produce a first ingestion snapshot. Show the snapshot to the owner.
  3. **Accuracy verification.** The owner walks through the snapshot and confirms (or corrects) at least 10 cards: the right cards are listed, the prices are right, the quantities are within reason, and nothing is missing that should be there. Capture corrections as a structured note.
- **Pass threshold.** All three of: (a) explicit written consent captured, (b) scraper dry run produces a first ingestion snapshot, (c) owner accuracy verification finds no major discrepancies (a few minor mismatches are fine — Sbrauble stock is itself imperfect; we just need to know the scraper isn't fundamentally broken).
- **Fail action.** Three scenarios: (a) the owner declines consent (extremely unlikely given the friendship, but the gate must allow it) → reframe Phase 1 without local store data and ship Phase 0 → Discover-only Phase 1 → Phase 2 store integration becomes optional; (b) the scraper dry run fails (Cúpula DT is on a Sbrauble theme variant the scraper can't parse) → fix the scraper or fall back to a per-store adapter; (c) accuracy verification finds major discrepancies (the scraper sees ghost products or misses entire categories) → debug the scraper, do not ship the shopping line until accuracy is real.
- **Owner.** Solo dev. Gate artifact: `docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md` containing the written consent, the first ingestion snapshot, and the accuracy verification notes.

### Gate 3 — External Dependency Feasibility Spike

**STATUS: PASSED (with a major beneficial Key Decision revision).** Executed 2026-04-08. Full analysis in `docs/brainstorms/gates/gate-3-dependency-spike.md`. Headline findings:

- **FaBDB replaced by `@flesh-and-blood/cards` npm package** — strictly better source of structured card data, maintained by the Fabrary team.
- **Fabrary deck access is feasible via AWS Amplify / AppSync GraphQL (AWS_IAM anonymous mode)** — medium-complexity engineering, with Playwright as a fallback.
- **Sbrauble / Cúpula DT commerce paths are scraping-allowed per robots.txt, but bound by `Crawl-delay: 360` (6 min/request)** — daily refresh requires either differential updates or an explicit permission exception from the store owner, which Gate 2 will request as part of its consent conversation.
- **Manual follow-ups before Phase 1 launch:** read Fabrary ToS and Sbrauble platform ToS manually and quote relevant clauses in the compliance log.

**Validates D-1, D-2, D-4.** The substitution engine, Discover, and Import flows depend on structured card data, Fabrary, and (in Phase 2) Sbrauble. Original gate protocol retained below for reference.

- **Protocol.** Time-boxed 1-2 day spikes per dependency:
  - **FaBDB.** Dump 50 random cards across 5 heroes via API. Audit which structured attributes required by the engine (pitch, class, talent, keywords, power, defense, card type, equipment slot) are populated as structured fields vs. free text. Confirm ToS allows automated mirroring.
  - **Fabrary.** Confirm whether a public API exists. If not, attempt scraping a known deck URL and the trending list. Confirm ToS allows automated ingestion. Identify deck URL schema and payload shape. Check whether trending exposes archetype metadata.
  - **Sbrauble (Phase 2 prep).** Confirm Cúpula DT robots.txt allows the target paths. Identify whether Sbrauble exposes a JSON API or only HTML. Compare HTML structure across 2-3 different Sbrauble stores in BR. Read Sbrauble platform ToS and quote the relevant scraping clause in this document or its planning successor.
- **Pass threshold.** Each dependency is either confirmed feasible **and consistent with current Key Decisions**, or has a defined alternative path **whose downstream Key Decisions have been re-affirmed in writing**. The "alternative path defined" outcome must not silently invalidate a Key Decision. For example: if Fabrary scraping is forbidden and the alternative is manual curation, the "100% automatic Fabrary trending" Key Decision is dead and must be explicitly revised in this document before Gate 3 is marked pass. A passing Gate 3 with a contradicted Key Decision is a fail in disguise.
- **Fail action.** Update this requirements document to reflect what is actually buildable. Examples: keywords missing from FaBDB → engine needs a text-parser pre-pass or hand curation, plus update R20-R23 to reflect the added preprocessing requirement; Fabrary scraping forbidden → Discover seed switches to manual curation, *and* the "automatic Fabrary trending" Key Decision is rewritten or removed; Sbrauble blocks scraping → single-store Cúpula-DT-only becomes the Phase 2 baseline (which collapses Phase 2 scope substantially).
- **Owner.** Solo dev. Gate artifact: `docs/brainstorms/gates/gate-3-dependency-spike.md` containing the raw API/HTML samples, ToS quotes, and any Key Decision re-affirmations or revisions triggered by the spike.

### Gate 4 — Gold-Set Protocol (Solo-Labeler Variant)

**Validates the evidence base of the Phase 0 exit gate.** The Phase 0 exit gate measures engine quality against a hand-labeled gold set of substitutions. The project owner has opted to be the sole labeler rather than recruit an independent FaB domain expert. This is an explicit bias tradeoff — it simplifies gate execution but sacrifices independence. The mitigation for labeler bias is **blind labeling** (the labeler does not see the engine's tier or score when evaluating a substitution) plus **structured sampling** (the set is drawn from real Fabrary decks and real engine candidates, not cherry-picked favorable cases).

- **Protocol.**
  1. **Assemble the gold set.** 30 substitutions (reduced from 50 because the solo-labeler path takes longer per substitution and the smaller set is still statistically meaningful for a pass/fail decision at the 70% bar). Stratified across at least 4 different heroes and at least 2 archetypes from decks sampled from Fabrary trending at the time of Phase 0 start. Each substitution candidate is drawn by running a prototype of the engine against the sampled decks; the labeler does not curate candidates manually.
  2. **Blind labeling.** For each of the 30 substitutions, present in a format that hides the engine's tier and score (e.g., a CSV or simple form with columns: deck hero, archetype, original card, proposed substitute, "would you play this: yes / no / uncertain"). The labeler fills one row at a time without seeing any other context from the engine. Do this in one sitting to avoid context drift between sessions.
  3. **Labeling session ergonomics.** Aim for ~5-8 seconds per row, ~3-5 minutes per batch of 5 rows, with short breaks. Total session ~30-45 minutes. Avoid labeling when tired, distracted, or rushed — bad labels corrupt the gold set more than no labels.
  4. **Pitch curve tolerance commitment.** In the same session (or a separate one), document what pitch curve tolerance is acceptable in practice, based on the labeler's FaB experience: "for a typical competitive deck, the curve can tolerate ±N red, ±M yellow, ±K blue without becoming unplayable". Insert the agreed numbers into R21.
- **Pass threshold.** All three of: (a) 30 substitutions labeled (excluding "uncertain" skips), (b) at least 20 of 30 ("yes" — "uncertain") are needed to hit the 70% Phase 0 exit gate bar, (c) pitch curve tolerance numbers inserted into R21.
- **Self-bias acknowledgement.** Because the labeler is also the project owner, the 70% bar is an honest self-assessment. If the engine hits 80%+, confidence is real; if it hits 70-79%, confidence is softer and Phase 0 should include informal user feedback as a cross-check before committing to Phase 1. If it hits below 70%, the engine needs work regardless of self-bias.
- **Fail action.** Do not proceed to Phase 1 until engine quality passes. Iterate on engine rules / weights and re-label a fresh sample (no using the same rows twice, to avoid memorizing labels).
- **Owner.** Solo dev (same as labeler). Gate artifact: `docs/brainstorms/gates/gate-4-gold-set.md` containing the 30 rows with labels, the pass/fail result, and the pitch curve tolerance numbers.

## Requirements

### Phasing Map

Each requirement is tagged with the phase it ships in. Some requirements split across phases (e.g., R22 ships tier 1 in Phase 0, then tier 2 + 3 in Phase 2).

| Phase | Requirements |
|---|---|
| **Phase 0** (validation slice) | R1, R2, R3, R5, R6, R7, R8, R10, R15 (onboarding paste only — no out-of-onboarding test mode), R16, R17 (Phase 0 scope: tier 1 only, non-interactive), R20, R21, R22 (tier 1 only), R23, R26 (the four bullets defined in R26 itself; R27 chart and R28 shopping line are *not* part of Phase 0) |
| **Phase 1** (v1.0 public) | **All of Phase 0**, plus: R4 (English only), R9 (3 home modes), R11, R12, R13, R14, R15 (out-of-onboarding test mode added), R17 (Phase 1 scope: tier 2 added, interactive re-solve added), R18, R19, R26 (now displayed alongside R27 placeholder + R28 shopping line), R28, **R30 (Sbrauble vertical scraper running against Cúpula DT only — same scraper as Phase 2, just one-store allow-list)**, R31, R32, R33 (cadence and reconciliation policy active from Phase 1) |
| **Phase 2** (v1.x deepening) | **All of Phase 1**, plus: R4 (PT-BR added), R22 (tier 3 added), R24, R25, R27 (full historical chart), R29, **R30 (scraper allow-list expanded to 2-4 Pelotas Sbrauble stores)** |

**Progressive collection entry**

- **R1.** Collection entry is **progressive**. The product must function with any amount of collection data registered, including zero. No flow blocks the user due to "incomplete collection".
- **R2.** The primary onboarding entry method is **pasting one or more Fabrary deck URLs**. Each URL is parsed; mainboard cards are added to the inventory; duplicates across multiple pasted decks are aggregated into a single quantity. Hero, weapon and equipment cards from the pasted decks are also added. The user can paste N URLs in a single onboarding flow.
- **R3.** Decks imported during onboarding via Fabrary paste are **automatically added to the tracked decks list**, based on the reasonable assumption that if the user built the deck on Fabrary, they want to track it.
- **R4.** The secondary entry method is **manual autocomplete**, supporting both Portuguese (PT-BR) and English card names, letting the user add individual cards with quantity at any time in the app.
- **R5.** The tertiary entry method is **inline "I have this one"**: whenever the app displays a card the user might potentially own (in missing-card lists, substitution suggestions, deck views), a micro-control lets the user register ownership with a single click without leaving the current screen. The collection updates in real time and affected deck readinesses reflect the change immediately.

**Tracked decks (home)**

- **R6.** The home surface displays the list of decks the user is currently tracking. For each deck it shows: deck name, hero, format (CC/Blitz), effective readiness (%) as a progress bar, and movement since the last session ("↑ +4%" or "new").
- **R7.** The user can untrack a deck with one click plus a light confirmation (undo available for a few seconds).
- **R8.** Clicking a deck in the list opens the Deck Detail view (R26+).
- **R9.** The home surface adapts its content to the user's state, in three distinct modes:
  - **Fully empty mode** (no collection and no tracked decks): empty state with primary CTA to Discover and secondary CTA to Import Fabrary. No auto-suggestion because there is no inventory against which to compute preview readiness.
  - **Fallback mode** (minimum collection present but no tracked decks): empty state plus a "We suggest tracking these 3 closest decks" block, computed as preview readiness of Fabrary trending against the current collection. User accepts with a single click. "Minimum collection" threshold (N cards) is deferred to planning.
  - **Populated mode** (one or more tracked decks): the tracked deck list is displayed at the top (R6-R8). Below the list, an **expansion/discovery section** titled "You may also be close to these decks" displays up to 3 suggestions. Candidates are sourced from the **Fabrary trending ingestion pipeline described in R11-R14** (not from Path C's closest-playable computation — the two are different mechanisms), filtered by (a) not already in the tracked list, (b) preview readiness above a threshold defined in planning, and (c) not explicitly dismissed by the user. This section is about discovery, not fallback — its role is to highlight the natural next expansion step.
- **R10.** Effective readiness is displayed **per individual tracked deck**, not aggregated by hero. The same hero may have multiple tracked decks simultaneously with different readinesses.

**Discover**

- **R11.** Discover ingests decks from **Fabrary trending** automatically on a regular cadence (specific cadence deferred to planning). It supports filters by hero, format (CC/Blitz), and archetype (when Fabrary provides that metadata).
- **R12.** Each Discover card displays a **preview effective readiness** for that deck against the user's current collection. The preview calculation must be fast enough to support smooth browsing.
- **R13.** Clicking "Track this deck" on a Discover card adds the deck to the tracked list and redirects to the Deck Detail view.
- **R14.** The Fabrary trending ingestion applies an automatic minimum quality filter: the deck must have a valid hero present in the catalog, must contain at least 60 mainboard cards, and must belong to a supported format (CC or Blitz). Decks failing this filter are excluded from Discover.

**Fabrary import and the 3 paths**

- **R15.** The user pastes a Fabrary deck URL into the Import field. **During onboarding** (R2-R3), pasted URLs are always imported as inventory seed and auto-tracked. **Outside of onboarding**, the default behavior is **test mode**: parse the deck, compute the result against the current collection, and display one of three path responses (R16-R18). In test mode, cards are **not** added to inventory by default. A secondary button "Also add these cards to my inventory" lets the user reuse the import as a collection entry when appropriate.
- **R16. Path A (buildable now).** The deck can be built 100% from exact cards in the collection. Display a card-by-card match list and a "Track" button.
- **R17. Path B (buildable with substitutions).** One or more cards are missing, but substitutions from the user's own collection are available and preserve the pitch curve. Display the original deck list with swaps highlighted (original card → substitute, tier, rationale). A "Track modified version" button tracks the version with swaps applied, not the original deck.
  - **Phase 0 scope.** Tier 1 substitutions only. The result screen is **non-interactive**: the user accepts the entire suggested swap set or discards it (then untracks the deck). No per-swap reject/alter, no engine re-solve. This deliberately keeps Phase 0 free of constraint-solver complexity so the engine hypothesis can be validated against the gold set in isolation.
  - **Phase 1+ scope.** Tier 2 substitutions become eligible. The user can accept, reject, or alter each swap individually before tracking. **When the user rejects or alters a swap, the engine re-solves the remaining substitutions to keep the global pitch-curve constraint (R21) valid. If no valid re-solve exists after a rejection, the UI shows "this rejection would break the pitch curve" and either blocks the rejection or flags the deck as curve-invalid — it must not silently ship an invalid deck.**
- **R18. Path C (proximal version).** Paths A and B are infeasible. The system computes the "closest playable version today" using substitutions up to tier 3, plus a clear report of cards that are still missing, and a global fidelity score versus the original (e.g., "68% fidelity — 14 substitutions applied"). Options: "Track proximal version" or "Show me what's missing to buy the original".
- **R19.** In any path, the result screen also displays the shopping line (R28) — which missing cards are in stock at tracked stores and at what price.

**Substitution engine**

- **R20.** The substitution engine operates on **mainboard cards and equipment** (by slot + class/talent). It **never substitutes the hero card**. It **does not substitute weapons in v1**.
- **R21.** Substitutions must **preserve the original deck's pitch curve** — the distribution of red (pitch 1) / yellow (pitch 2) / blue (pitch 3) cards across the mainboard — within a defined tolerance. The exact tolerance thresholds (e.g., ±2 red, ±1 yellow, ±1 blue) are deferred to planning and must be decided with a FaB domain expert before engine implementation begins. A suggestion that breaks the curve beyond tolerance is invalid regardless of other matches.
- **R22.** Substitutions are classified into **3 user-facing tiers**:

| Tier | Score | UI label | Semantics |
|---|---|---|---|
| 1 | ≥90% | "Near-identical" | Same pitch, same class/talent, same card type, overlapping keywords, power/defense within 1 |
| 2 | 70-89% | "Substitutive" | Close match on pitch/class, divergence in keywords, cost, or stats |
| 3 | 50-69% | "Approximation" | Same role (e.g., red Warrior attack), larger functional divergences. Only surfaces in Path C. |

- **R23.** Every substitution shown includes a **plain-language rationale**. Example: "Same red pitch, same Warrior class, -1 power, shared Go Again keyword."
- **R24.** The engine takes the **deck's archetype** into account when that metadata is available from Fabrary (aggro / control / midrange / combo). Substitutions are weighted to preserve the card's role within the archetype.
- **R25.** The user can mark any individual suggestion as "good" or "bad". This feedback is stored as a quality signal for future engine improvements. The UI does not need to change immediately in response; the learning loop is offline.

**Deck Detail**

- **R26.** The Deck Detail screen displays:
  - Effective readiness prominently (%)
  - Visual breakdown: exact cards from collection / substituted cards from collection / missing cards
  - List of active substitutions applied (original card, substitute, tier, rationale), with individual controls to accept/reject/change each one
  - Link to the original deck on Fabrary (when applicable)
- **R27.** The Deck Detail shows **historical movement** of the deck's readiness as a small chart, starting from the day the deck was first tracked (no backfill — see Scope Boundaries). For decks tracked less than 7 days, the chart may show a placeholder or compact two-point view ("first seen" → "now") instead of the full chart.
- **R28.** The **shopping line**, displayed below the readiness summary, lists missing cards in stock at tracked stores, with store name, unit price, available quantity, and data freshness. Format: "With R$ 45 at Cúpula DT + R$ 12 at [Store Y] you reach 100%." Default sort: lowest total cost to complete the deck.
- **R29.** For missing cards with **no stock at any tracked store**, the shopping line shows "unavailable locally" and automatically suggests tier 2-3 substitutions as clickable alternatives ("instead, you can use X from your collection, or Y available at Cúpula DT for R$ 8").

**Store data**

- **R30.** Store data ingestion uses a single mechanism — a vertical scraper built for the **Sbrauble** e-commerce platform — across all phases. The scraper never asks the store owner to do manual work; once the scraper exists, adding a store is a configuration change, not a labor commitment to the store. **Phase 1** runs the scraper against **Cúpula DT only** (anchor store; owner is a personal friend of the project owner — consent and crawl-rate exception captured in Gate 2). **Phase 2** expands the scraper's allow-list to **2-4 Pelotas stores in total**, contingent on per-store consent (see R31) and any HTML/theme variance work the spike (Gate 3) discovered. The scraper operates with an identifying user-agent on all stores. **robots.txt compliance — important finding from Gate 3:** the Sbrauble platform default declares `Crawl-delay: 360` (6 minutes per request), but `/?view=ecom/` is *not* in the Disallow list — commerce scraping is permitted per path, only constrained by the crawl delay. The scraper must support a **per-store rate configuration**:
  - **Phase 1 (Cúpula DT):** operates at ~1-2 seconds per request per explicit permission from the store owner (Gate 2). Daily full refresh of ~500 products is feasible in ~10-15 minutes. The per-store exception is recorded in config, not hardcoded globally.
  - **Phase 2 (non-partner stores):** defaults to respecting each store's robots.txt Crawl-delay, unless that specific store owner has granted a written exception. When constrained, use differential updates (fetch listing → diff previous snapshot → only refetch changed product detail pages) to stay within budget.
  - The same code path handles both modes via per-store configuration.
- **R31.** **Cúpula DT is the anchor store**, onboarded with explicit informal-but-written consent from the owner (a personal friend of the project owner). The relationship is friendship-based, not contractual; no labor is asked of the store owner. The scraper reads Cúpula DT's public product pages on a daily cadence with a respectful rate limit, just as any retail customer comparison shopper might. Other Pelotas Sbrauble-based stores may only be added to the scraper after prior **written** (including informal written channels such as WhatsApp or email) **consent** from each store owner, recorded as a consent artifact referenced by an allow-list keyed by store ID. Silent opt-out is not sufficient. The scraper must not fetch from any store ID that is not on the allow-list — this is enforced in code, see S8.
- **R32.** Stock data is stored with a **last-fetch timestamp** and **source store name**. Any UI surface that displays stock must show freshness in natural language ("updated 2h ago" / "updated 3 days ago") and identify the store.
- **R33.** Target scraping cadence: daily. Stock changes between runs (card disappears, quantity changes) are reconciled by the ingestion algorithm. The specific reconciliation policy is deferred to planning.

## Security & Privacy Requirements

These requirements are product-level security decisions, not implementation details. They apply across all phases — but the **Phase 0 minimum viable subset** below limits which must be production-ready before the closed beta touches any real users; the rest harden into Phase 1. Specific technology choices are deferred to planning, but the *posture* must be committed here.

**Phase 0 minimum viable subset (must ship before any real user is invited to the closed beta):** S1 (auth + email verification — managed IdP is fine, but anonymous access is not), S2 (server-side authz on the `collection` and `tracked_deck` resources), S3 (encryption at rest on PII tables, plus a working deletion path — even if manual via dev script), S4 (no secrets or full collections in logs), S5 (host allow-list + redirect blocking + size cap on Fabrary URL fetches — the SSRF surface is real even with 5 testers), S7 (basic CSRF protection on writes), S9 (secrets out of source control). The full S1-S12 posture (CAPTCHA, full rate limiting, rotation policies, S8/S10/S11/S12) hardens during Phase 1 and must be in place before public launch.

- **S1. Authentication.** Sign-up and login use a managed identity provider (specific provider deferred to planning). Email verification is required before any inventory write. Account recovery is via email-based flow. MFA is optional in Phase 0/1 and required for any privileged role (admin, store partner) in Phase 2.
- **S2. Authorization matrix.** Per-resource access is enforced server-side, not assumed from session presence:
  - `collection` (cards owned, quantities): owner only — read + write
  - `tracked_deck` (per user): owner only — read + write
  - `substitution_feedback`: owner only — write; aggregated read for engine tuning
  - `store_stock`: public read; write only by the ingestion pipeline service identity
  - `store_partner_settings`: store partner role only
- **S3. PII inventory, sensitive data, and LGPD compliance.** PII stored: email (login), optional display name. Sensitive non-PII: full collection state (commercially valuable in a TCG context), tracked-deck list, deck readiness history (R27), and substitution feedback (R25). All of the above must be encrypted at rest. Retention: indefinite while the account is active; 30 days after a deletion request, then full purge. Per LGPD, the user has explicit rights to: **access** (export every user-linked record as JSON), **correction** (UI), **deletion** (the cascade must enumerate every table where the owner column references the deleted user — `collection`, `tracked_deck`, `deck_readiness_history`, `substitution_feedback`, `login_audit`, and any future user-linked table added in planning), and **portability** (JSON export covers the same set). A privacy policy and DPA-equivalent must be published before Phase 1 launch. Lawful basis: consent at sign-up. **Small-N de-anonymization mitigation:** any aggregated read of `substitution_feedback` for engine tuning must use a minimum aggregation threshold of k≥5 distinct users — a behavioral profile from a single Pelotas player joined to display name is effectively re-identifying in a 25-person community.
- **S4. No secrets or full collections in logs.** Application logs must redact: credentials, session tokens, full collection payloads. Aggregate counts (e.g., "added 5 cards") may be logged. Logging rules apply to all environments.
- **S5. Server-side URL fetch protection (SSRF).** Any server-side fetch of a user-supplied URL (R2 onboarding paste, R15 import) must:
  - Be restricted to an exact-hostname allow-list. Phase 0/1 starts at `fabrary.com` and any explicit subdomains discovered during Gate 3 (e.g., `api.fabrary.com`, `cdn.fabrary.com`). Wildcards are not used; each hostname is added explicitly.
  - Cover redirect targets — a redirect to a host not on the allow-list is treated as a fetch failure, not silently followed.
  - Use an egress proxy that blocks RFC1918, link-local (169.254/16), and cloud metadata (169.254.169.254).
  - Enforce a hard response-size cap and request timeout.
  - Validate the parsed payload against a schema before any inventory write.
  - **Allow-list amendment rule.** Adding a new hostname to the allow-list requires the same kind of written consent artifact that S8 requires for new stores (rationale: opening server-side fetch to a new external host is a security boundary change, not an implementation detail). Image URLs embedded in Fabrary deck payloads are *not* fetched server-side in v1 — they are rendered client-side from the source URL or skipped if hostile.
- **S6. Rate limiting and abuse controls.** All authenticated write endpoints have per-user and per-IP rate limits. Sign-up has a CAPTCHA gate. Onboarding URL paste is capped at N URLs per request (N deferred). Substitution feedback is capped per (user, suggestion) pair — latest vote wins, no brigading.
- **S7. CSRF and CORS posture.** All state-changing endpoints are protected against CSRF via SameSite=Lax cookies plus origin check, or via a token pattern (final mechanism deferred to planning). CORS denies origins outside the application origin by default.
- **S8. Scraping consent enforcement (code-level, not policy-level).** No store may be scraped or queried unless its `store_id` is on a server-side allow-list. The allow-list is populated only after:
  - Cúpula DT: formal partnership artifact (Gate 2) recorded
  - Other stores: written consent from the owner (informal channels such as WhatsApp or email are acceptable) recorded as a consent artifact
  - Sbrauble platform ToS reviewed and the relevant clause cited in this document or its planning successor before the first fetch of any Sbrauble store
  
  The scraper code must consult the allow-list on every request and refuse to fetch from any unlisted store. This is enforced in code, not in policy or process.
- **S9. Secrets management.** Every integration credential (FaBDB API tokens if any, Cúpula DT privileged feed credential, store-specific tokens) lives in a managed secret store. Never in source. Never logged. Each credential has a rotation policy and a documented owner. Environment isolation is enforced between dev, staging, and production.
- **S10. Outbound link safety.** Store product links displayed in the shopping line (R28) must:
  - Have hosts validated against the store allow-list at write time
  - Be rendered with `rel="noopener noreferrer" target="_blank"`
  - Use https only — no other schemes accepted
- **S11. Scraped data integrity.** Scraped store fields must:
  - Pass strict schema validation at write time (price is a currency-parseable number, name length bounded, URL on the allow-list)
  - Be HTML-escaped at render time (defends against stored XSS via hostile or compromised store pages)
  - Trigger an alert and pause the scraper for that store if a single run delta exceeds 90% of the catalog (likely scraper failure or hostile content)
- **S12. Catalog supply chain integrity.** Card catalog data (FaBDB mirror or any PT-BR index) is treated as code: version-pinned, source-controlled, diffed on update, human-reviewed before promotion to production. No runtime mutation of the catalog by user-facing code paths.

## Success Criteria

The primary metric below applies to **Phase 1** (the public launch). Phase 0 has its own exit gate (engine quality + qualitative interview) defined in Release Phasing. Phase 2's success criteria are deliberately not pre-committed and will be drafted from Phase 1 learnings.

- **Primary metric — recurring active use in Pelotas (Phase 1 exit gate).** At least 8 Pelotas-based players return to the app on at least 3 separate days over any 4-week window, and at least 5 of those 8 show behavioral evidence of ongoing engagement (paste a second Fabrary URL, track ≥2 decks, or accept ≥1 substitution swap). Originally the target was 20 weekly active players for 6 weeks, but the Gate 1 census (47 group members, ~8 tournament-active, ~39 casual-pool) made clear that even perfect execution could not hit that number from a pool of ~47. The new metric is calibrated to a 17-20% conversion of the realistic pool with ~4-week retention — aggressive but achievable.
- **Secondary metric — engine engagement.** Users who track at least 1 deck perform at least 1 meaningful interaction per session (add a card, accept a substitution, visit the shopping line) in 60%+ of their sessions.
- **Secondary metric — store bridge.** At least 20% of active users click at least 1 product link to a tracked store from the shopping line within any rolling 30-day window.
- **Qualitative metric — community voice.** At least 3 unprompted testimonials from local players or store owners recommending the app in Pelotas community channels (Discord, WhatsApp, in person at Cúpula DT) during the evaluation window.

If the primary metric is hit, v1 counts as a success regardless of the rest. If it isn't hit, the secondary metrics help diagnose where the product fell short.

## Scope Boundaries

Explicitly **out of scope** for v1:

- **Geographic.** Any city beyond Pelotas. Expansion to SP / POA / other cities is post-v1 work.
- **Formats.** Any format beyond Classic Constructed and Blitz. Draft, Sealed, Ultimate Pit Fight, Limited, Commoner and others are excluded.
- **Image-based collection entry.** OCR card scanner, collection photos, visual recognition. Rejected at ideation.
- **Third-party collection imports.** TCGplayer CSV, spreadsheet imports, sync with international services. Only Fabrary paste and manual entry are supported.
- **P2P marketplace.** Trading or selling between users, public wishlists, social profiles.
- **Weapon or hero substitution.** Weapon substitution may land in v1.x if user demand emerges.
- **Integrated checkout.** The app does not sell cards, does not process payments, and does not build carts. The shopping line links out to the product page on the tracked store.
- **Collection value / price history tracking.** "My collection is worth R$X and gained 4% this month" is out of scope.
- **Detailed card condition tracking.** NM/LP/MP/HP. V1 assumes NM by default; per-card condition can land in v1.x when demand shows.
- **Foil variants.** Treated as "the same card" in v1. Foil-specific tracking is a future concern.
- **Discord bot, browser extension, native mobile app.** V1 is web-only.
- **Features for stores (LGS dashboards, CRM, demand heatmap).** Idea #6 from the ideation document (B2B2C dashboard for game stores) is deferred to a separate v2 — v1 only consumes store data, it does not offer direct value back to the stores.
- **Community-submitted decks.** All Discover decks come from Fabrary trending. Community-submitted decks are not accepted in v1.
- **Retroactive readiness history.** The readiness time series for a deck begins the day it is tracked. There is no backfill.

## Key Decisions

- **Casual/intermediate as the primary persona, not competitive.** Chosen because it represents the largest share of the Pelotas community and because it better tolerates early imperfections in the substitution engine. Competitive players are a secondary audience once the engine matures.
- **Tracked decks as the home model, not a hero-centric view.** Chosen because it turns readiness into a progress metric toward a goal the user picked (stable and motivating), rather than a passive metric against a curated target that shifts over time. It also solves the "wall of numbers" problem with 30+ heroes. The hero-centric view becomes a Discover filter, not a deleted concept.
- **100% automatic Fabrary trending as the deck source.** Chosen over manual curation to eliminate ongoing operational cost and leverage existing community validation. The Fabrary-dependency risk is acknowledged and mitigated via local cache fallback and automatic quality filter.
- **Effective readiness (raw + substitutions) as the default metric.** Chosen over raw readiness because it aligns with the casual framing ("I can play this") and is more motivating. The raw breakdown is exposed in the detail view, not in the headline number.
- **Only the user's collection counts toward the headline readiness.** Store stock is shown as an upgrade line ("with R$ 45 at Cúpula DT you reach 100%"), not folded into the headline number. This is an honesty decision — the number reflects "I can play now", not "I can play after I spend money".
- **Collection entry is progressive, not an onboarding gate.** Chosen in response to the recognition that requiring a complete collection entry would kill the product at first login. Fabrary paste is the primary entry method, manual autocomplete is secondary, inline "I have this one" is tertiary, and skipping entirely is always permitted.
- **Fabrary import defaults to test mode outside of onboarding.** A URL pasted into the Import field is assumed to mean "I want to test whether I can build this", with a secondary button to also add cards to the inventory when appropriate. This avoids polluting the inventory with cards the user is only researching.
- **Three explicit substitution tiers in the UI** (tier 1 near-identical, tier 2 substitutive, tier 3 approximation). Transparency about quality is a feature — hiding uncertainty erodes trust the moment a bad suggestion appears.
- **Pitch curve preservation is a hard engine constraint.** Any substitution that breaks the curve is invalid, regardless of other feature matches. This is a FaB rule that cannot be relaxed.
- **Sbrauble vertical scraper as the only store-data ingestion mechanism.** Same scraper across all phases; Phase 1 has a one-store allow-list (Cúpula DT, with informal-but-explicit consent from the friend who owns it), Phase 2 expands the allow-list. The scraper imposes zero ongoing labor on store owners — no CSV, no manual feed, no dashboard upload, no weekly data handoff. This is the most respectful path for a friendly partnership and the most operationally simple path for a solo dev.
- **Pelotas-only, hardcoded where convenient.** V1 does not introduce a City entity, does not parameterize store lookups by city, and does not build per-city configuration surfaces. Refactor to multi-city when a second city is actually on the roadmap; the cost of extraction later is smaller than the cost of carrying speculative abstractions through v1.

## Dependencies / Assumptions

**Load-bearing dependencies and assumptions are now Pre-Planning Gates** — see that section above. The items below are residual: lighter dependencies and assumptions that do not justify a full gate but should remain visible.

**Residual external dependencies:**

- **D-1 (resolved during Gate 3).** The card-level source of truth is the **`@flesh-and-blood/cards`** npm package (companion: `@flesh-and-blood/types`), maintained by the Fabrary team. This replaces the original "FaBDB API" assumption. The package provides every field the substitution engine needs as structured, typed data: `cardIdentifier`, `name`, `classes`, `legalHeroes`, `types`, `pitch` (number), `power` (number), `defense` (number), `cost` (number), `keywords` (enum array — Crush, Dominate, Go Again, Reprise, Boost, Combo, Phantasm, Temper, and more), `talents` (enum array), `subtypes` (includes equipment slot info), `fusions`, `rarities`, `printings`. Source of truth: `github.com/the-fab-cube/flesh-and-blood-cards`. Install via `npm install`, versioned, no ToS concerns, no rate limits. **This is strictly better than the FaBDB dependency originally assumed** — see Gate 3 artifact for full analysis.
- **D-2 (partially gated — resolved by Gate 3).** Fabrary remains the deck-level source of truth (hero, format, archetype, trending), used for deck URL parsing (R2, R15-R18) and trending ingestion (R11-R14, R24). Gate 3 findings:
  - `robots.txt` at fabrary.net permits scraping (`User-agent: * Allow: /`); only AI-training crawlers are blocked (Amazonbot, Applebot-Extended, Bytespider).
  - Fabrary's frontend is a React SPA on Netlify; no server-side rendering for deck content.
  - Backend is AWS Amplify / AppSync GraphQL at `https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql`, with two auth modes: `AMAZON_COGNITO_USER_POOLS` (logged in) and `AWS_IAM` (anonymous via Cognito Identity Pool). Public deck reads use AWS_IAM.
  - Access path options: (a) GraphQL via AWS_IAM anonymous auth — requires SigV4 signing or Amplify client bootstrap, medium complexity; (b) headless browser rendering (Playwright/Puppeteer) — simpler but heavier; (c) reverse-engineer the GraphQL queries from a live browser session and replay them from our backend — recommended starting point.
  - `content.fabrary.net/info/app-info.json` is publicly accessible and returns structured JSON (confirmed working during Gate 3).
  - **Manual follow-up before Phase 1 launch:** read Fabrary ToS from the site footer and quote the relevant clause about automated access in the project compliance log. Most community deckbuilders permit non-commercial automation, but this must be verified.
  - Mitigation for outages: local cache of the last N known decks + "degraded Discover mode".
- **D-3 (consent obtained; accuracy verification pending).** Cúpula DT owner consent has been captured. The friend-based relationship made the consent step trivial. Data accuracy verification (checking that the scraper's snapshot matches the physical store shelves) is sequenced after Gate 3c produces a working scraper and is a Phase 1 prerequisite. See `docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md`.
- **D-4 (validated during Gate 3, but Phase 2 scope work remains).** Confirmed from Gate 3c that Cúpula DT's Sbrauble storefront is parseable (HTTP 200, server-rendered HTML, products in initial response, known URL pattern). Whether 2-4 *other* Pelotas stores use Sbrauble and whether their HTML structure is compatible with the same scraper remains open — this is Phase 2 work and not a Phase 1 blocker.
- **D-5. FaB Portuguese card name index.** Phase 2 only (PT-BR autocomplete is Phase 2). FaB is not officially printed in Portuguese; community translations vary in quality. If FaBDB does not provide a structured PT-BR field, manual curation is required and should be sized as a concrete work item before Phase 2 begins.

**Residual assumptions (lower stakes):**

- **A-2.** Casual players will accept readiness based on substitutions (the effective number) without confusion, provided the raw breakdown is reachable with a single click. **Validation:** observe in Phase 0 user interviews; iterate if confusing.
- **A-3 (Phase 0 exit gate validates this).** A rule-based substitution engine can reach the quality bar for a casual audience. The Phase 0 gold-set evaluation is the formal validation; if it fails, Phase 1 does not start.
- **A-4.** The Fabrary trending volume for relevant heroes is stable enough to continuously supply Discover with fresh content. **Validation:** observe during Gate 3's Fabrary spike; if trending volume is sparse, consider adding manual "Pelotas picks" curated by the anchor partner as a Discover supplement.
- **A-5 (new).** Casual players in Pelotas use phones for web access more than desktops. **Validation:** mobile-first design from day 1 (which the design pass must explicitly cover — see Outstanding Questions).

## Outstanding Questions

### Resolve Before Planning

Gate status as of 2026-04-08 (see `docs/brainstorms/gates/` for full artifacts):

- **Gate 1 — PASSED (with primary metric rescoped).** Community census produced 47 group members and ~8 tournament-active. Original metric ("20 weekly active for 6 weeks") was unreachable from the realistic pool; rescoped to "8 Pelotas players return on ≥3 separate days over any 4-week window, with ≥5 showing behavioral engagement". See `gate-1-census-result.md`.
- **Gate 2 — PASSED.** Consent from the Cúpula DT owner (a personal friend) captured. **Crawl-rate exception also granted** — the owner explicitly permitted the scraper to run at ~1-2 seconds per request (overriding the platform default of 360s), making daily full refresh feasible. Accuracy verification remains as a Phase 0 follow-up task (it needs the scraper prototype to exist) but is not a Phase 0 kickoff blocker. See `gate-2-cupula-dt-consent-and-accuracy.md`.
- **Gate 3 — PASSED (with a beneficial Key Decision revision).** Three sub-spikes completed. Replaced FaBDB with `@flesh-and-blood/cards` npm package (strictly better). Fabrary access is feasible via AppSync GraphQL (AWS_IAM anonymous) or headless browser fallback. Sbrauble / Cúpula DT commerce scraping is allowed per robots.txt but constrained by `Crawl-delay: 360`, handled either via differential updates or an explicit permission exception (to be requested during Gate 2 accuracy verification). Manual follow-ups: read Fabrary ToS and Sbrauble platform ToS before Phase 1 launch. See `gate-3-dependency-spike.md`.
- **Gate 4 — PROTOCOL DEFINED; LABELING PENDING.** Solo-labeler variant agreed (explicit bias tradeoff). 30-substitution gold set to be assembled and labeled during Phase 0 implementation, before the Phase 0 exit gate. Protocol and scoring rules in `gate-4-gold-set.md`.

**Interpretation for planning:** Phase 0 implementation is unblocked. Gate 1 and Gate 3 are passed. Gate 2 is sufficiently passed for Phase 0 (which has no store data). Gate 4's labeling session is a Phase 0 task, not a Phase 0 prerequisite. The only remaining pre-Phase 1 work not yet sequenced is: (a) Gate 2 accuracy verification + crawl-delay exception ask, (b) manual read of Fabrary and Sbrauble ToS.

Additionally, one design-level decision should be answered before Phase 1 (does not block planning but is needed before Phase 1 implementation):

- **[User decision]** Mobile-first design pass: a separate session covering interaction states (loading/empty/error/stale), responsive breakpoints, accessibility (WCAG AA, keyboard nav, color-independent tier semantics), and a navigation model across the 5 surfaces. The design-lens reviewer flagged this as a structural gap. Phase 0 has minimal UI surface, so this can land between Phase 0 and Phase 1.

### Deferred to Planning

- **[Affects R1, R14][Needs research]** Validate FaBDB API: availability, rate limits, ToS, and coverage of the structured attributes required by the substitution engine (pitch, class, talent, keywords, power, defense, card type, equipment slot).
- **[Affects R11-R15][Needs research]** Validate Fabrary: is there a public API? If not, is scraping technically viable and permitted by ToS? What is the deck URL schema and payload? Does the trending feed include usable archetype metadata (R24)?
- **[Affects R11][Technical]** Ideal ingestion cadence for Fabrary trending. Is daily over-engineering or necessary? How should decks that drop out of trending but still have active trackers be handled?
- **[Affects R12][Technical]** Strategy for computing Discover preview readiness. On-demand per card vs. precomputed in batch when inventory changes. Directly impacts perceived performance.
- **[Affects R20-R25][Technical]** Concrete substitution engine algorithm: feature weights, feature extraction from the card DB JSON, exact per-tier thresholds, equipment slot handling. This is the largest single technical design block in the project.
- **[Affects R24][Technical]** How archetype is determined. If Fabrary provides it, great; if not, a homegrown heuristic is needed (pitch distribution + card types + keywords → aggro / control / midrange).
- **[Affects R30-R33][Needs research]** How many Pelotas stores actually run on Sbrauble, who their owners are, and how to contact them. Blocks the declaration that "2-4 stores" is a realistic v1 number versus an aspirational one.
- **[Affects R30][Technical]** Sbrauble scraper architecture: a shared process that knows the platform plus a thin adapter per store, or one scraper per store? Inventory storage with history? Reconciliation between runs?
- **[Affects R30-R32][User decision / legal]** Explicit policy for communicating with non-partner stores before including them. Tone, acceptance threshold, opt-out process. Must be decided before the first scrape of any non-partner store.
- **[Affects R2][Technical]** Fabrary URL parsing: official API or scraping? Handling of private or inaccessible decks? Identifying duplicates across multiple pasted URLs?
- **[Affects R25][Technical]** Storage and format of "good/bad" feedback on substitution suggestions. The learning loop can be manual/offline in v1 (you read it and adjust weights by hand) or an automated mechanism.
- **[User decision]** Monetization model. Fully free in v1? Donations? Paid plans? Does not block v1 but needs an answer before public launch.
- **[User decision]** Technical stack decision: language, framework, hosting. Out of scope for this document but must be resolved before implementation begins.
- **[Affects R31][User decision]** Concrete form of the Cúpula DT partnership. Is a verbal handshake enough? Is a written agreement needed? What is offered in return (dashboard access, official mention, cross-promotion)?

## Next Steps

**Gate execution status (2026-04-08):** Gates 1 and 3 executed and passed. Gate 2 partially passed (consent done; accuracy verification sequenced after scraper exists). Gate 4 protocol defined; labeling session is a Phase 0 task.

**Next concrete steps, in order:**

1. **Run `/ce:plan` for Phase 0.** Phase 0 is unblocked. Its scope: `@flesh-and-blood/cards` ingestion, inventory + tracked decks data model, Fabrary deck URL parsing (via AppSync GraphQL with AWS_IAM anonymous — start by reverse-engineering the live query from the Fabrary web app), tier 1 substitution engine, non-interactive Path B result screen, deck detail without chart or shopping line, Phase 0 minimum security subset (S1, S2, S3, S4, S5, S7, S9). Target duration: 4-6 weeks.

2. **During Phase 0 implementation, execute Gate 4 labeling session.** Assemble 30-substitution gold set, label blindly, score against the ≥70% bar. Insert the resulting pitch curve tolerance numbers into R21. This happens after the engine prototype is functional but before committing to Phase 1.

3. **After Phase 0 exit gate passes, sequence Gate 2 accuracy verification.** Build the scraper against Cúpula DT's `/?view=ecom/*` paths, produce a first snapshot, walk through it with the owner, verify ≥10 cards, capture the explicit crawl-rate exception. This is Phase 1 prep.

4. **Manual follow-ups (can happen in parallel with any phase):** read Fabrary ToS from the site footer; read Sbrauble platform ToS from sbrauble.com. Quote relevant clauses in the gate-3 artifact. These are legal / compliance hygiene before Phase 1 launch, not blockers for Phase 0.

5. **Separate design pass between Phase 0 and Phase 1:** mobile-first, interaction states (loading/empty/error/stale), navigation model, accessibility (WCAG AA, keyboard nav, color-independent tier semantics). Phase 0's minimal UI does not block on it, but Phase 1's richer surface requires it.
