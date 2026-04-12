# Phase 1 Follow-ups

> **What this is:** every trade-off, shortcut, and "we'll do it later" decision made during Phase 0 that needs revisiting before the project can move from closed beta (5-10 testers) to anything more public. This file is the single source of truth for "what does Phase 0 owe Phase 1?" — anything intentionally cut should be listed here so it does not silently rot.
>
> **What this is not:** a roadmap of new features. It is a debt ledger.
>
> **Rule:** when Phase 0 makes a deliberate trade-off, add an entry here in the same commit. When Phase 1 starts, this file is the first thing the implementer reads.

---

## Frontend testing infrastructure

### A18. No Vitest bootstrap in `apps/web` — frontend unit tests are structurally unavailable

**Status:** Resolved on 2026-04-11 in branch `chore/phase-1a-a18-vitest-bootstrap`. `apps/web` now has a `vitest.config.ts` mirroring the Vite plugins, a `src/test/setup.ts` loading `@testing-library/jest-dom/vitest` + RTL cleanup, and a smoke test (`src/components/__tests__/empty-home-state.test.tsx`) that renders `<EmptyHomeState>` end-to-end under `QueryClientProvider` + `AuthContext.Provider`. Backfill of the remaining Phase 1a-era components listed below is still outstanding and tracked as follow-up work.

**Phase 0 posture:** none. **Phase 1a posture:** `apps/web` has no test runner configured. `pnpm --filter @rathe-arsenal/web test` exits with code 1 because Vitest finds no test files. There is no `vitest.config.ts`, no test setup file, no `@testing-library/react` dependency.

**Why deferred (Phase 1a):** Phase 0 shipped a thin, largely stateless frontend (deck list, inline mark-owned, onboarding form) where visual/typecheck verification was sufficient and every hour spent bootstrapping Vitest was an hour not spent on Phase 0 gates. Phase 1a's parallel Units 4, 5, and 8 introduced non-trivial interactive components — the `<CardAutocomplete>` WAI-ARIA combobox, the two-mode home state machine with loading/error/empty/populated branches, and `<PathCResult>` + the Path C banner — all of which are currently verified by TypeScript typecheck plus manual reasoning only. None of them have automated coverage for keyboard behavior, ARIA state transitions, mode branching, or rendering contracts.

**Phase 1 trigger to revisit:** **before the next Phase 1a unit ships**, or whichever of the following comes first —
- U6 (out-of-onboarding test mode) introduces a new route with fetch-bound UX states (loading, timeout, SSRF-rejected host, alreadyTracked, import success) that are exactly the kind of logic that degrades silently without tests
- U7 (interactive swap editor) introduces per-row reject UI with reject-all-disable-while-pending semantics and curve-warning rendering — implicit contracts that typecheck cannot catch
- Any user-reported regression in one of the Phase 1a interactive surfaces
- Growth past the ~47-person community, at which point manual QA per release stops scaling

**When triggered, the work is:**
1. Add `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` (or `happy-dom`) to `apps/web/package.json` as devDependencies
2. Create `apps/web/vitest.config.ts` with `environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`, and `globals: true`
3. Create `apps/web/src/test-setup.ts` importing `@testing-library/jest-dom/vitest`
4. Add a `test` script to `apps/web/package.json` (e.g., `"test": "vitest run"`)
5. Backfill tests for the Phase 1a-era components that currently have zero coverage, prioritizing:
   - `<CardAutocomplete>` — keyboard navigation (ArrowUp/ArrowDown/Enter/Escape), ARIA combobox state (`aria-expanded`, `aria-activedescendant`), click-outside behavior, post-add confirmation dismissal, `ownedQuantity` badge rendering
   - `home.tsx` state machine — all four branches (loading skeleton, error+retry, empty mode, populated mode) and mode transitions triggered by query invalidation
   - `<EmptyHomeState>` — card-count phrasing, muted "coming soon" label is not interactive
   - `<PathCResult>` and the `PathCBanner` — Path C renders only when `snapshot.path === 'C'`, fidelity formatting matches `Math.round(fidelityPercent * 10) / 10`
6. Wire the new `test` script into the existing CI pipeline (matches the `@rathe-arsenal/api` and `@rathe-arsenal/engine` stages)

Estimated: 1-2 hours to bootstrap the harness; the first component backfill batch is another 2-3 hours.

**Where documented:** This entry. Cross-referenced from the Phase 1a plan's Known Gotchas ("Web package has no tests yet") and from the Unit 4/5/8 PR descriptions (leopoldo8/rathe-arsenal#2, leopoldo8/rathe-arsenal#3, leopoldo8/rathe-arsenal#4).

---

## Phase 1a Unit 7 review residuals (2026-04-11)

### U7-R1. Re-solve double engine pass on every reject click

**Phase 1a posture:** `ReSolveService.rejectSubstitute` and `reSolveDryRun` both run `computeAndStoreReadiness` (or `computeReadinessWithExclusions`) once with the exclusion set, then run `computeReadinessWithExclusions` a second time with an empty set to derive curve warnings. That is two full engine passes per click — catalog scan × per-deck inventory × substitution search, doubled.

**Why deferred:** the race-safety fix (U7-R2) and the dead-code cleanup are cheap one-liners; eliminating the double pass requires either (a) threading a cached "baseline" through the request lifecycle or (b) teaching `computeEffectiveReadiness` to emit per-slot drop reasons so curve warnings fall out of a single pass. Option (b) is an engine-level redesign and would delay U7's merge by at least one working session. At Phase 1a scale (≤20 tracked decks × 4595-card catalog × per-click latency <100ms observed in tests) the user-visible cost is acceptable.

**Phase 1 trigger to revisit:** any of —
- Reject-click latency exceeds 250ms in practice for any tracked deck
- Community grows past ~100 users, at which point the quadratic cost matters on shared infra
- The engine grows additional per-slot diagnostic surface that makes option (b) cheap

**When triggered, the work is:**
1. Compute the baseline-exclusions readiness once at the top of `rejectSubstitute` / `reSolveDryRun`
2. Reuse it both for the exclusions-empty short-circuit and for `compareMissing` in the warning derivation
3. Alternatively: extend `IEffectiveReadinessResult` to carry `droppedByCurve: string[]` populated inside the single engine pass
4. Retire `deriveCurveWarnings` and `deriveCurveWarningsFromSnapshot` helpers

**Where documented:** This entry. Flagged by `ce:review` against commit `5c4829f` on `feat/phase-1a-unit7-swap-editor`.

---

### U7-R2. Re-solve test coverage gaps against plan scenarios

**Phase 1a posture:** `re-solve.service.spec.ts` covers happy path, cross-deck isolation, idempotency (sequential), and the curve-break case. The plan lists two additional scenarios that never landed as tests:
- "Reject multiple substitutes in sequence — each rejection accounts for all previously rejected cards"
- "Reject all substitutes — deck shows raw readiness (effectivePercent === rawPercent); modified-view banner shows N rejections"

There is also no explicit assertion that `reject-substitute` writes exactly **one** snapshot row (only that `computeAndStoreReadiness` is called once).

**Why deferred:** the three missing scenarios are coverage gaps, not correctness gaps — the code path exercised by "reject one" is the same as "reject N in sequence" (each call loads all persisted exclusions, then computes). Sequential-idempotency is already tested. Adding the scenarios is a ~60-line test commit, reviewer flagged as non-blocking.

**Phase 1 trigger to revisit:** any regression in the rejection flow, or any refactor to `ReSolveService` that changes how exclusions are loaded or applied.

**When triggered, the work is:**
1. Add "reject multiple in sequence" test: reject A, then B, assert exclusion set passed to `computeAndStoreReadiness` on call 2 contains both A and B
2. Add "reject all substitutes" test: reject every entry in `breakdown.substituted`, assert `effectivePercent === rawPercent` in the response and `rejectionCount === initial.length`
3. Add a `deck_readiness_snapshot` row count assertion to the happy-path reject test

**Where documented:** This entry. Flagged by `ce:review` against commit `5c4829f`.

---

## Auth & security trade-offs (from Clerk → DIY swap, 2026-04-09)

### A1. No CSRF middleware (`csurf`, double-submit cookie, etc.)

**Phase 0 posture:** none. The app uses Bearer tokens in the `Authorization` header, not cookies, for authentication. Traditional CSRF attacks (browser auto-attaching cookies cross-origin) do not apply when there is no cookie-based session.

**Why deferred:** Adding CSRF middleware against bearer-token auth is busywork. The risk it protects against doesn't exist in the current shape.

**Phase 1 trigger to revisit:** the moment any auth surface starts using cookies (e.g., for SSR, for a no-JS fallback, or for "remember me"). The same change that introduces a cookie session must add CSRF protection. **Do not introduce cookies without CSRF in the same PR.**

**Where documented:** `docs/research/phase-0-security-notes.md` (S7 section).

---

### A2. No refresh tokens — single 7-day access JWT

**Phase 0 posture:** sign-in issues a single JWT valid for 7 days. When it expires, the user re-signs-in. No `/auth/refresh` endpoint, no refresh-token storage, no token-rotation logic.

**Why deferred:** Refresh-token rotation is a meaningful chunk of code (storage, revocation list, replay protection, frontend retry-on-401 logic). For a closed beta where users sign in once a week, the UX cost (re-sign-in once a week) is acceptable and the code savings are large.

**Phase 1 trigger to revisit:** any of —
- Sessions need to be shorter than 7 days for compliance/security hardening
- The user base grows past 50 active users (re-sign-in friction starts costing)
- A leaked-token incident makes short-lived access tokens an actual requirement
- The product gains any "background refresh" pattern (mobile app, etc.)

**Implementation sketch for Phase 1:**
- New entity `refresh_token` (id, userId, tokenHash, expiresAt, revokedAt, createdAt)
- New endpoint `POST /api/auth/refresh` that validates the refresh token, rotates it (issues new refresh + new access), revokes the old
- Access JWT lifetime drops to 15min; refresh token lifetime is 30d
- Frontend gets a fetch wrapper that catches 401, calls refresh, retries the original request
- Sign-out endpoint revokes the refresh token

---

### A3. JWT stored in `localStorage` (not httpOnly cookie)

**Phase 0 posture:** the frontend stores the JWT under `rathe-arsenal:jwt` in `localStorage`. Reads it on mount, attaches it to every API request via `Authorization: Bearer`.

**Why deferred:** httpOnly cookies are the more XSS-resistant option but bring CSRF surface (see A1). For a Phase 0 React app that renders **no** user-generated HTML (no markdown, no embedded HTML, no untrusted image hosts) the XSS attack surface is genuinely tiny, and the CSRF surface avoided by skipping cookies is the bigger Phase 0 concern.

**Phase 1 trigger to revisit:** any of —
- The app starts rendering user-generated content that could carry an XSS payload (markdown, BBCode, embedded HTML, rich text, anything from a 3rd party)
- The app adds a content-loading surface from an untrusted source (image proxies, iframe embeds)
- Phase 1 introduces the cookie session change from A1

**When triggered, the work is:** swap localStorage for an httpOnly + Secure + SameSite=Strict cookie holding the JWT, add `csurf` middleware on state-changing routes, document the new posture.

---

### A4. Email enumeration leak on `POST /api/auth/sign-up` — RESOLVED (Phase 1a Unit 1)

**Resolution:** `signUp()` now always returns `202 Accepted` with the generic message `"If this email is not already registered, you will receive a verification link shortly."` The existing-user check short-circuits before any database write, so duplicate sign-up attempts produce no side effects (no row, no email, no unique-constraint 500). `EAuthErrorCode.EmailInUse` and its mapper entry were removed as dead code. See `apps/api/src/auth/auth.service.ts`.

---

### A5. No rate limiting on `/api/auth/*` endpoints — RESOLVED (Phase 1a Unit 1)

**Resolution:** `@nestjs/throttler` is registered as a global `APP_GUARD` in `app.module.ts` with a lenient 120 req/min per-IP default, overridden per auth route: sign-in 5/min, sign-up / resend-verification 3/hour, forgot-password / reset-password 5/hour, verify-email 10/hour. Health checks opt out via `@SkipThrottle()`. `main.ts` enables `app.set('trust proxy', 1)` so `req.ip` reflects the real client IP from Railway's `X-Forwarded-For`, not the gateway. The catalog autocomplete endpoint is throttled at 30 req/min.

---

### A6. Email verification resend endpoint — RESOLVED (Phase 1a Unit 1)

**Resolution:** `POST /api/auth/resend-verification` now accepts `{ email }`, rate-limited at 3/hour per IP. It mirrors the enumeration-safe pattern of `forgot-password`: always returns a generic 202, only sends an email when the user exists and is still unverified. Known acceptable residual risk: an unverified account can be kept alive indefinitely by resending every 23 hours; purge-unverified cleanup is a Phase 2 chore.

---

### A7. JWT secret rotation invalidates all live sessions

**Phase 0 posture:** `JWT_SECRET` rotation is a manual operational event documented in `scripts/deploy-railway.md`. Rotating it kicks every signed-in user immediately.

**Why deferred:** dual-secret rotation (old key still valid for verification while new key signs new tokens) requires JWT key-id (`kid`) headers and a key-id-aware verifier. Phase 0 has zero need for this complexity.

**Phase 1 trigger to revisit:** when the operational cost of "every user has to sign in again on rotation" becomes meaningful, OR when there is a reason to rotate routinely (compliance, scheduled hygiene).

**When triggered, the work is:** add `kid` to JWT headers, store an array of recent `JWT_SECRET` values, verify against any of them, sign with the latest. Standard rolling-key pattern.

---

### A8. No account-deletion UI — RESOLVED (Phase 1a Unit 2)

**Resolution:** `DELETE /api/auth/me` (authenticated, rate-limited to 5/hour per IP) now accepts a re-entered password and soft-deletes the account via `user.deletedAt = now()`. `JwtStrategy.validate()` rejects users with `deletedAt != null` on the same per-request lookup — no additional DB query, preserving the A13 trade-off. A new `/_auth/settings` route houses `DeleteAccountModal`, which requires both password and confirmation checkbox before submission and renders inline errors on 401 / 429. A `scripts/purge-deleted-users.ts` script (raw `pg` driver, single-transaction cascade, `--dry-run` / `--yes` / `--days=N` flags, interactive confirmation when `isTTY`) purges rows older than 30 days; wire-up instructions for Railway's second-service cron pattern live in `scripts/deploy-railway.md`. The Phase 0 `scripts/delete-user.ts` was updated alongside to include `rejected_substitute` in its cascade (the Unit 7 table that was never registered in the Phase 0 script).

---

### A9. No multi-factor authentication

**Phase 0 posture:** email + password only.

**Why deferred:** explicitly excluded by the Phase 0 origin plan.

**Phase 1 trigger to revisit:** any public exposure or any surface handling sensitive data that warrants 2FA. Probably TOTP (Google Authenticator) first, WebAuthn later.

---

### A10. No social/OAuth providers (Google, Apple, GitHub, Discord)

**Phase 0 posture:** none.

**Why deferred:** every OAuth provider is its own provider/configuration/UX surface. Not justified by closed-beta scale.

**Phase 1 trigger to revisit:** based on tester feedback. If a meaningful fraction of testers complain about creating yet-another-password, prioritize Google (highest adoption among the target audience).

---

### A11. No password policy beyond 10-character minimum

**Phase 0 posture:** the sign-up DTO enforces `@MinLength(10)` and nothing else. No complexity rules, no breach-database lookup (e.g. HIBP API), no rotation prompts.

**Why deferred:** modern password guidance (NIST SP 800-63B) is "long is more important than complex" and discourages forced rotation. Phase 0 hits the "long" bar; the rest is polish.

**Phase 1 trigger to revisit:** if any tester reuses an obviously-weak password and it becomes a story. Otherwise leave alone.

**Optional Phase 1 add:** check submitted passwords against the HIBP "Pwned Passwords" API (k-anonymity model — the API never sees the full password). 1 dependency, ~30 lines.

---

### A12. No email change flow

**Phase 0 posture:** the email a user signs up with is permanent. To change it, the user asks the operator to delete and recreate the account.

**Why deferred:** explicitly excluded by the Phase 0 origin plan. Closed beta.

**Phase 1 trigger to revisit:** any public surface or growth past the operator-handles-it scale.

---

### A13. JWT contents are minimal — only `sub` (userId)

**Phase 0 posture:** the JWT carries `{ sub: userId, iat, exp }`. The strategy loads the user from DB on every request to get the email and verify the user still exists / is still verified.

**Why deferred:** deliberate. Loading from DB on every request guarantees that admin actions (password reset, account suspension, role changes) take effect immediately. Phase 0's 5-10 user scale makes the per-request DB query free.

**Phase 1 trigger to revisit:** when the per-request DB query becomes a measurable bottleneck.

**When triggered, the work is:** carry `email` (and any role/permission claims) inside the JWT, accept the trade-off that suspended users keep working until their token expires (or add a revocation list).

---

### A14. No audit log retention

**Phase 0 posture:** sign-in attempts are logged via `nestjs-pino` as structured events (`event: 'auth.sign_in.success'` / `'auth.sign_in.failure'`). The logs go to Railway's ephemeral log surface and are not retained beyond Railway's defaults.

**Why deferred:** explicit audit-log retention requires either a separate log sink (Datadog, Logtail, etc.) or a database table. Both are Phase 1 work.

**Phase 1 trigger to revisit:** any compliance need, any incident response need, any "who signed in when" question that the operator cannot answer from Railway's log retention window.

---

### A17. Tier 2 keyword penalty weight not validated against a tier-2-labeled fixture

**Phase 0 posture:** none (tier 2 did not exist). **Phase 1a posture:** Unit 3 ships `TIER_2_KEYWORD_OVERLAP_WEIGHT = 0.15` as the tier 2 keyword penalty weight. The value was picked during implementation to satisfy the plan's semantic guidance ("tier 2: 70-89%, keyword overlap relaxed") and the 0.70 floor, but it was not validated against a gold-set-labeled tier 2 fixture.

**Why deferred (Phase 1a):** the Gate 4 gold set (`docs/brainstorms/gates/gate-4-gold-set.csv`) was generated from the Phase 0 tier 1 engine, so its labels apply only to tier 1 pairs. The existing `gold-set-regression.spec.ts` locks in tier 1 acceptance at 14/19 (73.7% SOFT_CONFIDENCE), which prevents tier 1 regressions during the Unit 3 refactor. It does **not** validate whether tier 2 produces substitutions humans would accept. Running a fresh depletion round over the same sampled decks with the new tiered engine and relabelling the tier 2 rows (target: >=60% acceptance per the plan's Risks table) is blocked on ~1 hour of human labelling time and would delay Unit 3.

**Phase 1 trigger to revisit:** any of --
- Before Phase 1a public rollout to the Pelotas FaB community, run a fresh tier-2 labelling round and publish the result alongside Gate 4.
- First credible user complaint about a tier 2 suggestion quality in Phase 1a beta.
- Any tuning of `TIER_2_KEYWORD_OVERLAP_WEIGHT`, `maxPowerDelta`, or `maxDefenseDelta` in `packages/engine/src/substitution/constants.ts`.

**When triggered, the work is:** regenerate candidates with `scripts/gold-set/generate-candidates.ts` modified to use `findSubstitution` (or a dedicated tier-2-only script). Fill the `label` column for the tier 2 rows. Add a `gold-set-regression.spec.ts` block that enforces a tier 2 acceptance floor (plan target: >=60%). Estimated ~1-2 hours including labelling.

**Where documented:** `docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md` "Deferred to Implementation" + "Risks & Dependencies" sections.

---

### A16. No CAPTCHA on sign-up (deferred from S6)

**Phase 0 posture:** none. **Phase 1a posture:** still none. The full S1-S12 origin-doc posture lists "Sign-up has a CAPTCHA gate" as part of S6, which is required before public launch. Phase 1a ships rate limiting (5 sign-in/min, 3 sign-up/hour per IP) and email verification, but no CAPTCHA.

**Why deferred (Phase 1a):** the Phase 1a audience is the ~47-person Pelotas FaB community, recruited via Cúpula DT and the local Discord/WhatsApp -- a known, invitation-adjacent surface. Per-IP rate limiting + email verification is the accepted compensating control at this scale. Adding CAPTCHA (hCaptcha or Cloudflare Turnstile) is ~1 hour of work and is held back to avoid friction on the first community impression.

**Phase 1 trigger to revisit:** any of —
- First credible abuse signal in Railway logs (sign-up spikes, repeated bot patterns)
- Any growth campaign or open-web sign-up link beyond the closed community
- User base grows past 100 active users
- A leaked-credential-stuffing pattern emerges

**When triggered, the work is:** add hCaptcha or Cloudflare Turnstile to the sign-up form, validate the token server-side in `AuthService.signUp()` before the existing-user check. ~1 hour of integration. The plan plan-1a documents this as a deliberate compensating control choice, not an oversight.

**Where documented:** `docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md` Scope Boundaries section.

---

### A15. Resend free tier cap = 100 emails/day

**Phase 0 posture:** Resend's free tier is the only email channel. 100 emails/day, 3000/month. For 5-10 closed-beta users this is irrelevant.

**Why deferred:** there is no actual problem at this scale.

**Phase 1 trigger to revisit:** when daily email volume approaches 80 (sign-ups + verification resends + password resets summed). At that point, either upgrade Resend or migrate to AWS SES (cheaper at scale, more setup).

---

## Non-auth Phase 0 deferrals

These come from the original Phase 0 plan (`docs/plans/2026-04-08-001-feat-fab-deck-readiness-phase-0-plan.md`) and are reproduced here so the Phase 1 implementer has one place to look. The original plan is the canonical source.

- **B1.** No Discover surface (R11-R14)
- **B2.** No shopping line / store data pipeline (R28-R33, including the Sbrauble vertical scraper)
- **B3.** No historical readiness chart (R27)
- **B4.** No substitution feedback storage / learning loop (R25)
- **B5.** No tier 2 or tier 3 substitutions (R22)
- **B6.** No interactive swap editor (Phase 0 is accept-all-or-discard)
- **B7.** No archetype-aware engine weighting (R24)
- **B8.** No PT-BR autocomplete or manual card autocomplete (R4)
- **B9.** No mobile-specific design pass
- **B10.** No weapon substitution (engine recognizes weapons but never substitutes them)
- **B11.** No hero substitution (hard-coded constraint, never relaxes)

See the Phase 0 plan's "Scope Boundaries" section for the full rationale on each.

---

## How to use this file

When starting Phase 1:

1. Read this file before reading the Phase 0 plan
2. Triage entries by the actual Phase 1 scope — not everything here will be relevant
3. For every entry that is in Phase 1 scope, open a corresponding implementation unit in the Phase 1 plan with the trigger condition restated
4. For entries that remain deferred, **leave them here** with an updated "next trigger" line

When making a new Phase 0 trade-off:

1. Add an entry here in the same commit
2. Use the same template: posture / why deferred / trigger to revisit / implementation sketch
3. Cross-reference from the implementation file's comments if the trade-off is non-obvious from the code

When deleting an entry:

1. Only delete when the trade-off has been addressed in code AND verified
2. Move to the bottom of the file under a `## Resolved` section with the resolution date and PR link, rather than deleting outright — keeps the history visible
