---
title: "Phase 1a handoff — Unit 3 shipped, 5 units unblocked for parallel work"
type: handoff
status: active
date: 2026-04-11
plan: docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md
base-commit: 71229a0
---

# Phase 1a handoff

## Where we are

**Unit 3 (engine tier 2 + path helper + exclusion-aware search) is merged.** Commit `71229a0` on `main`. leopoldo8/rathe-arsenal#1.

`main` is 23 commits ahead of the Phase 0 baseline and has:
- New engine primitives: `scoreCandidate`, `findTierMatch`, `findSubstitution`, `computePath`, `ITierConfig`, `TIER_1_CONFIG`, `TIER_2_CONFIG`, `TIER_2_KEYWORD_OVERLAP_WEIGHT`
- `IEffectiveReadinessResult.path: 'A' | 'B' | 'C'` populated at compute time
- Optional `excludedIdentifiers: ReadonlySet<string>` fifth parameter on `computeEffectiveReadiness` (defaults to empty set, backward-compatible)
- `tier1Substitution` removed from the public API; use `findTierMatch(card, inventory, catalog, TIER_1_CONFIG)` for tier-1-only searches (only relevant in `scripts/gold-set/generate-candidates.ts`, already migrated)
- `composeRationale(missing, candidate, tier?)` emits `"Tier 2 substitute -- keyword overlap relaxed: ..."` for tier 2 matches; default tier is 1
- Gate 4 gold-set regression runs as a Jest spec on every `pnpm --filter @rathe-arsenal/engine test`

## Units now unblocked for parallel work

From the plan's dependency graph, after Unit 3 landing:

| Unit | Depends on | Suggested branch | Notes |
|---|---|---|---|
| **U1** Auth Hardening (A4/A5/A6 + trust proxy) | none | `feat/phase-1a-auth-hardening` | Cross-cutting — touches global `APP_GUARD`, `main.ts` trust proxy, and frontend 429 handling on all auth forms. Pins `@nestjs/throttler@^6`. |
| **U4** Manual Card Autocomplete (R4) | none | `feat/phase-1a-autocomplete` | Full-stack: NestJS catalog search endpoint + collection add-card with cross-deck recompute + ARIA combobox on web home. |
| **U5** Home State Machine (R9 two-mode) | none | `feat/phase-1a-home-state-machine` | Smallest unit. Backend adds `collectionCardCount` to `GET /api/decks`; frontend collapses fallback into empty mode per Scope Boundaries. |
| **U6** Out-of-Onboarding Test Mode (R15) | U3 (`computePath`) | `feat/phase-1a-test-mode` | New `POST /api/decks/test` endpoint. **MUST route outbound HTTP through `FetchGuardService.guardedFetch`** — no direct `fetch()`. Creates `/import` frontend route. |
| **U7** Interactive Swap Editor + Persisted Rejections (R17 Phase 1) | U3 (`excludedIdentifiers`, `computePath`) | `feat/phase-1a-re-solve` | Introduces `rejected_substitute` entity + migration + three new endpoints (`reject-substitute`, `reset-rejections`, dry-run `re-solve`). Frontend reworks `SubstitutionRow` with per-row reject + curve-warning banner. |
| **U8** Path C fidelity (R18) | U3 (`computePath`, `path` field) | `feat/phase-1a-path-c` | Adds `computeFidelity(breakdown, totalCards)` helper + `fidelityPercent` field. Frontend renders `PathCResult` + tracked-deck Path C banner. |

**U2 (Account Deletion, A8)** chains off U1 — cannot start until U1's rate limiting is merged.

## Parallelization strategy

1. **Spawn 5 sessions in parallel** — one per independent unit (U1, U4, U5, U6, U7, U8 — that's 6 if you count U8 separately, though U8 is small enough to bundle). Each session branches from `main` @ `71229a0`.
2. **Use git worktrees** so sessions don't stomp on each other:
   ```sh
   cd /Users/rodrigohaertel/workspace/personal/rathe-arsenal
   git worktree add ../rathe-arsenal-u1 -b feat/phase-1a-auth-hardening main
   git worktree add ../rathe-arsenal-u4 -b feat/phase-1a-autocomplete main
   git worktree add ../rathe-arsenal-u5 -b feat/phase-1a-home-state-machine main
   git worktree add ../rathe-arsenal-u6 -b feat/phase-1a-test-mode main
   git worktree add ../rathe-arsenal-u7 -b feat/phase-1a-re-solve main
   git worktree add ../rathe-arsenal-u8 -b feat/phase-1a-path-c main
   ```
3. **Kick each session with `/compound-engineering:ce-work`** pointing at the plan path and the unit name:
   ```
   /compound-engineering:ce-work plan:docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md unit:U4
   ```
4. Sessions must **NOT** push to `main` directly — PR-per-unit, rebase merge, same flow as Unit 3. Merge conflicts are unlikely because units touch non-overlapping files; the only likely contention is `apps/api/src/decks/decks.module.ts` (U5 + U6 both add providers) and `apps/web/src/routeTree.gen.ts` (regenerated on build).
5. **Merge order when PRs are ready:** U1 first (so U2 can start), then any order for U4/U5/U6/U7/U8. Re-run the Gate 4 gold-set regression in CI on every PR — it already runs as part of `packages/engine` Jest.

## Known gotchas discovered during U3

1. **The plan's "only in-repo consumer is `compute.ts`" claim was wrong.** `scripts/gold-set/generate-candidates.ts` also imported `tier1Substitution`. When touching public engine exports in future units, grep the entire monorepo — not just `packages/engine/` and `apps/api/`.
2. **Twism git rules conflict with "one commit per unit".** Resolved by amending unpushed commits within a unit's review cycle; new session should do the same. Never amend after pushing.
3. **Tier 2 quality is not validated against gold-set labels.** The Gate 4 CSV was labeled from tier 1 output only. The existing regression spec enforces tier 1 parity but **cannot detect tier 2 over-acceptance**. Logged as **A17** in `docs/phase-1-followups.md`. Revisit before Phase 1a public rollout.
4. **Workspace package manager is pnpm.** All tests run via `pnpm --filter @rathe-arsenal/<pkg> test`. Workspace typecheck is `pnpm -r typecheck`. There is no root-level `test` script.
5. **Web package has no tests yet.** `pnpm --filter @rathe-arsenal/web test` exits with code 1 because Vitest finds no test files. Units with frontend changes may need to bootstrap Vitest before TDD.
6. **`.env.example` is Railway-shaped** (`postgres:dev@localhost:5432/rathe_arsenal`). `NODE_ENV=development` triggers TypeORM `synchronize: true`, so new entities (U2 `deletedAt`, U7 `rejected_substitute`) auto-migrate locally without a hand-written migration while iterating. Production still runs explicit migrations; unit authors must still write them.

## What U3 did NOT ship (for downstream units to consume)

- **No API-layer path derivation for legacy snapshots.** U6/U7/U8 must call `computePath(snapshot.breakdown)` at read time in `SubstitutionService` when serializing snapshots to the frontend, per the plan's "Legacy snapshot handling" decision. U3 only exposed the helper.
- **No `fidelityPercent` helper.** U8 adds `computeFidelity(breakdown, totalCards): number` and the field on `IEffectiveReadinessResult`. U8 is the only unit that touches `packages/engine/` after U3.
- **No `rejected_substitute` entity.** U7 introduces it.
- **No `computeReadinessWithExclusions` service method.** U7 adds a `SubstitutionService` method that calls `computeEffectiveReadiness(..., excludedIdentifiers)` *without* persisting a snapshot (for the dry-run `re-solve` endpoint). The exclusion-aware compute itself is already in the engine.

## Baseline verification commands for any new session

```sh
# Sanity check the merged state
git log --oneline -1 71229a0   # should be the U3 commit

# Run the engine suite — gold-set regression must pass
pnpm --filter @rathe-arsenal/engine test

# API regression
pnpm --filter @rathe-arsenal/api test

# Workspace typecheck
pnpm -r typecheck
```

Expected: engine 128/128 green, api 115/115 green, typecheck clean.

## Plan + debt ledger links

- Phase 1a plan: `docs/plans/2026-04-10-001-feat-phase-1a-product-core-plan.md`
- Debt ledger (add any new follow-ups here): `docs/phase-1-followups.md`
- Origin doc: `docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md`
- Gate 4 regression fixture: `docs/brainstorms/gates/gate-4-gold-set.csv`
- Gate 4 engine replay spec: `packages/engine/__tests__/gold-set-regression.spec.ts`
