# Pre-Launch Hardening Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/pre-launch-hardening/design.md`
**Status**: In Progress — Phase 1 ✅ (T1 `3c0580f`, web 1502 passed) · Phase 2 ✅ (T2 `81ae4f1`, T3 `3faacec`, T4 `8a0e21c`, T5 `db23df8`, web 1512 passed)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `.claude/rules/testing.md` (80% target, `__tests__/` co-location, AAA), `CLAUDE.md` (TDD), existing samples `apps/web/src/**/__tests__/*.spec.tsx` (114 files), `apps/api/src/**/__tests__/*.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| React component (Footer, /about, AuthLayout, AppErrorBoundary, RootErrorFallback) | unit | 1:1 to ACs + listed edge cases (both locales, `/about` link href, fallback renders on child throw) | `apps/web/src/**/__tests__/*.spec.tsx` | `pnpm --filter @rathe-arsenal/web test` |
| i18n catalog (`about`) | unit | verbatim en-US disclaimer string asserted + key parity green | `apps/web/src/i18n/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/web test` |
| Web helper (`initWebSentry`, vite plugin gate) | unit | both branches — DSN present/absent, auth-token present/absent | `apps/web/src/**/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/web test` |
| API config (`env.dto`) | unit | `validateEnv` passes without `SENTRY_DSN`; accepts it when present | `apps/api/src/config/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/api test` |
| API helper (`initApiSentry`) | unit | both branches — init called with DSN, skipped without | `apps/api/src/**/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/api test` |
| API filter (`HttpExceptionFilter`) | unit | captures on non-HTTP + status≥500; does NOT capture on 4xx | `apps/api/src/common/filters/__tests__/*.spec.ts` | `pnpm --filter @rathe-arsenal/api test` |
| Config / doc (vite.config, tsconfig, package.json start, `.env.example`, `README.md`, `deploy-railway.md`) | none | build gate + verbatim grep asserted in Done-when | — | build gate |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Web unit (Vitest/jsdom) | Yes | per-test RTL cleanup, fully mocked, no shared store | 1438-test i18n/uxui precedent runs green |
| API unit (Jest, `createMock`) | Yes | mocked deps, no DB connection | existing `apps/api/src/**/__tests__/*.spec.ts` |
| API e2e (Jest + Postgres) | No | shared DB | `*.e2e-spec.ts` — **not touched by these tasks** |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (web) | After a web unit task | `pnpm --filter @rathe-arsenal/web test` |
| Quick (api) | After an api unit task | `pnpm --filter @rathe-arsenal/api test` |
| Build (web) | End of a web phase / config task | `pnpm --filter @rathe-arsenal/web typecheck && pnpm --filter @rathe-arsenal/web lint && pnpm --filter @rathe-arsenal/web test` |
| Build (api) | End of an api phase / config task | `pnpm --filter @rathe-arsenal/api typecheck && pnpm --filter @rathe-arsenal/api lint && pnpm --filter @rathe-arsenal/api test` |
| Full | Final, before hand-off | Build (web) + Build (api) + `pnpm --filter @rathe-arsenal/api test:e2e` (Postgres; CI-deferred locally per STATE env caveat — these tasks don't alter e2e behavior) |

---

## Execution Plan

### Phase 1: Disclaimer content foundation (Sequential)
```
T1
```

### Phase 2: Disclaimer surfaces (Parallel OK)
```
        ┌→ T2 [P]
T1 ────┼→ T3 [P]
        └→ T4 [P]
   T5 [P] (no dep)
```

### Phase 3: Sentry web (Parallel OK)
```
T6 ──→ T7
   T8 [P] (no dep)
```

### Phase 4: Sentry api (Parallel OK)
```
T10 ──→ T11
   T9 [P] (no dep)
   T12 [P] (no dep)
```

### Phase 5: Env documentation (Sequential)
```
T13
```

---

## Task Breakdown

### T1: Add `about` i18n catalog (pt-BR + en-US) with verbatim disclaimer

**What**: Create the `about` locale namespace with disclaimer + `/about` context + footer/link keys, registered in both locale index files.
**Where**: `apps/web/src/i18n/locales/pt-BR/about.ts`, `.../en-US/about.ts`, and both `locales/*/index.ts`.
**Depends on**: None
**Reuses**: existing catalog shape + `TTranslationResources` parity type.
**Requirement**: DISC-04 (i18n parity), DISC-02 (verbatim en text)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `about.ts` exists in both locales with keys `disclaimer`, `pageHeading`, `fanProjectBody`, `footerLinkLabel`, `backLink`; registered in both `index.ts`.
- [ ] Unit test asserts the en-US `about.disclaimer` equals the verbatim string from `ip-posture.md` (`Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.`).
- [ ] Unit test asserts pt-BR `about.disclaimer` contains `Flesh and Blood™`, `Legend Story Studios®`.
- [ ] `catalog-parity.spec.ts` stays green (no key drift).
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web test`

**Tests**: unit · **Gate**: quick (web)
**Commit**: `feat(web): add about i18n catalog with LSS disclaimer (DISC-02/04)`

---

### T2: `Footer` component mounted in `AppShell` [P]

**What**: A persistent footer rendering the localized disclaimer + a `<Link to="/about">`, mounted after `<main>` in `AppShell`.
**Where**: `apps/web/src/components/shell/Footer.tsx` (+ `Footer.module.css`); modify `AppShell.tsx`.
**Depends on**: T1
**Reuses**: `useTranslation`, `<Link>`, CSS-module + brand tokens.
**Requirement**: DISC-01

**Tools**: MCP: NONE · Skill: NONE (optional `impeccable:polish` — see MCP/Skills question)

**Done when**:
- [x] `Footer` renders the disclaimer text and an `/about` link; mounted in `AppShell` after `<main>`.
- [x] Unit test: renders disclaimer in en-US and pt-BR (locale-switched); `/about` link resolves via router `<Link>` (href `/about`), not a bare anchor.
- [x] CSS keeps the footer clear of the fixed `BottomTabBar` (<960px) — bottom spacing.
- [x] Gate passes: `pnpm --filter @rathe-arsenal/web test`

**Tests**: unit · **Gate**: quick (web)
**Commit**: `feat(web): persistent disclaimer footer in AppShell (DISC-01)`

---

### T3: Public `/about` route [P]

**What**: A self-contained public page with the full disclaimer + fan-project context section and a back link.
**Where**: `apps/web/src/routes/about.tsx` (+ module css).
**Depends on**: T1
**Reuses**: file-based routing (auto-registered); `<Link>`; `about` catalog.
**Requirement**: DISC-03

**Tools**: MCP: NONE · Skill: NONE (optional `impeccable:polish`)

**Done when**:
- [x] `/about` renders (a) the disclaimer and (b) a fan-project context section (`fanProjectBody`).
- [x] Unit test asserts both sections present; renders without an auth wrapper (public).
- [x] Back link navigates via `<Link>`.
- [x] Gate passes: `pnpm --filter @rathe-arsenal/web test`

**Tests**: unit · **Gate**: quick (web)
**Commit**: `feat(web): public /about route with fan-project disclaimer (DISC-03)`

---

### T4: Disclaimer line on anon `AuthLayout` [P]

**What**: Add a persistent disclaimer line + `/about` link at the bottom of `AuthLayout` (covers all 6 anon auth routes).
**Where**: modify `apps/web/src/components/auth-layout/AuthLayout.tsx` (+ css).
**Depends on**: T1
**Reuses**: `useTranslation`, `<Link>`; renders unconditionally (independent of the optional `footer` prop).
**Requirement**: DISC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `AuthLayout` renders a disclaimer/`about` link at the bottom regardless of the `footer` prop.
- [x] Unit test asserts the `/about` link (href `/about`) is present in a rendered `AuthLayout`.
- [x] Gate passes: `pnpm --filter @rathe-arsenal/web test`

**Tests**: unit · **Gate**: quick (web)
**Commit**: `feat(web): disclaimer link on anon AuthLayout (DISC-06)`

---

### T5: README disclaimer block [P]

**What**: Add the verbatim en-US disclaimer as a top-of-file block above the technical setup.
**Where**: `README.md`.
**Depends on**: None
**Reuses**: —
**Requirement**: DISC-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `README.md` contains the verbatim disclaimer line above the setup instructions.
- [x] Grep confirms the exact string is present.
- [x] Gate: build (web) unaffected (doc-only).

**Tests**: none (doc) · **Gate**: build (doc-only; grep in Done-when)
**Commit**: `docs: add LSS fan-content disclaimer block to README (DISC-05)`

---

### T6: `initWebSentry` helper (env-gated, privacy-minimal)

**What**: Add `@sentry/react`; create `initWebSentry()` reading `import.meta.env.VITE_SENTRY_DSN`, no-op when empty, else init with `sendDefaultPii:false, tracesSampleRate:0, integrations:[]`.
**Where**: `apps/web/src/observability/sentry.ts`; add dep to `apps/web/package.json`.
**Depends on**: None
**Reuses**: `@sentry/react`.
**Requirement**: OBS-01, OBS-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `initWebSentry()` calls `Sentry.init` exactly once when DSN is non-empty; skips entirely when empty.
- [ ] Unit test (mocked `@sentry/react`) asserts both branches + the privacy options (`sendDefaultPii:false`, `tracesSampleRate:0`).
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web test`

**Tests**: unit · **Gate**: quick (web)
**Commit**: `feat(web): env-gated Sentry init helper (OBS-01/06)`

---

### T7: `AppErrorBoundary` + `RootErrorFallback`, wired in `main.tsx`

**What**: Add a top-level Sentry error boundary with an on-brand fallback; call `initWebSentry()` before render and wrap `<RouterProvider>`.
**Where**: `apps/web/src/components/error/AppErrorBoundary.tsx`, `RootErrorFallback.tsx`; modify `main.tsx`.
**Depends on**: T6
**Reuses**: `Sentry.ErrorBoundary` (renders fallback regardless of init); `initWebSentry`.
**Requirement**: OBS-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] A child throwing inside `AppErrorBoundary` renders `RootErrorFallback` (not a blank tree).
- [ ] Unit test asserts fallback renders on child throw (works without a DSN).
- [ ] `main.tsx` calls `initWebSentry()` before render and wraps the router in `AppErrorBoundary`.
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/web test`

**Tests**: unit · **Gate**: quick (web)
**Commit**: `feat(web): top-level error boundary + Sentry capture (OBS-02)`

---

### T8: Web sourcemap upload via `@sentry/vite-plugin` (token-gated) [P]

**What**: Add `@sentry/vite-plugin`; a unit-testable gate returns the plugin only when `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`) is set, else `[]`; wire it after other plugins in `vite.config.ts`; keep sourcemaps private (delete after upload).
**Where**: `apps/web/vite.config.ts` (+ small exported gate helper, e.g. `apps/web/src/observability/sentry-vite.ts`); add dep.
**Depends on**: None
**Reuses**: `@sentry/vite-plugin`; existing `build.sourcemap`.
**Requirement**: OBS-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Gate helper returns `[]` when `SENTRY_AUTH_TOKEN` is absent, and a single plugin when present (+ org/project).
- [ ] Unit test asserts both branches.
- [ ] `pnpm --filter @rathe-arsenal/web build` succeeds with NO token set (no upload, no error).
- [ ] Gate passes: build (web) — includes a token-less `build` smoke.

**Tests**: unit · **Gate**: build (web)
**Commit**: `feat(web): token-gated Sentry sourcemap upload (OBS-07)`

---

### T9: `SENTRY_DSN` in `EnvDto` + `validateEnv` coverage [P]

**What**: Add optional `SENTRY_DSN` to `EnvDto`.
**Where**: `apps/api/src/config/env.dto.ts`; test `apps/api/src/config/__tests__/env.dto.spec.ts`.
**Depends on**: None
**Reuses**: `@IsOptional() @IsString()` pattern (mirrors `FIRECRAWL_API_KEY`).
**Requirement**: OBS-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `validateEnv` passes with a valid env lacking `SENTRY_DSN`.
- [ ] `validateEnv` accepts a present `SENTRY_DSN` string.
- [ ] Unit test covers both.
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api test`

**Tests**: unit · **Gate**: quick (api)
**Commit**: `feat(api): optional SENTRY_DSN env var (OBS-05)`

---

### T10: `initApiSentry` helper + wire in `bootstrap()`

**What**: Add `@sentry/node`; create `initApiSentry(dsn?)` (no-op when empty, else init privacy-minimal); call it in `main.ts` after `NestFactory.create` with `ConfigService.get('SENTRY_DSN')`.
**Where**: `apps/api/src/observability/sentry.ts`; modify `apps/api/src/main.ts`; add dep.
**Depends on**: None
**Reuses**: `@sentry/node`; `ConfigService`.
**Requirement**: OBS-03, OBS-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `initApiSentry` returns `false`/skips when DSN empty; inits once with `sendDefaultPii:false, tracesSampleRate:0` when present.
- [ ] Unit test asserts both branches (mocked `@sentry/node`).
- [ ] `main.ts` calls it post-`NestFactory.create`.
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api test`

**Tests**: unit · **Gate**: quick (api)
**Commit**: `feat(api): env-gated Sentry init in bootstrap (OBS-03/06)`

---

### T11: `HttpExceptionFilter` reports 5xx/non-HTTP to Sentry

**What**: In the existing `!isHttp || status>=500` branch, add `Sentry.captureException(exception)`; leave 4xx untouched.
**Where**: modify `apps/api/src/common/filters/http-exception.filter.ts`; test `.../__tests__/http-exception.filter.spec.ts`.
**Depends on**: T10
**Reuses**: existing filter + its severity condition.
**Requirement**: OBS-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] A non-`HttpException` and a `HttpException` with status≥500 each trigger `Sentry.captureException`.
- [ ] A 4xx `HttpException` does NOT trigger capture.
- [ ] Unit test (mocked `@sentry/node`) covers all three; existing filter behavior (response envelope) unchanged.
- [ ] Gate passes: `pnpm --filter @rathe-arsenal/api test`

**Tests**: unit · **Gate**: quick (api)
**Commit**: `feat(api): capture 5xx errors to Sentry in exception filter (OBS-04)`

---

### T12: API sourcemaps — `tsc` emit + `--enable-source-maps` [P]

**What**: Set `sourceMap: true` in api `tsconfig.json`; change `start` to `node --enable-source-maps dist/main.js`; document the required Railway start command in `scripts/deploy-railway.md`.
**Where**: `apps/api/tsconfig.json`, `apps/api/package.json` (`start`), `scripts/deploy-railway.md`.
**Depends on**: None
**Reuses**: existing build.
**Requirement**: OBS-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `tsconfig.json` emits sourcemaps; `nest build` produces `.js.map` in `dist`.
- [ ] `start` script includes `--enable-source-maps`.
- [ ] `deploy-railway.md` documents the prod start command.
- [ ] Gate passes: build (api) — typecheck + lint + tests green; `pnpm --filter @rathe-arsenal/api build` emits maps.

**Tests**: none (config) · **Gate**: build (api)
**Commit**: `chore(api): emit sourcemaps + enable-source-maps at runtime (OBS-08)`

---

### T13: Document Sentry env vars in `.env.example`

**What**: Add `VITE_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (all optional) with notes that absence disables the respective behavior.
**Where**: `.env.example`.
**Depends on**: None
**Reuses**: existing `.env.example` sectioning.
**Requirement**: OBS-05, OBS-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] All five vars documented with optional/no-op notes.
- [ ] Grep confirms each key present.
- [ ] Gate: build (web+api) unaffected (doc-only).

**Tests**: none (doc) · **Gate**: build (doc-only; grep in Done-when)
**Commit**: `docs: document Sentry env vars in .env.example (OBS-05/07)`

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 i18n namespace (2 files + 2 registers) | ✅ Cohesive |
| T2 | 1 component + 1 mount | ✅ Granular |
| T3 | 1 route | ✅ Granular |
| T4 | 1 component edit | ✅ Granular |
| T5 | 1 doc block | ✅ Granular |
| T6 | 1 helper | ✅ Granular |
| T7 | 2 small components + wiring | ✅ Cohesive |
| T8 | 1 gate helper + config | ✅ Cohesive |
| T9 | 1 field | ✅ Granular |
| T10 | 1 helper + wiring | ✅ Granular |
| T11 | 1 filter edit | ✅ Granular |
| T12 | 3 config edits (one concern: api sourcemaps) | ✅ Cohesive |
| T13 | 1 doc file | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | root of Phase 1 | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T1 | T1→T3 | ✅ |
| T4 | T1 | T1→T4 | ✅ |
| T5 | None | T5 [P] no dep | ✅ |
| T6 | None | root of Phase 3 | ✅ |
| T7 | T6 | T6→T7 | ✅ |
| T8 | None | T8 [P] no dep | ✅ |
| T9 | None | T9 [P] no dep | ✅ |
| T10 | None | root | ✅ |
| T11 | T10 | T10→T11 | ✅ |
| T12 | None | T12 [P] no dep | ✅ |
| T13 | None | Phase 5 | ✅ |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | i18n catalog | unit | unit | ✅ |
| T2 | React component | unit | unit | ✅ |
| T3 | React component (route) | unit | unit | ✅ |
| T4 | React component | unit | unit | ✅ |
| T5 | doc | none | none | ✅ |
| T6 | Web helper | unit | unit | ✅ |
| T7 | React component | unit | unit | ✅ |
| T8 | Web helper + config | unit | unit | ✅ |
| T9 | API config | unit | unit | ✅ |
| T10 | API helper | unit | unit | ✅ |
| T11 | API filter | unit | unit | ✅ |
| T12 | config only | none | none | ✅ |
| T13 | doc | none | none | ✅ |

All three validation tables pass — no ❌.
