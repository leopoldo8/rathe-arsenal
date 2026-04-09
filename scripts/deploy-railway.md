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

## Manual user deletion (Phase 0 — see Unit 2)

1. Run `pnpm tsx scripts/delete-user.ts <userId>` against the production DB
   (use Railway's `railway run` to inject `DATABASE_URL`).
2. All user-linked rows are cascade-deleted by the script.
