# Rathe Arsenal

> Your Flesh and Blood collection, ready to play.

> **Disclaimer.** Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.

Private closed-beta web app that turns Fabrary deck URLs into a tracked deck list with a substitution-aware "effective readiness" score, computed against the cards you actually own — plus an interactive swap editor, Path C ("closest playable version"), and a variant-aware shopping line against Cúpula DT.

**Status (2026-04-18).** Phase 0 shipped and validated the engine hypothesis (Gate 4: 73.7% SOFT_CONFIDENCE). Phase 1a (product core: tier 2 engine, interactive swap editor, Path C, autocomplete, auth hardening) and the variant-aware shopping line are merged to `main`. Phase 1b (Liga FaB / Sbrauble scraper + shopping line) has Units 0–6 merged; Unit 7 (Gate 2 in-person accuracy walkthrough) is the remaining blocker to the public launch. Phase 1c (Discover, R9 fallback mode, R27 chart) is not yet planned.

Plans:

- Phase 0 — [`docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`](docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md) (completed)
- Replace Clerk with DIY auth — [`docs/plans/2026-04-09-001-feat-replace-clerk-diy-auth-plan.md`](docs/plans/2026-04-09-001-feat-replace-clerk-diy-auth-plan.md) (completed)
- Phase 1a — [`docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md`](docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md) (completed)
- Phase 1b — [`docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md`](docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md) (Units 0–6 merged; Unit 7 pending)
- Variant-aware shopping line — [`docs/plans/2026-04-13-001-feat-variant-aware-shopping-line-plan.md`](docs/plans/2026-04-13-001-feat-variant-aware-shopping-line-plan.md) (completed)

## Stack

- **Backend**: NestJS 11 + TypeORM + PostgreSQL + DIY auth (passport-jwt + bcrypt + Resend)
- **Frontend**: React 19 + Vite + TanStack Router + TanStack Query
- **Engine**: Pure TypeScript package (`packages/engine`), zero framework imports
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
