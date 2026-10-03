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

## Test-quality brief

Every implementation phase inherits this. It is distilled from `.specs/LESSONS.md`, which records tests that passed while the bug they were supposed to catch survived. This redesign is unusually exposed to L-006, because the handoff specifies hundreds of exact values and a test that only checks "an element rendered" leaves every one of them free to drift.

1. **Pin exact values that an acceptance criterion fixes.** When a criterion names a literal — a token, a px size, an aspect ratio, a duration, a keyframe percentage — assert that literal, in `apps/web/src/styles/__tests__/design-guards.spec.ts` when it lives in CSS. A guard that only checks the class exists does not protect the value inside it. (L-006)
2. **Test the container, not only the component.** If a phase mounts something inside a shell, assert the child's content renders through the parent, not merely that the child works standalone. (L-007)
3. **Assert the mechanism, not the artifact it happens to produce.** When a criterion requires a specific router component, assert that component was invoked — a mocked `Link` and a bare anchor produce identical DOM. The same applies to any wrapper whose presence is the point. (L-008)
4. **Split conjunctions.** An "X and Y" criterion needs two independent assertions. A fallback rendering does not prove the error was reported. (L-009)
5. **Cover every render branch at the boundary.** A component with collapsed and expanded states needs the indicator tested in both, at count = 1. (L-003)
6. **Assert the identifier across every variant of a batched action**, not just the boolean that distinguishes them. (L-005)
7. **A skipped test is a failing test.** Nothing in this run may add a `skip` or a `todo`. The one inherited skip must be gone by the end of phase 1.

## Deviations

Decisions taken without the owner, or departures from the agreed plan. Empty means nothing has diverged yet.

### DEV-01 — Prototype bundle not mirrored into the repo (revised)
- **Original plan**: fetch the two `.dc.html` prototype files into a gitignored `prototype/` directory so every implementation agent has a visual reference.
- **What actually happened**: the Claude Design read tool is available only in the orchestrator's session, not in subagents' tool registries. A subagent dispatched to fetch the bundle could not reach it and correctly stopped rather than improvising.
- **Decision**: drop the mirror. Implementation agents work from `design-handoff.md`, which carries every literal that matters — hex values, px geometry, the full keyframe blocks, the mask expressions and the copy. The orchestrator pulls individual screenshots directly at verification time, when there is a built screen to compare them against, rather than pre-fetching a bundle nobody has a use for yet.
- **Why this is acceptable**: the handoff is unusually complete for a design document. The prototype's marginal value is confirming that the written values compose into the intended look, which is a verification question, not an implementation one.
- **Reversible**: yes — the orchestrator can fetch and commit the bundle at any point.

### DEV-03 — Swap workstream split, engine ahead of screen
- **What**: the swaps workstream is split in two. The engine, migration, persistence and endpoints (Half A) land immediately after the foundation. The Swaps screen (Half B) stays late in the order.
- **Why**: D7 changes what `effectivePercent` means. Home renders an average-readiness KPI and per-deck readiness meta; deck detail renders `raw`, `fidelity`, `pct` and the 90px medallion. Building those two phases against today's engine would bake the old numbers into their fixtures, and every one of those assertions would turn red when the engine change eventually landed — forcing a retrofit of two phases' tests. Landing the engine change first means those phases are written against correct numbers from the start.
- **Cost**: Half A has to leave the existing Swaps screen functional during the window before Half B rebuilds it, since every phase must be committable with a green suite. The swaps design owns that question.
- **Reversible**: yes, but expensively — reverting the order after Home and deck detail are built recreates exactly the retrofit this avoids.

### DEV-04 — Local Postgres brought up in Docker
- **What**: a `postgres:16-alpine` container named `rathe-arsenal-pg` on port 5432, with the exact credentials the repo's `.env` already points at (`postgresql://postgres:dev@localhost:5432/rathe_arsenal`). No config file was changed; the container was shaped to fit the existing configuration.
- **Why**: every prior feature recorded "no local PostgreSQL" as a known limitation, which pushed the DB-backed API e2e suite to CI-only and left `scripts/screenshot-all-surfaces.ts` — the repo's own self-validation tool, which captures ~64 screenshots across both themes and both viewports — unusable locally. Both are exactly the automated verification this run needs, and the owner's validation philosophy puts them ahead of anything manual. Docker was already running on this machine.
- **Scope of the change**: none in the repository. The container is infrastructure on the developer's machine.
- **Reversible**: yes, completely — `docker rm -f rathe-arsenal-pg`. Nothing in the repo depends on it existing.
- **Note for the owner**: this also means the `## Known env limitation` line in `.specs/STATE.md` is now out of date. Left alone for the moment rather than edited mid-run.

### DEV-05 — Mutation responses also carry the acted-on row
- **What**: `ISwapMutationResult` is `{ deckId, swap, rows }`, not the design's `{ deckId, rows }`. `swap` is the row the request acted on, with its real post-recompute status, which can be `retired`.
- **Why**: §2's restore-phantom rule says restore must report the row's actual resulting status, but §6 says `rows` excludes retired rows, so a restored row that the recompute retires again would simply vanish from the response with no explanation. Half B's in-place confirmation needs to know that happened.
- **Reversible**: yes, additive field.

### DEV-06 — Revert clears `outcome`
- **What**: `revert` resets `appliedAt` and `outcome` to null; a later `approve` starts with no outcome.
- **Why**: the design is silent. A post-play outcome describes one application of the swap; carrying it across a revert and re-approval would show feedback the user gave about a swap they then undid. The outcome write is logged (`swaps.transition`), so nothing is lost for telemetry.
- **Reversible**: yes, one line in `resolve-swap-transition.ts`.

### DEV-07 — Small state-machine details the §6 table leaves open
- A blank or whitespace-only rejection note is stored as null, so Recusadas never renders an empty quote.
- Re-rejecting with a different reason or note updates the row but skips the readiness recompute, since the exclusion set did not change.
- The same-reason no-op compares reason and note after normalizing omitted values to null, so a reason-less repeat of a reason-less rejection is a no-op while an edited note is not swallowed.

### DEV-08 — `GET /api/swaps` and mutation rows keep `imageUrl.sources`
- **What**: `ISwapRow.originalImageUrl` / `substituteImageUrl` are the catalog's full image object, including the `sources` mirror list. The old `/api/reviews` shape strips it.
- **Why**: §11 has `SwapRow` render through `CardArt` with its fallback chain, which walks `sources`.

### DEV-09 — No tighter per-route throttle on the swap endpoints (open for Half B)
- **What**: the five mutations inherit only the global 120 requests/min/IP limit.
- **Why**: §7 turns a bulk action into N sequential single-endpoint calls. A 30/min override like `tags`/`users` would make a bulk approve of 40 rows fail partway. Even 120/min caps one bulk action at roughly that many rows per minute.
- **Needs a call in Half B**: either cap bulk selection, pace the client dispatch, or add a bulk endpoint. Not decided here.

### Phase 2 close-out (2026-10-03, resumed session)
- The run stopped on 2026-08-16 with the five endpoints unwritten. Resumed and finished on 2026-10-03.
- `GET /api/swaps` and the five mutations live in `apps/api/src/swaps/`. The old `/api/reviews` and `/decks/:id/decisions` shim stays until Half B, as the landing sequence requires.
- The status write, readiness recompute and reconciliation share one transaction. `SwapSuggestionQueryService.loadReadinessInputs` and `SubstitutionService.computeAndStoreReadiness` gained an optional `EntityManager` for this. Verified by mutation: dropping the manager from the readiness read makes the e2e fail (`effectivePercent` does not rise after approve).
- Malformed ids return 400 (`ParseUUIDPipe`) instead of a Postgres 500.
- **Pre-existing failures fixed on the way** (all three were test drift, not product bugs): `state-transition-matrix.spec.ts` lint error from `48cf5a6`; `tags.controller.int-spec.ts` expected a bare array after #83 changed `GET /api/tags` to `{ tags }`, and its throttle override never reached the `APP_GUARD` instance; `decks.controller.put.int-spec.ts` still expected a 400 for a missing `heroIdentifier` after #84 made it optional, and hung on the auto-mocked service.
- **Phase 1 gap closed**: FND-04's guard did not exist; added to `design-guards.spec.ts`.
- **Test-strength note for every later phase**: the API now has a `test:int` suite (70 tests) besides `test` and `test:e2e`. It must be part of the gate.

## Baseline before any change

Captured 2026-08-16 on `feat/product-redesign` at commit `8c22ed2`, after `pnpm install`:

| Check | Result |
|-------|--------|
| `pnpm typecheck` | Green — `apps/web`, `apps/api`, `packages/engine` |
| `apps/api` unit | 857 passed / 857, 72 suites |
| `apps/web` unit | 1525 passed, 1 skipped, 120 files |
| `packages/engine` unit | 232 passed / 232, 13 suites |
| `apps/api` e2e | 31 passed / 31, 5 suites — **run locally for the first time**, against the DEV-04 container |
| **Total** | **2645 passing, 1 skipped** |

The e2e line is the payoff for DEV-04. `theme-persistence.e2e-spec.ts` and `plan-b-full-flow.e2e-spec.ts` are the two suites `.specs/STATE.md` records as CI-only for want of a local database; both pass here. Every phase of this run can now be verified against the same suite CI will run, instead of discovering database-layer breakage only after the PR is open.

The single skip is the `describe.skip` block in `apps/web/src/styles/__tests__/contrast.spec.ts` covering borderline dark tokens with documented body-size failures. Phase 1 must un-skip it — see the ruling in `design/01-foundation.md` §9. Any other skip appearing later in this run is a regression introduced by this run.

## Shared files — collision map

These are touched by more than one phase and are the reason implementation runs **sequentially per phase**, with parallelism only *within* a phase across genuinely disjoint files.

| File | Rule |
|------|------|
| `apps/web/src/i18n/locales/pt-BR/index.ts` and `en-US/index.ts` | Every phase that adds a namespace edits both. Sequential phases make this safe. |
| `apps/web/src/routeTree.gen.ts` | Generated. Any phase adding a route runs the generator; nobody hand-edits it. |
| `apps/web/tests/visual/__snapshots__/` | The foundation's token swap invalidates every baseline. Each later phase regenerates the baselines for screens it touches, in the same commit. |
| `apps/web/src/styles/tokens.css`, `global.css` | Owned by the foundation phase. No later phase may modify them; a later phase that needs a new token asks for it rather than adding one locally. |

Git worktree isolation is deliberately not used: nine worktrees each editing the same two locale index files would produce merge work strictly worse than running in order.

### DEV-02 — Font-family retention decided by the orchestrator
- **What**: `--ra-font-mono` and `--ra-font-serif` are kept rather than dropped, resolving open items 2 and 3 in `design/01-foundation.md` §9.
- **Why**: 29 and 14 files respectively consume them, and no one has looked at what those files render. The handoff constrains what the three new families are used *for*, not what else may exist. Dropping them buys nothing this phase needs.
- **Reversible**: yes — a later phase that finds a surface where the extra family is visibly wrong can retire it then.
