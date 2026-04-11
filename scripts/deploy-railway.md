# Railway Deployment — Rathe Arsenal Phase 0

> **Updated 2026-04-09:** Clerk replaced with DIY auth (passport-jwt + bcrypt + Resend).

Single Railway service runs the NestJS app, which serves both `/api/*` (REST API)
and the bundled React SPA from the root path. One Postgres addon. One URL.

## One-time Railway setup

1. **Create project**: `railway init` from this repo root, or via the dashboard
   (https://railway.app/new) — pick "Deploy from GitHub repo" -> `leopoldo8/rathe-arsenal`.
2. **Add Postgres addon**: dashboard -> New -> Database -> PostgreSQL.
   Railway auto-injects `DATABASE_URL` into the service.
3. **Set environment variables** (Service -> Variables):
   - `NODE_ENV=production`
   - `PORT=3000`
   - `JWT_SECRET=<64-char random hex>` (see "Generate JWT secret" below)
   - `JWT_EXPIRES_IN=7d` (optional, defaults to `7d`)
   - `RESEND_API_KEY=re_...` (see "Resend setup" below)
   - `EMAIL_FROM=Rathe Arsenal <noreply@your-verified-domain>` (or `onboarding@resend.dev` for testing)
   - `APP_BASE_URL=https://<your-railway-domain>` (the base URL for verification/reset email links)
   - `VITE_CLERK_PUBLISHABLE_KEY` — **REMOVED (no longer needed)**
   - `AWS_APPSYNC_ENDPOINT=https://42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com/graphql`
   - `COGNITO_IDENTITY_POOL_ID=us-east-2:e50f3ed7-32ed-4b22-a05e-10b3e7e03fe0`
   - `COGNITO_REGION=us-east-2`
   - `FABRARY_ALLOW_HOSTS=fabrary.net,42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com,cognito-identity.us-east-2.amazonaws.com`
4. **Set health check**: `/api/health` (already in `railway.json`).
5. **Generate domain**: Service -> Settings -> Generate Domain. Note the URL.

## Generate JWT secret

```bash
openssl rand -hex 32
# produces a 64-character hex string (256 bits of entropy)
# paste this into the Railway JWT_SECRET env var
```

**Rotation:** updating `JWT_SECRET` and redeploying invalidates **all live sessions**
immediately. Users see a 401 on their next request and must re-sign-in.
This is the Phase 0 kill switch for compromised tokens.
See `docs/phase-1-followups.md` A7 for the Phase 1 graceful-rotation plan.

## Resend setup

1. Sign up at https://resend.com (free, no credit card for the free tier — 100 emails/day, 3000/month)
2. (Optional for initial testing) Skip domain verification — use `onboarding@resend.dev` as the `EMAIL_FROM`
3. (For production sender) Verify your domain in the Resend dashboard -> Domains
4. Create an API key: Resend dashboard -> API Keys -> Create
5. Paste the key into Railway env var `RESEND_API_KEY`

## Deploy

```bash
git push origin main
```

Railway auto-builds via Nixpacks using the `buildCommand` and `startCommand` from
`railway.json`. First build pulls Node 20 + pnpm via corepack.

## Verify

```bash
curl https://<your-railway-domain>/api/health
# {"status":"ok","timestamp":"..."}
```

Visit `https://<your-railway-domain>/` in a browser -> landing page renders ->
click "Sign up" -> fill email + password -> "Check your email" page -> open email ->
click verification link -> signed in -> redirected to `/`.

## Manual user deletion (Phase 0 escape hatch — still supported)

1. Run `pnpm tsx scripts/delete-user.ts <userId>` against the production DB
   (use Railway's `railway run` to inject `DATABASE_URL`).
2. All user-linked rows are cascade-deleted by the script, including
   `rejected_substitute` rows tied to the user's tracked decks.

## Soft-delete + 30-day purge (Phase 1a Unit 2 / A8)

Users who request account deletion via the UI (`DELETE /api/auth/me`) are
**soft-deleted** — their `user.deletedAt` is set, `JwtStrategy.validate()`
immediately rejects their existing JWT, and no cascade runs yet. A scheduled
cron purges the rows permanently 30 days later, meeting the LGPD retention
window while leaving room for accidental-delete recovery in the interim.

### Purge script

```bash
# Dry run (prints eligible userIds, touches nothing)
pnpm purge:deleted-users -- --dry-run

# Real purge with non-interactive confirmation (for cron)
pnpm purge:deleted-users -- --yes

# Interactive run (prompts y/N before deleting)
pnpm purge:deleted-users

# Override retention window (e.g. for testing against a staging DB)
pnpm purge:deleted-users -- --dry-run --days=7
```

The script:
- Uses the raw `pg` driver (no TypeORM decorator runtime, fast cold start)
- Runs the whole cascade under a single transaction
- Cascade order: `rejected_substitute` → `deck_readiness_snapshot` →
  `deck_card` → `tracked_deck` → `collection_card` → `user`
- Emits a structured `{"event":"purge.user.delete","userId":...}` log line
  for every deleted userId before the final commit
- Detects `process.stdin.isTTY` to decide between interactive prompt and
  non-interactive cron mode
- Exits non-zero on any failure (cron treats this as a failed run)

### Wiring the cron on Railway

Railway's cron feature requires a **second service** in the same project
(the main API service is always-on and cannot also carry a cron schedule).
Set it up once via the dashboard:

1. **Dashboard → Project → New → Empty Service**
2. **Settings → Source → Connect Repo** → `leopoldo8/rathe-arsenal` (same repo)
3. **Settings → Deploy**:
   - **Cron Schedule**: `0 3 * * *` (daily at 03:00 UTC — low-traffic window)
   - **Start Command**: `pnpm purge:deleted-users -- --yes`
   - **Health Check**: *disabled* (cron services don't serve traffic)
   - **Restart Policy**: `NEVER` (a failed cron run should fail-loud, not
     loop)
4. **Settings → Variables → Shared Variables** → link `DATABASE_URL` from
   the Postgres service so both the API and the cron share the same DB.
   **Do not** copy-paste the URL — use Railway's shared-variable reference
   so rotating the Postgres credentials propagates automatically.
5. **Settings → Networking** → leave the cron service private (no public
   domain, no incoming traffic).
6. **Deploy** the service. Railway will run the build once, then schedule
   the start command on the cron. Verify the first run in the service logs:

   ```
   [purge] Connected. Retention window: 30 days (cutoff: ...).
   [purge] No users older than the retention window. Nothing to do.
   ```

### Operational notes

- **Dry-run before enabling**: the first production run should be with
  `--dry-run` (temporarily edit the start command to
  `pnpm purge:deleted-users -- --yes --dry-run`) so the first cron tick
  only logs, never deletes. Flip back to `--yes` alone once the dry-run
  output looks right.
- **Monitoring**: Railway log retention is short. If LGPD compliance
  requires audit evidence beyond Railway's retention window, pipe the
  `purge.user.delete` events to an external sink (Datadog, Logtail, S3).
  Tracked as a Phase 2 follow-up (A14).
- **Manual intervention**: to purge a specific user before the 30-day
  window, use the Phase 0 `scripts/delete-user.ts` instead — it hard-deletes
  a single user on demand and bypasses the retention gate.
- **Restore window**: as long as `user.deletedAt IS NOT NULL` and the row
  still exists, an operator can run
  `UPDATE "user" SET "deletedAt" = NULL WHERE id = '<uuid>'` to resurrect
  an accidentally-deleted account. The user's JWT is already invalidated
  on their side, but their data survives until the cron fires.
