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

- **Feature**: pre-launch-hardening — `.specs/features/pre-launch-hardening/` — **✅ COMPLETE & VERIFIED (independent Verifier PASS, iteration 2).** Branch `feat/pre-launch-hardening` (off `main`, planning commit `48768a9`). Two closed-invite (Cúpula DT ~47) launch changes: (1) LSS fan-content disclaimer surface, (2) env-gated Sentry error monitoring.
- **Tasks (13, all committed)**: Phase 1 T1 `3c0580f` (`about` i18n catalog, verbatim en-US disclaimer). Phase 2 T2 `81ae4f1` (Footer in AppShell), T3 `3faacec` (public `/about`), T4 `8a0e21c` (anon AuthLayout line), T5 `db23df8` (README block) — Footer + /about got `impeccable:polish`. Phase 3 T6 `c84331f` (`initWebSentry` gated), T7 `5910092` (AppErrorBoundary + RootErrorFallback + main.tsx wiring — app's first error boundary), T8 `0b8357c` (`@sentry/vite-plugin` sourcemap upload, token-gated). Phase 4 T9 `46f82e3` (`SENTRY_DSN` EnvDto), T10 `52024b8` (`initApiSentry` in bootstrap), T11 `80cfb2c` (HttpExceptionFilter captures 5xx/non-HTTP only), T12 `67a5ad2` (api tsconfig sourcemaps + `--enable-source-maps` start + deploy-railway.md). Phase 5 T13 `3b676df` (`.env.example` Sentry vars).
- **Deps added**: `@sentry/react ^10.62.0`, `@sentry/node ^10.62.0`, `@sentry/vite-plugin ^5.3.0` (dev), `@types/node` (dev, for `process.env` in vite.config). All Sentry behavior is a NO-OP without DSN/token env vars (dev/CI unaffected).
- **Verification**: Verifier iteration 1 (Opus) → FAIL on 3 test-strength gaps (all impl correct): DISC-01 no AppShell-mounts-Footer test, DISC-04 `<Link>`-vs-bare-`<a>` mutant survived (href-only assertion), OBS-02 capture-half of AND-conjunction unasserted. Fix worker (Sonnet, test-only) → F1 `eba3940` (AppShell.spec), F2 `4797afb` (router-Link `data-tsr-link` marker on Footer + about + AuthLayout), F3 `30db0f6` (+ `5ddc47a` typecheck fixup) (Sentry.ErrorBoundary wiring assertion). Verifier iteration 2 (Opus) → **PASS**: 3/3 previously-open mutants now killed, 21/21 ACs spec-anchored, 14/14 requirement IDs ✅ Verified. Report: `.specs/features/pre-launch-hardening/validation.md`.
- **Gate**: web typecheck + lint + **1525 passed / 1 pre-existing skip / 0 failed** (120 files); api typecheck + lint + **857 unit passed / 0 failed**; engine build green. api `test:e2e` NOT run locally (no local Postgres — CI-deferred; the filter change is additive and does not alter the response envelope). Fix pass touched only `*.spec.tsx` (zero source files).
- **Lessons**: candidates L-007, L-008, L-009 recorded in `.specs/lessons.json` / `LESSONS.md` (integration-not-just-unit mount test; SPA-Link vs bare-anchor discrimination marker; assert both halves of an AND-conjunction AC). Process note confirmed: quick (vitest) gate does NOT typecheck — phase workers must end on a BUILD gate (two `noUncheckedIndexedAccess` errors surfaced only at build).
- **Next step**: Owner decision on finish — open PR `feat/pre-launch-hardening` → `main` (matches the #104/#108 precedent; CI runs the full suite incl. api e2e with a Postgres service) OR direct merge. `origin` = github.com/leopoldo8/rathe-arsenal. Post-launch follow-ups still open (not this feature): the deployment-IaC gap (scraper/purge cron workers + Railway `startCommand` not in repo — T12 documented the api start command in deploy-railway.md but did not add a `railway.json startCommand`).
- **Model policy**: phase workers in Sonnet, Verifier in Opus (owner-set).
- **Blockers**: none.
- **Uncommitted files (non-feature, pre-existing)**: `.agents/`, `.specs/features/uxui-remediation/validation.md`, `apps/web/test-results/` — untracked, not part of this feature.

### Prior completed features (reference)
- **uxui-remediation** — `.specs/features/uxui-remediation/` — ✅ COMPLETE & VERIFIED, merged to `main` (PR #108). a11y/impeccable-bans/ReadinessHero remediation; 24 tasks, Verifier PASS.
- **swap-copies-grouping** — `.specs/features/swap-copies-grouping/` — ✅ PASS, on `main` (AD-005, frontend-only `× N` grouping).
- **i18n** — `.specs/features/i18n/` — ✅ COMPLETE & VERIFIED (PASS), on `main` (PR #104). pt-BR/en-US via i18next (AD-001..004).
- **Known env limitation**: no local PostgreSQL — DB-backed api e2e (`theme-persistence`, `plan-b-full-flow`) run in CI only (Postgres service), not locally.
