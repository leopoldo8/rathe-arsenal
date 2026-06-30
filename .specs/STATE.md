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

## Handoff

- **Feature**: swap-copies-grouping — `.specs/features/swap-copies-grouping/` — **✅ COMPLETE & VERIFIED (PASS).** Frontend-only grouping of identical per-copy substitutions on the Swaps page + deck-detail breakdown (AD-005). Awaiting owner's call on integration (PR/merge).
- **Phase / Task**: Phase 1 (Swaps) + Phase 2 (deck-detail), 5 tasks, all done via Sonnet phase-workers; Verifier (Opus) PASS on iteration 2.
- **Verification**: Independent Verifier (Opus, author ≠ verifier). Run #1 → FAIL on 4 coverage gaps (SWAPGRP-05 collapsed surviving mutant, SWAPGRP-12/14/15 uncovered) — all test-only, impl correct. Fix `3c21c38` added 6 tests; reset-key hardening `b3e3d9c` killed the residual L-005 mutant. Run #2 → **PASS**: 17/17 ACs spec-anchored, 0 gaps, discrimination sensor clean. Report: `.specs/features/swap-copies-grouping/validation.md`.
- **Completed commits**: plan `2166108`; Phase 1 — T1 `eed37c6`, T2 `e21c9fc`, T3 `9b155c1`; Phase 2 — T4 `a2df54a`, T5 `eb4719b`; verifier docs `436e10a`/`f01e555`; fix `3c21c38`; reset hardening `b3e3d9c`.
- **Gate**: web `pnpm --filter @rathe-arsenal/web test` **1393 passed / 1 skipped** (pre-existing `contrast.spec.ts` describe.skip, not in branch diff) + typecheck + lint green. No backend/engine/api changes (frontend-only).
- **Requirement status**: SWAPGRP-01–17 ✅ Verified.
- **Lessons**: L-005 (assert bulk reset ops keyed by substitute id, not just `reset: true`) recorded; addressed in `b3e3d9c`.
- **Next step**: Owner decision — integrate `feat/swap-copies-grouping` (branched off `origin/main` @ `436d8bb`). Optional self-validation: Playwright visual baselines change (the `× N` badge + grouped rows on Swaps + deck-detail) — refresh via `pnpm --filter @rathe-arsenal/web test:visual:update` when convenient. Engine per-copy expansion root cause logged in `docs/phase-1-followups.md` (revisit only if true per-copy partial decisions are wanted).
- **Blockers**: none.
- **Model policy**: phase workers in Sonnet, Verifier in Opus (owner-set this session).
- **Uncommitted files**: `.agents/` + `apps/web/test-results/` untracked (not part of this feature).
- **Branch**: feat/swap-copies-grouping (off origin/main @ 436d8bb).
