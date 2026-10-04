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

## Handoff

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
