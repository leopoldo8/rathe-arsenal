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
- **Phase / Task**: **Phase 2 (all frontend extraction) COMPLETE & committed.** Next: Phase 3 (T13, T14) frontend locale transport + auth error i18n.
- **Completed**: Planning; Phase 1 (T1–T5 + fixes); main merge `8c1aef9`; Phase 2a (T6/T7/T8); 2b (T9 `15019a4`, T10 `f8688b8`); 2c (T11 `a9621e3`, T12 `105fa10`); T12b gap fix `02fbb6d` (12 root components + skeleton labels) + residual fix `ba476b2`. Repo-wide residual sweep CLEAN; web suite green (1327). Notable bumps handled by the orchestrator: a 2b session-limit cutoff (parcial T10 verified+committed), and a T12b worktree/concurrent-agent tangle (adopted the complete green worktree commit `02fbb6d`, discarded a parcial dupe, then fixed 3 missed residuals).
- **In-progress** (file:line): none — between phases.
- **Next step**: dispatch Phase 3 worker (Sonnet) — T13 (inject `Accept-Language` in `lib/auth-fetch.ts` + `lib/api-client.ts`; add `code` to `AuthFetchError` from the envelope) → T14 (map `AuthFetchError.code`→`t('apiErrors.<EAuthErrorCode>')` at auth catch sites; fill `apiErrors` namespace). Then Phase 4 (T15–T18 backend), Verifier (Opus).
- **Blockers**: none.
- **Model policy**: Phases 2–4 in Sonnet, Verifier in Opus (owner-set).
- **Main integration**: done at this checkpoint; future main changes integrate at the next clean-tree checkpoint.
- **Uncommitted files**: `.agents/` + `apps/web/test-results/` untracked (not part of this feature).
- **Branch**: feat/i18n-pt-br-en-us (now includes origin/main @ 512faf2)
