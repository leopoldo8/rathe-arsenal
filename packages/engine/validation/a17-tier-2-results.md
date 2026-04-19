---
status: PENDING LABELER
ship_gate: Gate 2
blocker: true
created: 2026-04-19
---

> WARNING: PENDING LABELER — Gate 2 ship-blocker. Cupula DT member needed for 1-2h labeling session to fill this document. See `a17-tier-2-gold-set.md` for instructions and the 30 suggestions to review.

# A17 — Tier-2 Gold-Set Results

## Labeling Session Details

| Field | Value |
|-------|-------|
| Labeler | [pending] |
| Session date | [pending] |
| Engine version | [pending — run `pnpm --filter engine build && node -e "const e=require('./packages/engine/dist/index.js'); console.log(e.ENGINE_VERSION)"` before session] |
| Source gold-set doc | `packages/engine/validation/a17-tier-2-gold-set.md` |

---

## Decision Table

| # | Missing Card | Proxy | Decision (Accept / Reject) | Rejection Reason |
|---|--------------|-------|---------------------------|------------------|
| 1 | [pending] | [pending] | [pending] | |
| 2 | [pending] | [pending] | [pending] | |
| 3 | [pending] | [pending] | [pending] | |
| 4 | [pending] | [pending] | [pending] | |
| 5 | [pending] | [pending] | [pending] | |
| 6 | [pending] | [pending] | [pending] | |
| 7 | [pending] | [pending] | [pending] | |
| 8 | [pending] | [pending] | [pending] | |
| 9 | [pending] | [pending] | [pending] | |
| 10 | [pending] | [pending] | [pending] | |
| 11 | [pending] | [pending] | [pending] | |
| 12 | [pending] | [pending] | [pending] | |
| 13 | [pending] | [pending] | [pending] | |
| 14 | [pending] | [pending] | [pending] | |
| 15 | [pending] | [pending] | [pending] | |
| 16 | [pending] | [pending] | [pending] | |
| 17 | [pending] | [pending] | [pending] | |
| 18 | [pending] | [pending] | [pending] | |
| 19 | [pending] | [pending] | [pending] | |
| 20 | [pending] | [pending] | [pending] | |
| 21 | [pending] | [pending] | [pending] | |
| 22 | [pending] | [pending] | [pending] | |
| 23 | [pending] | [pending] | [pending] | |
| 24 | [pending] | [pending] | [pending] | |
| 25 | [pending] | [pending] | [pending] | |
| 26 | [pending] | [pending] | [pending] | |
| 27 | [pending] | [pending] | [pending] | |
| 28 | [pending] | [pending] | [pending] | |
| 29 | [pending] | [pending] | [pending] | |
| 30 | [pending] | [pending] | [pending] | |

---

## Acceptance Rate

**[ ]% (pending)**

- Total entries: 30
- Accepted: [pending]
- Rejected: [pending]
- Pass threshold: >=18 of 30 (>=60%)

---

## Rejection Reasons Grouped

[pending — fill after labeling session using the taxonomy from `a17-tier-2-gold-set.md` Section 5]

| Rejection Category | Count | Entry Numbers |
|--------------------|-------|---------------|
| Wrong archetype | | |
| Keyword mismatch breaks gameplan | | |
| Stats mismatch significant | | |
| Too aggressive proxy | | |
| Flavor / archetype identity | | |
| Engine bug | | |

---

## Ship Decision

**[pending — requires >=60% acceptance (>=18 of 30) to ship Gate 2]**

If acceptance >= 60%:
- Update `status` frontmatter to `passed`
- Set `blocker: false`
- Record the acceptance rate and date
- Update the plan status in `docs/plans/2026-04-19-001-feat-v1-foundation-core-experience-plan.md` Unit 8 checkbox

If acceptance < 60%:
- Update `status` frontmatter to `failed-first-pass`
- Group rejection reasons from the table above
- Propose constant revisions to `packages/engine/src/substitution/constants.ts` targeting the most frequent rejection categories
- Re-run a fresh 30-entry labeling batch (different cards, same decks acceptable) after constant revision
- Document revision history below before re-running

---

## Revision History

[empty — no revisions yet]
