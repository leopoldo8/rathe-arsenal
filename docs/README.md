# Docs index

Two kinds of documents live here.
Current docs describe how the project works now, and are kept up to date.
Historical records describe what was decided or found at a point in time, and are never rewritten; they may describe things that have since changed.

## Current docs

| Document | What it is for |
|----------|----------------|
| [`../README.md`](../README.md) | What the product is, the stack, how to run and test it |
| [`../CLAUDE.md`](../CLAUDE.md) | Session context for Claude: guides, what is in flight, owner rules |
| [`../.specs/STATE.md`](../.specs/STATE.md) | Decisions log (AD-NNN) and the current handoff |
| [`../.impeccable.md`](../.impeccable.md) | Design brief: users, brand, palette, typography, motion |
| [`../.design/`](../.design/) | Confirmed design documents and mockups, one per feature |
| [`../scripts/deploy-railway.md`](../scripts/deploy-railway.md) | Railway deployment: services, environment variables, verification |
| [`validation-philosophy.md`](validation-philosophy.md) | How releases are validated (automated first, no external human gate) |
| [`dev-fixtures.md`](dev-fixtures.md) | Test decks, the seeded fixture user, local QA helpers |
| [`phase-1-followups.md`](phase-1-followups.md) | Debt ledger: trade-offs and the trigger to revisit each; entries are never deleted, only given a status line |
| [`design/v1/visual-regression.md`](design/v1/visual-regression.md) | How to run and update the screenshot regression suite |
| [`design/v1/contrast-matrix.md`](design/v1/contrast-matrix.md) | Contrast ratios of the color tokens in dark and light themes |
| [`research/ip-posture.md`](research/ip-posture.md) | Stance on card images and Legend Story Studios IP; read before any monetization or asset change |
| [`research/scraper-cost-scaling.md`](research/scraper-cost-scaling.md) | Store scraper and Firecrawl cost model |

## Historical records

Read these as a record of their date.

| Folder | What it holds |
|--------|---------------|
| [`audit/`](audit/) | Quality audits: `uxui-2026-06-29`, `ai-slop-2026-10-03`, and `personas-2026-10-21` (the persona audit behind the persona-rethink release, which is not in the repository: it was evidence for the persona-rethink spec, which was deleted) |
| [`brainstorms/gates/`](brainstorms/gates/) | Retired gate documents; the engine gold-set CSV and the store consent artifacts that code cites live here |
| [`ideation/`](ideation/) | Idea exploration before the first plan |
| [`plans/`](plans/) | Only the deferred Phase 1c plan and its addendum |
| [`prototypes/`](prototypes/) | The Phase 0 engine validation |
| [`research/`](research/) | Security notes and the Phase 1b compliance log (the two research files above are current) |
| [`roadmap/`](roadmap/) | Future work that is not scheduled: `card-scanner-ocr.md` |
| [`design/v1/`](design/v1/) | The 2026-04 visual identity prototype and `path-abc-spec.md`, which predates the 2026-10 redesign |

## Removed on 2026-10-29

Finished specs and plans were deleted: everything under `.specs/features/`, `docs/superpowers/`, the finished plans in `docs/plans/`, and the requirement brainstorms.
Git history keeps them: `git log --all -- .specs/features docs/plans docs/superpowers docs/brainstorms`.
Some historical records still name these paths; treat such references as pointers into history.

## Plan status convention

A plan carries a `status:` line in its frontmatter: `completed` (built and merged) or `deferred` (written, not built, waiting on an owner decision).
Only deferred plans stay in `plans/`; a finished plan is deleted.
Unit checkboxes inside a plan are not a progress signal.
