# Pre-Launch Hardening Specification

Two independent pre-launch changes for the closed-invite community launch (Cúpula DT, ~47 users): a fan-content IP disclaimer surface and Sentry production error monitoring.

## Problem Statement

Rathe Arsenal renders Legend Story Studios (LSS) card art on every screen but carries **no fan-content disclaimer anywhere** (no footer, no `/about`) — a hard requirement of the LSS Fan Content Policy (`docs/research/ip-posture.md`), recommended from v1 launch. Separately, production runtime errors are invisible: the app has only Pino structured logging to Railway's ephemeral surface and **no error-tracking service**, so once real users hit the app there is no way to know when something breaks.

## Goals

- [ ] Surface the exact LSS-required disclaimer on the site footer, an `/about` page, and the repo `README.md`, localized (pt-BR + en-US).
- [ ] Capture unhandled runtime errors from both `apps/web` and `apps/api` in Sentry, gated behind an env var so dev/CI without a DSN is a no-op, with a privacy-minimal configuration.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Price/stock sanity-check of the shopping line | Already validated by owner; not a code change |
| Light theme changes | Owner validated it works in practice; no change wanted |
| CAPTCHA on sign-up, refresh tokens, marketing landing page | Deferred — triggered by open-web launch, not closed-invite (A) |
| Sentry performance tracing / session replay | Privacy-minimal posture — errors only. `tracesSampleRate: 0`, no replay. |
| Monetization surfaces (ads, Patreon, affiliate) + full Phase 2 IP activation checklist | Not activating monetization; this is the preparatory disclaimer step only (`docs/research/ip-posture.md` P2-IP1) |
| Takedown dry-run admin command (ip-posture Rule #5 checklist item) | Phase 2 activation checklist item, not required for the closed-invite launch |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Disclaimer canonical text | Verbatim EN from `ip-posture.md` §"Required Disclaimer" is the source of truth; localized pt-BR translation preserves `™`/`®` and the LSS/entity names | The disclaimer is a hard policy requirement; substance must survive translation, trademark symbols are language-agnostic | n |
| README disclaimer placement | **In scope** — top-of-file block above technical setup | `ip-posture.md` placement #3 lists it as required; it is a ~5-line cheap edit and the doc recommends it from v1 launch | n |
| Footer scope | Persistent footer in the authenticated `AppShell` **and** a disclaimer line + `/about` link on the anon `AuthLayout` (DISC-06) — both in-scope this batch | Owner confirmed anon-page coverage in now: `AuthLayout` is a single shared component so anon coverage is one edit covering all six auth routes; satisfies `ip-posture.md` "every page" | **y** |
| `/about` visibility | Publicly reachable (no auth guard); renders self-contained (falls into `__root.tsx` "plain outlet" bucket) | A legal disclaimer page must be viewable without an account | n |
| Sentry web env var name | `VITE_SENTRY_DSN` (not `SENTRY_DSN`) | Vite only exposes client env vars prefixed `VITE_`; the api uses unprefixed `SENTRY_DSN` | n |
| Sentry api init timing | Inside `bootstrap()` after `NestFactory.create` (ConfigModule has loaded `.env` by then), errors-only via global handlers + `captureException` in the existing `HttpExceptionFilter` | Avoids `instrument.ts` pre-import ordering complexity; errors-only needs no early auto-instrumentation; reuses the existing global `@Catch()` filter | n |
| Sentry PII posture | `sendDefaultPii: false`; no request bodies; strip anything beyond error + minimal context | Project posture is deliberately data-minimal (`docs/phase-1-followups.md` Phase 1c telemetry entry) | n |
| Sourcemap upload (owner confirmed in-scope) | **Web**: `@sentry/vite-plugin` uploads on `pnpm build`, gated on build-time `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` — build succeeds (upload skipped) when absent. **Api**: `tsc` sourcemaps + Node `--enable-source-maps` de-minifies captured stacks in-process — no upload needed (nest/tsc output is not aggressively minified) | Minification only mangles the web bundle materially; the api path gets readable traces without the heavier sentry-cli upload step | **y** |
| Disclaimer PT-BR voice | Fixed legal text, not brand-voice-adapted; owner reviews the pt-BR rendering | `.impeccable.md` voice applies to the surrounding `/about` context copy, not the verbatim legal line | n |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Fan-content IP disclaimer surface ⭐ MVP

**User Story**: As the project owner, I want the LSS-required disclaimer visible in-product and in the repo so that the closed-invite launch respects the LSS Fan Content Policy before exposing LSS card art to the community.

**Why P1**: The disclaimer is an unconditional policy requirement, not a nicety. It must ship before the community sees the app.

**Acceptance Criteria**:

1. WHEN any authenticated shell route (`/home`, `/decks/*`, `/library`, `/swaps`, `/settings`, `/add-cards`, `/onboarding`) renders THEN the `AppShell` SHALL render a persistent footer containing the localized disclaimer text and a link to `/about`.
2. WHEN the footer renders in the `en-US` locale THEN it SHALL contain the verbatim string `Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.`
3. WHEN the footer renders in the `pt-BR` locale THEN it SHALL contain a pt-BR translation of the disclaimer that preserves `Flesh and Blood™`, `Legend Story Studios®`, and the entity names.
4. WHEN a user navigates to `/about` (authenticated or not) THEN the app SHALL render a self-contained page containing (a) the verbatim/localized disclaimer and (b) a fan-project context section explaining Rathe Arsenal is an unofficial fan project.
5. WHEN the footer `/about` link is activated THEN navigation SHALL use the TanStack Router `<Link>` (SPA navigation), not a bare anchor full-reload.
6. WHEN the pt-BR and en-US catalogs are compiled THEN the new disclaimer/about keys SHALL exist in both with full key parity (existing `catalog-parity.spec.ts` stays green).
7. WHEN a reader opens `README.md` THEN a disclaimer block SHALL appear above the technical setup, containing the verbatim en-US disclaimer.

**Independent Test**: Render `AppShell` in each locale and assert the disclaimer text + `/about` link; render the `/about` route component and assert both sections; run `catalog-parity.spec.ts`; grep `README.md` for the verbatim line.

---

### P1: Sentry production error monitoring ⭐ MVP

**User Story**: As the project owner, I want unhandled errors from web and api reported to Sentry so that I learn about production breakage from real users without a coordinated feedback loop.

**Why P1**: Post-launch the owner is otherwise blind to runtime errors; this is the passive-signal backbone the validation philosophy relies on.

**Acceptance Criteria**:

1. WHEN `apps/web` boots AND `import.meta.env.VITE_SENTRY_DSN` is a non-empty string THEN the web Sentry SDK SHALL initialize exactly once with that DSN.
2. WHEN `apps/web` boots AND `VITE_SENTRY_DSN` is absent/empty THEN the web Sentry SDK SHALL NOT initialize (dev/CI no-op) and app boot SHALL be unaffected.
3. WHEN a React render error propagates to the top-level boundary THEN it SHALL be captured by Sentry AND a fallback UI SHALL render instead of a blank screen.
4. WHEN `apps/api` bootstraps AND `SENTRY_DSN` is a non-empty string THEN the api Sentry SDK SHALL initialize exactly once with that DSN.
5. WHEN `apps/api` bootstraps AND `SENTRY_DSN` is absent/empty THEN the api Sentry SDK SHALL NOT initialize and boot SHALL be unaffected.
6. WHEN `HttpExceptionFilter` catches a non-`HttpException` OR an `HttpException` with status ≥ 500 THEN it SHALL call `Sentry.captureException` with the exception.
7. WHEN `HttpExceptionFilter` catches an `HttpException` with status < 500 (4xx client error) THEN it SHALL NOT report to Sentry (no noise from expected validation/auth failures).
8. WHEN either SDK initializes THEN it SHALL be configured with `sendDefaultPii: false`, `tracesSampleRate: 0`, and no session replay.
9. WHEN `validateEnv` runs without `SENTRY_DSN` THEN validation SHALL pass (optional field); WHEN `SENTRY_DSN` is present it SHALL be accepted as a string.
10. WHEN `.env.example` is read THEN it SHALL document `SENTRY_DSN` (api) and `VITE_SENTRY_DSN` (web) as optional, plus the build-time `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` for web sourcemap upload, each with a note that absence disables the respective behavior.
11. WHEN `pnpm --filter @rathe-arsenal/web build` runs AND `SENTRY_AUTH_TOKEN` (+ org/project) is set THEN the Sentry Vite plugin SHALL upload sourcemaps for the release; WHEN the token is absent THEN the build SHALL still succeed with no upload and no error (CI/local builds unaffected).
12. WHEN the api is built THEN `tsc` SHALL emit sourcemaps AND the production start command SHALL run Node with `--enable-source-maps` so captured server stack traces resolve to TypeScript source; this SHALL require no external upload step.

**Independent Test**: Unit-test the web/api init helpers for the DSN-gated branch (init called with DSN, skipped without); unit-test `HttpExceptionFilter` capture-on-5xx / no-capture-on-4xx with a mocked Sentry; unit-test `validateEnv` with and without `SENTRY_DSN`; assert the Vite config gates the Sentry plugin on the auth token; assert api `tsconfig` emits sourcemaps and the start script passes `--enable-source-maps`; grep `.env.example`.

---

### P2: Disclaimer on anonymous auth pages (owner confirmed in-scope this batch)

**User Story**: As the project owner, I want the disclaimer reachable from the sign-in/sign-up screens too so that the very first screen an invited user sees carries the LSS notice ("every page" per policy).

**Why included**: Closes the "every page" gap cheaply via the single shared `AuthLayout`; owner confirmed it ships in this batch alongside P1.

**Acceptance Criteria**:

1. WHEN any anon auth route (`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/check-your-email`) renders THEN `AuthLayout` SHALL render a persistent minimal disclaimer line or `/about` link at the bottom of the layout.
2. WHEN that link is activated THEN it SHALL navigate to `/about`.

**Independent Test**: Render `AuthLayout` and assert the disclaimer/`about` link presence + href.

---

## Edge Cases

- WHEN `VITE_SENTRY_DSN` / `SENTRY_DSN` is present but malformed THEN the SDK's own init handles it (no bespoke validation beyond non-empty); app boot SHALL NOT crash.
- WHEN Sentry is not initialized (no DSN) AND `HttpExceptionFilter` calls `Sentry.captureException` THEN the SDK SHALL no-op silently (no throw, no unhandled rejection).
- WHEN the active locale is neither pt-BR nor en-US (falls back to pt-BR) THEN the footer SHALL render the pt-BR disclaimer (fallback path).
- WHEN `/about` is visited while logged out THEN it SHALL render without redirecting to sign-in.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DISC-01 | P1: Disclaimer | Execute | ✅ Verified (T2 `81ae4f1`, AppShell test `eba3940`) |
| DISC-02 | P1: Disclaimer (footer verbatim en / pt) | Execute | ✅ Verified (T1 `3c0580f`) |
| DISC-03 | P1: Disclaimer (/about page) | Execute | ✅ Verified (T3 `3faacec`) |
| DISC-04 | P1: Disclaimer (SPA link + i18n parity) | Execute | ✅ Verified (T1 `3c0580f`, Link-marker `4797afb`) |
| DISC-05 | P1: Disclaimer (README block) | Execute | ✅ Verified (T5 `db23df8`) |
| DISC-06 | Disclaimer (anon AuthLayout) | Execute | ✅ Verified (T4 `8a0e21c`) |
| OBS-01 | P1: Sentry web init (DSN-gated) | Execute | ✅ Verified (T6 `c84331f`) |
| OBS-02 | P1: Sentry web error boundary | Execute | ✅ Verified (T7 `5910092`, capture-wiring `30db0f6`) |
| OBS-03 | P1: Sentry api init (DSN-gated) | Execute | ✅ Verified (T10 `52024b8`) |
| OBS-04 | P1: Sentry api filter capture (5xx only) | Execute | ✅ Verified (T11 `80cfb2c`) |
| OBS-05 | P1: Sentry env validation + `.env.example` | Execute | ✅ Verified (T9 `46f82e3`, T13 `3b676df`) |
| OBS-06 | P1: Sentry privacy config | Execute | ✅ Verified (T6/T10) |
| OBS-07 | P1: Sentry web sourcemap upload (token-gated) | Execute | ✅ Verified (T8 `0b8357c`) |
| OBS-08 | P1: Sentry api sourcemaps (`--enable-source-maps`) | Execute | ✅ Verified (T12 `67a5ad2`) |

**ID format:** `[CATEGORY]-[NUMBER]`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 14 total, all 14 ✅ Verified (independent Verifier PASS, iteration 2 — `validation.md`).

---

## Success Criteria

- [ ] The verbatim en-US disclaimer appears in the footer, `/about`, and `README.md`; pt-BR translation appears in footer + `/about` under pt-BR locale.
- [ ] `catalog-parity.spec.ts` stays green with the new keys.
- [ ] With no DSN set, `pnpm --filter @rathe-arsenal/web test`, api tests, typecheck, and lint all pass (Sentry is a no-op).
- [ ] With a DSN set, a thrown 5xx in the api and a React render error in the web each produce a Sentry capture (verified by unit tests on the gated helpers/filter, not a live Sentry account).
- [ ] Gate green: web typecheck + lint + unit; api typecheck + unit + e2e.
