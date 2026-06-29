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

## Handoff

- **Feature**: i18n — `.specs/features/i18n/`
- **Phase / Task**: **Phase 3 (frontend transport + auth error i18n) COMPLETE & committed.** Next: Phase 4 (T15–T18 backend i18n).
- **Completed**: Planning; Phase 1; main merge `8c1aef9`; Phase 2 (2a/2b/2c + T12b `02fbb6d` + residual `ba476b2`); Phase 3 — T13 `54849ca` (Accept-Language in both wrappers + AuthFetchError.code), T14 `62c6c8c` (apiErrors namespace + localizeAuthError helper, applied to 6 auth surfaces, removed English formatRateLimitMessage), plus `6190ba2` (status-label residual + 2 lint errors the build gate surfaced). All web gates green: typecheck + lint + 1340 tests.
- **In-progress** (file:line): none — between phases.
- **Lesson**: the extraction gate was Quick-web (typecheck + test, NO lint), so `no-unused-vars` from the t()-migration (orphan STATUS_LABELS imports) + an English status-label residual only surfaced at the Phase-3 build gate. Future per-task gates on extraction-style work should include lint.
- **Next step**: dispatch Phase 4 worker (Sonnet) — T15 (`resolveLocale` + `@AcceptLanguage()` decorator), T16 (localized email templates + EmailService locale param), T17 (thread locale through auth controllers/service), T18 (expose error `code` on the API envelope). Backend = NestJS + Jest (`pnpm --filter @rathe-arsenal/api test` / `test:e2e`). Then Verifier (Opus).
- **Blockers**: none.
- **Model policy**: Phases 2–4 in Sonnet, Verifier in Opus (owner-set).
- **Main integration**: done at this checkpoint; future main changes integrate at the next clean-tree checkpoint.
- **Uncommitted files**: `.agents/` + `apps/web/test-results/` untracked (not part of this feature).
- **Branch**: feat/i18n-pt-br-en-us (now includes origin/main @ 512faf2)
