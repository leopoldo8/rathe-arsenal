# Railway Deployment

Sign-in is by e-mail code.
A session is an opaque token in the httpOnly `ra_session` cookie, backed by a `user_session` row.
The row has no expiry of its own: it lasts until sign-out, a password change or account deletion revokes it.
The cookie lasts 400 days and is sent again whenever the session is used more than a day after it was last seen.
There is no JWT: a password is optional, and the six-digit code is the way in for accounts without one.

The repository expects two Railway services in one project, plus one Postgres addon:

- **Web service**: runs the NestJS app, which serves `/api/*` and the bundled React SPA from the root path.
- **Worker service**: runs the same build with a different start command, `node --enable-source-maps dist/stores/variant-queue-worker.js` (from `apps/api`).
  It drains the job queues (store prices and availability, recommendations, Tutor answers, reference data) and runs housekeeping.
  Nothing in the repository starts it: `railway.json` and the package scripts define no worker start command, so this command is set in the dashboard (PR #92, which introduced the worker, names `node dist/stores/variant-queue-worker.js`, without the source-maps flag).
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
| `TURNSTILE_SECRET_KEY` | web | no | Cloudflare Turnstile on sign-up and code requests; absent, the check is skipped |
| `VITE_TURNSTILE_SITE_KEY` | web (build) | no | Site key for the widget; absent, no widget is shown |
| `SENTRY_DSN` | both | no | Absent, API Sentry is off |
| `VITE_SENTRY_DSN` | web (build) | no | Absent, web Sentry is off |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | web (build) | no | Source-map upload at build; the build succeeds without them |
| `AWS_APPSYNC_ENDPOINT`, `COGNITO_IDENTITY_POOL_ID`, `COGNITO_REGION`, `FABRARY_ALLOW_HOSTS` | both | no | Fabrary deck import on the web service, and the worker's reference-data step; the defaults in code are correct, override only to change them |
| `FABRARY_USER_AGENT` | both | no | Override of the browser-like User-Agent Fabrary's firewall requires; override only to rotate it |
| `PRICE_SYNC_ENABLED` | one of them | no | `true` turns on the hourly in-process read of TCGplayer prices for the sets on sell lists; default off. Any process that boots the application module runs it (the worker too), so set it on one service only |
| `GEMINI_API_KEY` | worker | no | Read only by the worker; absent, recommendation and Tutor runs fail |
| `GEMINI_THINKING_LEVEL`, `GEMINI_CHAT_THINKING_LEVEL` | worker | no | `low`, `medium` or `high` |
| `OPENROUTER_API_KEY`, `CHAT_OPENROUTER_MODEL`, `RECOMMENDATION_OPENROUTER_MODEL` | worker | no | Optional model provider instead of Gemini |
| `SCRAPER_FETCH_PROVIDER` | worker | no | `direct` (default) or `firecrawl` |
| `FIRECRAWL_API_KEY` | worker | no | Needed when the provider is `firecrawl` |
| `FIRECRAWL_REQUESTS_PER_MINUTE`, `FIRECRAWL_MONTHLY_CREDIT_BUDGET`, `FIRECRAWL_CREDITS_PER_PASS`, `FIRECRAWL_CREDITS_PER_DETAIL`, `FIRECRAWL_CREDITS_PER_LISTING_PAGE` | both | no | Rate and credit budget of the plan |
| `STORE_PRICE_VALID_DAYS`, `STORE_AVAILABILITY_PASS_DAYS` | both | no | How long a store price stays valid (read by the web service and the worker), and how often the availability pass runs (worker) |
| `STORE_SCRAPER_ENABLED`, `STORE_ALLOW_HOSTS`, `ADMIN_API_KEY` | web | no | `STORE_SCRAPER_ENABLED` and `STORE_ALLOW_HOSTS` are read only by the legacy scrape script (see the last section); `ADMIN_API_KEY` is the key of the admin endpoints. The schema requires `ADMIN_API_KEY` when `STORE_SCRAPER_ENABLED=true` |

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
- The worker service is running: its housekeeping step purges accounts and decks deleted more than 30 days ago, used-up or expired sign-in codes at least an hour old, and revoked sessions.
- Mark the web e2e job as a required check in the repository settings.
- Routes the persona-rethink plan listed without a coverage row: `/api/collection/sources/:id/copies`, `/api/catalog/collector-codes`, `/library-csv-sources/:sourceId/versions`, `/api/collection/library`.

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

## Smoke test

`pnpm smoke` checks a deployed environment end to end, and `.github/workflows/smoke.yml` runs it for you.
It checks, in order:

1. `/api/health` answers `status: ok`; on a push to main it first waits (up to 10 minutes) until `commit` equals the pushed commit, so it never tests the old deploy.
2. The SPA index and `/entrar` are HTML with the app root.
3. A protected API route answers 401 when signed out.
4. It signs in as the smoke account, then checks `/api/auth/me`, a catalog search, the deck list, the deck page API and its missing list.
5. A real Chromium loads `/` and the smoke deck's page, so a broken JavaScript bundle fails the run.
6. It signs out and checks the session no longer works.

It never creates accounts, decks or share links.
Nothing about an environment is stored in the repository: every value is a GitHub Environment secret or variable.

The `commit` in `/api/health` is Railway's `RAILWAY_GIT_COMMIT_SHA`, which Railway sets only for deploys triggered from GitHub.
Check that the staging web service deploys from GitHub, or the run waits for a commit that never shows up and fails after the timeout.

### Two ways to sign in

- **Staging, by e-mailed code (`SMOKE_SIGN_IN=code`).** The smoke requests a code, reads the e-mail from a Resend inbox and verifies the six digits. This exercises the real sign-in, including the e-mail.
- **Production, by password (`SMOKE_SIGN_IN=password`).** `POST /api/auth/sign-in` takes an e-mail and a password and needs no Turnstile token and no e-mail. No bot-protection bypass exists in the code, and none should be added.

Staging has to run Cloudflare's test keys (see step 5 below), so Turnstile always passes there.
That also means **staging has no bot protection while it uses the test keys**.
Production keeps its real keys.

### One-time setup

1. **Turn on receiving in Resend.**
   In the Resend dashboard open Emails, then the Receiving tab.
   Resend gives you a managed domain `<id>.resend.app`: any username at it receives mail (for example `smoke@<id>.resend.app`).
   A domain of your own also works, by adding the MX record the dashboard shows; use a subdomain, because an MX record on a domain that already receives other mail conflicts with it.
   Docs: https://resend.com/docs/dashboard/receiving/introduction
2. **Create an API key that can read received e-mails.**
   Resend's key permissions are `full_access` and `sending_access`; `sending_access` is documented as send-only, so use a separate key with full access, and name it for the smoke.
   Docs: https://resend.com/docs/api-reference/api-keys/create-api-key
   Resend does not say in its docs which permission the receiving endpoints need, so the first manual run (step 10) is what confirms the key works.
   This key is the `RESEND_INBOUND_API_KEY` secret.
3. **Sign up the smoke account on staging** with that address (`smoke@<id>.resend.app`), in a browser on the staging site.
   With the test keys from step 5 on, the sign-up goes through; the confirmation e-mail lands in the Resend Receiving tab.
4. **Sign up the smoke account on production** with the same kind of address, in a browser.
   Production has real bot protection, so this has to be a person in a browser.
   Then open Settings and set a password: the app e-mails a six-digit code to the account's own address, which you read in the Resend Receiving tab, and the password must have at least 10 characters.
   That is the `SMOKE_PASSWORD` secret of the production environment.
5. **Put Cloudflare's test keys on staging** (never on production).
   - API service: `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (always passes).
   - Web build: `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (always passes; `1x00000000000000000000BB` is the invisible one).
   - The site key is read at build time (`apps/web/src/components/auth/TurnstileWidget.tsx`), so redeploy the web service after changing it.
   - A test secret key only accepts the test token `XXXX.DUMMY.TOKEN.XXXX`, which the test site keys produce; a real token fails.
   Docs: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
6. **Give each smoke account its deck.**
   Run once per environment, from your machine:

   ```bash
   # staging: signs in by code, read from the Resend inbox
   SMOKE_BASE_URL=https://<staging-domain> SMOKE_SIGN_IN=code SMOKE_INBOX=resend \
     SMOKE_EMAIL=smoke@<id>.resend.app RESEND_INBOUND_API_KEY=<key> \
     SMOKE_TURNSTILE_TOKEN=XXXX.DUMMY.TOKEN.XXXX pnpm smoke:setup

   # production: signs in with the password from step 4
   SMOKE_BASE_URL=https://<production-domain> SMOKE_SIGN_IN=password \
     SMOKE_EMAIL=smoke@<id>.resend.app SMOKE_PASSWORD=<password> pnpm smoke:setup
   ```

   It creates one small deck only if the account has none, so running it again changes nothing.
   Do not paste those values into a file in the repository.
7. **Create the GitHub Environments** `staging` and `production` (repository Settings, Environments).
8. **Add the secrets** to each environment:
   `SMOKE_BASE_URL`, `SMOKE_EMAIL`;
   staging also `RESEND_INBOUND_API_KEY` and `SMOKE_TURNSTILE_TOKEN` (`XXXX.DUMMY.TOKEN.XXXX`);
   production also `SMOKE_PASSWORD`.
9. **Add the variable** `SMOKE_SIGN_IN` to each environment: `code` on staging, `password` on production.
10. **Run the workflow once by hand**: Actions, Smoke, Run workflow, pick `staging`, then `production`.

Until the secrets exist, a push to main shows the Smoke job as skipped with a notice naming what is missing, instead of failing.
A manual run with something missing fails and names it.

**Not verified yet:** delivery of the sign-in e-mail from Resend's sending side to a `.resend.app` receiving address has not been tested.
The first manual run on staging checks it.
If the code never arrives, the run fails with "no sign-in code e-mail reached the inbox" after 90 seconds; look at the Receiving tab to see whether the e-mail arrived at all.

### Running it from your machine

```bash
SMOKE_BASE_URL=https://<domain> SMOKE_SIGN_IN=none pnpm smoke      # no sign-in: only the public checks
```

Other inputs: `SMOKE_EXPECT_COMMIT` (wait for that SHA), `SMOKE_COMMIT_WAIT_MS`, `SMOKE_CODE_WAIT_MS`, `SMOKE_TOTAL_TIMEOUT_MS`.
Against a local API started with `EXPOSE_DEV_SECRETS=true` you can use `SMOKE_INBOX=dev-response`: the code request then answers with the digits (`_devCode`) and no inbox is read.
The browser check needs Chromium: `pnpm exec playwright install chromium`.
Each address allows 5 untried codes an hour, so repeated failed runs that never reach the verify call can lock the code request for a while (HTTP 429).

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
- revoked sessions (signed out, or ended by a password change or account deletion).

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
