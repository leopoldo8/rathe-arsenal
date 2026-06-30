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

- **Feature**: uxui-remediation — `.specs/features/uxui-remediation/` — **📋 PLANNED, awaiting Execute go-ahead.** Owner said "plan, don't implement yet."
- **Phase / Task**: Specify + Discuss + Design + Tasks complete. `spec.md` (17 reqs UXUI-01..17), `context.md` (decisions D1–D4), `design.md` (3 shared mechanisms + 1 layout change + guards), `tasks.md` (24 atomic tasks across 6 phases; matrix/parallelism/gates + 3 validation tables all green). Source of truth: `docs/audit/uxui-2026-06-29/MAP.md` (81 findings → 12 themes + 4 decisions) + `cluster-*.md` + `_global-crosscheck.md`.
- **Decisions locked (owner)**: D1 mount ReadinessHero as canvas banner · D2 wordmark solid brass · D3 light-theme toggle left as-is (no change) · D4 logged default (tighten add-cards numerals + CardLightbox caption; ratify hero-stats/eyebrows as intentional exceptions). Scope = systemic themes T1–T12 + D1/D2 + standalone P1s (home `window.confirm`, visual-fixture repair); per-surface P2/P3 long-tail deferred to a documented backlog in spec.md.
- **Next step**: On owner go-ahead, run Execute. 6 phases (>3) → offer one worker per phase (offer-then-confirm), then the always-on Verifier. Tools default MCP/Skill NONE; optional `impeccable:polish`/`layout` on visual tasks (open question in tasks.md).
- **Decision candidates to ratify at Execute** (append to Decisions as AD-005/006 if kept): canonical `:focus-visible` convention + guard; no-raw-brand-hex guard.
- **Env caveat**: visual re-baseline (Phase 5, T22–T24) needs dev server + seeded Postgres; if no local DB, defer snapshot regen to CI (mirrors the i18n known-env limitation below), keep unit+typecheck+lint+guards as the local gate.
- **Branch**: currently on `main` (caller switched + fast-forwarded to origin/main @ 431543e before the audit). Execute should start a feature branch (e.g. `feat/uxui-remediation`).

### Prior feature (reference)
- **Feature**: i18n — `.specs/features/i18n/` — **✅ COMPLETE & VERIFIED (PASS).** Ready for delivery; only the owner's call on opening the PR remains.
- **Phase / Task**: All four phases (T1–T18) implemented & committed; independent Verifier passed on the second run.
- **Verification**: Two independent Verifier passes (Opus, author ≠ verifier). Run #1 returned FAIL on two P1 gaps — P1-AC8 (localStorage-unavailable path threw out of `changeLanguage`: a REAL impl gap, not just missing evidence) and P1-AC7 (runtime missing-key fallback was config-only). Fix `9afb58d` added a guarded `safeLocalStorage` cache detector in `apps/web/src/i18n/index.ts` (mirrors the ThemeToggle try/catch) + 3 tests. Run #2 → **PASS**: 12/12 non-deferred ACs spec-anchored, 0 spec-precision gaps, sensor 8/8 mutations killed (incl. the new guard mutation), gate green. Report: `.specs/features/i18n/validation.md`.
- **Completed commits**: Phase 1; main merge `8c1aef9`; Phase 2 (2a/2b/2c + `02fbb6d` + `ba476b2`); Phase 3 — `54849ca`, `62c6c8c`, `6190ba2`; Phase 4 — T15 `020937e`, T16 `21b2ccd`, T17 `920d252`, T18 `a99eef6`; specs `309f719`; handoff `ab22073`; **gap fix `9afb58d`**.
- **Gate (Verifier run #2)**: web typecheck + lint + **1343 tests** green; api typecheck + **849 unit** green; api e2e 29 passed (incl. auth.controller mocked, 17). 2 DB-backed e2e (`theme-persistence`, `plan-b-full-flow`) fail LOCALLY only — KNOWN ENV LIMITATION (no local PostgreSQL on :5432; CI runs them with a Postgres service), cause verified as DB connect, non-i18n.
- **Requirement status**: I18N-01–09 ✅ Verified; I18N-10 ⏸️ Deferred (P3, out of T1–T18 scope, per spec).
- **Lessons**: candidates L-001 (test localStorage-unavailable in-memory fallback) + L-002 (assert runtime missing-key fallback, not just config) recorded in `.specs/lessons.json` / `LESSONS.md`. Earlier process lesson: extraction-style per-task gates should include lint (a residual surfaced only at the Phase-3 build gate).
- **Next step**: Owner decision — open PR `feat/i18n-pt-br-en-us` → `main` (branch is +38 commits ahead; `origin` = github.com/leopoldo8/rathe-arsenal). Nothing else outstanding for this feature. P3 (I18N-10, non-auth error localization) is a separate future follow-up.
- **Blockers**: none.
- **Model policy**: Phases 2–4 in Sonnet, Verifier in Opus (owner-set).
- **Uncommitted files**: `.agents/` + `apps/web/test-results/` untracked (not part of this feature).
- **Branch**: feat/i18n-pt-br-en-us (includes origin/main @ 512faf2)
