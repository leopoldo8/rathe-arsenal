# Rathe Arsenal

> Your Flesh and Blood collection, ready to play.

Private closed-beta web app that turns Fabrary deck URLs into a tracked deck list with a substitution-aware "effective readiness" score, computed against the cards you actually own.

**Phase 0** validates one hypothesis: *rule-based tier 1 substitution is good enough for casual FaB players.* Everything in this repo is in service of answering that question.

See [`../docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`](../docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md) for the full plan.

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
