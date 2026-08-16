# Product Redesign — Implementation Notes

Running log for the autonomous execution run started 2026-08-16. The owner is away; every decision taken without them is recorded here, with its reasoning, so it can be audited or reversed on their return.

## Mandate

Given by the owner before leaving, 2026-08-16:

| Question | Answer |
|----------|--------|
| How far to take it | Implement everything, commit, push the branch, open the PR. **Do not merge.** |
| Deployment risk | `main` reaches staging only; nobody depends on that data. The destructive migration (D8) and the readiness drop (D7) are therefore normal operations, not incidents. |
| Phasing | Run all nine phases without stopping. Only interrupt for something genuinely blocking. |
| Visual reference | Pull the prototype through the Claude Design tool. No browser automation — the owner declined Chrome access earlier and that still stands. |
| Decision authority | Decide on the owner's behalf, using the advisor and subagents to pressure-test anything non-obvious. |

## Standing rules for this run

1. **Green or stop.** Typecheck, lint and the unit suites must pass before any phase is committed. A skipped known-failure does not count as green — see the ruling on `contrast.spec.ts` in `design/01-foundation.md` §9.
2. **No merge, no deploy.** The run ends at an open PR.
3. **Prefer the reversible option** when a call is genuinely ambiguous, log it below, and keep going. Never stall waiting for the owner.
4. **Do not silently drop shipped behavior.** If a handoff screen omits something the app already does, it survives unless a recorded decision says otherwise (this already produced D6 and D9).
5. Every user-facing string lands in both `pt-BR` and `en-US` in the same change that introduces it.

## Deviations

Decisions taken without the owner, or departures from the agreed plan. Empty means nothing has diverged yet.

### DEV-01 — Prototype kept out of version control
- **What**: the two `.dc.html` prototype files and their screenshots are fetched into `.specs/features/product-redesign/prototype/` and that directory is gitignored.
- **Why**: they are large throwaway artifacts carrying an inline-styled runtime the handoff explicitly says must not be ported. Every literal value that matters (tokens, geometry, keyframes, copy) is already in the committed `design-handoff.md`. Keeping the bundle local gives every implementation agent a visual reference without putting a misleading "reference implementation" into the PR.
- **Reversible**: yes — remove the gitignore entry and commit the folder.

### DEV-02 — Font-family retention decided by the orchestrator
- **What**: `--ra-font-mono` and `--ra-font-serif` are kept rather than dropped, resolving open items 2 and 3 in `design/01-foundation.md` §9.
- **Why**: 29 and 14 files respectively consume them, and no one has looked at what those files render. The handoff constrains what the three new families are used *for*, not what else may exist. Dropping them buys nothing this phase needs.
- **Reversible**: yes — a later phase that finds a surface where the extra family is visibly wrong can retire it then.
