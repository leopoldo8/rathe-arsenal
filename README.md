# Rathe Arsenal

> Your Flesh and Blood collection, ready to play.

> **Disclaimer.** Rathe Arsenal is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios. © Legend Story Studios

Rathe Arsenal helps Flesh and Blood players in Brazil work out what their collection can play.
It is pt-BR first, with en-US.

What it does today:

- **Sign-in by e-mail code.** One e-mail field and a six-digit code sent by e-mail; a password is optional.
- **Getting cards in.** Pasted text, a CSV file or a Fabrary link, the phone camera scanner, a manual search, and ready-made product lists. Lines the reader cannot place are kept as pending lines to resolve.
- **Decks.** Import a deck from Fabrary or start from scratch, with the rules of the format checked on every change (every problem at once, with the dated rule changes) and an inventory kept apart from the main deck.
- **Readiness.** The share of a deck you can play with the cards you own, the missing cards, and alternatives for a missing card (stand-ins ranked by fit).
- **Closing the deck.** The missing list shows what is left after owned copies, with store availability and prices.
- **Card lists.** Want lists and sell lists, a "spare copies" view computed from the collection and decks, and price suggestions from TCGplayer.
- **Sharing.** A deck or a list gets a public link (with a link preview image) that shows the deck, asks for the missing cards, or offers or requests cards over WhatsApp.
- **Tutor.** A chat assistant, behind an access flag, that answers about a deck, the rules and prices and proposes swaps you apply yourself.
- **Glossary.** Game words explained in place.
- **Public pages.** `/about` and `/termos`, plus the shared deck and list pages.

Current work and decisions live in [`.specs/STATE.md`](.specs/STATE.md).
The index of every other document is [`docs/README.md`](docs/README.md).

## Stack

- **Backend**: NestJS 11 + TypeORM + PostgreSQL. Auth is an httpOnly session cookie (`ra_session`) over a `user_session` row, bcrypt for the optional password, Resend for e-mail.
- **Frontend**: React 19 + Vite + TanStack Router + TanStack Query + i18next (pt-BR / en-US)
- **Engine**: Pure TypeScript package (`packages/engine`), zero framework imports
- **Worker**: a second process from the API codebase (`apps/api/src/stores/variant-queue-worker.ts`) that drains the job queues (store prices, availability, recommendations, Tutor answers, reference data) and runs housekeeping
- **Integrations**: Fabrary (deck import), store pages via optional Firecrawl, Gemini and optional OpenRouter (Tutor and recommendations), TCGplayer prices, optional Cloudflare Turnstile on sign-up, Sentry (opt-in, a no-op unless `SENTRY_DSN` / `VITE_SENTRY_DSN` are set)
- **Monorepo**: pnpm workspace
- **Deploy**: Railway, a web service (API plus built SPA) and a worker service

## Layout

```
apps/
  api/        NestJS: REST API under /api/*, serves the built SPA, worker entry
  web/        React + Vite SPA
packages/
  engine/     Legality, readiness and substitution engine (pure TS)
scripts/      Dev and ops scripts (seed:fixture, screenshot, share:report, prices, purge, deploy notes)
docs/         Living guides plus historical records (start at docs/README.md)
.specs/       STATE.md (decisions log and current handoff); a feature's spec lives here only while it is in flight
.design/      Confirmed design documents per feature (the mockups were removed on 2026-10-28 and live in git history)
```

## Local development

Prereqs: Node ≥20.18, pnpm ≥9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`), local Postgres.

```bash
pnpm install
cp .env.example .env       # fill in JWT_SECRET, RESEND_API_KEY, EMAIL_FROM, APP_BASE_URL, DATABASE_URL
pnpm dev                   # runs api (3000) + web (5173, proxies /api) concurrently
```

To sign in without an inbox, add `EXPOSE_DEV_SECRETS=true` to `.env`: the API then returns the sign-in secrets in its responses.
Never set it in staging or production; the API refuses to start with it when `NODE_ENV=production`.

`pnpm seed:fixture` prepares a signed-in test user with decks (see [`docs/dev-fixtures.md`](docs/dev-fixtures.md)).

## Test

```bash
pnpm lint
pnpm typecheck
pnpm test                                    # unit tests of every package
pnpm --filter @rathe-arsenal/api test:int    # integration tests (database)
pnpm --filter @rathe-arsenal/api test:e2e    # API end-to-end tests (database)
pnpm --filter @rathe-arsenal/web test:e2e    # Playwright journeys and accessibility scan (api and web running)
pnpm --filter @rathe-arsenal/web test:visual # screenshot regression, local only
pnpm smoke                                   # post-deploy smoke test of a deployed environment (SMOKE_BASE_URL, see scripts/deploy-railway.md)
```

CI runs three jobs: quality (lint, typecheck, unit tests), API end-to-end tests against Postgres, and the web Playwright job.
The visual regression project is not part of CI; see [`docs/design/v1/visual-regression.md`](docs/design/v1/visual-regression.md).
The testing approach is in [`docs/validation-philosophy.md`](docs/validation-philosophy.md).

## Build

```bash
pnpm build                 # builds web first (api serves dist)
```

## Deploy

See [`scripts/deploy-railway.md`](scripts/deploy-railway.md).
