# Rathe Arsenal — Session Context

Quick-reference pointers for any Claude session on this repo. Read in
this order before doing non-trivial work.

## Authoritative guides

| Document | Read when |
|----------|-----------|
| [`docs/validation-philosophy.md`](docs/validation-philosophy.md) | Any question about releasing, testing, gates, user validation. Overrides all older "Gate 2 walkthrough" / "Cúpula DT session" language in brainstorms and plans. |
| [`.impeccable.md`](.impeccable.md) | Design context: users, brand personality, palette, typography, motion. Use before any UI work. |
| [`docs/dev-fixtures.md`](docs/dev-fixtures.md) | Test deck URLs + sign-up/import helper for local screenshots and QA. |
| [`docs/phase-1-followups.md`](docs/phase-1-followups.md) | Debt ledger. Every Phase 0/1 trade-off + trigger to revisit. |
| [`docs/research/ip-posture.md`](docs/research/ip-posture.md) | LSS card-image IP stance. Consult before any monetization surface or asset pipeline change. |
| [`docs/research/scraper-cost-scaling.md`](docs/research/scraper-cost-scaling.md) | Store scraper / Firecrawl cost model. Consult before adding stores, changing url-sync cadence, or any periodic-crawl work. |

## Philosophy (one-line each, full context in the linked docs)

- **Validation is automated-first.** Tests, telemetry, dev-browser
  self-loop, visual regression. External human validation is not a
  release gate — see `docs/validation-philosophy.md`.
- **Projects are personal bets.** The owner decides when something
  ships, informed by the automated signals above, not by committee or
  walkthrough.
- **Minimize friction.** Prefer `scripts/x.sh` over manual steps.
  Prefer auto-generated over prompted. Prefer background-checkable
  signals over "show me what changed".

## Active vs retired

- **Active plans**: none in flight (Plan A merged, Plan B not yet
  written). Phase 1c plan + addendum exist but are on hold pending
  owner decision on whether to execute or defer further.
- **Recently shipped** (spec-driven, `.specs/features/`): i18n (pt-BR /
  en-US), uxui-remediation (a11y + design-token discipline), and
  pre-launch-hardening (LSS fan-content disclaimer surface + opt-in
  Sentry error monitoring — PR #109, in review). See `.specs/STATE.md`
  for the current handoff snapshot.
- **Retired ceremonies** (do not propose): Gate 2 presencial
  walkthrough, A17 tier-2 external labeler session, 3-5 tester
  observation rounds, formal pre-release user studies.

## Language

Code + docs + commit messages: English. Conversation with owner:
Portuguese (BR) unless the owner requests otherwise in-session.

## Global personal guidelines

This repo inherits defaults from
[`~/.claude-personal/CLAUDE.md`](~/.claude-personal/CLAUDE.md) (personal
project philosophy applied across all side projects). Read that before
this if starting a new session.
