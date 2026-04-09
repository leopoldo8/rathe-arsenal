# Phase 0 Security Notes

Scope: explains the deliberate security posture of Phase 0 so future reviewers
understand *why* certain conventional protections are absent. Phase 0 is the
**floor** of the security posture, not the ceiling. Phase 1 hardens from here.

Phase 0 security subset (per the plan): **S1, S2, S3, S4, S5, S7, S9**.
Out of scope until Phase 1: S6, S8, S10, S11, S12.

For the complete list of deferred auth/security trade-offs with Phase 1 triggers
and implementation sketches, see [`docs/phase-1-followups.md`](../phase-1-followups.md).

> **Superseded 2026-04-09:** Clerk replaced with DIY Passport+JWT auth.
> See `docs/plans/2026-04-09-001-feat-replace-clerk-diy-auth-plan.md`.

## S1 — Authentication and email verification

Handled by `AuthService` + `JwtAuthGuard` + `JwtStrategy` (DIY, not a managed IdP).

- **Password hashing:** bcrypt cost 12 via `PasswordHasherService`. Cost factor is
  hardcoded as a class-private constant, not env-configurable.
- **Email verification:** on sign-up, a 32-byte random token (256 bits of entropy)
  is generated, sha256-hashed before storage, and emailed to the user. The
  verification link expires in 24 hours. **Sign-in is blocked until the user
  clicks the link** (`AuthService.signIn` throws `EMAIL_NOT_VERIFIED` when
  `emailVerifiedAt` is null). This is stricter than many managed IdPs' default.
- **Password reset:** same token pattern, 1-hour expiry. The endpoint
  `POST /api/auth/forgot-password` returns the same generic response regardless
  of whether the email exists (does not leak account existence — unlike sign-up,
  which does, see A4 in phase-1-followups.md).
- **JWT issuance:** HS256 with a 64-character random hex secret (`JWT_SECRET` env var).
  7-day lifetime. No refresh tokens. See A2 in phase-1-followups.md.
- **Frontend session:** JWT stored in `localStorage` under the namespaced key
  `rathe-arsenal:jwt`. See A3 in phase-1-followups.md for the XSS trade-off.
- **Global guard:** `JwtAuthGuard` is registered as `APP_GUARD` in `app.module.ts`.
  Only routes decorated with `@Public()` bypass it (currently `/api/health` and
  all `/api/auth/*` endpoints).
- **Per-request user load:** `JwtStrategy.validate(payload)` loads the user from
  the database on every authenticated request to ensure suspended/un-verified
  users are immediately locked out. See A13 in phase-1-followups.md.

Accepted trade-offs (all documented in phase-1-followups.md):
- **A4:** Email enumeration leak on sign-up (closed-beta acceptable).
- **A5:** No rate limiting on auth endpoints (S6 is Phase 1).
- **A6:** No "resend verification email" endpoint (workaround: use forgot-password).
- **A11:** Password policy is 10-char minimum only.

## S2 — Server-side authorization

Every service that touches `collection_card`, `tracked_deck`, or related rows
goes through `AuthzService` (Unit 2 of the Phase 0 plan). The two helpers —
`assertOwnsTrackedDeck` and `assertOwnsCollectionCard` — throw a generic
`NotFoundException` for both "wrong owner" and "row does not exist", so the
response never leaks whether a resource exists but belongs to someone else.

## S4 — No secrets or full collections in logs

`nestjs-pino` is configured with a redact list covering:
`authorization`, `cookie`, `set-cookie`, `password`, `passwordHash`,
`newPassword`, `email`, `verificationToken`, `verificationTokenHash`,
`passwordResetToken`, `passwordResetTokenHash`, `jwt`, `collectionPayload`
at both header and root levels. Application code never `console.log`s — every
emitter goes through the injected NestJS `Logger` which delegates to pino.

## S5 — Host allow-list, redirect blocking, size cap, timeout

Every server-side fetch of a user-influenced URL goes through
`FetchGuardService.guardedFetch(url, opts)`. The Phase 0 allow-list (configured
via `FABRARY_ALLOW_HOSTS` env var) is:

- `fabrary.net`
- `42xrd23ihbd47fjvsrt27ufpfe.appsync-api.us-east-2.amazonaws.com`
- `cognito-identity.us-east-2.amazonaws.com`

Redirects are followed manually (`redirect: 'manual'`) and the target host is
re-validated against the allow-list before the next request. Cross-host
redirects throw `FetchGuardError(REDIRECT_DENIED)`. Bodies are read as a stream
and aborted past `maxBytes`. `AbortController` enforces `timeoutMs`.

## S7 — CSRF posture (intentional: no `csurf` middleware)

The app uses **bearer tokens in `Authorization` headers**, not cookies, for
authentication. JWTs are stored in `localStorage` and manually attached by the
frontend to every request. There is no cookie-based session.

Traditional CSRF attacks rely on the browser auto-attaching the victim's cookies
to a cross-origin request initiated by an attacker page. With bearer-token auth,
the attacker page has no way to read the JWT from localStorage (same-origin
policy) and no way to make the browser attach it automatically — the attacker
would need an XSS to exfiltrate the token, which is a separate class of bug.

Therefore: no `csurf`, no double-submit cookie, no SameSite=Strict cookie work.
This is *deliberate*, not an oversight. See A1 in phase-1-followups.md for the
trigger condition that reintroduces CSRF protection (any cookie-based session).

## S9 — Secrets out of source control

`.env` files are in `.gitignore`. `.env.example` enumerates every required var
with empty placeholder values only. Production secrets live in Railway's
environment variable UI.

Pre-commit verification:
```bash
grep -r "sk_live_\|pk_live_\|re_live_\|Bearer [A-Za-z0-9]" apps/ packages/ scripts/
# Expected: zero hits
```

## Out of scope (Phase 1)

- **S6** — CAPTCHA / bot mitigation. Phase 0 has no rate limiting. See A5 in phase-1-followups.md.
- **S8** — Store allow-list enforcement. No stores exist in Phase 0.
- **S10** — Outbound link safety. No shopping links in Phase 0.
- **S11**, **S12** — see origin Phase 0 plan for context.
