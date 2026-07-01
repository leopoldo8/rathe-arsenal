# Pre-Launch Hardening Validation

**Latest status**: ✅ **PASS** (Iteration 2, 2026-07-01) — see [Iteration 2](#iteration-2--re-verification-2026-07-01) below. Iteration 1's original report (FAIL, 3 test-strength gaps) is preserved unmodified further down for history.

---

## Iteration 2 — Re-Verification (2026-07-01)

**Spec**: `.specs/features/pre-launch-hardening/spec.md`
**Diff range**: `c46fc26..5ddc47a` (4 fix commits on `feat/pre-launch-hardening`, on top of the `main..c46fc26` range validated in Iteration 1)
**Verifier**: independent sub-agent (author ≠ verifier), fresh from Iteration 1's verifier — re-derived all evidence from scratch, did not inherit Iteration 1's assertions as given

### Scope

Iteration 1 (`c46fc26`) returned ⚠️ Issues / FAIL-equivalent with 3 test-strength gaps (implementation was already functionally correct by source inspection; the tests just didn't discriminate). A fix worker then landed 4 **test-only** commits (`eba3940`, `4797afb`, `30db0f6`, `5ddc47a`) strengthening exactly those 3 gaps. This iteration independently re-runs the discrimination sensor against all 3 in scratch state and re-runs the full gate.

### Fix commits since Iteration 1

| Commit | Files touched | Type |
| ------ | -------------- | ---- |
| `eba3940` | `AppShell.spec.tsx` | test-only |
| `4797afb` | `Footer.spec.tsx`, `about.spec.tsx`, `AuthLayout.spec.tsx` | test-only |
| `30db0f6` | `AppErrorBoundary.spec.tsx` | test-only |
| `5ddc47a` | `AppErrorBoundary.spec.tsx` (typecheck fix) | test-only |

**Non-test-file check**: `git diff --stat c46fc26..5ddc47a -- . ':!*.spec.tsx'` → **empty**. `git diff --stat c46fc26..5ddc47a` → 5 files changed, all `__tests__/*.spec.tsx`, 124 insertions(+), 6 deletions(-). **Confirmed: zero source (non-test) files changed** — the fix was strictly test-strengthening, as instructed.

### Discrimination Sensor Re-Check (the 3 previously-open mutants)

All 3 mutations were re-injected independently in the real working tree (not assumed from Iteration 1's report), tests re-run, mutation reverted via `git checkout --`, and `git status`/`git diff` confirmed clean before moving to the next mutation.

| # | Requirement | File:line mutated | Mutation | Iteration 1 result | Iteration 2 result |
| - | ----------- | ------------------ | -------- | ------------------- | -------------------- |
| 1 | DISC-01 (AC1) | `apps/web/src/components/shell/AppShell.tsx:48` | Removed `<Footer />` from the render tree | ❌ No test covered this (GAP, not a survived mutant — untested) | ✅ **Killed** — `AppShell.spec.tsx`: 2/2 new tests failed: `AppShell — footer / disclaimer (DISC-01) > renders the localized disclaimer text from the mounted Footer` and `> renders a link to /about from the mounted Footer` (`getByText`/`getByRole('link', {name:'Sobre'})` threw `TestingLibraryElementError: Unable to find...`). 13 pre-existing `AppShell.spec.tsx` tests still passed. |
| 2 | DISC-04 (AC5) | `apps/web/src/components/shell/Footer.tsx:2,25-27` | Swapped `<Link to={'/about' as any}>` for a raw `<a href="/about">` (removed the `Link` import) | ❌ **Survived** — all 3 `Footer.spec.tsx` tests stayed green | ✅ **Killed** — `Footer.spec.tsx`: 1/3 tests failed: `Footer > renders the /about link via router <Link> (href, not a bare full-reload anchor)` — the new `expect(aboutLink).toHaveAttribute('data-tsr-link', 'true')` assertion failed (`data-tsr-link` marker absent because the mocked `Link` was never invoked by a bare anchor). 2 other Footer tests still passed. |
| 3 | OBS-02 (AC3) | `apps/web/src/components/error/AppErrorBoundary.tsx` | Replaced `<Sentry.ErrorBoundary fallback={...}>` with a hand-rolled plain React `class extends React.Component` error boundary (no Sentry import) | ⚠️ Not independently asserted (spec-precision gap — "captured by Sentry" half of the AND had no assertion) | ✅ **Killed** — `AppErrorBoundary.spec.tsx`: 1/5 tests failed: `AppErrorBoundary — Sentry capture wiring (OBS-02) > delegates to Sentry.ErrorBoundary with RootErrorFallback as its fallback` (`errorBoundaryMock` never invoked — `toHaveBeenCalledTimes(1)` failed with 0 calls). **The other 4 pre-existing fallback-render tests still passed** (the plain boundary still renders `RootErrorFallback` on error, so the fallback-render half is unaffected by this mutation) — this independently demonstrates the AND-conjunction's two halves are now separately, correctly discriminated: the capture-wiring test fails only on loss of Sentry wiring, the fallback-render tests fail only on loss of fallback UI. |

**Sensor result: 3/3 previously-open mutants killed.**

Post-sensor cleanup verified: `git status --short` and `git diff` on all 3 mutated files (`AppShell.tsx`, `Footer.tsx`, `AppErrorBoundary.tsx`) show zero diff — real working tree fully restored after each mutation.

### Spot-checks requested by the orchestrator

- **OBS-02 AND-conjunction, both halves now asserted**: Confirmed. `AppErrorBoundary.spec.tsx` has (a) 4 pre-existing tests against the real, un-mocked `@sentry/react` module proving the fallback renders (`role="alert"`, heading, throwing content replaced) — the "fallback UI SHALL render" half; and (b) 1 new test (`AppErrorBoundary — Sentry capture wiring (OBS-02)`) that mocks `@sentry/react` via `vi.doMock` + `vi.resetModules()` + dynamic import (scoped to its own `describe`, doesn't affect the real-SDK suite) and asserts `AppErrorBoundary` delegates to `Sentry.ErrorBoundary` with `RootErrorFallback` as its `fallback` prop — the "captured by Sentry" half. Both halves independently killed by the sensor mutation (see row 3 above).
- **DISC-04 not closed by weakening**: Confirmed by reading the diff (`git show 4797afb`). The pre-existing `expect(aboutLink).toHaveAttribute('href', '/about')` assertion is **still present, unchanged** — the fix *added* `expect(aboutLink).toHaveAttribute('data-tsr-link', 'true')` immediately after it, it did not replace the href check. The router mock was also extended (not replaced) to stamp `data-tsr-link="true"` only when the mocked `Link` component is actually invoked, so a bare anchor bypasses the mock and lacks the marker — this is what gives the assertion mechanism-discriminating power that a bare `href` check lacks.

### Gate Check (Iteration 2)

- **Gate command**: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web lint && pnpm --filter @rathe-arsenal/web test`
- **`web typecheck`**: exit 0, no errors
- **`web lint`**: exit 0, no errors/warnings
- **`web test`**: **120 test files passed (120), 1525 tests passed, 1 skipped (1526 total)**
- **Test count before (Iteration 1)**: 1522 passed + 1 skipped = 1523 total
- **Test count after (Iteration 2)**: 1525 passed + 1 skipped = 1526 total
- **Delta**: **+3 new tests** — matches the fix commits exactly: 2 new tests in `AppShell.spec.tsx` (DISC-01) + 1 new test in `AppErrorBoundary.spec.tsx` (OBS-02) + 0 new tests in `Footer.spec.tsx`/`about.spec.tsx`/`AuthLayout.spec.tsx` (DISC-04 strengthened existing test bodies with an added assertion, no new `it()` blocks)
- **Failures**: none
- **api**: not re-run this iteration — confirmed via `git diff --stat` that zero `apps/api/**` files changed since Iteration 1 (fix commits touched only `apps/web/**/__tests__/*.spec.tsx`); Iteration 1's api gate result (857/857 passed, typecheck/lint green) stands unchanged.

### Requirement Traceability Update (Iteration 2)

| Requirement | Iteration 1 Status | Iteration 2 Status |
| ----------- | ------------------- | -------------------- |
| DISC-01 | ⚠️ Needs Fix (Fix 1) | ✅ **Verified** |
| DISC-04 | ⚠️ Needs Fix (Fix 2) | ✅ **Verified** |
| OBS-02 | ⚠️ Needs Fix (Fix 3) | ✅ **Verified** |
| All other requirements (DISC-02/03/05/06, OBS-01/03/04/05/06/07/08) | ✅ Verified | ✅ Verified (unchanged, not in scope this iteration) |

### Iteration 2 Summary

**Overall**: ✅ **PASS** — all 3 Iteration 1 gaps closed by test-only strengthening; zero source-file changes; gate fully green with 3 new discriminating tests; no regressions (1525/1525 passing, same 1 pre-existing unrelated skip).

**Spec-anchored check**: 21/21 ACs now clean PASS (was 18/21 in Iteration 1).
**Sensor (re-check)**: 3/3 previously-open mutants killed.
**Gate**: web typecheck ✅, web lint ✅, web test 1525 passed / 1 skipped (1526 total), 0 failed.

**What changed since Iteration 1**: Nothing in behavior — only test coverage. `AppShell.spec.tsx` gained an integration-level assertion that the composed shell actually mounts `Footer`'s disclaimer/link. `Footer.spec.tsx` (and the two other components sharing the same router-mock pattern) gained a `data-tsr-link` marker assertion that discriminates TanStack `<Link>` from a hand-written anchor, closing the SPA-navigation regression guard. `AppErrorBoundary.spec.tsx` gained a companion suite (mocked `@sentry/react`, scoped via `vi.doMock`/`vi.resetModules`) proving the boundary delegates to `Sentry.ErrorBoundary`, closing the "captured by Sentry" half of the AC3 conjunction.

**Next steps**: None — feature is verifier-clean. Ready to route through the normal `finishing-a-development-branch` flow at the owner's discretion (merge/PR), no outstanding fix tasks.

---

# Iteration 1 (original report, preserved for history)

**Date**: 2026-07-01
**Spec**: `.specs/features/pre-launch-hardening/spec.md`
**Diff range**: `main..HEAD` (16 commits, `48768a9`..`c46fc26` on `feat/pre-launch-hardening`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1–T13 | ✅ Done | All 13 tasks committed per `tasks.md` header; commit hashes verified against `git log --oneline main..HEAD` |

---

## Spec-Anchored Acceptance Criteria

### P1: Fan-content IP disclaimer surface

| # | Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| - | -------------------------- | --------------------- | ------------------------ | ------ |
| AC1 | Any authenticated shell route renders → `AppShell` renders persistent footer w/ disclaimer + `/about` link | Footer content visible when `AppShell` renders | `apps/web/src/components/shell/AppShell.tsx:48` — `<Footer />` mounted after `<main>` (source-verified); `apps/web/src/components/shell/__tests__/Footer.spec.tsx:45-64` tests `Footer` **standalone**, not via `AppShell`. No test in `AppShell.spec.tsx` renders `AppShell` and asserts footer/disclaimer presence. | ⚠️ **GAP** (partial) — component-level PASS, `AppShell`-integration untested |
| AC2 | en-US locale → verbatim disclaimer string | Exact string incl. `™`/`®`/comma, matching `docs/research/ip-posture.md:82` | `apps/web/src/i18n/__tests__/about-catalog.spec.ts:20-22` — `expect(enUS.about.disclaimer).toBe(VERBATIM_EN_DISCLAIMER)`. Cross-checked char-for-char vs. `ip-posture.md:82` — exact match. Mutation-killed (Sensor #3). | ✅ PASS |
| AC3 | pt-BR locale → translation preserving trademark substrings | `Flesh and Blood™`, `Legend Story Studios®`, entity names preserved | `apps/web/src/i18n/__tests__/about-catalog.spec.ts:24-27` — `toContain('Flesh and Blood™')`, `toContain('Legend Story Studios®')`; `Footer.spec.tsx:51-57` | ✅ PASS |
| AC4 | `/about` renders (a) disclaimer + (b) fan-project context | Both sections present | `apps/web/src/routes/__tests__/about.spec.tsx:44-53` (disclaimer), `:56-60` (fan-project body) | ✅ PASS |
| AC5 | Footer `/about` link uses TanStack `<Link>` (SPA), not bare anchor | Navigation mechanism must be `<Link>` | `Footer.spec.tsx:59-64` asserts `href="/about"` only. **Surviving mutant**: replaced `<Link to="/about">` with a raw `<a href="/about">` in `Footer.tsx` (import removed) — all 3 Footer tests still passed (mutation not killed). The global router mock renders `Link` as `<a href>`, so the assertion can't distinguish SPA `<Link>` from a hand-written anchor. | ⚠️ **Spec-precision gap / surviving mutant** — asserts destination, not mechanism |
| AC6 | pt-BR/en-US catalogs compiled → new keys exist in both, parity green | `catalog-parity.spec.ts` stays green | `apps/web/src/i18n/__tests__/catalog-parity.spec.ts:24-28` (ran green, full suite); `about-catalog.spec.ts:29-33` (about-namespace-specific parity) | ✅ PASS |
| AC7 | `README.md` → disclaimer block above technical setup, verbatim | Verbatim en-US line present, positioned above setup | `README.md:5` — `> **Disclaimer.** Rathe Arsenal is in no way affiliated...` positioned above line 7 ("Private closed-beta web app...") and all setup instructions. Grep-confirmed exact string. Doc-only task (Test Coverage Matrix marks doc/config rows "none — grep asserted in Done-when") — not a gap, matches design. | ✅ PASS (doc-only, by design) |

**Status**: ❌ 5/7 clean PASS, 2 flagged (1 GAP, 1 spec-precision gap / surviving mutant)

### P1: Sentry production error monitoring

| # | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| - | --------- | --------------------- | ------------------------ | ------ |
| AC1 | web boots, non-empty `VITE_SENTRY_DSN` → init exactly once w/ that DSN | `Sentry.init` called once, with DSN | `apps/web/src/observability/__tests__/sentry.spec.ts:39-51` — `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith({dsn,...})`. Mutation-killed (Sensor #1). | ✅ PASS |
| AC2 | web boots, absent/empty DSN → no init, boot unaffected | No `Sentry.init` call; app still boots | `sentry.spec.ts:29-37` (both empty-string + undefined branches); `apps/web/src/main.tsx:13` calls `initWebSentry()` unconditionally, no branching around render. Mutation-killed (Sensor #1). | ✅ PASS |
| AC3 | React render error → captured by Sentry AND fallback UI renders | Both capture + fallback occur | `apps/web/src/components/error/__tests__/AppErrorBoundary.spec.tsx:40-50` (fallback `role=alert` renders), `:52-60` (heading, not blank), `:62-72` (throwing content replaced). "Captured by Sentry" is **not independently asserted** — `@sentry/react` is deliberately un-mocked (per file docstring) so no spy exists on `captureException`/`ErrorBoundary`'s internal call; the test only proves the fallback-UI half. | ⚠️ **Spec-precision gap** (partial) — fallback-render half PASS; capture half relies on documented SDK behavior, not an assertion |
| AC4 | api bootstraps, non-empty `SENTRY_DSN` → init exactly once | `Sentry.init` called once, with DSN | `apps/api/src/observability/__tests__/sentry.spec.ts:40-51` — `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith({...})`; `apps/api/src/main.ts:17` wires `initApiSentry(...)` post-`NestFactory.create`. | ✅ PASS |
| AC5 | api bootstraps, absent/empty DSN → no init, boot unaffected | No init call | `apps/api/src/observability/__tests__/sentry.spec.ts:26-37` (both branches, `result === false`) | ✅ PASS |
| AC6 | Filter catches non-HTTP OR HttpException status≥500 → `captureException` called | Capture triggered on 5xx/non-HTTP | `apps/api/src/common/filters/__tests__/http-exception.filter.spec.ts:90-105` (non-HttpException), `:107-122` (500) — both assert `captureExceptionMock` called once with the exception **AND** response envelope preserved (`success`/`statusCode`/`error`/`timestamp`). Mutation-killed (Sensor #2). | ✅ PASS |
| AC7 | Filter catches 4xx `HttpException` → does NOT call `captureException` | No capture on 4xx | `http-exception.filter.spec.ts:124-138` — asserts `captureExceptionMock` **not** called, envelope preserved. Mutation-killed (Sensor #2). | ✅ PASS |
| AC8 | Either SDK inits → `sendDefaultPii:false`, `tracesSampleRate:0`, no replay | Exact option values asserted | web `sentry.spec.ts:45-50` asserts full argument object incl. `integrations: []`; api `sentry.spec.ts:46-50` asserts full argument object. Both assert on the actual argument, not just call count. | ✅ PASS |
| AC9 | `validateEnv` w/o `SENTRY_DSN` passes (optional); w/ `SENTRY_DSN` accepted | Both branches pass | `apps/api/src/config/__tests__/env.dto.spec.ts:138-141` (absent → `toBeUndefined()`), `:143-147` (present → `toBe(dsn)`) | ✅ PASS |
| AC10 | `.env.example` documents `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` optional, no-op notes | All 5 keys present w/ notes | `.env.example:44-57` — grep-confirmed all 5 keys present with "absent → disabled" notes. Doc-only (matches Test Coverage Matrix). | ✅ PASS (doc-only, by design) |
| AC11 | `web build` w/ `SENTRY_AUTH_TOKEN` (+org/project) → plugin uploads; w/o → build succeeds, no upload/error | Token-gated plugin inclusion; build never fails | `apps/web/src/observability/__tests__/sentry-vite.spec.ts:31-43` (absent/empty → `[]`, plugin not called), `:45-61` (present → 1 plugin w/ org/project/authToken); `apps/web/vite.config.ts:20` wires `...sentryWebPlugins(process.env)` last in plugin list. **Directly re-verified**: ran `pnpm --filter @rathe-arsenal/web build` with no `SENTRY_AUTH_TOKEN` set in this environment — build succeeded (`✓ built in 2.08s`), no upload attempted, no error. Mutation-killed (Sensor #4). | ✅ PASS |
| AC12 | api build → `tsc` emits sourcemaps; start command runs w/ `--enable-source-maps` | `.js.map` emitted; start script includes flag | `apps/api/tsconfig.json:10` — `"sourceMap": true`; `apps/api/package.json:9` — `"start": "node --enable-source-maps dist/main.js"`; `scripts/deploy-railway.md:32-38` documents the required Railway custom start command. **Directly re-verified**: ran `pnpm --filter @rathe-arsenal/api build` — emitted 274 `.js.map` files incl. `dist/main.js.map`. Doc/config-only (no unit test, matches Test Coverage Matrix). | ✅ PASS |

**Status**: 11/12 clean PASS, 1 spec-precision gap flagged

### P2: Disclaimer on anonymous auth pages (DISC-06)

| # | Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| - | --------- | --------------------- | ------------------------ | ------ |
| AC1 | Any anon auth route renders → `AuthLayout` renders persistent disclaimer/`/about` link at bottom | Link/disclaimer present, independent of `footer` prop | `apps/web/src/components/auth-layout/__tests__/AuthLayout.spec.tsx:169-177` (no `footer` prop → link present), `:179-188` (`footer` prop present too → link still present, proving independence). Source: `AuthLayout.tsx:106-112` renders unconditionally. **Verified all 6 anon routes use `AuthLayout`**: `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `check-your-email.tsx` all import/render it (grep-confirmed). Unlike AC1 in the P1 story, `AuthLayout` itself is the component under test, so no separate integration gap here. | ✅ PASS |
| AC2 | Link activation → navigates to `/about` | href/target is `/about` | `AuthLayout.spec.tsx:176,187` — `toHaveAttribute('href', '/about')` | ✅ PASS |

**Status**: ✅ 2/2 PASS

**Overall AC status**: 18/21 clean PASS, 3 flagged (1 coverage GAP, 2 spec-precision gaps/surviving mutants) — none block core functionality; all are test-strength issues, not implementation defects.

---

## Discrimination Sensor

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `apps/web/src/observability/sentry.ts:19` | Flipped DSN-empty guard `if (!dsn)` → `if (dsn)` in `initWebSentry` | ✅ Killed — 3/3 tests in `sentry.spec.ts` failed |
| 2 | `apps/api/src/common/filters/http-exception.filter.ts:18` | Changed capture condition `status >= 500` → `status >= 400` | ✅ Killed — "does NOT capture a 4xx" test in `http-exception.filter.spec.ts` failed |
| 3 | `apps/web/src/i18n/locales/en-US/about.ts:3` | Dropped `™` after "Flesh and Blood" in the verbatim en-US disclaimer | ✅ Killed — 3 tests failed across `about-catalog.spec.ts`, `Footer.spec.tsx`, `about.spec.tsx` |
| 4 | `apps/web/src/observability/sentry-vite.ts:18` | Inverted the `SENTRY_AUTH_TOKEN` gate (kept plugin construction unreachable but changed guard polarity so the no-token branch stopped returning `[]`) | ✅ Killed — 2/3 tests in `sentry-vite.spec.ts` failed |
| 5 (extra, beyond the 4 suggested) | `apps/web/src/components/shell/Footer.tsx:24-26` | Replaced `<Link to={'/about' as any}>` with a raw `<a href="/about">` (removed `Link` import) | ❌ **Survived** — all 3 `Footer.spec.tsx` tests still passed; confirms the AC5 spec-precision gap above |

All mutations applied via direct edit + `git checkout -- <file>` revert per mutation; working tree confirmed clean (`git status --short`) before and after each mutation and at sensor completion.

**Sensor depth**: lightweight (5 mutations — 4 suggested + 1 additional targeted at the AC5 concern surfaced during spec-anchored review)
**Result**: 4/5 killed, 1 survived → surfaced as a fix task (see Ranked Gaps)

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| No features beyond what was asked | ✅ |
| No abstractions for single-use code | ✅ |
| Only touched files required for task | ✅ (46 files changed, all traceable to a task in `tasks.md`) |
| Didn't "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ (CSS-module convention, `useTranslation`, router-mock pattern reused throughout) |
| Spec-anchored outcome check (asserted values match spec-defined outcome) | ⚠️ 3 flagged (AC1, AC3-Sentry, AC5) — see table above |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ⚠️ AppShell↔Footer integration path uncovered |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every new/modified test file carries an explicit AC/requirement-ID docstring |
| Documented guidelines followed | `.claude/rules/testing.md` (AAA, `__tests__/` co-location — followed); `CLAUDE.md` TDD — followed per commit sequence (T1 catalog before consumers) |

---

## Edge Cases (from spec.md)

- [x] `VITE_SENTRY_DSN`/`SENTRY_DSN` malformed → SDK's own init handles it, no bespoke validation (design decision, not separately tested — SDK behavior trusted per design.md Risk table; reasonable, not flagged as a gap)
- [x] Sentry not initialized, filter calls `captureException` → SDK no-ops silently — implicitly covered: `AppErrorBoundary.spec.tsx` exercises the real (un-mocked) SDK with no DSN configured in the test env and does not throw
- [x] Active locale falls back to pt-BR → footer renders pt-BR disclaimer — the app's i18n fallback mechanism is a pre-existing, separately-tested concern (`i18n-boot.spec.ts`); not re-tested here, reasonable reuse
- [x] `/about` visited while logged out → renders without redirect — `about.spec.tsx:63-69` asserts no `AppShell`/`AuthLayout` wrapper (no banner/nav landmarks), consistent with unauthenticated rendering

---

## Gate Check

- **Gate command (web)**: `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web lint && pnpm --filter @rathe-arsenal/web test`
- **Gate command (api)**: `pnpm --filter @rathe-arsenal/engine build && pnpm --filter @rathe-arsenal/api typecheck && pnpm --filter @rathe-arsenal/api lint && pnpm --filter @rathe-arsenal/api test`
- **Result**: all green
  - `engine build`: exit 0 (tsc, no errors)
  - `web typecheck`: exit 0 (tsc --noEmit, no errors)
  - `web lint`: exit 0 (eslint, no warnings/errors)
  - `web test`: **120 test files passed, 1522 tests passed, 1 skipped** (1523 total) — matches the author's `tasks.md` claim ("Web 1522 passed") independently reproduced
  - `api typecheck`: exit 0 (tsc --noEmit, no errors)
  - `api lint`: exit 0 (eslint, no warnings/errors)
  - `api test`: **72 test suites passed, 857 tests passed** — matches the author's `tasks.md` claim ("Api 857 passed") independently reproduced
  - Additionally re-ran (beyond the mandated gate, to close AC11/AC12 evidence): `pnpm --filter @rathe-arsenal/web build` (succeeded, no token) and `pnpm --filter @rathe-arsenal/api build` (emitted 274 `.js.map` files)
- **`api test:e2e`**: intentionally **not run** — requires local Postgres (unavailable in this environment); CI-deferred per the orchestrator's explicit scope instruction. Changes in this feature are additive to the error path (Sentry capture call) and do not alter the response envelope (confirmed by the "preserves the response envelope" assertions in `http-exception.filter.spec.ts`), so this is a low-risk deferral, not a coverage hole.
- **Test count before feature**: not independently re-derived (would require checking out `main` and running the suite) — the diff stat shows 9 new/modified test files, matching the task list's "Test files in scope."
- **Test count after feature**: web 1523 (1522 passed + 1 pre-existing skip), api 857
- **Skipped tests**: 1 web test skipped — pre-existing, not introduced by this feature (not in the diff's touched test files)
- **Failures**: none

---

## Fix Plans (ranked gaps)

### Fix 1: AC1 (DISC-01) — no `AppShell`-level test asserts the footer renders

- **Root cause**: `Footer.spec.tsx` tests the `Footer` component in isolation; `AppShell.spec.tsx` (pre-existing file, extended by nothing in this feature) never asserts footer/disclaimer content. The mount itself (`AppShell.tsx:48`) is correct by source inspection, but the AC as written ("WHEN AppShell renders THEN...") is about the composed shell, not the standalone component.
- **Fix task**: Add one test to `apps/web/src/components/shell/__tests__/AppShell.spec.tsx` that renders `<AppShell>` and asserts the disclaimer text (or a stable `role="contentinfo"`/footer landmark) and the `/about` link are present in the rendered tree.
- **Priority**: Minor — the underlying behavior is correct (verified by source read); this is a coverage/regression-safety gap, not a functional defect. Low risk of drift since `Footer` is a 30-line component with its own solid test.

### Fix 2: AC5 (DISC-04) — SPA-link assertion doesn't discriminate `<Link>` from a bare anchor

- **Root cause**: The shared router mock (`vi.mock('@tanstack/react-router', ...)`) renders `Link` as `<a href={to}>`, so any component's rendered DOM looks identical whether it uses TanStack's `<Link>` or a hand-written `<a>`. The test only asserts the resulting `href`, which a bare anchor would also satisfy. Confirmed via mutation: swapping `Footer.tsx`'s `<Link>` for a raw `<a href="/about">` left all 3 `Footer.spec.tsx` tests green.
- **Fix task**: Either (a) add an assertion that the mocked `Link` component was actually invoked (e.g., spy on the mock factory and assert it was called with `to="/about"`), or (b) drop the router mock for this specific assertion and use `MemoryHistory`/`RouterProvider` so a real `<Link>` vs. `<a>` distinction is observable (e.g., via `data-*` markers TanStack Router attaches, or a full-reload vs. client-side-nav behavioral check). Option (a) is the cheaper fix given the existing mock infrastructure.
- **Priority**: Minor — functionally the app uses `<Link>` (confirmed by source read of `Footer.tsx:25`, `AuthLayout.tsx:109`, `about.tsx:35`), so there's no live behavior bug; this only weakens the regression guard against a future accidental swap to a bare anchor (which would cause a full page reload, a real but not urgent UX regression risk).

### Fix 3: AC3-Sentry (OBS-02) — "captured by Sentry" half of the AC is not independently asserted

- **Root cause**: `AppErrorBoundary.spec.tsx` intentionally uses the real (un-mocked) `@sentry/react` module so the "renders fallback even without a DSN" behavior is exercised authentically. This is a reasonable choice, but it means no test proves `captureException`/`ErrorBoundary`'s reporting path actually fires — the AC's "captured by Sentry AND fallback renders" conjunction only has the fallback half under direct assertion.
- **Fix task**: Add a test that mocks `@sentry/react`'s `ErrorBoundary`/`captureException` (similar to the pattern in `sentry.spec.ts`) to assert the boundary's `onError`/capture path is invoked when a child throws, as a companion to the existing un-mocked "fallback renders" tests (keep both — one proves capture wiring, the other proves the no-DSN UX safety net).
- **Priority**: Minor — `Sentry.ErrorBoundary` is a third-party primitive whose capture behavior is documented and stable; the risk of silent regression here is low, but the AC's conjunction ("AND") is not fully evidenced per evidence-or-zero.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| DISC-01 | Implementing | ⚠️ Needs Fix (Fix 1) |
| DISC-02 | Implementing | ✅ Verified |
| DISC-03 | Implementing | ✅ Verified |
| DISC-04 | Implementing | ⚠️ Needs Fix (Fix 2) |
| DISC-05 | Implementing | ✅ Verified |
| DISC-06 | Implementing | ✅ Verified |
| OBS-01 | Pending | ✅ Verified |
| OBS-02 | Pending | ⚠️ Needs Fix (Fix 3) |
| OBS-03 | Pending | ✅ Verified |
| OBS-04 | Pending | ✅ Verified |
| OBS-05 | Pending | ✅ Verified |
| OBS-06 | Pending | ✅ Verified |
| OBS-07 | Pending | ✅ Verified |
| OBS-08 | Pending | ✅ Verified |

---

## Summary

**Overall**: ⚠️ Issues (3 minor, non-blocking gaps — all test-strength weaknesses, not functional defects)

**Spec-anchored check**: 18/21 ACs clean PASS; 3 flagged (1 coverage GAP — AC1/DISC-01; 2 spec-precision gaps/surviving mutants — AC5/DISC-04, AC3-Sentry/OBS-02)
**Sensor**: 4/5 mutations killed; 1 survived (directly corresponds to the AC5 gap)
**Gate**: web (typecheck+lint+test) green, 1522/1522 web tests passed + 1 pre-existing skip; api (typecheck+lint+test) green, 857/857 api tests passed; engine build green; web/api production builds independently re-verified for OBS-07/OBS-08

**What works**: All 21 ACs have functionally correct, source-verified implementations. The verbatim disclaimer is character-exact against `ip-posture.md`. Both Sentry init helpers are properly DSN-gated with privacy-minimal config asserted on the full argument object (not just call count). The `HttpExceptionFilter` correctly satisfies the payload/conjunction rule (capture behavior AND preserved response envelope both asserted, on both the positive and negative 4xx case). Sourcemap gating (web token, api `--enable-source-maps`) is correctly wired and independently re-verified by running real builds. All 6 anon auth routes confirmed (by import grep) to route through the single `AuthLayout` that carries the disclaimer.

**Issues found**:
1. `AppShell` never gets a test-level assertion that it actually renders `Footer`'s content (source-correct, test-uncovered).
2. The `/about` link "must use `<Link>`, not a bare anchor" requirement (AC5) is asserted only by destination `href`, not by mechanism — a mutation swapping in a raw anchor survived.
3. OBS-02's "captured by Sentry" half of the conjunction has no direct assertion (only the fallback-UI half is proven).

**Next steps**: Route Fix 1–3 (all Minor priority, none require behavior changes — only additional/strengthened test assertions) to an implementer. Given all three are Minor and the underlying implementation is functionally correct by source inspection, this is a judgment call for the orchestrator/owner on whether to fix before merge or track as a fast-follow — none block the closed-invite launch functionally, but per the project's TDD/testing guidelines, closing them keeps the regression net intact.
