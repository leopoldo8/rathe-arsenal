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
- **Phase / Task**: **ALL FOUR PHASES (T1–T18) COMPLETE & committed** (HEAD `deb0f79`). The independent Verifier (Opus) was dispatched but LOST when the prior Claude Code process exited — it did NOT finish and `validation.md` was likely never written. Feature implementation is done; only the final Verifier pass remains.
- **Completed**: Planning; Phase 1; main merge `8c1aef9`; Phase 2 (2a/2b/2c + T12b `02fbb6d` + residual `ba476b2`); Phase 3 — T13 `54849ca`, T14 `62c6c8c`, `6190ba2`; Phase 4 — T15 `020937e` (resolveLocale + decorator), T16 `21b2ccd` (localized emails), T17 `920d252` (locale threading), T18 `a99eef6` (error `code` on envelope), specs `309f719`. Gates: web typecheck+lint+1340 tests green; api typecheck + 849 unit green; api auth e2e (17, mocked) green.
- **In-progress** (file:line): none code-wise. ⚠️ UNVERIFIED: the Verifier runs sensor mutations in scratch/stash; if it was killed mid-mutation the real tree MAY hold an un-reverted mutation or a leftover `git stash`. The cleanliness check was interrupted before it ran — do it FIRST next session (see Next step).
- **Known env limitation (NOT a regression)**: 2 DB-backed e2e (`theme-persistence.e2e-spec`, `plan-b-full-flow.e2e-spec`) fail locally with "Unable to connect to the database" (no local PostgreSQL on :5432; no docker-compose in repo). They are pre-existing, non-i18n full-flow tests; CI runs them with a Postgres service. Verified failure cause is DB connect, independent of code.
- **Lesson**: the extraction gate was Quick-web (typecheck + test, NO lint), so `no-unused-vars` + an English status-label residual only surfaced at the Phase-3 build gate. Future per-task gates on extraction-style work should include lint.
- **Next step (DO IN ORDER)**:
  1. **Cleanliness check FIRST** (the lost Verifier may have dirtied the tree): run `git status --porcelain` (expect ONLY untracked `.agents/` + `apps/web/test-results/`), `git stash list`, `git log --oneline -1` (expect `deb0f79`), `ls .specs/features/i18n/validation.md`. If a tracked file shows a stray sensor mutation → `git restore <file>`; if a verifier stash exists → inspect, then drop it. Confirm green with `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web test`.
  2. **Re-dispatch the Verifier** — fresh general-purpose agent, **model opus**. It reads `spec.md` (ACs I18N-01..10) + `.claude/skills/tlc-spec-driven/references/validate.md`, re-derives coverage evidence-or-zero, runs the discrimination sensor in scratch state (~5–7 mutations: flip `resolveLocale` fallback `'pt-BR'`→`'en-US'`; break `convertDetectedLanguage` en-branch; null-out `auth-fetch` `code` parse; swap a `localizeAuthError` code mapping; drop `code` from `http-exception.filter` envelope; swap an email template pt/en subject; mismatch a pt/en catalog key → must trip `catalog-parity.spec.ts`), writes `.specs/features/i18n/validation.md`, returns PASS/FAIL + ranked gaps. Tell it the 2 DB e2e are a KNOWN ENV LIMITATION (no local Postgres), NOT an i18n gap. (Full prior prompt is in the chat transcript.)
  3. If **PASS** → wrap up: summarize to owner + offer to open a PR (`feat/i18n-pt-br-en-us` → `main`). If **FAIL** → route ranked gaps as fix tasks (bounded 3 iterations), then re-verify.
- **Blockers**: none.
- **Model policy**: Phases 2–4 in Sonnet, Verifier in Opus (owner-set).
- **Main integration**: done at this checkpoint; future main changes integrate at the next clean-tree checkpoint.
- **Uncommitted files**: `.agents/` + `apps/web/test-results/` untracked (not part of this feature).
- **Branch**: feat/i18n-pt-br-en-us (now includes origin/main @ 512faf2)
