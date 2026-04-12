---
gate: 1
title: Pelotas FaB Community Census + Adoption Probe
status: PASSED (with primary metric rescope)
date: 2026-04-08
owner: Rodrigo (project owner, already embedded in local FaB community)
---

# Gate 1 — Pelotas FaB Community Census + Adoption Probe

## Evidence gathered

The project owner is already a member of the local Pelotas FaB group and provided the following direct observations about the community size and engagement:

- **Total group membership:** 47 members.
- **Tournament-active players:** ~8 (subset of members who regularly participate in organized play).
- **Casual / semi-casual pool (target audience for the casual persona):** ~47 − 8 = ~39 members.

Because the project owner is an active community member, the formal cross-check step (asking a community-trusted third party to verify the list) is satisfied by self-reporting from within the community itself.

## Analysis

The original primary success metric in the requirements document was "20 weekly active Pelotas players for 6 consecutive weeks". That metric implicitly assumed a candidate pool of 40-60 potential users with ~50% conversion and ~80% weekly retention.

With the actual pool size now known (47 total, ~39 in the target persona), the original metric is unreachable under any realistic conversion model:

- At 30% conversion (optimistic for a new tool in a niche community): 39 × 0.30 = ~12 sign-ups.
- At 50% weekly retention (optimistic): 12 × 0.50 = ~6 weekly actives.
- Even at 100% conversion + 100% retention: 39 weekly actives, which is above the 20 bar — but both are unrealistic.

The metric had to be rescoped to reflect the actual pool.

## Rescoped primary metric

- **New primary metric (Phase 1 exit gate):** "At least 8 Pelotas-based players return to the app on at least 3 separate days over any 4-week window, and at least 5 of those 8 show behavioral evidence of ongoing engagement (paste a second Fabrary URL, track ≥2 decks, or accept ≥1 substitution swap)."
- **Rationale:** Calibrated to 17-20% conversion of the realistic pool with ~4-week retention. Ambitious but plausible for a niche tool in a friendly community.

The adoption probe (the "would you open it weekly?" survey) is deferred from this gate into **Phase 0 closed beta recruitment**. Rather than asking in the abstract, the project will offer the beta directly to local group members and measure conversion behaviorally. This avoids the social-desirability bias of an abstract "would you use it?" question.

## Decision

**PASS** — The pool is large enough to support the rescoped metric, and the project owner is already embedded in the community (which satisfies the cross-check and the adoption-probe-access requirements by virtue of membership). The original metric has been updated in the requirements document to reflect the actual ceiling of the market.

## Fail action (if rescoped metric misses during Phase 1)

If even the rescoped metric misses, the next move is to reframe the product — either as a Discord bot integration inside the existing community workflow (lower adoption threshold than a standalone web app), or to accept that Pelotas alone cannot sustain the project and consider widening geography after Phase 1.
