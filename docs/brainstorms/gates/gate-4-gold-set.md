---
gate: 4
title: Gold-Set Protocol (Solo-Labeler Variant)
status: PENDING (protocol defined; gold set not yet labeled)
date: 2026-04-08
owner: Rodrigo (also the sole labeler — explicit bias tradeoff)
---

# Gate 4 — Gold-Set Protocol (Solo-Labeler Variant)

## Decision

The project owner will be the sole labeler of the substitution gold set. This is an explicit, conscious tradeoff: simpler execution at the cost of evaluator independence. The mitigations are **blind labeling** (the labeler cannot see the engine's tier or score when evaluating each substitution) and **structured sampling** (the set is drawn from real Fabrary decks and real engine candidates, not cherry-picked).

## Protocol (to execute during Phase 0 before the exit gate)

### Step 1 — Gold set assembly

- **Size:** 30 substitutions (reduced from 50 in the original protocol because the solo-labeler path takes longer per substitution and the smaller set is still sufficient for a pass/fail decision at the 70% threshold).
- **Stratification:** At least 4 different heroes and at least 2 archetypes (aggro / control / midrange / combo — pick whichever 2+ are well-represented in the Fabrary trending at the time of Phase 0 start).
- **Sampling procedure:** Sample 4-6 decks from Fabrary trending at the start of Phase 0. For each deck, identify 5-8 core mainboard cards. For each core card, run a prototype of the engine against `@flesh-and-blood/cards` and extract 1-2 candidate substitutions. Aggregate candidates across decks until reaching 30. **The labeler must not curate candidates manually** — whatever the engine proposes is what gets labeled.

### Step 2 — Blind labeling session

- **Format:** A simple CSV or spreadsheet with columns: `rowNumber`, `deckHero`, `archetype`, `deckContext`, `originalCard`, `proposedSubstitute`, `label`.
- **Hidden columns (filled only after labeling):** `engineTier`, `engineScore`, `agreement`.
- **Process:** Open the CSV, fill the `label` column row by row with one of `yes` / `no` / `uncertain`. Do the full 30 rows in a single session (30-45 minutes, 5-8 seconds per row) to avoid context drift between sessions.
- **Self-bias mitigations:**
  - Blind: the tier and score columns are not visible during labeling.
  - Quick: rapid-fire labeling reduces the temptation to second-guess in favor of the engine.
  - Single session: no overnight reconsidering that could align with engine output.
  - Honest "uncertain": if genuinely unsure, mark `uncertain`. These are excluded from the denominator. Resist the temptation to pick `yes` just to have an answer.

### Step 3 — Scoring

- **Total rows:** 30
- **Denominator:** 30 − (number of `uncertain` rows)
- **Numerator:** number of `yes` rows
- **Pass threshold:** ≥70% → at least 20 of 30 are `yes` (after excluding `uncertain`).
- **Interpretation:**
  - **≥80%:** engine is working well, high confidence despite self-bias.
  - **70-79%:** pass, but softer confidence. Phase 0 should include informal user feedback as a cross-check before committing to Phase 1.
  - **<70%:** engine needs iteration. Do not advance to Phase 1. Redraw the gold set from different decks (to avoid memorizing labels) before re-testing.

### Step 4 — Pitch curve tolerance

During the same labeling session (or a separate one), document acceptable pitch curve tolerance based on FaB experience:

- "For a typical competitive deck, the curve can shift by ±N red, ±M yellow, ±K blue without becoming unplayable."
- Suggested starting numbers (to revise during labeling): ±2 red, ±1 yellow, ±1 blue.
- These numbers are inserted into R21 of the requirements document once decided.

## Artifacts to produce

- `gate-4-gold-set.csv` — the 30 labeled rows
- `gate-4-pitch-curve-tolerance.md` — the agreed tolerance numbers and reasoning
- This artifact (`gate-4-gold-set.md`) will be updated with the pass/fail result after labeling is complete

## Gate status

**PENDING.** The protocol is defined and the labeler is identified. The actual labeling session happens as part of Phase 0 implementation — after the engine prototype exists and after Fabrary trending data is ingested (or manually sampled).

Gate 4 does not block Gate 3 or Gate 2; they can run in parallel. Gate 4's pass/fail output is consumed at the **Phase 0 exit gate**, not before Phase 0 begins.
