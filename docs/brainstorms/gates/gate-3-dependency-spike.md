---
gate: 3
title: External Dependency Feasibility Spike
status: PASSED (with a major Key Decision revision — see Action 1 below)
date: 2026-04-08
owner: Rodrigo
---

# Gate 3 — External Dependency Feasibility Spike

## Summary of findings

Three spikes were executed against the original dependencies (FaBDB, Fabrary, Sbrauble). The most important finding is that **FaBDB is no longer the right dependency for card data** — a better alternative was discovered during the Fabrary spike.

### Action 1 — Replace FaBDB with `@flesh-and-blood/cards`

**Original assumption:** Card catalog data would come from FaBDB (D-1 in the requirements doc).

**Finding:** Fabrary's JavaScript bundle references an npm package called `@flesh-and-blood/cards`, which turns out to be a **fully structured, community-maintained, open-source TypeScript library of FaB card data**. It is maintained by the same people who build Fabrary.

- **Package:** `@flesh-and-blood/cards`
- **Latest version (as of 2026-04-08):** 3.6.242 (and a parallel unscoped `fab-cards` package at v8.0.147)
- **Companion package:** `@flesh-and-blood/types` (card type and enum definitions)
- **Repository:** https://github.com/fabrary/fab-cards
- **Source of truth:** https://github.com/the-fab-cube/flesh-and-blood-cards (maintained by Tyler Luce — the canonical open FaB data repo, data managed in Google Sheets)
- **Install:** `npm i @flesh-and-blood/cards @flesh-and-blood/types`
- **Usage:**

    ```ts
    import { cards } from "@flesh-and-blood/cards";

    cards.forEach((card) => {
      // card.pitch, card.classes, card.talents, card.keywords, ...
    });
    ```

**Schema — every field needed by the substitution engine is present as structured data:**

| Field | Type | Example | Engine usage |
|---|---|---|---|
| `cardIdentifier` | string | `"snatch-red"` | Unique ID for lookups |
| `name` | string | `"Rain Razors"` | UI display |
| `classes` | `Class` enum array | `["Warrior","Wizard"]` | Class matching |
| `legalHeroes` | `Hero` enum array | `["Dromai","Fai"]` | Hero filter |
| `types` | `Type` enum array | `["Attack Action"]` | Card type matching |
| `pitch` | number | `1`, `2`, `3` | **Pitch curve preservation (R21)** |
| `power` | number | `3`, `14` | Stat comparison |
| `defense` | number | `3`, `4` | Stat comparison |
| `cost` | number | `0`, `10` | Cost matching |
| `keywords` | `Keyword` enum array | `["Go Again", "Dominate"]` | **Structured, not free text — R22 tier scoring** |
| `talents` | `Talent` enum array | `["Draconic"]` | Talent matching |
| `subtypes` | `Subtype` enum array | `["1H","Dagger"]` | Equipment slot (R20) |
| `fusions` | `Fusion` enum array | `["Earth","Ice"]` | Fusion-specific rules |
| `rarities` | `Rarity` enum array | `["Majestic"]` | Rarity display |
| `printings` | `Printing` array | see schema | Set/foiling variants |

**Enums available (confirmed from README):**
- `Class`: NotClassed, Generic, Adjudicator, Bard, Brute, Guardian, Illusionist, Mechanologist, Merchant, Ninja, Ranger, Runeblade, Shapeshifter, Warrior, Wizard
- `Talent`: Draconic, Earth, Elemental, Ice, Light, Lightning, Royal, Shadow
- `Type`: Action, Attack Action, Attack Reaction, Defense Reaction, Equipment, Hero, Instant, Mentor, Resource, Token, Weapon
- `Keyword`: Arcane Barrier, Battleworn, Blade Break, Blood Debt, Boost, Channel, Charge, Combo, Crush, Dominate, Essence, Freeze, Fusion, Go Again, Heave, Intimidate, Legendary, Mentor, Negate, Opt, Phantasm, Reload, Reprise, Specialization, Spectra, Spellvoid, Temper, Thaw, Unfreeze
- `Hero`: Arakni, Azalea, Benji, Boltyn, Bravo, Briar, Chane, Dash, Data Doll, Dorinthea, Emperor, Genis Wotchuneed, Ira, Iyslander, Kano, Kassai, Katsu, Kavdaen, Kayo, Levia, Lexi, Oldhim, Prism, Rhinar, Ruu'di, Shiyana, Taylor, Valda, Viserai, Yorick
- `Format`: Blitz, Clash, Classic Constructed, Commoner

**Why this is strictly better than FaBDB:**
1. **Structured typing** — no regex/parsing needed on keywords or types. Every field is an enum or primitive.
2. **Maintained by Fabrary team** — the same people who run the deckbuilder we depend on for Discover. Alignment.
3. **Source of truth is community-canonical** — `the-fab-cube/flesh-and-blood-cards` is the de-facto canonical open data set.
4. **No API, no rate limits, no ToS concerns** — it's an npm package installed locally. Updates via `npm update`.
5. **Deterministic** — the data is the same for every consumer, versioned explicitly.
6. **PT-BR names** — not included in the base package, but the structure is clean enough that a PT-BR alias layer is a trivial addition in Phase 2 (R4).

**Required doc update:** D-1 in the requirements document is rewritten from "FaBDB API" to "@flesh-and-blood/cards npm package". See requirements doc update section below.

### Action 2 — Fabrary for deck parsing and trending

**Investigation:**
- `robots.txt` at https://fabrary.net/robots.txt is permissive (`User-agent: * Allow: /` + `Content-Signal: search=yes,ai-train=no`). Scraping for non-AI-training purposes is allowed. Only AI crawlers (Amazonbot, Applebot-Extended, Bytespider) are blocked.
- **Stack:** React SPA hosted on Netlify Edge. Not server-side rendered.
- **Deck URL pattern:** `fabrary.net/decks/{ULID}` (26-character identifier, e.g., `01G76H1R1ERRBRKS7RVCQAB8RX`).
- **Backend:** AWS Amplify / AppSync GraphQL at `https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql` (confirmed from the JS bundle).
- **Auth modes:** `AMAZON_COGNITO_USER_POOLS` (for logged-in users) and `AWS_IAM` (for anonymous users via Cognito Identity Pool). Public deck viewing uses `AWS_IAM` anonymous access — a standard Amplify pattern where an unauth identity pool grants read-only access to certain operations.
- **CDN:** `content.fabrary.net` and `prod-content.fabrary.io` serve static content. Confirmed that `https://content.fabrary.net/info/app-info.json` returns HTTP 200 with structured JSON data (banners, content submissions, hero identifiers).

**Feasibility of deck import (R2, R15-R18):**
- **Option A — GraphQL unauth:** Use the AppSync endpoint with AWS_IAM anonymous auth via a Cognito Identity Pool. Requires bootstrapping the Amplify client or signing requests manually with SigV4. Non-trivial but well-supported.
- **Option B — Headless browser rendering:** Use Playwright or Puppeteer to load the deck URL and extract the rendered deck list from the DOM. Simpler to set up but heavier at runtime.
- **Option C — Reverse-engineer GraphQL queries from browser DevTools:** Capture the exact GraphQL query used by Fabrary in a real session, then replay it from our backend with AWS_IAM credentials. Most efficient once set up.

**Recommendation:** Start with Option C (capture the real query pattern once) and fall back to Option B (headless browser) only if AWS_IAM anonymous access turns out to be gated or changes in the future.

**Feasibility of trending feed ingestion (R11-R14):**
- Trending is not a static JSON file on the CDN — it's likely a GraphQL query against the same AppSync endpoint.
- Same pattern applies: capture the query from a live Fabrary session, replay it with AWS_IAM credentials, cache results on our side.

**ToS status:** Fabrary has a Terms of Service page (embedded in the JS bundle — accessible via the site footer). **Action:** The project owner must read the ToS manually before Phase 1 goes live and confirm that automated access (scraping or GraphQL) is not prohibited. Most community deckbuilders are silent on this or explicitly permit non-commercial automated use, but we must verify.

### Action 3 — Sbrauble / Cúpula DT scraping

**robots.txt analysis (exact content of https://www.cupuladt.com.br/robots.txt):**

```
User-agent: CloudflareBrowserRenderingCrawler
Disallow: /

User-agent: *
Crawl-delay: 360
Disallow: /index.php
Disallow: /b/
Disallow: /decks/
Disallow: /dks/
Disallow: /*?view=user
Disallow: /*?view=dks/...
Disallow: /*?view=ref2/
Disallow: /*?view=bzr/
Disallow: /*?view=colecao/
Disallow: /*?view=torneios/
Disallow: /*?view=forum/leiloes
Disallow: /*?view=forum/rss
Disallow: /*?view=mp/showcase/...
```

**Key finding 1: the `/?view=ecom/` path is NOT in the Disallow list.** The entire e-commerce catalog is allowed for scraping per robots.txt. The Disallow list targets platform social features (decks, forum, tournaments, marketplace, collection, user views) but leaves the commerce paths open. This is the Sbrauble platform's default policy.

**Key finding 2: `Crawl-delay: 360`** (6 minutes between requests, universal for `User-agent: *`). This is the hard constraint — even though the path is allowed, the Sbrauble platform demands 6 minutes between requests. For a daily full refresh of ~500-1000 FaB products, this means 50-100 hours per scrape, which is infeasible.

**Feasibility test:** Ran `curl -sSI` against `https://www.cupuladt.com.br/?view=ecom/itens&tcg=8` and the listing page. Results:
- HTTP 200 OK
- Cloudflare in front but not challenging (no CAPTCHA interstitial)
- Products are in the initial server-rendered HTML (not JavaScript-hydrated)
- Example product URLs: `/?view=ecom/item&tcg=8&edicao=[ID]&cardID=[CODE]&card=[NUM]`
- Stock displayed inline as "N unid."
- Prices displayed as "R$ N,NN"

**Example products confirmed in dry run (informal, via WebFetch):**
- "5 Copper" — R$ 2,00 — 1 unit
- "A Drop in the Ocean (Blue)" — R$ 0,25 — 37 units
- "Aether Crackers (Cold Foil)" — R$ 49,90 — 1 unit

These are real Flesh and Blood cards with valid Brazilian currency pricing and stock counts — the structure is scrape-friendly.

**Strategy for dealing with the 360s Crawl-delay:**

Two options:
1. **Differential updates.** Fetch the paginated listing (1-2 requests per day) to detect changes, then fetch only changed product detail pages. At ~5-20 requests/day per store, well within 360s × 6 = 36 minutes/day budget.
2. **Explicit permission to exceed the default.** Ask the Cúpula DT owner (the friend) to explicitly permit a higher rate (e.g., 1-2 seconds per request) specifically for the ecom paths. Friend's permission, documented in Gate 2, supersedes the generic platform default for us. This is the cleanest path.

**Recommended path:** Option 2 (explicit permission), with Option 1 (differential updates) as fallback if the friend would rather not grant an exception. This decision becomes part of the Gate 2 conversation — see `gate-2-cupula-dt-consent-and-accuracy.md`.

**Sbrauble platform ToS:** Could not be retrieved via WebFetch or curl (the main sbrauble.com page returned 403 to automated requests). **Action:** The project owner must visit sbrauble.com in a real browser and read the Terms of Use / Termos de Uso page manually, quoting any relevant clauses about automated access. If the platform-level ToS explicitly forbids scraping, the Gate 2 "friend permission" path may or may not be sufficient depending on how strictly the friend reads their own platform agreement. This is a **manual follow-up** that must happen before Phase 1 ships.

## Key Decision consistency check

Gate 3's Action 1 (replacing FaBDB with `@flesh-and-blood/cards`) technically **does not contradict** the existing Key Decisions — the decision was about "seed the catalog from a structured community source", and both FaBDB and `@flesh-and-blood/cards` satisfy that framing. The specific reference in D-1 is updated from "FaBDB API" to "@flesh-and-blood/cards npm package", and the FaB domain expert engagement in Gate 4 does not require FaBDB.

No Key Decisions need to be withdrawn.

## Doc updates triggered by this gate

The following updates must be applied to the requirements document `docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md` before Phase 0 implementation begins:

1. **D-1** should be rewritten from "FaBDB API publicly available..." to "The `@flesh-and-blood/cards` and `@flesh-and-blood/types` npm packages, installed via `npm install`, provide all card metadata and enums required by the substitution engine (R20-R24). These replace the original FaBDB dependency."
2. **R30 and R33** should note the Crawl-delay: 360 constraint and the differential / explicit-permission strategy.
3. **Gate 2** should include the explicit ask to the Cúpula DT owner about exceeding the default crawl rate.
4. **Gate 4** pitch curve tolerance research no longer needs to pull data from FaBDB — it can reference `@flesh-and-blood/cards` directly for curve analysis of real decks.

These updates are applied in the same commit as this gate artifact.

## Decision

**PASS.** All three dependencies have been investigated:

- **Card catalog source:** `@flesh-and-blood/cards` is strictly better than the originally-assumed FaBDB. Structured, typed, zero ToS concerns, zero rate limits. The swap is a net-positive change to the architecture.
- **Fabrary:** Feasible for both deck parsing and trending via AWS Amplify GraphQL (AWS_IAM unauth) or headless browser rendering. ToS must be manually read before Phase 1 launch.
- **Sbrauble / Cúpula DT:** Feasible for ecom scraping; Crawl-delay: 360s constraint exists and must be handled via differential updates or an explicit exception from the store owner. Sbrauble platform ToS must be manually read before Phase 1 launch.

**Residual manual follow-ups (not blocking Phase 0, but required before Phase 1):**
- Read and quote Fabrary ToS from the site footer.
- Read and quote Sbrauble platform ToS (sbrauble.com).
- Ask Cúpula DT owner about the crawl rate exception.
