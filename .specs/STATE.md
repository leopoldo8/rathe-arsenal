# STATE

## Decisions

### AD-001
- **Decision**: Frontend i18n is owned by an `i18next` + `react-i18next` + `i18next-browser-languagedetector` stack; all user-facing UI strings go through `t()`/the locale catalogs — no hardcoded user-facing literals.
- **Reason**: Industry-standard for React SPA; detection, localStorage caching, fallback, interpolation, and plural come out of the box; compatible with React 19.
- **Trade-off**: 3 new runtime deps (~40kb gz) over a hand-rolled context.
- **Scope**: `apps/web` — every component/route rendering user-facing text.
- **Date**: 2026-06-28
- **Status**: active

### AD-002
- **Decision**: Supported locales are exactly `pt-BR` (default + fallback) and `en-US`, addressed by full BCP-47 regional tags everywhere (catalog keys, `<html lang>`, `Accept-Language`); preference persists in `localStorage` only (no backend column); no locale prefix in URLs.
- **Reason**: Owner decisions this session; regional tags avoid the `supportedLngs` region-resolution pitfall; client-only persistence keeps the backend untouched for preference storage.
- **Trade-off**: Language preference does not sync cross-device the way `theme` does.
- **Scope**: `apps/web` (locale resolution/persistence) and `apps/api` (locale parsing).
- **Date**: 2026-06-28
- **Status**: active

### AD-003
- **Decision**: User-facing API error messages are localized in the client by mapping a stable `code` that the error envelope exposes (extends the existing CSV opaque-code pattern); the backend translates only content with no client to translate (auth emails).
- **Reason**: Keeps error i18n where the active locale already lives; avoids threading locale into every service throw-site.
- **Trade-off**: Every new user-facing error must define a stable code + a client `apiErrors.<code>` entry.
- **Scope**: `apps/api` error envelope + `apps/web` error rendering.
- **Date**: 2026-06-28
- **Status**: active

### AD-004
- **Decision**: The active locale is transported to the API via the `Accept-Language` header, injected centrally in both HTTP wrappers (`lib/auth-fetch.ts` and `lib/api-client.ts`); backend resolves it with a shared `resolveLocale()` and threads it explicitly to the email call sites (no AsyncLocalStorage/CLS).
- **Reason**: Standard HTTP mechanism; two central injection points cover all calls; only 3 call sites need the value server-side.
- **Trade-off**: New server-side request-scoped values would need explicit threading until a context mechanism is introduced.
- **Scope**: `apps/web` HTTP layer + `apps/api` auth/email controllers & services.
- **Date**: 2026-06-28
- **Status**: active

### AD-005
- **Decision**: Identical per-copy substitution suggestions (same deck + original card + substitute card) are grouped into a single row in the UI layer (`apps/web`), shown with a `× N` copies indicator and "all copies" actions. The decision model stays binary per `(userId, deckId, substituteIdentifier)`; one decision applies to every copy in a group. The engine's per-copy expansion (`packages/engine/src/readiness/compute.ts` Pass 2 emits one `substituted` entry per missing copy) is intentionally left in place.
- **Reason**: Frontend-only grouping removes duplicate rows without touching backend/engine/migrations; the binary decision already covers all copies, so "accept all" is free. True per-copy partial decisions (accept 1 of N, persisted) would require a schema + engine change and were deferred by the owner this session.
- **Trade-off**: No per-copy partial accept; any non-grouping consumer of the snapshot still sees per-copy entries. Root-cause engine fix logged in `docs/phase-1-followups.md`.
- **Scope**: `apps/web` — Swaps page (`/swaps`) + deck-detail breakdown (`/decks/:id`) substitution rendering + decisions.
- **Date**: 2026-06-29
- **Status**: active

### AD-006
- **Decision**: Swap suggestions become persisted rows with their own stable id, minted by the engine and reused across recomputations, replacing today's model where a suggestion is a transient engine output (`substituted: [{ original, match }]`) and only the user's binary decision persists, keyed by `(userId, trackedDeckId, cardIdentifier)`. The full lifecycle ships with the redesign: approve, revert, reject with an optional reason, restore, and an optional post-play outcome.
- **Reason**: The redesigned Swaps screen offers Reverter and Restaurar actions and shows a rejection reason in quotes; none of those are addressable without a durable identity for a suggestion. Owner chose the persisted-row option over keying endpoints by `(deckId, cardIdentifier)`.
- **Trade-off**: Requires reconciliation whenever the engine recomputes — matching a fresh proposal to an existing row, and retiring rows the engine no longer proposes without deleting decided history. This is the highest-risk part of the redesign and the most likely source of silent bugs.
- **Scope**: `packages/engine` (suggestion identity + rejected-pair suppression input), `apps/api` (new table, migration, five endpoints), `apps/web` (Swaps screen).
- **Date**: 2026-08-16
- **Status**: active

### AD-007
- **Decision**: AD-005's `× N` copy grouping survives the redesign. Identical suggestions for multiple copies of the same card in the same deck stay collapsed into one row, one decision applies to all copies, and the grouping is adapted into the handoff's row design (which does not specify it).
- **Reason**: The handoff was written without knowledge of AD-005; taking it literally would reintroduce the duplicate rows that AD-005 removed. Per-copy partial decisions remain deferred.
- **Trade-off**: Requires design work the handoff does not supply, and the persisted-row model (AD-006) has to decide whether rows are per-copy or per-group.
- **Scope**: `apps/web` Swaps screen + whatever AD-006 persists.
- **Date**: 2026-08-16
- **Status**: active

### AD-008
- **Decision**: Writes that add to a `collection_card` quantity use one atomic statement, `INSERT ... ON CONFLICT ("userId","cardIdentifier","sourceId") DO UPDATE SET quantity = LEAST(collection_card.quantity + EXCLUDED.quantity, 20)`, with duplicate identifiers summed before the statement. Read-then-update is not used for new increment paths.
- **Reason**: The card scanner commits many cards at once and can race another tab or device; read-then-update loses an increment under concurrency. First introduced by `POST /api/collection/cards/batch` (card-scanner, Landing door 3).
- **Trade-off**: `CollectionService.addCard` keeps its read-then-update until someone migrates it; two increment styles coexist meanwhile.
- **Scope**: `apps/api` collection writes.
- **Date**: 2026-10-04
- **Status**: active

### AD-009
- **Decision**: Picking an alternative for a missing card is a deck change: the pick moves the original's missing copies to the chosen card in `deck_card`, and a separate `card_replacement` row (status `active` | `kept` | `reverted` | `removed`, never deleted) remembers the original. While a replacement is active, readiness gives its copies no engine stand-in on every recompute path.
- **Reason**: Owner chose it in the card-alternatives discovery (`.design/card-alternatives.md`, Key decisions 1, 2 and 4) knowing the deck stops matching its imported decklist at pick time; the record lives outside `deck_card` because every composition save deletes and reinserts those rows.
- **Trade-off**: Turning picks back into pinned stand-ins later needs a pinned-substitute engine input and user-created rows in swap reconciliation.
- **Scope**: `packages/engine` (optional protected-copies input to `computeEffectiveReadiness`), `apps/api` (new table, replacement routes, `SubstitutionService.runReadiness`, `DecksService.updateComposition`), `apps/web` (deck detail).

### AD-010
- **Decision**: Synergy between a card and a deck is judged by a language model, Gemini 3.8 Flash, given the deck list, the hero and each candidate's rules text, returning a ranked top list. Claude Opus 5.5 is the equal-quality alternative. A keyword and subtype heuristic does not judge synergy well enough.
- **Reason**: Synergy spike (`.specs/features/synergy-spike/`, result in `scripts/synergy-spike/out/result.md`, verified PASS): on the owner's three decks, blind-judged, Gemini 3.8 Flash had 5, 7 and 10 of its top 10 accepted and Opus 5.5 had 5, 7 and 9, both passing the 5-of-10 bar on every deck; GPT-6.1 Sol and MiMo-V2.6-Pro failed the Kayo deck; the heuristic failed all three (that comparison is confounded by row position, see the spike's implementation notes). Gemini cost 0.137 USD for the three decks against 0.82 USD for Opus.
- **Trade-off**: The Kayo deck sat exactly on the bar for both passing models, so quality is good on most decks and thin on some. Each judgment is a paid external call taking seconds, so it cannot sit on an interactive path without caching. Gemini's list price doubles on 2027-01-01. Which API serves it in the product (Google directly or OpenRouter) is not decided here.
- **Scope**: the Recommendations feature and the in-group order of card alternatives (design `.design/card-alternatives.md`, sections Synergy spike and Recommendations).
- **Date**: 2026-10-04
- **Status**: active

### AD-011
- **Decision**: Language-model work runs as rows in a Postgres job table (`recommendation_run`, at most one `pending` and one `running` row per deck through partial unique indexes, coalesced by one atomic `INSERT ... ON CONFLICT ... DO UPDATE`) drained by the existing `variant-queue-worker` process in a loop of its own; no request path calls a model. The model is Gemini 3.8 Flash called directly on Google's `generateContent` REST endpoint with plain `fetch` and `GEMINI_API_KEY`, which only the worker reads and which is optional in the environment schema.
- **Reason**: card-recommendations (`.specs/features/card-recommendations/plan.md`, Landing doors 5, 7 and 8): a call takes about a minute, must survive deploys, and must not stall variant fetches; the design (`.design/card-recommendations.md`) chose Google directly, free tier first.
- **Trade-off**: A second job kind shares one process with the variant queue, so a crash takes both down until Railway restarts it. Switching to OpenRouter or another model replaces the client and its outcome table. Runs are never pruned.
- **Scope**: `apps/api` (`recommendations` module, `stores/variant-queue-worker.ts`, deck-list writers that enqueue), the `scrapper-worker` Railway service environment.
- **Date**: 2026-10-06
- **Status**: active

## Handoff

- **Feature**: card-recommendations — `.specs/features/card-recommendations/` — plan and checks written on an autonomous run (owner away), profile `standard` provisional. Branch `feat/card-recommendations` in worktree `.claude/worktrees/card-recommendations`, based on `5ad1916`, not pushed. Per-deck recommendations judged by Gemini 3.8 Flash (AD-010, AD-011): queued runs drained by the worker, the deck-page panel, the home clear-upgrade marker, dismiss, adopt as a `card_replacement` with `pickedFrom = 'recommendation'`, and the alternatives in-group order.
- **Blocks go-live**: `GEMINI_API_KEY` on the `scrapper-worker` service, and the migration on production. The live Gemini request shape is unproven until the first real run.
- **Tests**: run this branch's api e2e against `postgresql://postgres:dev@localhost:5432/rathe_arsenal_recs`, a separate database in the same container, so the new tables and the six-value `pickedFrom` CHECK never reach the dev database the `main` checkout synchronizes.

### Previous handoff

- **Feature**: card-alternatives — `.specs/features/card-alternatives/` — built and VERIFIED (PASS, round 5 scoped, profile standard), merged to `main` as #130; the synergy spike (AD-010) merged as #131.
- **Deviations**: 1-20 in `.specs/features/card-alternatives/implementation-notes.md`.
- **Open, owner**: the 0.05 owned bonus in the alternatives order is uncalibrated (plan open question 1); case-insensitive tag uniqueness (`IDX_deck_tag_user_name_ci`) and `user.preferences` still differ between migrations and entities.

### Older handoff

- **Feature**: card-scanner — `.specs/features/card-scanner/` — **built and VERIFIED (PASS, round 3, independent Verifier, profile standard)**. Merged to `main` as #122. Phone-camera scanning at `/add-cards/scan`: on-device OCR of the collector code with a 3-variant vote, per-card notice with Wrong + name search, review list, one atomic batch commit (AD-008).
- **Deviations**: DEV-01..08 in `.specs/features/card-scanner/implementation-notes.md` (index shape grouped by card, tesseract.js 7, all 15 core files ship ~53 MB, confirm on the bar, re-arm rule, 2x2 tabs on phones, vitest on half the cores, e2e apps on 127.0.0.1).
- **Open, owner**: real-device recognition rate unmeasured (33/38 right, 0 wrong on clean official images); a commit retried after a lost response adds twice; `add-cards` visual baseline tolerates the fourth tab (1% diff), consider refreshing baselines.
- **Since #122**: full-screen page with flashlight (#128), camera focus, lens choice, 2x zoom and `?debug=1` readout (#129), faster OCR and resolver fixes (#132), pt-BR "Não é essa" label (#133), tilt correction with a capture margin (#134). Next steps, ranked: `.specs/features/card-scanner/ocr-roadmap.md`.
- **Gate for this feature**: as below, plus `apps/web` OCR benchmark (`recognition-benchmark.spec.ts`, ~60 s, downloads 38 LSS images into gitignored `apps/web/.cache/` on first run) and `tests/e2e/card-scanner-flow.spec.ts` (Chromium fake camera, needs `pnpm dev`).

- **Latest work**: AI-slop audit — `docs/audit/ai-slop-2026-10-03/inventory.md` (findings, owner decisions, what shipped, deviations). Shipped in #115 (dead code), #116 (copy pass), #117 (localized engine reasons), #118 (deck detail and home), #119 (swaps, library, sources, new deck, settings).
- **Feature**: product-redesign — `.specs/features/product-redesign/` — all 10 phases complete and merged to `main` (#110), followed by post-launch polish #111–#114. Every deviation (DEV-01..31) and the provisional calls live in `implementation-notes.md`.
- **Provisional, owner to confirm**: DEV-20 bulk actions (sequential calls, 50-row cap), DEV-12 `cardCounts` on `GET /api/decks`, DEV-14 DECK-02 "Comprar tudo" → link to the shopping list, DEV-19 onboarding keeps the top nav, DEV-22 Sources chevron removal, DEV-14 decklist "by type" cannot split attack vs non-attack actions (catalog `types[0]`).
- **Open follow-ups**: recompute paths other than swap mutations do not take the deck lock (DEV-10); `review_aggregate` table is now unused (drop needs a migration); owner visual sign-off against the prototype (unreachable from the run, DEV-01).
- **Deploy step**: run `pnpm --filter @rathe-arsenal/api backfill:swap-suggestions` once right after the first deploy (`scripts/deploy-railway.md`).
- **Gate**: `pnpm typecheck`, `pnpm lint`, engine/api/web unit, api `test:int` and `test:e2e` (`--runInBand` under load), and both Playwright projects (`cd apps/web && npx playwright test`, needs `pnpm dev` running; `pnpm seed:fixture` resets the fixture).
- **Local DB**: Docker container `rathe-arsenal-pg` (DEV-04); `docker start rathe-arsenal-pg` after a reboot.
- **Blockers**: none.

### Prior completed features (reference)
- **uxui-remediation** — `.specs/features/uxui-remediation/` — ✅ COMPLETE & VERIFIED, merged to `main` (PR #108). a11y/impeccable-bans/ReadinessHero remediation; 24 tasks, Verifier PASS.
- **swap-copies-grouping** — `.specs/features/swap-copies-grouping/` — ✅ PASS, on `main` (AD-005, frontend-only `× N` grouping).
- **i18n** — `.specs/features/i18n/` — ✅ COMPLETE & VERIFIED (PASS), on `main` (PR #104). pt-BR/en-US via i18next (AD-001..004).
- **pre-launch-hardening** — `.specs/features/pre-launch-hardening/` — ✅ COMPLETE & VERIFIED, merged to `main` (PR #109).
