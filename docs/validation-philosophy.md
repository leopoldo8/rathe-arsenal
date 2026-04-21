---
title: Validation Philosophy — Rathe Arsenal
type: reference
status: authoritative
date: 2026-04-21
supersedes:
  - All "Gate 2" ceremony references in brainstorm and plan documents
  - Any "labeler session" language requiring external humans
  - "Presencial walkthrough" as a release gate
---

# Validation Philosophy

> **This document is the authoritative source on validation cadence for
> Rathe Arsenal.** Where older brainstorms, plans, or follow-up entries
> reference external human validation ceremonies (Gate 2 walkthrough,
> A17 labeler session with Cúpula DT, 4-5 tester observation rounds),
> **this document overrides them.** The older docs were written before
> the validation philosophy was explicit; they stay as-is for historical
> fidelity, but their release-gate semantics are obsolete.

## Principle

**Human validation is expensive.** Agendar tempo, rodar sessão,
compilar feedback, traduzir notas em decisões — esse ciclo custa horas
que o solo-dev não tem. O projeto não ganha mais sinal com gate
cerimonial do que ganha com telemetria passiva + self-review criterioso.

## Cadence

The project ships to its target community (Cúpula DT) **when the
owner (Rodrigo) decides it's ready**, not when a formal gate passes.
Release is a personal judgment, informed by the four automated signals
below, not a committee decision.

### Four validation signals, in order of preference

1. **Automated** — tests (unit, integration, E2E), telemetria server-
   side, visual regression snapshots, typecheck, lint. Zero coordenação.
   Runs in CI, bounces back a signal that can be read when convenient.
2. **Self-validation** — the owner percorre os fluxos críticos, olha
   screenshots capturados por Claude via dev-browser, decide se aceita.
   Ten minutes at a desk, no preparation required.
3. **Informal friends circle** — demo to close friends when the project
   feels demo-ready. Unscripted. Feedback is qualitative and guides
   polish but is not a gate.
4. **Target community release** — Cúpula DT (or equivalent community
   for other projects) sees the product **only after** the owner has
   cleared signals 1-3. Never as a pre-release validation gate; always
   as the actual release moment.

### What replaces the formal "Gate 2 walkthrough"

The original v1 brainstorm and Plan A documented a formal Gate 2
ceremony: 3-5 Cúpula DT testers, presencial walkthrough, observer
script, return-unprompted tracking, compilation into pass/fail.

**That ceremony is retired.** It's replaced by the following, each of
which produces a more reliable signal at zero coordination cost:

- **E2E test suite covering the critical journey** — sign-up → verify
  email → onboarding (step 1 → 2 → 3) → home populated → deck detail
  → approve/reject substitution → shopping line. Blocks merges when
  any node breaks. Detects regressions the Cúpula walkthrough would
  never catch because manual walks don't re-run on every PR.
- **Server telemetry on substitution decisions** — count approvals,
  rejections, resets, bulk-clears per deck, per user, per tier. When
  the community starts using the product, this tells us organically
  whether tier-2 suggestions are trustworthy (R22-style aggregate
  metric) without a labeling session.
- **Dev-browser self-validation loop** — `scripts/smoke.sh` (to be
  written) imports the test-fixture decks documented in
  `docs/dev-fixtures.md`, walks each core surface, captures screenshots
  at 1440×900 and 375×812, writes a compact report. Runnable locally
  or in CI. Replaces "watch a tester navigate the deck detail".
- **Visual regression** — Playwright snapshot tests against the
  captured baselines. A PR that accidentally shifts typography or
  breaks a layout gets flagged on the diff, not on the next walkthrough.

### What replaces "A17 tier-2 labeler session"

A17 in the v1 brainstorm and Plan A documented a 1-2h session with a
FaB-competent non-developer labeling 30 tier-2 suggestions, passing
when ≥60% of them are accepted.

**Retired as a release blocker.** Replacement:

- Tier-1 regression tests already lock the engine's known-good
  substitution behavior (`gold-set-regression.spec.ts`).
- Tier-2 is shipped to production with the current constants
  (`TIER_2_KEYWORD_OVERLAP_WEIGHT = 0.15`, chosen during Phase 1a).
- Acceptance rate is **measured passively** via the decisions API
  telemetry — `decision='approved'` count divided by total tier-2
  suggestions surfaced. When the signal drops below a watchable
  threshold (say, < 40% acceptance over a rolling 7-day window with
  ≥20 decisions), revisit constants.
- No human labeling session is on the critical path to ship.

If the owner ever wants an explicit tier-2 sanity check, the lowest-
cost form is **the owner labels 10 suggestions himself in 15 minutes**
(he's a competent FaB player), not a coordinated external session.

## Default behavior for planning documents

When writing new plans, brainstorms, or follow-up entries:

- **Do not list external human validation as a gate.** No "Gate 2",
  "Cúpula walkthrough", "labeler session", "user testing round" in
  release prerequisites.
- **Do list automated validation as a gate.** E2E test green, visual
  regression clean, telemetry dashboards wired, smoke script passes.
- **Do plan the telemetry primitives up front.** Every feature that
  touches a decision surface (substitute, mark owned, import, etc.)
  should ship with the counter that lets telemetry tell the story.
- **Do include owner self-validation steps** when judgment is required
  — "owner reviews the new onboarding copy against the brand voice".
  Internal, fast, no scheduling.

## When external humans *are* appropriate

Not never — just intentionally scoped:

- **After release**, as passive users — feedback collected via app
  channels (support form, comments, observed telemetry), not
  coordinated sessions.
- **Friends circle before release** — unscheduled, informal, feedback
  optional. This is a demo, not a gate.
- **Specific technical questions** where expert judgment is load-
  bearing and the owner doesn't have the expertise (e.g., "is this
  card art legally defensible under LSS Fan Content Policy?"). One
  expert, one specific question, no ceremony.

## Pointers

- Test fixtures for self-validation: `docs/dev-fixtures.md`
- Telemetry posture for Phase 1c: `docs/plans/2026-04-18-001-feat-phase-1c-discover-history-telemetry-plan-addendum.md`
- Original v1 brainstorm (with retired Gate 2 language, kept for
  historical context): `docs/brainstorms/2026-04-19-v1-visual-identity-and-ux-requirements.md`
- Personal project guidelines (applies to this and other projects):
  `~/.claude-personal/CLAUDE.md`
