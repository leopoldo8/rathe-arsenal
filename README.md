# Rathe Arsenal

> Your Flesh and Blood collection, ready to play.

> **Disclaimer.** Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.

Private closed-beta web app that turns Fabrary deck URLs into a tracked deck list with a substitution-aware "effective readiness" score, computed against the cards you actually own — plus an interactive swap editor, Path C ("closest playable version"), and a variant-aware shopping line against Cúpula DT.

**Status (2026-07-01).** Phase 0 shipped and validated the engine hypothesis (Gate 4: 73.7% SOFT_CONFIDENCE). Phase 1a (product core: tier 2 engine, interactive swap editor, Path C, autocomplete, auth hardening), the variant-aware shopping line, and Phase 1b (Liga FaB / Sbrauble scraper + shopping line, Units 0–6) are merged to `main`. Since then: internationalization (pt-BR / en-US), a UX/UI quality remediation pass (accessibility, design-token discipline, readiness focal point), and pre-launch hardening (LSS fan-content disclaimer surface + opt-in Sentry error monitoring). The original "Gate 2 in-person accuracy walkthrough" launch blocker is **retired** — external human validation is no longer a release gate (see [`docs/validation-philosophy.md`](docs/validation-philosophy.md)); the target-community (Cúpula DT) release is an owner decision informed by automated signals. Phase 1c (Discover, R9 fallback mode, R27 chart) is not yet planned.

Plans:

- Phase 0 — [`docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`](docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md) (completed)
- Replace Clerk with DIY auth — [`docs/plans/2026-04-09-001-feat-replace-clerk-diy-auth-plan.md`](docs/plans/2026-04-09-001-feat-replace-clerk-diy-auth-plan.md) (completed)
- Phase 1a — [`docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md`](docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md) (completed)
- Phase 1b — [`docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md`](docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md) (Units 0–6 merged; Unit 7 was a Gate 2 in-person walkthrough — retired as a release gate, see [`docs/validation-philosophy.md`](docs/validation-philosophy.md))
- Variant-aware shopping line — [`docs/plans/2026-04-13-001-feat-variant-aware-shopping-line-plan.md`](docs/plans/2026-04-13-001-feat-variant-aware-shopping-line-plan.md) (completed)
- Internationalization (pt-BR / en-US) — spec `.specs/features/i18n/` (merged)
- UX/UI quality remediation — spec `.specs/features/uxui-remediation/` (merged)
- Pre-launch hardening (LSS disclaimer + Sentry) — spec `.specs/features/pre-launch-hardening/` (in review)

## Stack

- **Backend**: NestJS 11 + TypeORM + PostgreSQL + DIY auth (passport-jwt + bcrypt + Resend)
- **Frontend**: React 19 + Vite + TanStack Router + TanStack Query + i18next (pt-BR / en-US)
- **Engine**: Pure TypeScript package (`packages/engine`), zero framework imports
- **Observability**: Sentry (opt-in — web + api; a complete no-op unless `SENTRY_DSN` / `VITE_SENTRY_DSN` are set)
- **Monorepo**: pnpm workspace
- **Deploy**: Single Railway service serving both API and SPA

## Layout

```
apps/
  api/        NestJS — REST API under /api/* + serves built SPA
  web/        React + Vite SPA
packages/
  engine/     Substitution engine (pure TS)
scripts/      Dev/ops scripts (delete-user, deploy notes)
docs/         Project-specific docs (research, security notes, ADRs)
```

## Local development

Prereqs: Node ≥20.18, pnpm ≥9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`), local Postgres.

```bash
pnpm install
cp .env.example .env       # fill in JWT_SECRET, RESEND_API_KEY, DATABASE_URL
pnpm dev                   # runs api (3000) + web (5173) concurrently
```

## Test

```bash
pnpm test                  # all packages
pnpm --filter @rathe-arsenal/api test
pnpm --filter @rathe-arsenal/engine test
```

## Build

```bash
pnpm build                 # builds web first (api serves dist)
```

## Deploy

See [`scripts/deploy-railway.md`](scripts/deploy-railway.md).
