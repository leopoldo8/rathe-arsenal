---
title: "feat: Replace Clerk with DIY Passport+JWT auth in Phase 0"
type: feat
status: completed
date: 2026-04-09
completed: 2026-04-09
origin: docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md
target_repo: rathe-arsenal
---

# feat: Replace Clerk with DIY Passport+JWT auth in Phase 0

## Overview

Remove Clerk as the managed identity provider for Phase 0 of Rathe Arsenal and replace it with a hand-rolled authentication layer built on `@nestjs/passport` + `passport-jwt` + `bcrypt` + Resend (transactional email). The replacement covers email/password sign-up, email verification, sign-in, password reset, and JWT-based session management — everything Clerk was carrying — with zero recurring vendor cost and full code ownership.

This plan **amends** Unit 1 (and a small slice of Unit 2) of the Phase 0 plan in place. The Phase 0 plan is otherwise unchanged: same monorepo layout, same NestJS+React+Vite stack, same Railway single-service deployment, same scope boundaries, same Gate 4 exit criteria. Only the auth substrate changes.

> **Target repo:** `rathe-arsenal/`. All file paths in this plan are relative to that repo root. (This plan originally lived at the workspace-level `personal/docs/plans/` and was moved into `rathe-arsenal/docs/plans/` during the 2026-04-11 doc consolidation.)

## Problem Frame

The Phase 0 plan picked Clerk as the managed IdP on the assumption that Clerk's free tier would cover a 5-10 person closed beta indefinitely. After scaffolding Unit 1, the project owner discovered that Clerk has paid pricing tiers for production use that were not factored into the budget for a throwaway-eligible validation phase. Continuing with Clerk introduces:

1. **Recurring cost risk** — even if the free tier covers Phase 0, any growth past the free MAU threshold is a billing surprise during a phase that is explicitly throwaway-eligible.
2. **Vendor lock-in** — every API the app makes against Clerk (sign-in modal, JWT verification, user metadata) is rework if Phase 1 needs to switch providers.
3. **Mismatch with the project posture** — Phase 0 is meant to invest in the engine, not in vendor relationships. The original "would spend a week of the budget on auth instead of the engine" objection that pushed the plan toward Clerk was correct in spirit but the savings are smaller than estimated: integrating Clerk into NestJS is also non-trivial, and the time saved was on the order of 1-2 days, not a week.

The user has explicitly chosen to replace Clerk with a DIY implementation built on libraries that are already part of the NestJS day-job vocabulary (`@nestjs/passport`, `passport-jwt`, `bcrypt`). The only new external dependency is **Resend** for transactional email, and Resend's free tier (100 emails/day, 3000/month) covers Phase 0 forever with margin to spare.

## Requirements Trace

This plan satisfies the same security requirement subset the Phase 0 plan called out for auth, with one rewrite of the rationale text:

- **S1** (auth + email verification via *managed IdP*): satisfied by `AuthService` + `EmailService` + the `verificationTokenHash` columns on the User entity. The "managed IdP" wording in the origin doc is amended to "managed-or-DIY IdP with email verification enforced before sign-in" — the requirement is *email verification enforced*, not *Clerk specifically*. (See origin: `docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`, Security & Privacy subset.)
- **S2** (server-side authz on `collection` and `tracked_deck`): unchanged. `AuthzService` (Phase 0 Unit 2) still consumes `request.user.userId`, but `userId` is now an app-generated UUID instead of Clerk's `user_xxx` string. No behavioral change to the authz pattern.
- **S4** (no secrets or full collections in logs): unchanged. The same `nestjs-pino` redact list applies. Add `passwordHash`, `password`, `verificationToken`, `passwordResetToken` to the redact list.
- **S7** (basic CSRF protection on writes): the existing CSRF posture (Bearer-token auth, no cookies, therefore no CSRF surface) is **preserved**. The DIY JWT lives in localStorage, sent via `Authorization: Bearer <jwt>`, exactly the same shape as the Clerk JWT was. No `csurf` middleware needed. Documented in the security notes file.
- **S9** (secrets out of source control): unchanged. The Clerk env vars are removed from `.env.example` and replaced with `JWT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`. None ship in source.

The Phase 0 plan's R-series user-flow requirements are unaffected — auth is upstream of all of them.

## Scope Boundaries

Explicit non-goals for this swap. Many of these are inherited from the Phase 0 plan's scope boundaries and reaffirmed here so the implementing agent does not pull them in by reflex:

- **No social/OAuth providers** (Google, GitHub, Apple). Phase 0 is email+password only. Closed beta of 5-10 friends; no social-login expectation.
- **No multi-factor authentication.** Phase 0 explicitly excludes MFA per the origin plan.
- **No refresh tokens.** A single 7-day access JWT. When it expires, the user signs in again. Refresh-token rotation is Phase 1 work and adds non-trivial complexity (storage, revocation, replay protection) for negligible Phase 0 gain.
- **No CAPTCHA, no rate limiting beyond what Express defaults provide.** S6 is explicitly Phase 1.
- **No password policy beyond a minimum length.** The implementing agent picks a sensible minimum (10 characters) during Unit 4. No complexity rules, no rotation, no breach-database lookup. Phase 0 closed beta.
- **No magic-link sign-in.** Email+password only. Magic links would require an additional token type and an additional template; not justified by Phase 0 scope.
- **No account-deletion UI.** The deletion path is still the dev script `scripts/delete-user.ts` from Phase 0 Unit 2. The script is updated to also clear the auth columns (it already cascades through every user-linked table).
- **No admin user / role system.** Every user is equal. Phase 0 has no admin surface.
- **No session storage beyond the JWT itself.** Stateless. No `session` table, no Redis. The JWT carries `sub` (userId) and `iat`/`exp`; the backend re-derives the user from the database on each request via the strategy.
- **No httpOnly-cookie session.** Bearer-token in `Authorization` header, JWT in localStorage. The trade-off is documented (XSS risk vs CSRF risk; CSRF is the bigger Phase 0 surface to avoid because the existing security posture explicitly omits CSRF middleware).
- **No password-strength meter UI.** The frontend renders a plain password input.
- **No "remember me" / "stay signed in" toggle.** All sessions are 7 days.
- **No email change flow.** The user's email is set at sign-up and never changed in Phase 0. Account recreation if needed.
- **No localization of email templates.** English only. The Phase 0 testers are bilingual; this is acceptable for validation.

## Context & Research

### Current scaffold state (uncommitted)

The Phase 0 Unit 1 scaffold was partially executed before this plan was triggered. The current state of the `rathe-arsenal/` working tree includes Clerk-coupled files that this plan replaces. **Nothing has been committed** — the entire scaffold is uncommitted in the working tree of an empty repo. The implementing agent should treat the existing Clerk files as "to be deleted/rewritten" rather than "to be preserved":

Clerk-touching files currently in the scaffold (17 total, surfaced via grep):

- Backend: `apps/api/src/auth/clerk-auth.guard.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/__tests__/clerk-auth.guard.spec.ts`, `apps/api/src/auth/decorators/current-user.decorator.ts` (no Clerk-specific code, but lives in the auth dir), `apps/api/src/app.module.ts` (imports `ClerkAuthGuard` for global registration), `apps/api/src/config/env.dto.ts` (declares `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`), `apps/api/src/config/__tests__/env.dto.spec.ts`, `apps/api/package.json` (`@clerk/backend` dependency)
- Frontend: `apps/web/src/main.tsx` (`<ClerkProvider>`), `apps/web/src/routes/index.tsx` (`SignedIn`/`SignedOut`/`SignInButton`/`SignUpButton`/`UserButton`), `apps/web/src/routes/_auth.tsx` (`SignedIn`/`SignedOut`/`RedirectToSignIn`), `apps/web/src/lib/api-client.ts` (`useAuth` from `@clerk/clerk-react`), `apps/web/package.json` (`@clerk/clerk-react` dependency)
- Config + docs: `.env.example` (Clerk env vars), `scripts/deploy-railway.md` (Clerk dashboard setup section), `docs/research/phase-0-security-notes.md` (S1 + S7 sections describe Clerk), `README.md` (mentions Clerk in stack list)

This plan rewrites or replaces every single one. The `current-user.decorator.ts` is the only file that survives unchanged in shape (it just reads `request.user` regardless of how that user got there).

### Stated ecosystem preference (carried from Phase 0 plan)

The owner uses NestJS + TypeORM + class-validator daily. The Phase 0 plan inherited the CLAUDE.md house style: file naming (`.controller.ts` / `.service.ts` / `.module.ts` / `.dto.ts` / `.guard.ts` / `.spec.ts` in `__tests__/`), `IPascalCase` interfaces, `EPascalCase` enums, `Test.createTestingModule` with explicit provider lists (never `AppModule`), `createMock` from `@golevelup/ts-jest`, `HttpException` semantic exceptions never `console.log`. This plan inherits the same conventions verbatim.

### External references

- **`@nestjs/passport`** — first-class NestJS adapter for passport strategies. The standard way to do JWT auth in NestJS. Mature, well-documented.
- **`passport-jwt`** — JWT verification strategy for passport. Reads the token from `Authorization: Bearer <jwt>`, validates the signature, calls a `validate(payload)` callback that returns the user object attached to `request.user`.
- **`@nestjs/jwt`** — companion module that wraps `jsonwebtoken` for issuing tokens. Provides `JwtService.sign(payload)` and `JwtService.verify(token)`.
- **`bcrypt`** — battle-tested password hashing. Use `bcrypt.hash(password, 12)` for storage and `bcrypt.compare(plain, hash)` for verification. Cost factor 12 is the modern default (≈250ms per hash on a Railway shared CPU; acceptable for a closed beta).
- **`resend`** (npm package) — official Resend SDK. Single method: `resend.emails.send({ from, to, subject, html, text })`. Free tier: 100 emails/day, 3000/month, no credit card required for the free tier.
- **CLAUDE.md security rules** at `~/.claude/rules/security.md` — mandate parameterized queries (TypeORM handles this), input validation via class-validator on every DTO, rate limiting on all endpoints (deferred to Phase 1 per Phase 0 scope), no hardcoded secrets, error messages that do not leak sensitive data.

### Institutional learnings

No `docs/solutions/` directory exists in this workspace. No prior auth-related learnings to consult.

### Constraints materially shaping the plan

- **Cost sensitivity is now a first-class constraint**, added to the Phase 0 plan's existing list ("solo dev, 4-6 week budget", "closed beta scale", "engine correctness matters more than everything else", "Phase 0 is throwaway-eligible"). The lesson from the Clerk swap: pre-commit, audit *every* third-party dependency for paid tiers and reject anything that would charge before Phase 0 ends.
- **The implementing agent owns auth security in this design.** Mistakes in token generation, password hashing, or verification-token handling are the developer's responsibility — there is no managed IdP catching them. The plan compensates by leaning on well-established library defaults (bcrypt cost 12, JWT HS256 with a strong random secret, sha256-hashed verification tokens stored in the DB).
- **Resend free tier cap = 100 verification/reset emails per day.** For a 5-10 user beta this is irrelevant in practice, but the EmailService should fail gracefully on Resend rate-limit errors (treat as transient, return a generic "try again later" to the user; do NOT crash the sign-up flow without the user having a clear next step).
- **Email enumeration leak is accepted.** The sign-up flow will return "email already in use" when a duplicate email is submitted. This is a known minor leak (an attacker can probe whether a given email has an account). For a closed beta with manual invitations, this is acceptable. Documented in the security notes. Phase 1 may switch to a "if this account doesn't exist, you'll receive an email" generic response if/when the beta opens publicly.

## Key Technical Decisions

Each decision is justified against this project's requirements, not against patterns elsewhere in the workspace.

- **`@nestjs/passport` + `passport-jwt` + `@nestjs/jwt` for auth substrate.** This is the canonical NestJS auth stack. The owner already knows it from work. `passport-jwt` provides the strategy that reads `Authorization: Bearer <jwt>` and calls a `validate(payload)` callback; the callback loads the user from the DB and returns the user object, which NestJS attaches to `request.user`. `@nestjs/jwt` provides `JwtService.sign()` for issuing tokens at sign-in. Together they replace `ClerkAuthGuard` with `JwtAuthGuard` (a thin `AuthGuard('jwt')` subclass) at the same global registration point.

- **HS256 (symmetric) JWT signing with a single `JWT_SECRET` env var.** RS256 (asymmetric) is the right answer when multiple services need to verify tokens without holding the signing key. Phase 0 has exactly one service (the NestJS app) that both signs and verifies, so HS256 is simpler and equally secure. The secret is a 64-character random hex string generated by the deployer (`openssl rand -hex 32`) and stored in Railway's env var UI. Rotation invalidates all live sessions; the plan accepts that for Phase 0 (rotation is a manual operational event, not a feature).

- **7-day access tokens, no refresh tokens.** Refresh-token rotation is the right architecture for production apps that want short-lived access tokens (5-15 min) plus long-lived refresh tokens (weeks). It is also a meaningful chunk of code: refresh-token storage, revocation list, replay protection, the `/auth/refresh` endpoint, the frontend retry-on-401 logic. For a closed beta where users sign in once a week, a single 7-day access token is dramatically simpler and the user-experience cost (re-sign-in once a week) is acceptable. Phase 1 can introduce refresh tokens if/when sessions need to be shorter for security hardening.

- **bcrypt cost factor 12.** The 2026 default for new applications. About 250ms per hash on a Railway shared CPU, which means brute-force is computationally expensive for an attacker without making sign-in noticeably slow for the user. Argon2id is the more modern choice but introduces a less-familiar library and the security improvement over bcrypt-12 is marginal at this scale. Phase 0 picks the boring well-trodden option.

- **Email verification is enforced *before* sign-in succeeds.** A user who has signed up but not clicked the verification link cannot obtain a JWT. The sign-in endpoint returns `403 Forbidden` with `code: EMAIL_NOT_VERIFIED` and the frontend shows a "resend verification email" button. This is stricter than Clerk's default and stricter than many OSS auth libs ship by default — but it satisfies S1 unambiguously and is one less footgun.

- **Verification and password-reset tokens are random 32-byte hex strings, hashed with sha256 before storage.** Same pattern as `secret_token` in Rails / Django's `default_token_generator`. The token sent in the email is the raw hex; the database stores `sha256(rawHex)`. To validate, the backend hashes the incoming token and compares. This means a database leak does NOT expose live verification/reset tokens — an attacker would need both the leak and a same-day in-flight token to abuse the link. The hash is sha256, not bcrypt: these tokens are already 256 bits of entropy (effectively unguessable), so the hash exists for *containment of leaked-DB exposure*, not for slowing down a brute force.

- **Verification tokens expire in 24 hours; password-reset tokens expire in 1 hour.** Standard intervals. Both are stored as `expiresAt` columns alongside the hash. After expiry, the user requests a new email.

- **JWT in localStorage on the frontend, sent via `Authorization: Bearer`.** Same wire-shape as the Clerk integration was. The known XSS-exfiltration risk is documented in the security notes file as an explicit accepted trade-off, with the rationale that Phase 0's React app has no user-generated HTML render path (no markdown rendering, no embedded HTML, no untrusted image hosts) and the CSRF risk avoided by *not* using cookies is the bigger concern given the existing "no `csurf`" posture. The frontend stores the JWT under a single localStorage key (`rathe-arsenal:jwt`) and the React `<AuthProvider>` reads it on mount.

- **Frontend auth context, not a third-party UI library.** Build a small `<AuthProvider>` that holds `{ user, token, signIn, signOut, signUp, ... }` in React context. Five plain forms in five plain routes. No `<SignIn>` widget from any vendor. This is more code than dropping in a Clerk modal but less than reskinning a vendor widget — and the implementing agent has full control of every state transition.

- **Resend SDK used directly (no `nodemailer` abstraction).** Nodemailer-with-SMTP is the more portable choice — but Phase 0 has exactly one transactional sender, and the Resend SDK is 1 dependency, 1 method, 5 lines of integration. If Phase 1 wants to switch (to AWS SES, Postmark, etc.), the swap is contained inside `EmailService` and is a few hours of work. Premature abstraction is not free.

- **Dev mode bypasses Resend entirely.** When `NODE_ENV === 'development'`, `EmailService.send()` logs the rendered email to stdout via the NestJS logger (with the link clearly visible) and returns success without contacting Resend. The dev API also returns a `_devVerificationLink` field in the sign-up response so the implementing agent and the e2e tests can extract the link without parsing logs. In production this field is **omitted** (not just empty — omitted from the DTO entirely).

- **The implementing agent does NOT introduce its own crypto primitives.** Every crypto operation goes through a named library: bcrypt for passwords, `crypto.randomBytes` (Node built-in) for tokens, `crypto.createHash('sha256')` for token hashing, `jsonwebtoken` (via `@nestjs/jwt`) for JWTs. No hand-rolled "I'll just XOR these bytes" code. Wrapped in two service classes — `PasswordHasherService` and `TokenGeneratorService` — so they are mockable in tests and swappable in Phase 1.

## Open Questions

### Resolved During Planning

- **Clerk vs another managed IdP vs DIY?** Resolved to DIY. Cost sensitivity is the primary driver; control + ecosystem fit are secondary drivers.
- **Symmetric vs asymmetric JWT signing?** Resolved to symmetric (HS256) — single service signs and verifies, simpler.
- **Refresh-token rotation in Phase 0?** Resolved to no — single 7-day token, re-sign-in on expiry.
- **Where does the JWT live on the frontend?** Resolved to localStorage. Trade-off documented in security notes.
- **Email transactional provider?** Resolved to Resend (free tier 100/day, well within Phase 0 needs).
- **Verification token storage shape?** Resolved to sha256 of a 32-byte random hex, with `expiresAt`, stored as nullable columns directly on the User entity (not a separate table). Sufficient for Phase 0; a separate `token` table is overkill.
- **Email verification: required before sign-in or only encouraged?** Resolved to required. Enforced at sign-in time; sign-in returns `403 EMAIL_NOT_VERIFIED` until the user clicks the link.
- **OAuth/social providers in Phase 0?** Resolved to no.
- **MFA in Phase 0?** Resolved to no (already excluded by origin plan).
- **Account-deletion UI in Phase 0?** Resolved to no (already excluded by origin plan; dev script remains the deletion path).
- **Should the User entity primary key be the Clerk ID or app-generated?** Resolved to app-generated UUIDv4. Phase 0 plan Unit 2 originally specified "primary key is Clerk's userId string"; that line is amended in this swap (see Plan Amendments below).

### Deferred to Implementation

- **Exact minimum password length and any complexity rules.** Suggested: 10 character minimum, no complexity rules. Final pick is in Unit 4 inside the `SignUpDto`'s class-validator decorators.
- **HTML email template visual design.** Plain HTML, brand line at top, single CTA button, plaintext fallback. Final markup is in Unit 3.
- **Exact Resend "from" address.** Pick a sensible default during Unit 3 (`Rathe Arsenal <noreply@<domain>>`); the domain will need to be verified in the Resend dashboard before production. For Phase 0, Resend's `onboarding@resend.dev` works as a verified-by-default sender for closed-beta testing.
- **Frontend form styling.** Plain CSS with the existing inline styles in `__root.tsx`. No CSS framework added in this plan; if the implementing agent wants Tailwind later it is a separate decision.
- **Whether to display the user's email in the header after sign-in.** Yes, but the exact placement is a Unit 5 detail.
- **JWT secret rotation procedure.** Phase 0 accepts that rotation invalidates all sessions and is a manual operational event. Documented in `scripts/deploy-railway.md`. Phase 1 may add a key-id (`kid`) for graceful rotation.
- **Whether to log the sign-in event (audit trail).** Phase 0 logs sign-in success/failure via the existing `nestjs-pino` logger as a structured event (`event: 'auth.sign_in.success'` / `'auth.sign_in.failure'`). Detailed audit-log retention is Phase 1.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Sign-up flow

```
Browser                          API                              Database         Resend
   │                              │                                  │                │
   │  POST /api/auth/sign-up      │                                  │                │
   │  { email, password }         │                                  │                │
   ├─────────────────────────────►│                                  │                │
   │                              │  hash password (bcrypt 12)       │                │
   │                              │  generate verification token     │                │
   │                              │  hash token (sha256)             │                │
   │                              │  INSERT user                     │                │
   │                              ├─────────────────────────────────►│                │
   │                              │                                  │                │
   │                              │  send verification email         │                │
   │                              │  (link contains raw token)       │                │
   │                              ├─────────────────────────────────────────────────►│
   │                              │                                  │                │
   │  201 { userId, email }       │                                  │                │
   │  (no JWT issued yet)         │                                  │                │
   │◄─────────────────────────────┤                                  │                │
   │                              │                                  │                │
   │  GET /verify-email?token=xxx │                                  │                │
   │  (browser via email link)    │                                  │                │
   ├─────────────────────────────►│                                  │                │
   │                              │  hash incoming token             │                │
   │                              │  SELECT user WHERE hash matches  │                │
   │                              │  AND expiresAt > now             │                │
   │                              ├─────────────────────────────────►│                │
   │                              │  UPDATE emailVerifiedAt = now    │                │
   │                              │  clear verification fields       │                │
   │                              ├─────────────────────────────────►│                │
   │                              │  issue JWT                       │                │
   │                              │  (now signed in)                 │                │
   │  200 { jwt, user }           │                                  │                │
   │◄─────────────────────────────┤                                  │                │
```

### Sign-in flow

```
Browser                          API                              Database
   │  POST /api/auth/sign-in      │                                  │
   │  { email, password }         │                                  │
   ├─────────────────────────────►│                                  │
   │                              │  SELECT user by email            │
   │                              ├─────────────────────────────────►│
   │                              │  bcrypt.compare(password, hash)  │
   │                              │  check emailVerifiedAt != null   │
   │                              │  issue JWT (sub=userId, exp+7d)  │
   │  200 { jwt, user }           │                                  │
   │◄─────────────────────────────┤                                  │
```

### Authenticated request (replaces ClerkAuthGuard)

```
Browser                          API
   │  GET /api/decks              │
   │  Authorization: Bearer xxx   │
   ├─────────────────────────────►│
   │                              │  JwtAuthGuard (AuthGuard('jwt'))
   │                              │    └─ JwtStrategy.validate(payload)
   │                              │         │
   │                              │         ├─ load user from DB by payload.sub
   │                              │         ├─ assert user.emailVerifiedAt != null
   │                              │         └─ return { userId, email }
   │                              │  request.user populated
   │                              │  controller handler runs
```

### User entity (locked at this swap, same shape Unit 2 of Phase 0 plan will use)

```
user
├─ id                          uuid          PK, app-generated (uuidv4)
├─ email                       varchar(255)  unique, not null
├─ passwordHash                varchar(60)   not null  (bcrypt output)
├─ emailVerifiedAt             timestamptz   nullable  (null = unverified)
├─ verificationTokenHash       varchar(64)   nullable  (sha256 hex)
├─ verificationTokenExpiresAt  timestamptz   nullable
├─ passwordResetTokenHash      varchar(64)   nullable
├─ passwordResetTokenExpiresAt timestamptz   nullable
└─ createdAt                   timestamptz   not null  (default now())
```

## Implementation Units

### Unit 1: User entity, schema, env swap, dependency swap

**Goal:** Lock the User entity shape with all auth columns, swap the package.json dependencies (remove Clerk, add passport/jwt/bcrypt/resend), swap env vars in `env.dto.ts` and `.env.example`, and remove the Clerk references that are now dead. This unit ships no behavior — it sets the stage for Units 2-5.

**Requirements:** S1 (data shape), S9 (env var hygiene).

**Dependencies:** None. This is the first unit of the swap.

**Files:**
- Modify: `apps/api/package.json` — remove `@clerk/backend`; add `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, `bcrypt`, `resend`; add devDeps `@types/passport-jwt`, `@types/bcrypt`
- Modify: `apps/web/package.json` — remove `@clerk/clerk-react`
- Modify: `apps/api/src/config/env.dto.ts` — remove `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`; add `JWT_SECRET` (string, min 32 chars), `JWT_EXPIRES_IN` (string, default `'7d'`), `RESEND_API_KEY` (string), `EMAIL_FROM` (string, valid email), `APP_BASE_URL` (URL — used to build verification/reset links in emails)
- Modify: `.env.example` — same swap, with placeholder values and a comment pointing to the Resend dashboard
- Modify: `apps/api/src/config/__tests__/env.dto.spec.ts` — update the valid env fixture and the missing-var assertions
- Create: `apps/api/src/database/entities/user.entity.ts` — TypeORM entity matching the schema in High-Level Technical Design above. **This file partially fulfills Phase 0 plan Unit 2's User entity work** (the original Unit 2 will reference this file rather than creating it again — see Plan Amendments below)
- Create: `apps/api/src/database/entities/user.entity.spec.ts` (unit test for any entity-level helpers if added)
- Modify: `apps/api/src/common/logger/logger.module.ts` — extend redact list with `passwordHash`, `password`, `verificationToken`, `passwordResetToken`, `verificationTokenHash`, `passwordResetTokenHash`
- Delete: `apps/api/src/auth/clerk-auth.guard.ts`
- Delete: `apps/api/src/auth/__tests__/clerk-auth.guard.spec.ts`
- Modify: `README.md` — update stack list to remove Clerk, add "DIY auth (passport-jwt + bcrypt + Resend)"

**Approach:**
- The User entity locks an `id` of type `uuid` generated by the application via `@PrimaryGeneratedColumn('uuid')`. This is a deliberate departure from Phase 0 Unit 2's "primary key is Clerk's userId" — see Plan Amendments below.
- `passwordHash` is `varchar(60)` because bcrypt always emits a 60-character hash regardless of input.
- `verificationTokenHash` and `passwordResetTokenHash` are `varchar(64)` because sha256 hex is 64 characters.
- All four token-related columns are nullable. After successful verification, the verification columns are cleared. After successful password reset, the reset columns are cleared.
- `email` has a database-level unique index. Application-level pre-check (sign-up flow) catches duplicates earlier with a friendly error; the unique index is the defense-in-depth backstop.
- Removing Clerk files at this stage temporarily breaks the build — `apps/api/src/app.module.ts` still imports `ClerkAuthGuard` and `apps/web/src/main.tsx` still imports `ClerkProvider`. **Do not** patch those imports in this unit; they are addressed in Units 2 (backend) and 5 (frontend) when the replacements are ready. Mark this unit as "build broken between Unit 1 and Unit 2" in the commit message; the implementing agent may choose to land Unit 1 + Unit 2 together if intermediate-broken-build is undesirable.

**Patterns to follow:** CLAUDE.md naming conventions for entities (`.entity.ts`), TypeORM `@Column`/`@PrimaryGeneratedColumn` decorators per the existing `apps/api/src/database/datasource.ts` glob.

**Test scenarios:**
- *Happy path — env DTO parse with new vars:* with all new env vars set, `validateEnv` returns a populated DTO and `JWT_SECRET` is at least 32 chars.
- *Error path — env DTO missing JWT_SECRET:* throws with descriptive error naming `JWT_SECRET`.
- *Error path — env DTO short JWT_SECRET:* a 16-char `JWT_SECRET` throws.
- *Error path — env DTO missing RESEND_API_KEY:* throws with descriptive error naming `RESEND_API_KEY`.
- *Error path — env DTO invalid APP_BASE_URL:* `'not a url'` throws.
- *Edge case — env DTO no longer accepts CLERK vars:* a fixture with `CLERK_SECRET_KEY` set and the new vars unset still fails validation (because the new required vars are missing), proving the swap took effect.

**Verification:**
- `pnpm --filter @rathe-arsenal/api typecheck` reports the expected breakage pointing at `app.module.ts`'s `ClerkAuthGuard` import (the breakage proves the file was deleted; resolved in Unit 2).
- `pnpm --filter @rathe-arsenal/api test config` passes the env DTO scenarios.
- The User entity compiles in isolation (`pnpm --filter @rathe-arsenal/api typecheck` on a stub `app.module.ts` if needed, or via the entity's own spec).
- `grep -r "@clerk\|ClerkAuthGuard\|CLERK_" apps/api/src` returns no hits (the only acceptable hit would be inside this plan's Unit 7 cleanup notes; otherwise zero).

---

### Unit 2: PasswordHasher + TokenGenerator + JwtStrategy + JwtAuthGuard

**Goal:** Build the crypto primitives and the JWT verification path. After this unit lands, the backend has a working `JwtAuthGuard` that replaces `ClerkAuthGuard` at the global registration point in `app.module.ts`. The build is unbroken at the end of this unit (excluding the still-pending email and frontend pieces, which only break the actual sign-up/sign-in flows, not the boot path).

**Requirements:** S1 (auth backbone), S2 (request.user shape preserved for downstream authz).

**Dependencies:** Unit 1 (entity + env vars + dependencies installed).

**Files:**
- Create: `apps/api/src/auth/services/password-hasher.service.ts` — `@Injectable()` wrapping bcrypt. Methods: `hash(plain: string): Promise<string>` and `verify(plain: string, hash: string): Promise<boolean>`. Cost factor 12, hardcoded as a class constant
- Create: `apps/api/src/auth/services/token-generator.service.ts` — `@Injectable()` wrapping Node `crypto`. Methods: `generateRawToken(): string` (32 bytes hex = 64 chars), `hashToken(raw: string): string` (sha256 hex = 64 chars), `compareToken(raw: string, storedHash: string): boolean` (constant-time comparison via `crypto.timingSafeEqual`)
- Create: `apps/api/src/auth/strategies/jwt.strategy.ts` — `passport-jwt` strategy. Reads token from `Authorization: Bearer`, verifies signature with `JWT_SECRET` from `ConfigService`, calls `validate(payload)` which loads the user from DB by `payload.sub` and asserts `emailVerifiedAt != null`. Returns `{ userId, email }` to be attached to `request.user`. Throws `UnauthorizedException` on missing user or unverified email
- Create: `apps/api/src/auth/jwt-auth.guard.ts` — extends `AuthGuard('jwt')` from `@nestjs/passport`. Honors the `@Public()` decorator from `apps/api/src/auth/decorators/public.decorator.ts` (the existing decorator from the Clerk era is reused unchanged)
- Modify: `apps/api/src/auth/auth.module.ts` — provide `PasswordHasherService`, `TokenGeneratorService`, `JwtStrategy`, `JwtAuthGuard`. Import `PassportModule`, `JwtModule.registerAsync` (reads `JWT_SECRET` and `JWT_EXPIRES_IN` from `ConfigService`), and `TypeOrmModule.forFeature([UserEntity])`. Export the guard
- Modify: `apps/api/src/app.module.ts` — replace `ClerkAuthGuard` global registration with `JwtAuthGuard`
- Create: `apps/api/src/auth/services/__tests__/password-hasher.service.spec.ts`
- Create: `apps/api/src/auth/services/__tests__/token-generator.service.spec.ts`
- Create: `apps/api/src/auth/__tests__/jwt.strategy.spec.ts`
- Create: `apps/api/src/auth/__tests__/jwt-auth.guard.spec.ts`

**Approach:**
- `PasswordHasherService.hash(plain)` calls `bcrypt.hash(plain, 12)`. The cost factor is a class-private constant — not configurable via env — so a misconfiguration cannot accidentally weaken hashing in prod.
- `TokenGeneratorService.generateRawToken()` returns `crypto.randomBytes(32).toString('hex')`. 32 bytes = 256 bits of entropy = effectively unguessable.
- `TokenGeneratorService.compareToken(raw, storedHash)` first hashes `raw`, then uses `crypto.timingSafeEqual` to compare buffers. Returns `false` if buffer lengths differ (sanity check). Constant-time comparison prevents the very-narrow timing-side-channel where an attacker can learn how many leading bytes match.
- `JwtStrategy.validate(payload)` is the *only* place that queries the DB on every authenticated request. This is a deliberate trade-off: it costs one query per request but guarantees that a user whose `emailVerifiedAt` is later cleared (e.g., by an admin script) is immediately locked out. For 5-10 users this is well within budget. Phase 1 may cache the user in memory or in the JWT itself.
- `JwtAuthGuard` defers everything to `AuthGuard('jwt')`. The `@Public()` skip logic lives in a small `canActivate` override that checks the reflector, returns `true` if public, otherwise calls `super.canActivate(context)`.

**Patterns to follow:** CLAUDE.md NestJS service patterns; `@Injectable()` services with constructor DI; `Test.createTestingModule` with `createMock` for collaborators.

**Test scenarios:**
- *Happy path — PasswordHasher round-trip:* `hash(p)` produces a 60-char string; `verify(p, hash)` returns true; `verify('wrong', hash)` returns false.
- *Edge case — PasswordHasher with empty password:* `hash('')` succeeds (bcrypt accepts empty input); the application-level minimum-length validation lives in the DTO, not in the hasher (separation of concerns).
- *Happy path — TokenGenerator round-trip:* `compareToken(raw, hashToken(raw))` returns true; `compareToken(raw, hashToken('different'))` returns false.
- *Edge case — TokenGenerator constant-time on mismatched lengths:* a hash of the wrong length (e.g. truncated) returns false without throwing.
- *Happy path — JwtStrategy.validate with verified user:* given a payload `{ sub: userId }` and a DB user with `emailVerifiedAt != null`, returns `{ userId, email }`.
- *Error path — JwtStrategy.validate with no matching user:* throws `UnauthorizedException`.
- *Error path — JwtStrategy.validate with unverified user:* a user row exists but `emailVerifiedAt == null`; throws `UnauthorizedException` with no internal-detail leakage in the message.
- *Happy path — JwtAuthGuard public route:* a route marked `@Public()` returns true without invoking the JWT verifier.
- *Error path — JwtAuthGuard missing Authorization header:* throws `UnauthorizedException` (delegated to passport-jwt).
- *Integration — JwtAuthGuard with valid token end-to-end:* a `Test.createTestingModule` builds a real `JwtModule` with a test secret, signs a token for a seeded user, sends it via supertest to a protected endpoint, and gets a 200 with `request.user` populated. This is the cross-layer test that proves the strategy + guard + decorator + module wiring all line up.

**Verification:**
- `pnpm --filter @rathe-arsenal/api build` succeeds (Clerk references are gone, JwtAuthGuard wired).
- `pnpm --filter @rathe-arsenal/api test auth` passes every scenario above.
- `pnpm --filter @rathe-arsenal/api start` boots without auth-related errors (still no AuthService yet, so sign-up/sign-in routes don't exist — but the boot path is clean).
- `grep -r "ClerkAuthGuard\|@clerk/backend" apps/api/src` returns zero hits.

---

### Unit 3: EmailService + Resend integration + dev fallback + email templates

**Goal:** Build the side-channel that delivers verification and password-reset emails. Ship the EmailService that wraps the Resend SDK in production and writes to the logger in development. Ship two email templates as plain TS modules that return `{ subject, html, text }`.

**Requirements:** S1 (verification emails are part of the verification chain), S4 (no leakage of token contents into logs in prod — only in dev).

**Dependencies:** Unit 1 (env vars + Resend dependency installed).

**Files:**
- Create: `apps/api/src/email/email.module.ts` — provides `EmailService`, exports it, marked `@Global()` so any module can inject without imports
- Create: `apps/api/src/email/email.service.ts` — `@Injectable()` with `sendVerificationEmail({ to, link })` and `sendPasswordResetEmail({ to, link })`. Internally branches on `NODE_ENV`: production calls Resend; development logs the rendered email + link via `Logger`
- Create: `apps/api/src/email/templates/verification-email.template.ts` — pure function `(args: { link: string; appName: string }) => { subject, html, text }`
- Create: `apps/api/src/email/templates/password-reset-email.template.ts` — same shape
- Create: `apps/api/src/email/__tests__/email.service.spec.ts`
- Create: `apps/api/src/email/__tests__/verification-email.template.spec.ts`
- Create: `apps/api/src/email/__tests__/password-reset-email.template.spec.ts`
- Modify: `apps/api/src/app.module.ts` — import `EmailModule`

**Approach:**
- `EmailService` constructor takes `ConfigService` and reads `RESEND_API_KEY`, `EMAIL_FROM`, `NODE_ENV`. The Resend client is instantiated once in the constructor (or lazily on first send) and held as a private field.
- In development, `send*Email` methods call the injected `Logger` with a structured event including the link in the clear, then return `{ id: 'dev-mock' }` without contacting Resend.
- In production, the methods call `resend.emails.send(...)`. If Resend returns an error (rate limit, invalid recipient, network), the EmailService throws an `EmailDeliveryError` with a `code` enum (`RATE_LIMITED`, `INVALID_RECIPIENT`, `NETWORK`). The AuthService catches `EmailDeliveryError` and surfaces a generic "couldn't send email, please try again" to the user; the underlying error is logged (without the recipient email per S4 redaction rules).
- The templates are deliberately plain. Subject lines: `"Verify your Rathe Arsenal account"` and `"Reset your Rathe Arsenal password"`. Body: a brief explanation, a single CTA button styled with inline CSS (the link), and a plaintext fallback that includes the raw URL. No images, no tracking pixels, no localization.
- The implementing agent uses `@golevelup/ts-jest`'s `createMock` to mock the `Resend` client in `email.service.spec.ts`. The two template files are pure functions with snapshot tests (or small string-contains assertions).

**Patterns to follow:** CLAUDE.md NestJS module + service patterns. The `@Global()` module pattern is the same one `LoggerModule` uses in the existing scaffold.

**Test scenarios:**
- *Happy path — EmailService dev mode:* with `NODE_ENV='development'`, `sendVerificationEmail({ to, link })` does NOT call the Resend client; logs the rendered template with the link visible; returns success.
- *Happy path — EmailService prod mode:* with `NODE_ENV='production'`, calls `resend.emails.send` with the rendered subject/html/text and the configured `from`; returns the Resend response id.
- *Error path — EmailService prod mode rate-limited:* mocked Resend rejects with a 429-equivalent error; EmailService throws `EmailDeliveryError` with `code === 'RATE_LIMITED'`.
- *Error path — EmailService prod mode network error:* mocked Resend rejects with a generic error; EmailService throws `EmailDeliveryError` with `code === 'NETWORK'`.
- *Error path — EmailService prod mode invalid recipient:* mocked Resend rejects with an invalid-email error; EmailService throws `EmailDeliveryError` with `code === 'INVALID_RECIPIENT'`.
- *Happy path — verification template renders required fields:* output `subject` is non-empty, `html` contains the link, `text` contains the link, `text` does NOT contain HTML tags.
- *Happy path — password reset template renders required fields:* same shape.
- *Edge case — template URL injection guard:* a link containing characters like `<script>` is HTML-escaped in the `html` output. The implementing agent uses `String(...)` interpolation with a small `escapeHtml` helper or relies on a templating function that escapes by default. (Phase 0 generates links from internal token data, so this is defense-in-depth, not a known threat.)

**Verification:**
- `pnpm --filter @rathe-arsenal/api test email` passes every scenario.
- `pnpm --filter @rathe-arsenal/api start` (with `NODE_ENV=development` and a fake `RESEND_API_KEY`) boots cleanly.
- A manual smoke test (deferred to after Unit 4 wires up the AuthService) shows the verification email logged to stdout when a sign-up is performed in dev mode.

---

### Unit 4: AuthService + AuthController + DTOs (the HTTP surface)

**Goal:** Wire the crypto primitives, the JWT issuer, and the email service together into the application service that handles the five user-facing flows: sign-up, sign-in, verify-email, forgot-password, reset-password. Expose them as REST endpoints under `/api/auth/*`.

**Requirements:** R-series (auth is the gate to every R requirement), S1 (full flow), S2 (the controller is what other controllers' authz depends on by populating `request.user`).

**Dependencies:** Unit 1 (User entity + env), Unit 2 (PasswordHasher, TokenGenerator, JwtStrategy, JwtAuthGuard, JwtModule wired), Unit 3 (EmailService).

**Files:**
- Create: `apps/api/src/auth/dtos/sign-up.dto.ts` — class-validator: `@IsEmail()` email, `@IsString() @MinLength(10)` password
- Create: `apps/api/src/auth/dtos/sign-in.dto.ts` — same shape
- Create: `apps/api/src/auth/dtos/verify-email.dto.ts` — `@IsString() @Length(64, 64)` token (raw hex)
- Create: `apps/api/src/auth/dtos/forgot-password.dto.ts` — `@IsEmail()` email
- Create: `apps/api/src/auth/dtos/reset-password.dto.ts` — `@IsString() @Length(64, 64)` token, `@IsString() @MinLength(10)` newPassword
- Create: `apps/api/src/auth/dtos/auth-response.dto.ts` — interface `IAuthResponse { jwt: string; user: { id: string; email: string } }`
- Create: `apps/api/src/auth/dtos/sign-up-response.dto.ts` — `{ userId: string; email: string; _devVerificationLink?: string }` (the dev field is omitted entirely in prod, not just empty)
- Create: `apps/api/src/auth/auth.service.ts` — five methods matching the flows above
- Create: `apps/api/src/auth/auth.controller.ts` — `@Controller('auth')`. Five endpoints, all marked `@Public()` (they don't require an existing JWT to call)
- Create: `apps/api/src/auth/errors.ts` — `AuthError` with `code` enum (`EMAIL_IN_USE`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `EMAIL_DELIVERY_FAILED`)
- Create: `apps/api/src/auth/__tests__/auth.service.spec.ts`
- Create: `apps/api/src/auth/__tests__/auth.controller.spec.ts`
- Create: `apps/api/src/auth/__tests__/auth.flow.int-spec.ts` — integration test that exercises the full sign-up → verify → sign-in → forgot → reset chain against a real (test-mode) `JwtModule`, real `PasswordHasherService`, real `TokenGeneratorService`, real in-memory User repository (or createMock with realistic state), and a mocked `EmailService` that captures sends
- Modify: `apps/api/src/auth/auth.module.ts` — provide `AuthService`, register `AuthController`
- Modify: `apps/api/src/health/health.controller.ts` — no change needed; reaffirm the `@Public()` decorator

**Approach:**

`AuthService` methods (each returns a typed DTO; throws `AuthError` on failure, which the controller maps to `HttpException`):

- `signUp({ email, password })`:
  1. Look up user by email; if exists, throw `AuthError(EMAIL_IN_USE)`. (Email enumeration leak accepted for closed beta.)
  2. Hash password via `PasswordHasherService`.
  3. Generate raw verification token + expiresAt (24h) via `TokenGeneratorService`.
  4. Insert User with `emailVerifiedAt = null`, `verificationTokenHash = sha256(rawToken)`, `verificationTokenExpiresAt = now + 24h`.
  5. Build verification link: `${APP_BASE_URL}/verify-email?token=${rawToken}`.
  6. Call `emailService.sendVerificationEmail({ to, link })`. On failure, log + throw `AuthError(EMAIL_DELIVERY_FAILED)`. (The user row is left in place — the user can call `forgotPassword` to receive a fresh email later, OR the implementing agent may add a "resend verification" endpoint as a Phase 0 follow-up. For Unit 4, accept that a delivery failure means the user must contact support — for a closed beta with 5-10 friends, "support" is a Telegram message.)
  7. Return `{ userId, email, _devVerificationLink? }`. The `_devVerificationLink` is the raw link if and only if `NODE_ENV === 'development'`.

- `signIn({ email, password })`:
  1. Look up user by email; if missing, throw `AuthError(INVALID_CREDENTIALS)`.
  2. `passwordHasher.verify(password, user.passwordHash)`; if false, throw `AuthError(INVALID_CREDENTIALS)`.
  3. If `user.emailVerifiedAt == null`, throw `AuthError(EMAIL_NOT_VERIFIED)`.
  4. Issue JWT via `JwtService.signAsync({ sub: user.id })`.
  5. Return `{ jwt, user: { id, email } }`.

- `verifyEmail({ token })`:
  1. Hash incoming token via `TokenGeneratorService.hashToken`.
  2. Look up user by `verificationTokenHash` AND `verificationTokenExpiresAt > now`; if missing, throw `AuthError(INVALID_TOKEN)` (the message is generic — does not distinguish "wrong token" from "expired").
  3. Update user: `emailVerifiedAt = now`, `verificationTokenHash = null`, `verificationTokenExpiresAt = null`.
  4. Issue JWT (auto sign-in after verification — single round trip from email click to authenticated session).
  5. Return `{ jwt, user: { id, email } }`.

- `requestPasswordReset({ email })`:
  1. Look up user by email; if missing, return success silently (do NOT leak existence on this endpoint — it is reachable by anyone, unlike sign-up).
  2. Generate raw reset token + expiresAt (1h).
  3. Update user with `passwordResetTokenHash` and `passwordResetTokenExpiresAt`.
  4. Build link: `${APP_BASE_URL}/reset-password?token=${rawToken}`.
  5. Call `emailService.sendPasswordResetEmail`.
  6. Return `{ ok: true }`.

- `resetPassword({ token, newPassword })`:
  1. Hash incoming token; look up user by `passwordResetTokenHash` AND `passwordResetTokenExpiresAt > now`; if missing, throw `AuthError(INVALID_TOKEN)`.
  2. Hash new password.
  3. Update user: `passwordHash = newHash`, `passwordResetTokenHash = null`, `passwordResetTokenExpiresAt = null`. **Do not** clear or modify `emailVerifiedAt` (a verified user stays verified).
  4. Issue JWT (auto sign-in after reset).
  5. Return `{ jwt, user }`.

`AuthController` handlers are thin: parse the DTO, call the service, catch `AuthError` and map to the right `HttpException` (`409` for `EMAIL_IN_USE`, `401` for `INVALID_CREDENTIALS`, `403` for `EMAIL_NOT_VERIFIED`, `400` for `INVALID_TOKEN`/`TOKEN_EXPIRED`, `503` for `EMAIL_DELIVERY_FAILED`). The mapping is centralized in a small `auth-error.mapper.ts` helper to keep the controller readable.

**Patterns to follow:** CLAUDE.md NestJS controller + service + DTO patterns. Validation via class-validator decorators on DTOs; the global `ValidationPipe` already configured in `main.ts` enforces them.

**Test scenarios:**

*AuthService.signUp:*
- *Happy path:* given a fresh email, creates a user with `emailVerifiedAt == null`, hashes the password, stores the token hash, calls `emailService.sendVerificationEmail` with a link containing the raw token, returns `{ userId, email }`.
- *Error path — duplicate email:* given an existing email, throws `AuthError(EMAIL_IN_USE)` and does not call the email service.
- *Edge case — dev mode includes _devVerificationLink:* with `NODE_ENV='development'`, the response includes the raw link; with `NODE_ENV='production'`, the field is absent (not just empty).
- *Error path — email delivery fails:* mocked `emailService.sendVerificationEmail` throws; AuthService rethrows as `AuthError(EMAIL_DELIVERY_FAILED)`. (Unit 4 accepts that the user row is created but unverifiable; this is documented.)

*AuthService.signIn:*
- *Happy path:* verified user with correct password gets a signed JWT.
- *Error path — wrong password:* throws `AuthError(INVALID_CREDENTIALS)`.
- *Error path — unknown email:* throws `AuthError(INVALID_CREDENTIALS)` (same code as wrong password; do not distinguish).
- *Error path — unverified user:* throws `AuthError(EMAIL_NOT_VERIFIED)` even when password is correct.

*AuthService.verifyEmail:*
- *Happy path:* a valid unexpired token marks the user verified, clears the token columns, returns a JWT.
- *Error path — token does not match any user:* throws `AuthError(INVALID_TOKEN)`.
- *Error path — token expired:* throws `AuthError(INVALID_TOKEN)`.
- *Edge case — token consumed twice:* a second verifyEmail call with the same token throws `AuthError(INVALID_TOKEN)` because the columns were cleared on first success.

*AuthService.requestPasswordReset:*
- *Happy path — known email:* generates and emails a reset link, returns success.
- *Edge case — unknown email:* returns success silently, does not call the email service. (Verified by inspecting the mock.)
- *Edge case — known but unverified email:* still issues the reset (the user can prove ownership via the email click and then complete signup-by-resetting). Document this choice in the test name.

*AuthService.resetPassword:*
- *Happy path:* a valid unexpired reset token sets a new password (verified by re-running `signIn` with the new password) and clears the reset columns; returns a JWT.
- *Error path — invalid or expired reset token:* throws `AuthError(INVALID_TOKEN)`.
- *Edge case — reset does not change emailVerifiedAt:* a verified user resetting their password remains verified.

*AuthController:*
- Each endpoint maps the corresponding `AuthError` codes to the documented HTTP statuses (table-driven test).

*Integration (`auth.flow.int-spec.ts`):*
- Full chain — sign-up → verify (using the link captured from the mocked email service) → sign-in → use JWT to call a protected endpoint → forgot-password → reset-password (using the new captured link) → sign-in with new password → JWT still works on protected endpoint. This is the cross-layer test that proves AuthService + DTOs + ValidationPipe + JwtModule + JwtStrategy all line up end-to-end with no mocks except the email side channel.

**Verification:**
- `pnpm --filter @rathe-arsenal/api test auth` passes every scenario.
- `pnpm --filter @rathe-arsenal/api build && pnpm --filter @rathe-arsenal/api start` boots cleanly.
- Manual smoke test: `curl -X POST http://localhost:3000/api/auth/sign-up -H 'Content-Type: application/json' -d '{"email":"test@example.com","password":"correcthorsebattery"}'` → 201 with `_devVerificationLink` in dev. Click the link → 200 + JWT. `curl /api/auth/sign-in` → 200 + JWT. `curl /api/health -H "Authorization: Bearer <jwt>"` → 200 (the public endpoint doesn't actually need the bearer, but a future protected endpoint added in a later unit will).

---

### Unit 5: Frontend auth context + 5 routes + remove Clerk frontend

**Goal:** Replace the Clerk-based React frontend with a hand-rolled `<AuthProvider>` + 5 routes (`/sign-up`, `/sign-in`, `/verify-email`, `/forgot-password`, `/reset-password`). Update `_auth.tsx` to gate via the new context. Update `api-client.ts` to read the JWT from the new context. Delete the Clerk dependency from `apps/web/package.json`.

**Requirements:** Frontend half of S1 (the user can actually sign up + verify + sign in via a UI).

**Dependencies:** Unit 4 (HTTP endpoints exist).

**Files:**
- Modify: `apps/web/src/main.tsx` — remove `<ClerkProvider>`, wrap with new `<AuthProvider>`
- Create: `apps/web/src/auth/AuthContext.tsx` — React context exposing `{ user, token, signUp, signIn, signOut, isLoading, error }`
- Create: `apps/web/src/auth/AuthProvider.tsx` — provider that reads/writes localStorage key `rathe-arsenal:jwt`, fetches `/api/auth/me` on mount if a token exists (NB: a `GET /api/auth/me` endpoint is **added in Unit 4** for this purpose — call it out as a small addition to Unit 4's controller. It returns the user resolved from the JWT, or 401 if invalid)
- Create: `apps/web/src/auth/useAuth.ts` — `useContext(AuthContext)` hook with a null guard
- Create: `apps/web/src/routes/sign-up.tsx` — file route `/sign-up`. Form with email + password. On submit calls `auth.signUp(...)`. On success, redirects to a "check your email" screen
- Create: `apps/web/src/routes/sign-in.tsx` — same shape, on success redirects to `/`
- Create: `apps/web/src/routes/verify-email.tsx` — reads `?token=` from query, calls `POST /api/auth/verify-email`, on success stores the JWT and redirects to `/`. Shows "verifying…" / "success" / "invalid or expired link" states
- Create: `apps/web/src/routes/forgot-password.tsx` — form with email. On submit calls `POST /api/auth/forgot-password`. Always shows the same generic success message
- Create: `apps/web/src/routes/reset-password.tsx` — reads `?token=` from query, form for new password. On submit calls `POST /api/auth/reset-password`
- Create: `apps/web/src/routes/check-your-email.tsx` — static screen shown after sign-up
- Modify: `apps/web/src/routes/__root.tsx` — header now shows the signed-in user's email + a sign-out button (instead of Clerk's `<UserButton>`)
- Modify: `apps/web/src/routes/index.tsx` — landing now shows "Sign in" / "Sign up" links when signed out, and a "Go to home" link when signed in (the home page itself is Phase 0 Unit 7's responsibility)
- Modify: `apps/web/src/routes/_auth.tsx` — gating now reads from `useAuth()`. Redirects to `/sign-in` when unauthenticated
- Modify: `apps/web/src/lib/api-client.ts` — replace `useAuth` from Clerk with the new `useAuth` from `apps/web/src/auth/useAuth.ts`
- Delete: any leftover `@clerk/clerk-react` imports anywhere
- Modify: `apps/web/package.json` — remove `@clerk/clerk-react` from dependencies (already done in Unit 1, verify here)
- Create: `apps/web/src/auth/__tests__/AuthProvider.test.tsx` (Vitest)
- Create: `apps/web/src/routes/__tests__/sign-in.test.tsx` (Vitest + React Testing Library)
- Create: `apps/web/src/routes/__tests__/verify-email.test.tsx`

**Approach:**
- The `AuthProvider` is a small file. State: `user`, `token`, `isLoading`. On mount, if localStorage has the JWT, set it on state and call `GET /api/auth/me`. If 401, clear localStorage. If 200, set the user. The "loading" state prevents the gated routes from flashing the sign-in redirect while the `/me` call is in flight.
- `signUp`, `signIn`, `signOut`, `verifyEmail`, etc. are all functions on the context. Each calls the corresponding API endpoint via `fetch`, sets the resulting `{ jwt, user }` on state and localStorage, returns success, or throws an error the form catches and renders inline.
- Forms use plain React state (no React Hook Form for Phase 0 — the forms are 2 fields each, not worth the dependency for this slice). Validation is "the field is non-empty" client-side; the backend's class-validator is the real enforcement.
- The 5 routes are TanStack Router file routes. Each is a self-contained component. Styling is the same inline-style approach as the existing scaffold (no CSS framework added in this plan).
- The `routeTree.gen.ts` file is auto-regenerated by the Vite plugin on dev/build. The placeholder shipped in the scaffold is replaced on first run. The implementing agent does not manually edit it.
- The `_auth.tsx` gate is now: `if (isLoading) return null; if (!user) return <Navigate to="/sign-in" />; return <Outlet />;`. Same shape as the Clerk version, different source.
- localStorage key is namespaced: `rathe-arsenal:jwt`. The `:` is intentional to avoid collisions if the workspace ever runs multiple projects on the same domain.

**Patterns to follow:** Vitest + React Testing Library for component tests. Mock fetch via `vi.spyOn(global, 'fetch')`.

**Test scenarios:**
- *AuthProvider — happy path with stored JWT:* localStorage has a valid token; on mount, fetches `/api/auth/me`, populates `user`; `useAuth().user` is non-null.
- *AuthProvider — happy path with no stored JWT:* localStorage empty; `user` is null; `isLoading` becomes false quickly.
- *AuthProvider — error path with invalid stored JWT:* localStorage has a token but `/api/auth/me` returns 401; `user` is null and localStorage is cleared.
- *AuthProvider — signIn happy path:* call `signIn`; mocked fetch returns `{ jwt, user }`; localStorage now contains the JWT; `user` is set.
- *AuthProvider — signIn error path:* mocked fetch returns 401; `signIn` throws; `user` remains null.
- *AuthProvider — signOut clears state and localStorage:* after sign-in, calling `signOut` removes the JWT and resets `user`.
- *Sign-in form — empty fields blocked client-side:* submitting with no email shows a client-side error and does not call fetch.
- *Sign-in form — backend error rendered inline:* mocked fetch returns 401 with `{ error: 'invalid credentials' }`; the form shows an inline error and does not redirect.
- *Verify-email route — happy path:* `?token=xxx` triggers the API call; 200 response stores the JWT and redirects.
- *Verify-email route — error path:* invalid token returns 400; the route shows "this link is invalid or expired" with a link to `/sign-up` to retry.
- *Reset-password route — happy path with valid token:* submitting the form with a new password sets the new password and redirects to `/` signed in.

**Verification:**
- `pnpm --filter @rathe-arsenal/web test` passes every scenario.
- `pnpm --filter @rathe-arsenal/web build` succeeds.
- `pnpm dev` boots both api (3000) and web (5173); a manual smoke test signs up via the UI, captures the link from the api logs, clicks it, and lands signed-in on `/`.
- `grep -r "@clerk" apps/web/src apps/web/package.json` returns zero hits.

---

### Unit 6: Plan amendments — supersede Clerk references in origin Phase 0 plan + rewrite security notes

**Goal:** Update the upstream documents so future readers do not get whiplash. The Phase 0 plan (`docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`) and the project security notes (`rathe-arsenal/docs/research/phase-0-security-notes.md`) both refer to Clerk in ways that are now wrong. This unit edits them in place with explicit supersession markers pointing back to this plan.

**Requirements:** None (documentation hygiene).

**Dependencies:** Units 1-5 (the implementation needs to be real before the docs claim it).

**Files:**
- Modify: `docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md` (the Phase 0 plan — originally under the workspace-level `personal/docs/plans/`, now co-located inside `rathe-arsenal/docs/plans/` after the 2026-04-11 consolidation)
- Modify: `rathe-arsenal/docs/research/phase-0-security-notes.md`
- Modify: `rathe-arsenal/scripts/deploy-railway.md` (Clerk dashboard setup section is now obsolete; replaced with Resend setup + JWT secret generation)
- Modify: `rathe-arsenal/README.md` (stack list)

**Approach:**

In the Phase 0 plan, add a note at the top of Unit 1 (right under the unit heading) and at the relevant Key Technical Decisions bullet (the "Clerk as the managed IdP" line):

> **Superseded 2026-04-09:** Clerk replaced with DIY Passport+JWT auth. See `docs/plans/2026-04-09-001-feat-replace-clerk-diy-auth-plan.md`.

In the Phase 0 plan's Unit 2 entity description (the "User entity" bullet under the Approach section), update the line `'id is @PrimaryColumn('varchar') set from Clerk's userId'` to `'id is @PrimaryGeneratedColumn('uuid'); see auth swap plan for the locked entity shape'`.

In the Phase 0 plan's "Open Questions → Resolved During Planning" section, add a new entry: `Auth provider: Clerk vs DIY?` → `Re-resolved 2026-04-09 to DIY (passport-jwt + bcrypt + resend) due to Clerk pricing exposure. See swap plan.`

In the Phase 0 plan's "Constraints materially shaping the plan" section, add a new bullet: `Cost sensitivity: every third-party dependency must be auditable for paid tiers; reject anything that would charge before Phase 0 ends. (Added 2026-04-09 after the Clerk swap.)`

In `rathe-arsenal/docs/research/phase-0-security-notes.md`, rewrite the S1 section to describe the DIY chain (AuthService, JwtAuthGuard, bcrypt cost 12, sha256-hashed verification tokens, 24h verification expiry, 1h reset expiry, email-verification-required-before-sign-in). Keep the S2, S4, S5, S7 sections largely unchanged but add to S4's redact list mention. Add a new sub-section under S1 documenting the accepted trade-offs (email enumeration leak on sign-up, JWT in localStorage, no rate limiting).

In `rathe-arsenal/scripts/deploy-railway.md`, replace the "One-time Clerk dashboard setup" section with a "One-time Resend setup" section (verify domain, create API key) plus a new "Generate JWT secret" section (`openssl rand -hex 32`). Update the env vars list in the Railway setup section.

In `rathe-arsenal/README.md`, the stack list line mentioning Clerk is updated to read: `Backend: NestJS 11 + TypeORM + PostgreSQL + DIY auth (passport-jwt + bcrypt + Resend)`.

**Test expectation:** none — pure documentation edits, no behavioral change. Verify by re-grep: `grep -r "Clerk\|@clerk\|clerk" rathe-arsenal/` should return zero hits, and the Phase 0 plan should have explicit supersession markers at every Clerk reference site.

**Verification:**
- `grep -ri "clerk" rathe-arsenal/` returns zero hits.
- `grep -n "Superseded 2026-04-09" docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md` shows at least 2 markers (one at Unit 1, one at the Key Technical Decisions Clerk bullet, optionally one at the Open Questions entry).
- A reader landing on the Phase 0 plan today sees the supersession markers and follows the link to this swap plan; the swap plan describes the actual implementation.

## System-Wide Impact

- **Interaction graph:** The global `APP_GUARD` registration in `apps/api/src/app.module.ts` is the single integration seam where ClerkAuthGuard is replaced with JwtAuthGuard. Every controller in the app inherits the new guard automatically. The `current-user.decorator.ts` parameter decorator continues to work unchanged because both guards populate `request.user` with the same `{ userId, email }` shape.
- **Error propagation:** New error class `AuthError` (with code enum) is thrown by `AuthService` and mapped to `HttpException` by the controller. The existing `HttpExceptionFilter` (Phase 0 Unit 1) catches everything as before; no changes to the filter.
- **State lifecycle risks:** The User row is created during sign-up *before* the verification email is sent. If email sending fails, the row exists in an unverifiable state. Mitigation: the user can still trigger `forgotPassword` (which works on unverified users by design), receive a reset email, and complete account setup that way. This is documented in Unit 4 and accepted for Phase 0.
- **API surface parity:** All authenticated endpoints in Units 5+ of Phase 0 (decks, collection, etc.) consume `request.user` exactly the same way they would have under Clerk. No callsite changes.
- **Integration coverage:** The `auth.flow.int-spec.ts` file in Unit 4 is the cross-layer integration test that proves AuthService + JwtAuthGuard + DTOs + ValidationPipe + JwtModule + email side-channel all interact correctly without mocks (except the email transport).
- **Unchanged invariants:** Phase 0 plan's R-series user-flow requirements, the engine architecture, the monorepo layout, the Railway deployment posture, the substitution algorithm, and the Gate 4 exit criteria are all unchanged. The schema for `tracked_deck`, `collection_card`, `deck_card`, `deck_readiness_snapshot` (Phase 0 Unit 2) is unchanged. Only `user.id`'s type changes from `varchar` to `uuid` and the User entity gains password/verification columns.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Implementing the auth wrong (e.g., constant-time bug, password timing leak, JWT misconfiguration) | Lean on library defaults (bcrypt cost 12, `crypto.timingSafeEqual`, `@nestjs/jwt` with `JWT_SECRET` from env). Wrap crypto in two named services (PasswordHasher, TokenGenerator) so the surface area is small and reviewable. The auth.flow.int-spec.ts test exercises every flow end-to-end. |
| JWT_SECRET leaks via env var dump or git accident | `JWT_SECRET` is in `.env` (gitignored), Railway env var UI in prod, never logged (added to redact list). Pre-commit grep for `JWT_SECRET=` returns zero hits in the repo. |
| Resend free tier exhausted (100 emails/day) | For 5-10 closed-beta users this is a non-issue. EmailService throws `EmailDeliveryError(RATE_LIMITED)` on 429 and the user sees a "try again later" message. Documented in Unit 3. |
| Resend service outage during sign-up | Same path: EmailService throws, user sees a generic error. The user row was already created — they can use forgot-password later to recover. Documented in Unit 4 and the security notes. |
| Verification token leak via server logs | Tokens never appear in production logs (the dev-mode log path is gated on `NODE_ENV === 'development'`). The redact list covers `verificationToken`, `passwordResetToken`, etc. |
| User creates account but never verifies → orphaned row | Acceptable for Phase 0. The dev `delete-user` script (Phase 0 Unit 2) removes the row. Phase 1 may add a periodic cleanup of unverified rows older than 7 days. |
| 7-day JWT lifetime too long if a token leaks | Accepted trade-off for closed beta. JWT_SECRET rotation is the kill switch (rotates secret → all live tokens invalidated). Documented as a manual operational event in `scripts/deploy-railway.md`. |
| Passwords stored at rest are leaked via DB dump | bcrypt cost 12 is industry standard; the column is `varchar(60)`; no other plaintext password storage exists in the system. |
| Email enumeration leak on sign-up endpoint | Accepted for closed beta with manual invitations. Documented. Phase 1 may switch to a generic "account created or already exists" response if the beta opens publicly. |
| Implementing agent introduces a fresh dependency that has paid tiers | Cost-sensitivity constraint added to Phase 0 plan in Unit 6 of this plan. Future units must audit any new dependency for paid tiers. |
| The User entity primary key type change (varchar → uuid) breaks Phase 0 Unit 2 work | Phase 0 Unit 2 hasn't shipped yet — this swap lands first. Unit 6 amends the Phase 0 plan's Unit 2 Approach text to match. |

## Documentation / Operational Notes

- **Updated env vars to set in Railway** (replaces the Clerk vars in `scripts/deploy-railway.md`):
  - `JWT_SECRET` — generate with `openssl rand -hex 32`, paste into Railway env var UI
  - `JWT_EXPIRES_IN=7d` (or omit; the code default is 7d)
  - `RESEND_API_KEY` — from https://resend.com dashboard → API Keys
  - `EMAIL_FROM=Rathe Arsenal <noreply@your-verified-domain>` — for Phase 0 testing, `onboarding@resend.dev` works without domain verification
  - `APP_BASE_URL=https://<your-railway-domain>` — used to build verification/reset links
- **Resend setup checklist** (added to `scripts/deploy-railway.md`):
  1. Sign up at https://resend.com (free, no credit card)
  2. (Optional for testing) Verify a domain — required for production sender; not required if using `onboarding@resend.dev`
  3. Create an API key in the dashboard → paste into Railway env var
- **JWT secret rotation procedure** (documented in `scripts/deploy-railway.md`): updating `JWT_SECRET` in Railway and redeploying invalidates all live sessions immediately. Users see a 401 on their next request and must re-sign-in. This is the Phase 0 kill switch for compromised tokens.
- **Dev-mode email logging**: when running `pnpm dev` with `NODE_ENV=development`, sign-ups + password resets log the rendered email body (including the link) to stdout via the NestJS logger. The dev-only `_devVerificationLink` field on the sign-up response also exposes the link directly in the API response.

## Sources & References

- **Origin document:** `docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md` (the Phase 0 plan this swap amends)
- **CLAUDE.md security rules:** `~/.claude/rules/security.md`
- **CLAUDE.md coding style:** `~/.claude/rules/coding-style.md`
- **CLAUDE.md testing rules:** `~/.claude/rules/testing.md`
- **CLAUDE.md NestJS patterns:** `~/.claude/rules/patterns.md`
- **External (well-known, no link bait):** `@nestjs/passport`, `passport-jwt`, `@nestjs/jwt`, `bcrypt`, `resend` npm packages — all referenced via their npm registry pages and the corresponding GitHub repos.
- **Resend pricing:** https://resend.com/pricing — free tier 100 emails/day, 3000/month, no credit card required.
