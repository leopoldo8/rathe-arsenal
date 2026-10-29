# Railway Deployment

Sign-in is by e-mail code.
A session is an opaque token in the httpOnly `ra_session` cookie, backed by a `user_session` row (400 days).
There is no JWT: a password is optional, and the six-digit code is the way in for accounts without one.

The repository expects two Railway services in one project, plus one Postgres addon:

- **Web service**: runs the NestJS app, which serves `/api/*` and the bundled React SPA from the root path.
- **Worker service**: runs the same build with a different start command, `node --enable-source-maps dist/stores/variant-queue-worker.js` (from `apps/api`).
  It drains the job queues (store prices and availability, recommendations, Tutor answers, reference data) and runs housekeeping.
  Nothing in the repository starts it: `railway.json` and the package scripts define no worker start command, so this command is set in the dashboard (the plan that introduced it, `docs/superpowers/plans/2026-06-03-variant-fetch-queue.md`, names it).
  The dashboard must match this; the repository cannot confirm what is configured there.

Both services boot the full application module, so both validate the same environment (see the table below): the required variables must be set on each.

## One-time Railway setup

1. **Create project**: `railway init` from this repo root, or via the dashboard
   (https://railway.app/new): pick "Deploy from GitHub repo" -> `leopoldo8/rathe-arsenal`.
2. **Add Postgres addon**: dashboard -> New -> Database -> PostgreSQL.
   Railway auto-injects `DATABASE_URL` into the service.
3. **Set environment variables** on the web service, and the required ones plus the worker-only ones on the worker service (see "Environment variables").
4. **Set health check**: `/api/health`. `railway.json` does not set it; configure it in the dashboard for the web service.
5. **Generate domain**: Service -> Settings -> Generate Domain. Note the URL and use it as `APP_BASE_URL`.
6. **Set start command** on the web service: Service -> Settings -> Deploy -> Custom Start Command ->
   `pnpm --filter @rathe-arsenal/api start`. `railway.json` only defines the
   `buildCommand`: there is no repo-level `startCommand`, so the dashboard's
   custom start command is the only place this is configured. The api's own
   `start` script runs `node --enable-source-maps dist/main.js`; if the
   dashboard is ever set to something else (e.g. a bare `node dist/main.js`
   copied by hand), it must still include `--enable-source-maps` so captured
   server stack traces resolve to TypeScript source instead of minified
   `dist/*.js` (OBS-08).
7. **Create the worker service**: a second service from the same repo and the same build, with the start command from the top of this file and no public domain.
   Link `DATABASE_URL` from the Postgres service as a shared reference.

## Environment variables

Source of truth: `apps/api/src/config/env.dto.ts`; local defaults and comments are in `.env.example`.
The API refuses to start when a required variable is missing or invalid.

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `NODE_ENV` | both | yes | `production` |
| `PORT` | both | yes | `3000` on the web service; the worker serves no traffic but the schema still requires a value |
| `DATABASE_URL` | both | yes | Injected by the Postgres addon |
| `JWT_SECRET` | both | yes | At least 32 characters. Used only as the HMAC key of sign-in codes (see "Generate JWT secret") |
| `RESEND_API_KEY` | both | yes | See "Resend setup" |
| `EMAIL_FROM` | both | yes | `Rathe Arsenal <noreply@your-verified-domain>`, or `onboarding@resend.dev` for testing |
| `APP_BASE_URL` | both | yes | Public base URL, used in e-mailed links and as the one origin allowed to write |
| `EXPOSE_DEV_SECRETS` | none | no | Never set in staging or production. See the warning below |
| `JWT_EXPIRES_IN` | web | no | Still validated, but nothing reads it: sessions last 400 days regardless |
| `TURNSTILE_SECRET_KEY` | web | no | Cloudflare Turnstile on sign-up and code requests; absent, the check is skipped |
| `VITE_TURNSTILE_SITE_KEY` | web (build) | no | Site key for the widget; absent, no widget is shown |
| `SENTRY_DSN` | both | no | Absent, API Sentry is off |
| `VITE_SENTRY_DSN` | web (build) | no | Absent, web Sentry is off |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | web (build) | no | Source-map upload at build; the build succeeds without them |
| `AWS_APPSYNC_ENDPOINT`, `COGNITO_IDENTITY_POOL_ID`, `COGNITO_REGION`, `FABRARY_ALLOW_HOSTS` | web | no | Fabrary deck import; the defaults in code are correct, override only to change them |
| `FABRARY_USER_AGENT` | web | no | Override of the browser-like User-Agent Fabrary's firewall requires; override only to rotate it |
| `PRICE_SYNC_ENABLED` | web | no | `true` turns on the hourly in-process read of TCGplayer prices for the sets on sell lists; default off |
| `GEMINI_API_KEY` | worker | no | Read only by the worker; absent, recommendation and Tutor runs fail |
| `GEMINI_THINKING_LEVEL`, `GEMINI_CHAT_THINKING_LEVEL` | worker | no | `low`, `medium` or `high` |
| `OPENROUTER_API_KEY`, `CHAT_OPENROUTER_MODEL`, `RECOMMENDATION_OPENROUTER_MODEL` | worker | no | Optional model provider instead of Gemini |
| `SCRAPER_FETCH_PROVIDER` | worker | no | `direct` (default) or `firecrawl` |
| `FIRECRAWL_API_KEY` | worker | no | Needed when the provider is `firecrawl` |
| `FIRECRAWL_REQUESTS_PER_MINUTE`, `FIRECRAWL_MONTHLY_CREDIT_BUDGET`, `FIRECRAWL_CREDITS_PER_PASS`, `FIRECRAWL_CREDITS_PER_DETAIL`, `FIRECRAWL_CREDITS_PER_LISTING_PAGE` | worker | no | Rate and credit budget of the plan |
| `STORE_PRICE_VALID_DAYS`, `STORE_AVAILABILITY_PASS_DAYS` | worker | no | How long a store price stays valid, and how often the availability pass runs |
| `STORE_SCRAPER_ENABLED`, `STORE_ALLOW_HOSTS`, `ADMIN_API_KEY` | web | no | Admin scrape endpoint and the legacy scrape script (see the last section); `ADMIN_API_KEY` is required when `STORE_SCRAPER_ENABLED=true` |

`EXPOSE_DEV_SECRETS=true` makes the API put sign-in secrets (confirmation link, codes) in its responses so tests need no inbox.
Never set it in staging or production.
The API refuses to start with it set and `NODE_ENV=production`, and on any environment that is reachable from the internet it would let a stolen session change the password without the e-mail.

## Generate JWT secret

```bash
openssl rand -hex 32
# produces a 64-character hex string (256 bits of entropy)
# paste this into the Railway JWT_SECRET env var
```

**Rotation:** `JWT_SECRET` is the HMAC key of the six-digit sign-in codes only.
Changing it and redeploying makes the codes already e-mailed stop working; it does not sign anyone out, because sessions are database rows.
To sign everyone out, delete the rows of `user_session`.

## Resend setup

1. Sign up at https://resend.com (free, no credit card for the free tier: 100 emails/day, 3000/month)
2. (Optional for initial testing) Skip domain verification and use `onboarding@resend.dev` as the `EMAIL_FROM`
3. (For production sender) Verify your domain in the Resend dashboard -> Domains
4. Create an API key: Resend dashboard -> API Keys -> Create
5. Paste the key into Railway env var `RESEND_API_KEY`

## Deploy

```bash
git push origin main
```

Railway auto-builds via Nixpacks using the `buildCommand` from `railway.json`.
The start command comes from the dashboard (see setup steps 6 and 7).
First build pulls Node 20 + pnpm via corepack.

**Migrations run automatically when the API boots** in any environment where `NODE_ENV` is not `development` (`migrationsRun: !isDev` in `apps/api/src/database/database.module.ts`).
A deploy that adds a migration applies it on the first boot of the new version; there is no separate migration step.

## Before deploying the persona-rethink release (PR #181)

What to check on the deployed environment before or with this release:

- Production and staging run with `NODE_ENV=production` and without `EXPOSE_DEV_SECRETS`.
- `APP_BASE_URL` is set, for the e-mailed links.
- Every user signs in again after the deploy, because sessions moved to the `ra_session` cookie over a `user_session` row.
- Migrations run on boot, including `1778533613000` (the `purpose` column of `sign_in_code`).
- The worker service is running: its housekeeping step purges accounts and decks deleted more than 30 days ago, used-up or expired sign-in codes at least an hour old, and ended sessions.
- Mark the web e2e job as a required check in the repository settings.
- Routes the plan listed without a coverage row: `/api/collection/sources/:id/copies`, `/api/catalog/collector-codes`, `/library-csv-sources/:sourceId/versions`, `/api/collection/library`.

## Verify

```bash
curl https://<your-railway-domain>/api/health
# {"status":"ok","timestamp":"..."}
```

Visit `https://<your-railway-domain>/entrar` in a browser:

1. Type a new e-mail address and continue: the account is created and you are signed in at once, and a confirmation e-mail arrives (an unconfirmed account can do everything except create share links).
2. Sign out, return to `/entrar` and type the same address: an account without a password asks for the six-digit code, which arrives by e-mail; enter it and you land on the home page.
3. In the browser's storage, check the `ra_session` cookie is `HttpOnly` and `Secure`.

The worker is healthy when its logs show the loops running and housekeeping ticks (`housekeeping.tick`).

## Manual user deletion

1. Run `pnpm tsx scripts/delete-user.ts <userId>` against the production DB
   (use Railway's `railway run` to inject `DATABASE_URL`).
2. All user-linked rows are cascade-deleted by the script, including the user's decks and collection.

## Housekeeping and account deletion

A user who deletes their account (`DELETE /api/auth/me`) is **soft-deleted**: `user.deletedAt` is set, the session lookup rejects the account from then on, and the data stays for 30 days so an accidental deletion can be undone.
Decks deleted by a player are soft-deleted the same way and kept 30 days.

The purge runs in the **worker**, in its housekeeping step (`apps/api/src/housekeeping/housekeeping.service.ts`).
Each pass, under a database advisory lock so two workers never delete the same rows, it permanently removes:

- accounts and decks deleted more than 30 days ago (with everything that cascades from them);
- sign-in codes that are used up or expired and at least an hour old;
- sessions that ended.

No cron service is needed for this.
If an earlier setup created a Railway cron service that runs `pnpm purge:deleted-users -- --yes`, it is redundant; whether one still exists is only visible in the Railway dashboard.
The worker service must be running for housekeeping to happen.

### Manual purge script (fallback)

`scripts/purge-deleted-users.ts` does the same account purge on demand, with a raw `pg` connection and a single transaction.
Read the script for the exact tables it removes.

```bash
# Dry run (prints eligible userIds, touches nothing)
pnpm purge:deleted-users -- --dry-run

# Real purge with non-interactive confirmation
pnpm purge:deleted-users -- --yes

# Override retention window (e.g. for testing against a staging DB)
pnpm purge:deleted-users -- --dry-run --days=7
```

To resurrect an account inside the retention window, an operator can run
`UPDATE "user" SET "deletedAt" = NULL WHERE id = '<uuid>'`.
The person signs in again with a code; their data survives until the housekeeping step removes it.

## Store listing scrape (legacy cron and admin endpoint)

Store prices and availability now come from the worker: per-card lookups in the `variant_fetch_job` queue and an availability pass every `STORE_AVAILABILITY_PASS_DAYS`, with Firecrawl calls counted against `FIRECRAWL_MONTHLY_CREDIT_BUDGET` (decision AD-022 in `.specs/STATE.md`).
The section below documents the older listing scrape, which the repository still contains (`scripts/scrape-stores.ts`, the admin endpoint).
Whether a scrape cron service is still configured in Railway is not visible from the repository.

The scrape worker runs `scripts/scrape-stores.ts` as a **separate Railway cron
service** (same second-service pattern as the purge cron above). Unlike
`purge-deleted-users.ts`, it bootstraps a full NestJS standalone context so the
DI graph (FetchGuardService, CatalogService, TypeORM repositories) is available.

### Generate admin API key

```bash
openssl rand -hex 32
# produces a 64-character hex string (256 bits of entropy)
# paste this into the Railway ADMIN_API_KEY env var
```

### Wiring the scrape cron on Railway

1. **Dashboard → Project → New → Empty Service**
2. **Settings → Source → Connect Repo** → `leopoldo8/rathe-arsenal`
3. **Settings → Deploy**:
   - **Cron Schedule**: `0 3 * * *` (daily at 03:00 UTC — off-peak for Brazil)
   - **Start Command**: `pnpm tsx scripts/scrape-stores.ts`
   - **Health Check**: *disabled*
   - **Restart Policy**: `NEVER`
4. **Settings → Variables**:
   - Link `DATABASE_URL` from the Postgres service (shared reference).
   - Set `STORE_SCRAPER_ENABLED=true`
   - Set `STORE_ALLOW_HOSTS=www.cupuladt.com.br`
   - `ADMIN_API_KEY` is not needed by the worker (it runs without HTTP); it is
     only required on the API service. Still, linking it from shared variables
     is harmless and avoids drift.
5. **Settings → Networking**: leave private (no public domain).
6. **Deploy**. Verify the first run in service logs:

   ```
   {"event":"scrape-worker.store.completed","storeSlug":"cupula-dt","runId":1,...}
   ```

### Triggering a manual scrape via the admin endpoint

The scrape can also be triggered on-demand from the API pod (no Railway cron
needed for one-off runs):

```bash
# Replace <your-domain> and <your-admin-api-key> accordingly.
# Trigger an immediate scrape for cupula-dt:
curl -s -X POST https://<your-domain>/api/admin/stores/cupula-dt/scrape \
     -H 'x-admin-api-key: <your-admin-api-key>' | jq .

# Bypass a paused_delta_guard lock (use after investigating the delta spike):
curl -s -X POST 'https://<your-domain>/api/admin/stores/cupula-dt/scrape?force=true' \
     -H 'x-admin-api-key: <your-admin-api-key>' | jq .
```

The endpoint returns an `IScrapeRunSummary` JSON body on success (HTTP 200).
Rate limit: 2 calls per hour per IP.

### Dry-run before enabling writes

To check the scraper and matcher output, run the worker in
dry-run mode to verify the scraper + matcher output without writing to
`store_stock`:

```bash
# Via Railway run (injects DATABASE_URL automatically):
railway run pnpm tsx scripts/scrape-stores.ts --dry-run --store=cupula-dt
```

Dry-run logs `{"event":"scrape-worker.dry-run.would-scrape",...}` and exits
without touching the database.

### Operational notes

- **Delta guard**: if a run's delta exceeds 90%, the run is aborted and
  `store_scrape_run.status` is set to `paused_delta_guard`. Subsequent scheduled
  runs will refuse to start. Use the `?force=true` admin endpoint or reset the
  run row manually (`UPDATE store_scrape_run SET status='failed' WHERE id=<id>`)
  after investigating.
- **Soft lock**: a `running` row older than 30 minutes is treated as stale and
  ignored (protects against a pod restart mid-run leaving an orphan lock).
- **Monitoring**: check `store_scrape_run` for `status='failed'` or
  `status='paused_delta_guard'` rows after each cron tick. Railway log query:
  `event:scrape-worker.store.failed OR event:scrape-worker.store.completed`.
