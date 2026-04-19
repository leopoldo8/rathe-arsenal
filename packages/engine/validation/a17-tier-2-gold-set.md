---
status: pending-labeling
target: ">=60% acceptance"
created: 2026-04-19
ship_gate: Gate 2
blocker: true
---

# A17 — Tier-2 Gold-Set Labeling Session

## 1. Context and Purpose

**What is tier 2?**
The substitution engine operates in two tiers. Tier 1 enforces strict keyword overlap (hard gate: zero overlap fails) and caps stat deltas at 1. Tier 2 relaxes the keyword gate (zero overlap becomes a soft penalty weighted at 0.15 instead of 0.35) and widens stat delta tolerance to 2. A tier-2 substitute is the engine's best-effort fallback when no tier-1 candidate is available for a missing card.

**Why A17?**
Requirement A17 mandates that the tier-2 matching constants (`TIER_2_KEYWORD_OVERLAP_WEIGHT`, `TIER_2_FLOOR_SCORE`, `maxPowerDelta`, `maxDefenseDelta` in `packages/engine/src/substitution/constants.ts`) are validated against a fresh human labeling round before Gate 2 ships. The Gate 4 gold set covered tier-1 only. Tier-2 behavior has a distinct quality profile (softer matches, wider stat tolerance) and requires its own labeling pass.

**What is the ship gate?**
Gate 2 is blocked until this document reaches >=60% acceptance. The results are recorded in `packages/engine/validation/a17-tier-2-results.md`. If acceptance falls below 60%, the rejection reasons group into a revision proposal for the engine constants team before Gate 2 re-runs.

---

## 2. Instructions for Labeler

You are a Cupula DT member reviewing 30 tier-2 substitution suggestions produced by the `@rathe-arsenal/engine`. Each suggestion answers the question: "If a player owns the proxy card but not the missing card, is the proxy a reasonable stand-in for this deck?"

Estimated session time: 1-2 hours.

**Step-by-step:**

1. Read the deck hero and deck name for each entry to establish context (archetype, playstyle).
2. Read the missing card name. Consider what role that card plays in the deck.
3. Read the proposed proxy name and the engine's rationale.
4. Decide:
   - **Accept** if the proxy is a reasonable stand-in (same gameplan viability, no severe pitch or stat mismatch that breaks the deck).
   - **Reject** if the proxy would meaningfully break the deck's gameplan, has a pitch mismatch that disrupts resource curves, or is so far from the original that no skilled player would run it as a substitute.
5. Mark the checkbox (Accept or Reject).
6. If you reject, write a one-line reason (max 1 line). Use the taxonomy in Section 5 as guidance.
7. Do not skip entries. If genuinely uncertain, mark Accept and note "Uncertain — lean accept" in the rejection reason field.

**Key reminders:**
- These are **tier-2** suggestions. By definition the engine already failed to find a tier-1 match. The bar is "acceptable proxy," not "perfect replacement."
- Pitch color matters: a red-pitch card in a blue-heavy curve is a gameplan problem. The engine enforces same pitch, so this should not occur — flag it as an engine bug if it does.
- The engine does NOT enforce semantic gameplay logic (e.g., a Go Again synergy deck losing Go Again on the proxy). That is exactly what this labeling round measures.

---

## 3. Acceptance Criteria

| Outcome | Threshold | Consequence |
|---------|-----------|-------------|
| Pass | >=60% entries accepted (>=18 of 30) | Document pass, Gate 2 unblocked |
| Fail | <60% entries accepted (<18 of 30) | Group rejection reasons; propose revision to `TIER_2_KEYWORD_OVERLAP_WEIGHT` and related constants in `packages/engine/src/substitution/constants.ts`; re-run labeling on revised output |

Constants subject to revision if labeling fails:
- `TIER_2_KEYWORD_OVERLAP_WEIGHT` (currently 0.15 — lowering it reduces the keyword penalty, raising it increases it)
- `TIER_2_FLOOR_SCORE` (currently 0.70 — raising it tightens the acceptance window)
- `TIER_2_CONFIG.maxPowerDelta` (currently 2)
- `TIER_2_CONFIG.maxDefenseDelta` (currently 2)

Revision decisions must be re-validated with a fresh labeling pass on a new batch of 30 tier-2 suggestions (not the same 30, to avoid overfitting to this sample).

---

## 4. Suggestions (30 entries)

> TODO: Populate these 30 entries with real engine output before the labeling session.
> Suggested steps:
> 1. Ensure the engine is built: `pnpm --filter engine build`
> 2. Run the tier-2 candidate generator (adapt `scripts/gold-set/generate-candidates.ts` to use `TIER_2_CONFIG` instead of `TIER_1_CONFIG`, skipping cards that already have a tier-1 match).
> 3. Filter to `tier === 2` suggestions with `score >= 0.70 && score < 0.90` to sample the boundary region (most representative for labeling).
> 4. Pick the 30 most diverse entries across heroes and archetypes (avoid >5 entries from a single deck).
> 5. Replace the placeholder entries below with the generated output.
>
> Reference decks available in `scripts/gold-set/out/sampled/` (10 decks: Kayo CC, Azalea Silver, Verdance CC, Aurora CC, Jarl CC, Oscilio CC, Lyath Silver, Florian Silver, Arakni CC, Pleiades CC).

---

### #1 — [MISSING_CARD_1]

- **Deck:** [DECK_NAME_1] — [HERO_1]
- **Proposed proxy:** [PROXY_1]
- **Pitch cost type:** [PITCH_COLOR_1] (e.g., red / yellow / blue / colorless)
- **Engine rationale:** [RATIONALE_1]
- **Confidence:** [CONFIDENCE_1]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #2 — [MISSING_CARD_2]

- **Deck:** [DECK_NAME_2] — [HERO_2]
- **Proposed proxy:** [PROXY_2]
- **Pitch cost type:** [PITCH_COLOR_2]
- **Engine rationale:** [RATIONALE_2]
- **Confidence:** [CONFIDENCE_2]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #3 — [MISSING_CARD_3]

- **Deck:** [DECK_NAME_3] — [HERO_3]
- **Proposed proxy:** [PROXY_3]
- **Pitch cost type:** [PITCH_COLOR_3]
- **Engine rationale:** [RATIONALE_3]
- **Confidence:** [CONFIDENCE_3]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #4 — [MISSING_CARD_4]

- **Deck:** [DECK_NAME_4] — [HERO_4]
- **Proposed proxy:** [PROXY_4]
- **Pitch cost type:** [PITCH_COLOR_4]
- **Engine rationale:** [RATIONALE_4]
- **Confidence:** [CONFIDENCE_4]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #5 — [MISSING_CARD_5]

- **Deck:** [DECK_NAME_5] — [HERO_5]
- **Proposed proxy:** [PROXY_5]
- **Pitch cost type:** [PITCH_COLOR_5]
- **Engine rationale:** [RATIONALE_5]
- **Confidence:** [CONFIDENCE_5]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #6 — [MISSING_CARD_6]

- **Deck:** [DECK_NAME_6] — [HERO_6]
- **Proposed proxy:** [PROXY_6]
- **Pitch cost type:** [PITCH_COLOR_6]
- **Engine rationale:** [RATIONALE_6]
- **Confidence:** [CONFIDENCE_6]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #7 — [MISSING_CARD_7]

- **Deck:** [DECK_NAME_7] — [HERO_7]
- **Proposed proxy:** [PROXY_7]
- **Pitch cost type:** [PITCH_COLOR_7]
- **Engine rationale:** [RATIONALE_7]
- **Confidence:** [CONFIDENCE_7]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #8 — [MISSING_CARD_8]

- **Deck:** [DECK_NAME_8] — [HERO_8]
- **Proposed proxy:** [PROXY_8]
- **Pitch cost type:** [PITCH_COLOR_8]
- **Engine rationale:** [RATIONALE_8]
- **Confidence:** [CONFIDENCE_8]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #9 — [MISSING_CARD_9]

- **Deck:** [DECK_NAME_9] — [HERO_9]
- **Proposed proxy:** [PROXY_9]
- **Pitch cost type:** [PITCH_COLOR_9]
- **Engine rationale:** [RATIONALE_9]
- **Confidence:** [CONFIDENCE_9]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #10 — [MISSING_CARD_10]

- **Deck:** [DECK_NAME_10] — [HERO_10]
- **Proposed proxy:** [PROXY_10]
- **Pitch cost type:** [PITCH_COLOR_10]
- **Engine rationale:** [RATIONALE_10]
- **Confidence:** [CONFIDENCE_10]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #11 — [MISSING_CARD_11]

- **Deck:** [DECK_NAME_11] — [HERO_11]
- **Proposed proxy:** [PROXY_11]
- **Pitch cost type:** [PITCH_COLOR_11]
- **Engine rationale:** [RATIONALE_11]
- **Confidence:** [CONFIDENCE_11]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #12 — [MISSING_CARD_12]

- **Deck:** [DECK_NAME_12] — [HERO_12]
- **Proposed proxy:** [PROXY_12]
- **Pitch cost type:** [PITCH_COLOR_12]
- **Engine rationale:** [RATIONALE_12]
- **Confidence:** [CONFIDENCE_12]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #13 — [MISSING_CARD_13]

- **Deck:** [DECK_NAME_13] — [HERO_13]
- **Proposed proxy:** [PROXY_13]
- **Pitch cost type:** [PITCH_COLOR_13]
- **Engine rationale:** [RATIONALE_13]
- **Confidence:** [CONFIDENCE_13]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #14 — [MISSING_CARD_14]

- **Deck:** [DECK_NAME_14] — [HERO_14]
- **Proposed proxy:** [PROXY_14]
- **Pitch cost type:** [PITCH_COLOR_14]
- **Engine rationale:** [RATIONALE_14]
- **Confidence:** [CONFIDENCE_14]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #15 — [MISSING_CARD_15]

- **Deck:** [DECK_NAME_15] — [HERO_15]
- **Proposed proxy:** [PROXY_15]
- **Pitch cost type:** [PITCH_COLOR_15]
- **Engine rationale:** [RATIONALE_15]
- **Confidence:** [CONFIDENCE_15]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #16 — [MISSING_CARD_16]

- **Deck:** [DECK_NAME_16] — [HERO_16]
- **Proposed proxy:** [PROXY_16]
- **Pitch cost type:** [PITCH_COLOR_16]
- **Engine rationale:** [RATIONALE_16]
- **Confidence:** [CONFIDENCE_16]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #17 — [MISSING_CARD_17]

- **Deck:** [DECK_NAME_17] — [HERO_17]
- **Proposed proxy:** [PROXY_17]
- **Pitch cost type:** [PITCH_COLOR_17]
- **Engine rationale:** [RATIONALE_17]
- **Confidence:** [CONFIDENCE_17]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #18 — [MISSING_CARD_18]

- **Deck:** [DECK_NAME_18] — [HERO_18]
- **Proposed proxy:** [PROXY_18]
- **Pitch cost type:** [PITCH_COLOR_18]
- **Engine rationale:** [RATIONALE_18]
- **Confidence:** [CONFIDENCE_18]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #19 — [MISSING_CARD_19]

- **Deck:** [DECK_NAME_19] — [HERO_19]
- **Proposed proxy:** [PROXY_19]
- **Pitch cost type:** [PITCH_COLOR_19]
- **Engine rationale:** [RATIONALE_19]
- **Confidence:** [CONFIDENCE_19]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #20 — [MISSING_CARD_20]

- **Deck:** [DECK_NAME_20] — [HERO_20]
- **Proposed proxy:** [PROXY_20]
- **Pitch cost type:** [PITCH_COLOR_20]
- **Engine rationale:** [RATIONALE_20]
- **Confidence:** [CONFIDENCE_20]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #21 — [MISSING_CARD_21]

- **Deck:** [DECK_NAME_21] — [HERO_21]
- **Proposed proxy:** [PROXY_21]
- **Pitch cost type:** [PITCH_COLOR_21]
- **Engine rationale:** [RATIONALE_21]
- **Confidence:** [CONFIDENCE_21]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #22 — [MISSING_CARD_22]

- **Deck:** [DECK_NAME_22] — [HERO_22]
- **Proposed proxy:** [PROXY_22]
- **Pitch cost type:** [PITCH_COLOR_22]
- **Engine rationale:** [RATIONALE_22]
- **Confidence:** [CONFIDENCE_22]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #23 — [MISSING_CARD_23]

- **Deck:** [DECK_NAME_23] — [HERO_23]
- **Proposed proxy:** [PROXY_23]
- **Pitch cost type:** [PITCH_COLOR_23]
- **Engine rationale:** [RATIONALE_23]
- **Confidence:** [CONFIDENCE_23]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #24 — [MISSING_CARD_24]

- **Deck:** [DECK_NAME_24] — [HERO_24]
- **Proposed proxy:** [PROXY_24]
- **Pitch cost type:** [PITCH_COLOR_24]
- **Engine rationale:** [RATIONALE_24]
- **Confidence:** [CONFIDENCE_24]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #25 — [MISSING_CARD_25]

- **Deck:** [DECK_NAME_25] — [HERO_25]
- **Proposed proxy:** [PROXY_25]
- **Pitch cost type:** [PITCH_COLOR_25]
- **Engine rationale:** [RATIONALE_25]
- **Confidence:** [CONFIDENCE_25]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #26 — [MISSING_CARD_26]

- **Deck:** [DECK_NAME_26] — [HERO_26]
- **Proposed proxy:** [PROXY_26]
- **Pitch cost type:** [PITCH_COLOR_26]
- **Engine rationale:** [RATIONALE_26]
- **Confidence:** [CONFIDENCE_26]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #27 — [MISSING_CARD_27]

- **Deck:** [DECK_NAME_27] — [HERO_27]
- **Proposed proxy:** [PROXY_27]
- **Pitch cost type:** [PITCH_COLOR_27]
- **Engine rationale:** [RATIONALE_27]
- **Confidence:** [CONFIDENCE_27]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #28 — [MISSING_CARD_28]

- **Deck:** [DECK_NAME_28] — [HERO_28]
- **Proposed proxy:** [PROXY_28]
- **Pitch cost type:** [PITCH_COLOR_28]
- **Engine rationale:** [RATIONALE_28]
- **Confidence:** [CONFIDENCE_28]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #29 — [MISSING_CARD_29]

- **Deck:** [DECK_NAME_29] — [HERO_29]
- **Proposed proxy:** [PROXY_29]
- **Pitch cost type:** [PITCH_COLOR_29]
- **Engine rationale:** [RATIONALE_29]
- **Confidence:** [CONFIDENCE_29]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

### #30 — [MISSING_CARD_30]

- **Deck:** [DECK_NAME_30] — [HERO_30]
- **Proposed proxy:** [PROXY_30]
- **Pitch cost type:** [PITCH_COLOR_30]
- **Engine rationale:** [RATIONALE_30]
- **Confidence:** [CONFIDENCE_30]
- **Tier:** 2

Accept [ ]  Reject [ ]

Rejection reason (if any):

---

## 5. Rejection Reason Taxonomy

Use these categories when writing rejection reasons to allow grouping in `a17-tier-2-results.md`:

| Tag | When to use |
|-----|-------------|
| **Wrong archetype** | The proxy serves a fundamentally different deck archetype (e.g., an aggressive Go Again engine card proxied by a defensive block-and-react card). |
| **Keyword mismatch breaks gameplan** | The missing card's keyword (e.g., Go Again, Dominate, Crush, Surge, Intimidate) is central to the deck's win condition and the proxy lacks it. Tier 2 intentionally relaxes keyword overlap — reject here only when the keyword loss is strategically catastrophic, not merely suboptimal. |
| **Stats mismatch significant** | Power or defense delta of 2 is acceptable per tier-2 rules but in this specific deck the difference tips the balance (e.g., a deck relying on exactly 4 power to one-shot a specific defense threshold). |
| **Too aggressive proxy** | The proxy is a more expensive or resource-intensive card that the deck cannot efficiently pitch for. (Note: same pitch is enforced by the engine — flag as engine bug if pitch differs.) |
| **Flavor / archetype identity** | The proxy is structurally fine but belongs to a clearly different stylistic identity (e.g., a buff Brute card subbed into an evasion-Assassin package). Lean Accept unless the mismatch is severe. |
| **Engine bug** | The suggestion violates a hard constraint (pitch mismatch, wrong class, wrong type, wrong equipment slot). Mark as engine bug in addition to Reject. |
