# Rathe Arsenal — Session Context

Quick-reference pointers for any Claude session on this repo. Read in
this order before doing non-trivial work.

## Authoritative guides

| Document | Read when |
|----------|-----------|
| [`docs/validation-philosophy.md`](docs/validation-philosophy.md) | Any question about releasing, testing, gates, user validation. Overrides all older "Gate 2 walkthrough" / "Cúpula DT session" language in brainstorms and plans. |
| [`.impeccable.md`](.impeccable.md) | Design context: users, brand personality, palette, typography, motion. Use before any UI work. |
| [`docs/README.md`](docs/README.md) | Index of every doc: which are current and which are historical records. Start here when unsure what to trust. |
| [`.specs/STATE.md`](.specs/STATE.md) | Decisions log (AD-NNN) and the current handoff. Read before planning or resuming work. |
| [`.design/`](.design/) | Confirmed design documents, one per feature. Read the one for the area you touch. The mockups they cite were removed on 2026-10-28 and live in git history. |
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

- **In flight**: nothing. The last feature, persona-rethink, merged
  in PR #181 on 2026-10-28 and CI is green on `main`. Open items are
  in the Handoff of `.specs/STATE.md`.
- **Deferred**: `docs/plans/` holds only Phase 1c
  (`2026-04-18-001`) and its addendum, both `status: deferred`.
  Plans and specs of finished features were deleted on 2026-10-28;
  `git log --all -- .specs/features docs/plans` finds them.
  Phase 1c's Discover, the three-mode home, the readiness
  history chart and outbound click telemetry were never built (no
  `discover_deck` / Algolia code exists) and await an owner decision
  to execute or drop.
- **Recently shipped**, by feature (details in `.specs/STATE.md` and
  `.design/`; PR numbers via `gh pr list --state merged`):
  - i18n (pt-BR / en-US), uxui-remediation and pre-launch-hardening
    (LSS disclaimer surface, opt-in Sentry): PRs #104, #108 and #109, 2026-06.
  - Product redesign (#110, 2026-10-03), then the phone card scanner
    (#122, #128, #129, #132 to #134).
  - Card alternatives, which absorbed the swap flow (#130, #137, #138,
    #143), and per-deck recommendations (#136, #139 to #141).
  - The Tutor chat, behind an access flag (#145 to #147, #149, #150, #173, #176,
    #177).
  - Sharing: decks (#156 to #167, 2026-10-18 and 19), then card lists
    and shared lists (#169 to #172, #174, #175, #179, #180), with TCGplayer
    price suggestions (#171, #172, #178).
  - Persona rethink (#181, 2026-10-28): one-field sign-in with e-mailed
    codes and a server-side session cookie, a reader for pasted lists
    and CSV, deck rules rebuilt and an inventory, the missing list with
    store states, the "Sobrando" spare-copies page and sell and trade
    messages, a Tutor that counts copies, and a glossary.
- **Retired ceremonies** (do not propose): Gate 2 presencial
  walkthrough, A17 tier-2 external labeler session, 3-5 tester
  observation rounds, formal pre-release user studies.

## UI changes

Before implementing any new screen or visible UI change, show the owner
mockups with at least two alternatives and wait for a pick. Design
documents mark such slices `design` until that pick is made.

## Language

Code + docs + commit messages: English. Conversation with owner:
Portuguese (BR) unless the owner requests otherwise in-session.

## Global personal guidelines

This repo inherits defaults from
[`~/.claude-personal/CLAUDE.md`](~/.claude-personal/CLAUDE.md) (personal
project philosophy applied across all side projects). Read that before
this if starting a new session.
