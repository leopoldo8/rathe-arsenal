# P1: Swaps — Screen and Lifecycle — Design

**Spec**: `.specs/features/product-redesign/spec.md` (story "P1: Swaps — screen and lifecycle", SWAP-01..15)
**Handoff**: `.specs/features/product-redesign/design-handoff.md` §10 "Swaps"
**Decisions**: `.specs/STATE.md` AD-005, AD-006, AD-007; `spec.md` D7, D8, D9
**Status**: Draft (D7/D8/D9 resolved and incorporated; Half A/Half B landing split incorporated)

This is the highest-risk workstream in the redesign (AD-006: "the most likely source of silent bugs"). Every section below traces back to a specific line in the engine, the entities, or the handoff so the next reader can verify a claim instead of trusting it.

Sections 11-13 (Code Reuse Analysis, Tech Decisions, Requirement Traceability) are appended at the end rather than interleaved, so the `§N` cross-references used throughout sections 0-10 stay stable.

---

## Landing sequence — Half A and Half B

This workstream splits into two independently landable halves, because they have different, asymmetric dependents.

**Half A — engine, persistence, API.** §0 (readiness gating), §1 (current model), §2 (identity/reconciliation), §3 (per-copy vs. per-group), §4 (suppression), §5 (schema/migration), §6 (five endpoints), §8 (error handling), the engine/API portions of §9, §11, §12, §13, plus the compatibility shim and `apps/api/scripts/backfill-swap-suggestions.ts` described below — both required deliverables of this half, not optional cleanup. No frontend work.

**Half B — the Swaps screen.** §7 in full (tabs, in-place confirmation, reason panel, outcome control, `× N` grouping, filter rail/bulk/`all`), plus the web portions of §9, §11, §12, §13.

**Dependency direction: Half A before Home and Deck detail, not just before Half B.** §0 redefines what `effectivePercent` means. Home renders an average-readiness KPI and per-deck readiness meta (HOME-01, HOME-06); Deck detail renders `raw`/`fidelity`/`pct` and the 90px medallion (DECK-04, CMP-01/02). If either of those phases is built and its test fixtures written against today's engine — where a pending substitution already counts — every readiness assertion in them goes red the moment Half A ships later. Half A therefore has to land immediately after the Foundation phase, **ahead of Home and Deck detail** in the implementation order, so those phases are written against the correct numbers from the start rather than needing a fixture rewrite after the fact. Half B has no such upstream pressure — nothing depends on the Swaps *screen* existing, only on the engine change — so it stays where D1's suggested order already puts it, late in the sequence, and can land any time after Half A.

### The gap between Half A landing and Half B landing

Half A drops `substitute_decision` and retires the `decisions.controller.ts` sub-resource and `ReviewsController`'s backing store (§5, §6) — but the **currently shipped** `/swaps` route (pre-redesign) still calls `GET /api/reviews`, `POST /decks/:trackedDeckId/decisions`, and `POST /api/reviews/bulk` until Half B replaces it with the new screen. If Half A ships those endpoints gone, the still-deployed old screen 404s on every request — a broken intermediate state, which the repo's phase-landing convention (VIS-01: baselines never sit red; every phase commits to a working app) doesn't allow.

**Half A keeps the three old endpoints alive as a thin, explicitly temporary compatibility shim**, re-implemented against `swap_suggestion` instead of `substitute_decision` + snapshot-JSONB derivation:

- `GET /api/reviews` → rebuilds `ISubstitutionRow[]` (today's exact response shape) from `swap_suggestion` rows instead of `ReviewAggregateService.listSubstitutionRows`'s snapshot-breakdown-plus-decision-join. `swap_suggestion` already carries a superset of what `ISubstitutionRow` needs (slot, confidence, tier, rationale — card metadata resolved from the catalog as §5 already does for the new reads). `status = 'retired'` rows are excluded, same as they always would have been invisible under the old model (a retired row has no old-model analogue, so this isn't a behavior change for the old screen).
- `POST /decks/:trackedDeckId/decisions` (approve/reject a bare `cardIdentifier`) → the old DTO has no `slot` and no original card, only the substitute's identifier — exactly the ambiguity §2/§4 exist to fix. The shim resolves this the only way it can without changing the old screen's contract: **apply the decision to every `swap_suggestion` row in that deck whose `substituteIdentifier` matches**, deliberately reproducing today's over-broad, substitute-only-keyed behavior (§1) rather than the new pair-scoped one. This is correct for a shim — it's byte-for-byte what the old screen already does today — and explicitly wrong as a permanent behavior, which is why it's deleted, not kept as a code path, the moment Half B ships.
- `POST /api/reviews/bulk` → same per-row translation, looped over the operations array. The old contract's atomicity (`DecisionsService.bulkUpsert`'s single-transaction guarantee) is preserved for the shim specifically, since it's a bounded, temporary piece of code, not the permanent bulk-action design in §7 (which already accepts the weaker per-endpoint guarantee for the *new* five-endpoint model — the shim and the final design have different atomicity properties for different reasons, and that's fine because the shim is deleted before anyone depends on it long-term).

**What a user sees, precisely — and why the migration alone doesn't get there.** §5's migration creates `swap_suggestion` **empty** — it's a schema change, not a compute step. Every place that recomputes readiness (§4's call-site table) is user-triggered (a deck edit, a collection change, a bulk review) — nothing in this design sweeps every deck on its own. Without an explicit backfill, two things go wrong simultaneously, and they're worse than the 404 the shim exists to prevent, not better:

- The shim's `GET /api/reviews` reads from `swap_suggestion`, which is empty for any deck the user hasn't touched since deploy — the old screen loads successfully (no 404) but shows nothing, with no explanation, to a user who had pending swaps yesterday.
- `GET /api/decks` still serves `deck_readiness_snapshot.effectivePercent` from before Half A shipped — untouched, stale, pre-D7 numbers — until whatever next touches that deck recomputes it. Decks don't drop to their new, correct numbers uniformly "the moment Half A ships" as D7's rationale describes; they drop at unpredictable times as users happen to trigger a recompute, which is both a worse user experience and makes the owner's own accepted trade-off in D7 untrue in practice.

**Fix: the migration ships with a mandatory backfill step**, not left implicit. Because computing readiness requires the actual engine (`computeEffectiveReadiness`, catalog lookups, inventory aggregation across sources) rather than expressible SQL, this can't run inside `up()`'s `queryRunner` — it needs the same one-shot-script pattern already used in this repo (`apps/api/src/stores/variant-queue-worker.ts` boots a bare Nest context via `NestFactory.createApplicationContext(AppModule, ...)` for exactly this kind of out-of-request-cycle work). A new script, `apps/api/scripts/backfill-swap-suggestions.ts`, boots that context, iterates every `tracked_deck` row, and for each one calls the same pipeline §0's "Pipeline order" already defines — load approvals/exclusions (both empty, since D8 discarded the legacy table), call `SubstitutionService.computeAndStoreReadiness`, run `reconcileSwapSuggestions` (pure inserts this first time, since there's nothing persisted yet to reconcile against). At the closed-beta scale this design has already been sized against (~47 users, correspondingly few decks), this runs synchronously in seconds. The migration's header comment must point at this script and state that it is a **required deploy step run immediately after the migration**, before the release is considered complete — not an optional cleanup task. With it: every deck's `pct` drops (or, for decks with no substitutable gaps, stays put) uniformly at deploy time as D7 describes, and the old screen's rows are populated from the start of the gap window, not empty.

This shim is deleted in the same commit that lands Half B's new endpoints and screen — it's throwaway code by construction, not a second product to maintain, and should be labeled as such in its own file header (`// TEMPORARY — deleted when apps/web's redesigned Swaps screen ships; see .specs/features/product-redesign/design/07-swaps.md`).

---

## 0. Readiness gating (D7, SWAP-13) — settled: only approved substitutions count

**Resolved by the owner.** `effectivePercent` (the medallion/hero `pct`) counts only exact-owned cards plus **approved** substitutions. A pending, undecided substitution is still found and reported, but does not move the number until approved. This is option (i) from the earlier draft of this section, confirmed rather than defaulted-to.

**Today's behavior** (`packages/engine/src/readiness/compute.ts:256-257`):

```ts
const effectivePercent = totalCards > 0
  ? Math.round(((exactCount + substitutedCount) / totalCards) * 1000) / 10
  : 0;
```

`substitutedCount` increments for *every* match the engine finds (`compute.ts:229`), independent of any decision — there is no "found but not counted" concept today. The only existing lever, `excludedIdentifiers`, removes a substitution from being *found* at all (rejections). This design adds the missing lever for approval, at the same place.

### Input shape: a second branded set, same encoding as exclusion

`computeEffectiveReadiness` gains a sixth parameter, keeping the branded-key discipline from §4 (same collision reasoning applies: approval is scoped to a specific slot, not just a card pair):

```ts
export function computeEffectiveReadiness(
  deck: IDeck,
  inventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  tolerance: IPitchTolerance = DEFAULT_PITCH_TOLERANCE,
  excludedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
  approvedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
): IEffectiveReadinessResult
```

Two sets, not one richer decision map, because they're consumed at two different points in the algorithm for two different reasons: `excludedIdentifiers` filters *candidates* inside `findTierMatch`'s search loop (§4 — a rejected pair must never be found, so a fallback candidate can be tried instead). `approvedIdentifiers` is checked *after* a match is already found, in `compute.ts`'s Pass 2 loop, purely to decide whether that copy counts toward `substitutedCount`. Collapsing both into one `Map<TExclusionKey, 'approved' | 'rejected'>` would work too, but two sets keeps each call site's intent legible (`excludedIdentifiers` reads as "don't find these," `approvedIdentifiers` reads as "count these") and keeps the change additive — every existing 5-arg call site still compiles with the new 6th parameter defaulting to "nothing approved," which is the correct new default (see below), not an accident of omission.

**Inventory reservation is unaffected by approval.** A pending substitution still consumes its substitute's inventory in `remainingInventory` exactly as an approved one does (`compute.ts:233-234`, unchanged) — this keeps allocation deterministic within a single compute call: two different original cards can't both be assigned the same physical copy just because neither substitution has been approved yet. Only the *counting* toward `effectivePercent` differs, nothing about *which* substitute is chosen.

### What `substituted` means now, precisely

`breakdown.substituted[]` is unchanged in *what* it contains — every found match, approved or pending, exactly as today (a rejected pair is still never found at all, so it never appears here; that part of the model doesn't change). What's new: `ISubstitutedEntry` gains one field:

```ts
export interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
  readonly approved: boolean; // new — true iff approvedIdentifiers contains this entry's key
}
```

This is the exact, inspectable answer to "found but not counted" vs. "found and counted": `substitutedCount` and `effectivePercent` sum only entries where `approved === true`; the Swaps screen and the deck detail's "trocas sugeridas" panel keep rendering every entry in `breakdown.substituted[]` regardless of `approved` (they show pending suggestions precisely because they're the thing the user is being asked to act on). `notOwned` (`compute.ts:262-284`) is **unchanged** — it's still the union of `missing` plus every `substituted` entry's original card, regardless of `approved`. A card with a pending, unapproved substitute is exactly as "not owned" as one with an approved substitute or no substitute at all; approval doesn't change what the user physically owns, only what the engine currently treats as covering the slot for readiness purposes.

### Pipeline order (ties §2, §4, and this section together)

1. Load the deck's `swap_suggestion` rows; partition into `approvedIdentifiers` (`status = 'approved'`) and `excludedIdentifiers` (`status = 'rejected'`) — one query, two in-memory sets, both built with `buildExclusionKey`.
2. Call `computeEffectiveReadiness` with both sets.
3. Group the fresh `breakdown.substituted[]` by the quadruple key (§2 step 1) — independent of each entry's `approved` flag, which only affected the percentage in step 2, not the grouping.
4. Reconcile the fresh groups against all persisted rows (§2), including the `approved` ones — reconciliation never reads `entry.approved`; it only compares quadruple keys. A row's `status` moving to `'approved'` happens exclusively through `POST /swaps/:id/approve` (§6), never through this pipeline.

### Knock-on for DECK-04 — what `raw`, `fidelity`, and `pct` each mean now

Flagging this precisely rather than leaving the deck-surfaces workstream to guess, since none of the three changed the same way:

- **`raw` (`rawPercent`)** — unchanged. Exact-owned-copies percentage; never counted substitutions, before or after this design.
- **`fidelity` (`fidelityPercent`)** — unchanged, and **deliberately not gated by approval**. `computeFidelity` (`packages/engine/src/readiness/compute-fidelity.ts`) is computed over `breakdown` as a tier-weighted quality score of the *substitution plan the engine found*, regardless of whether the user has acted on it yet — it answers "how good would this deck be if the suggested plan were used," not "how ready is it right now." This is a scope boundary chosen deliberately to keep this change to exactly what D7 asked for (SWAP-13 says "effective percentage," not fidelity); if the deck-surfaces workstream wants fidelity to also gate by approval, that's a separate decision for that story's own design doc, not inherited from this one.
- **`pct` (`effectivePercent`)** — new meaning: exact-owned plus only *approved* substitutions. This is now literally "what you can play right now," and it drops for every deck with unreviewed pending suggestions the moment this ships (the owner's own stated, accepted consequence in D7).
- **Path (A/B/C) is unaffected.** `computePath` (`packages/engine/src/readiness/compute-path.ts`) classifies purely from `breakdown.missing.length` / `breakdown.substituted.length` — both unchanged in what they contain — so a deck with 3 pending, unapproved substitutions and nothing missing is still **Path B**, exactly as before.
- **The resulting tension, handed to DECK-04 rather than resolved here:** a deck can now be Path B (spec's DECK-03 "status strip renders `--ready` tone with no actions" is keyed off completeness, i.e. Path, not `pct`) while `pct` sits below 100 because its substitutions are still pending. If the status strip's tone/copy is driven by Path (as DECK-02/DECK-03's acceptance criteria read — "incomplete" vs "complete" are about missing cards, not approval), a deck can show a `--ready`-toned strip next to a medallion that isn't at 100. Whether that's the intended reading of "complete" post-D7, or whether DECK-03's completeness check needs to additionally require `pct === 100` (i.e., fully *approved*, not just fully *coverable*), is a call for the Deck detail design doc — this section only makes the disagreement visible, since it's a direct consequence of the change made here.

---

## 1. The current model (what exists today, precisely)

- `computeEffectiveReadiness` (`packages/engine/src/readiness/compute.ts`) is a pure function. It has no persistence and no id concept. Its Pass 2 loop (`compute.ts:201-244`) iterates once **per missing copy** (`for (let i = 0; i < missingQty; i++)`), calling `findSubstitution` separately for each copy and consuming `remainingInventory` as it goes. This means **two copies of the same missing card can legitimately resolve to two different substitutes** if the first substitute's owned quantity runs out mid-loop — a group is not guaranteed to be uniform just because it shares an original card.
- Every non-excluded match becomes one `ISubstitutedEntry = { original, match }` in `breakdown.substituted[]` (`packages/engine/src/readiness/types.ts:63-66`). `match.substitute` carries the substitute's full catalog card, `match.tier`, `match.score`, `match.rationale`.
- The only persisted decision state is `SubstituteDecisionEntity` (`apps/api/src/database/entities/substitute-decision.entity.ts`), unique on `(userId, trackedDeckId, cardIdentifier)`, with `decision: 'approved' | 'rejected'`. **`cardIdentifier` here is the substitute's identifier, not the original's** — confirmed by the comment in `apps/api/src/reviews/review-aggregate.service.ts:360-363`, which documents this as an intentional fix to an earlier orphaning bug, not a placeholder.
- Consequence of that: rejecting a substitute today suppresses that substitute card **for the whole deck**, for any original card it might be proposed against — not just the specific (original, substitute) pair the user saw and rejected. `loadExclusions` (`apps/api/src/decks/decisions/decisions.service.ts:153-159`) returns a flat `Set<string>` of rejected substitute identifiers, and `findTierMatch` (`packages/engine/src/substitution/score.ts:167`) filters `excludedIdentifiers.has(candidate.cardIdentifier)` — the candidate (substitute) side only, even though `missingCard` (the original) is in scope at that point and could be included in the key. This is a **latent correctness gap in the shipped product**, not something the redesign introduces. It is what AD-006 is calling out with the phrase "rejected-**pair** suppression input" in its scope line, and this design fixes it (§4).
- `updateComposition` (`apps/api/src/decks/decks.service.ts:930-945`) already does a form of "retire on recompute", but by **hard delete**: it computes the new substitute set and calls `manager.delete(SubstituteDecisionEntity, { trackedDeckId, cardIdentifier: Not(In([...newSubstituteIds])) })`. AD-006/SWAP-02 requires retiring, never deleting — this delete-based cleanup is replaced (§5).
- Approval today is **inert**: nothing reads `decision === 'approved'` to change engine output or readiness math. It only exists to bucket rows in the Reviews UI.
- The frontend already groups per-copy entries into one row client-side: `groupReviewRows` (`apps/web/src/routes/_auth/-swaps.helpers.ts:36-49`) keys on `` `${trackedDeckId}:${cardIdentifier}:${substituteIdentifier}` `` — no `slot` in the key. `TReviewRowId`/`makeReviewRowId` (`apps/web/src/api/reviews.ts:49-58`) use the same three-part composite as a synthetic id. AD-005 called this "frontend-only grouping"; AD-006 moves persistence into the backend, which means this composite key needs to be re-examined against the actual DB uniqueness constraint (§2) rather than carried forward as-is.

---

## 2. Suggestion identity and the natural key

### Is `slot` part of the key?

`deck_card` (`apps/api/src/database/entities/deck-card.entity.ts`) has **no unique constraint** on `(trackedDeckId, cardIdentifier)` or `(trackedDeckId, cardIdentifier, slot)` — it's just an auto-increment PK with plain columns. Nothing in the schema prevents the same `cardIdentifier` appearing in two different `deck_card` rows with different slots (or even the same slot, split across rows). The engine already treats `(cardIdentifier, slot)` as the unit of deck position — `notOwnedMap` in `compute.ts:265-284` keys explicitly on `` `${entry.cardIdentifier}::${entry.slot}` `` to avoid merging two different positions of the same card.

**Decision: the natural key is a quadruple** — `(trackedDeckId, cardIdentifier, slot, substituteIdentifier)` — not the triple the frontend currently uses. Two different slots holding the same original card, each substituted by the same replacement card, are two distinct suggestions with two distinct lifecycles (one could be approved while the other is rejected). Collapsing them under a triple key would silently merge unrelated decisions the moment a deck happens to duplicate a card across slots.

### Reconciliation rule

On every engine recompute for a deck (every call site enumerated in §6), reconcile the fresh engine output against persisted `swap_suggestion` rows for that `trackedDeckId`:

1. **Group** the fresh `breakdown.substituted[]` entries by the quadruple key. Because `scoreCandidate` (`packages/engine/src/substitution/score.ts`) is a pure function of `(missingCard, candidate, tierConfig)` only, and inventory exhaustion routes a later copy to a *different* candidate rather than the same candidate at a different tier, **every entry within one group shares an identical `tier`/`score`/`rationale`** — a group has exactly one confidence value, never an aggregate. `quantity` for the group is the count of per-copy entries that share the key.
2. For each fresh group, look up an existing row by the quadruple key (regardless of the row's current status):
   - **No row exists** → insert a new row, `status = 'pending'`, mint a new id.
   - **Row exists, `status` is `'pending'` or `'retired'`** → update `quantity`/`confidence`/`tier`/`rationale` from the fresh group; if it was `'retired'`, flip it back to `'pending'` (re-proposed). The id never changes.
   - **Row exists, `status` is `'approved'`** → update `quantity`/`confidence`/`tier`/`rationale` for display accuracy, but **never** touch `status`. Approval is only undone by an explicit Reverter action (§6), never by reconciliation finding the same pair again.
   - **Row exists, `status` is `'rejected'`** → by construction this case cannot occur: a rejected pair-and-slot is fed into the engine's exclusion set (§4), so the engine never proposes it again while it stays rejected, so it never appears in the fresh group set. Rejected rows are simply left untouched by reconciliation.
3. **A persisted row with no matching fresh group is not automatically retired.** There are two different reasons a group can go missing between recomputes, and the spec requires different handling for each:
   - **The `(cardIdentifier, slot)` position no longer exists in the deck** (the user removed the card, changed the slot, or deleted/edited the deck) → `status = 'retired'` for `pending` rows (SWAP-02) and for `approved` rows (the edge case: *"a suggestion is approved and the underlying deck is then edited so the slot no longer exists → the approval SHALL be retired without corrupting readiness"*). The row keeps `appliedAt`/`outcome` for history; it just stops being "live". A retired row is invisible to all three UI tabs (Pendentes/Aplicadas/Recusadas) — it's bookkeeping, not a fourth tab.
   - **The position still exists, but the substitute's owned quantity is now zero** — `findTierMatch` skips any candidate with `owned <= 0` (`score.ts:170-171`), so an exhausted substitute simply stops being found; nothing in the engine's output distinguishes this from "the pair is gone for good." Retiring here would violate the spec's edge case directly: *"the engine proposes a suggestion whose substitute card the user no longer owns → the row SHALL still render with an accurate owned count rather than disappearing silently."* So this case is a **no-op**: the row is left exactly as-is (status, `quantity`, `confidence` unchanged). It keeps rendering in its current tab with its last-known data. Live owned-count display is handled separately, at read time (§6) — `GET /api/swaps` annotates every row with the substitute's *current* owned quantity from inventory, independent of whether reconciliation touched the row. This keeps "why did this stop being freshly proposed" (a reconciliation concern) separate from "how many do you currently own" (a display concern computed fresh on every read).

   Because of this, `reconcileSwapSuggestions` needs one more input beyond `persistedRows`/`freshGroups`: `currentDeckSlots: ReadonlySet<string>`, built by the caller from the deck's live `deck_card` rows as `` `${cardIdentifier}::${slot}` ``. A missing group only produces a `retire` mutation when its `(cardIdentifier, slot)` key is absent from this set; otherwise it produces no mutation at all.
4. **Retired rows can resurrect, but only to `pending`, never straight back to `approved`.** If the same quadruple reappears later (e.g. the user re-adds the card to the same slot), the row un-retires to `pending`, requiring a fresh explicit approval. Auto-reinstating a stale approval risks applying a decision the user never made for the deck's current shape — this is the conservative choice per the repo's deviation-handling convention (pick the reversible/conservative option, don't silently reapply history).

**This must be a pure function**, independent of the database, so the highest-risk logic in the feature is unit-testable without the local-Postgres-less environment this repo runs in (`STATE.md`: "no local PostgreSQL — DB-backed api e2e run in CI only"):

```ts
// apps/api/src/swaps/reconcile-swap-suggestions.ts
interface IPersistedSwapRow {
  readonly id: string; // uuid
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
  readonly status: 'pending' | 'approved' | 'rejected' | 'retired';
}

interface IFreshSwapGroup {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
  readonly quantity: number;
  readonly tier: 1 | 2;
  readonly confidence: number; // normalized 0-100, one value per group
  readonly rationale: string;
}

type TSwapMutation =
  | { readonly kind: 'insert'; readonly group: IFreshSwapGroup }
  | { readonly kind: 'update'; readonly id: string; readonly group: IFreshSwapGroup; readonly unretire: boolean }
  | { readonly kind: 'retire'; readonly id: string };
  // No 'no-op' variant needed — a persisted row with no matching fresh group
  // whose (cardIdentifier, slot) is still in currentDeckSlots simply produces
  // no mutation at all (§2 step 3, the owned-count-zero case).

function reconcileSwapSuggestions(
  persistedRows: readonly IPersistedSwapRow[],
  freshGroups: readonly IFreshSwapGroup[],
  currentDeckSlots: ReadonlySet<string>, // `${cardIdentifier}::${slot}`, from live deck_card rows
): readonly TSwapMutation[];
```

The service wrapping this (`SwapsReconciliationService`) is the only piece that talks to TypeORM — it calls `reconcileSwapSuggestions`, then applies the returned mutations inside the same transaction as whatever triggered the recompute (deck edit, collection change, or a swap action itself — see the two branches below, both raised by review).

**Reject cascades.** Rejecting a suggestion changes the exclusion set fed into the next `computeEffectiveReadiness` call, which can change *other* rows too (freed inventory can let a previously-blocked substitution succeed elsewhere, or remove one). So `POST /swaps/:id/reject` must: write the rejection, recompute readiness with the updated exclusion set, run reconciliation, and **return the full reconciled row set for the deck** in the response — not just the one row that was rejected. SWAP-08's in-place confirmation is a client-side overlay keyed by row id, applied on top of whatever the server returns, not a "skip the refetch" trick — otherwise the in-place UI can silently disagree with server state after a cascade.

**Restore phantom.** Restoring a rejected row moves it to `pending`, but if the engine no longer proposes that pair at all (inventory shifted since the rejection), the very next recompute retires it again — the row would flash into Pendentes and immediately vanish if restore and recompute aren't synchronous. `POST /swaps/:id/restore` therefore recomputes and reconciles **before** returning, and its response reports the row's actual resulting status (which may already be `retired` again), not an assumed `pending`.

---

## 3. Per-copy vs per-group persistence (AD-005/AD-007)

**Decision: persist one row per group** — one row per distinct `(trackedDeckId, cardIdentifier, slot, substituteIdentifier)` quadruple, carrying a `quantity` column — not one row per engine-emitted per-copy entry.

This is a direct continuation of AD-007, which explicitly left this call to this design ("the persisted-row model (AD-006) has to decide whether rows are per-copy or per-group"). Per-group is the only choice that satisfies SWAP-11 ("one decision SHALL apply to every copy in the group") without a second layer of grouping logic on top of persistence: the row *is* the group, its id is the id the API exposes, and approve/reject/revert/restore act on the whole row in one write — no fan-out to N per-copy rows and no client-side re-grouping needed. The engine's per-copy expansion in `compute.ts` stays exactly as-is (AD-005 already decided this, "intentionally left in place") — grouping happens once, in the API's reconciliation step (§2), not in the frontend anymore.

**This changes the shape of AD-005's original scope note.** AD-005 said grouping was "frontend-only... without touching backend/engine/migrations." That was true when it was written (2026-06-29), before AD-006 put persistence in `apps/api`. Now that persisted rows exist, grouping naturally belongs where the row is created — moving it there isn't a new decision, it's AD-006 making AD-005's original constraint obsolete. The frontend's `groupReviewRows` (`-swaps.helpers.ts`) and the synthetic `TReviewRowId`/`makeReviewRowId` (`apps/web/src/api/reviews.ts`) are **superseded**, not reused: the server-issued `swap_suggestion.id` (uuid) becomes the row id the frontend keys off, and no client-side grouping pass is needed at all — the API already returns one row per group.

---

## 4. Suppression reaching the engine — without a database dependency

The engine stays a pure function; `apps/api` still owns loading rejections and building the exclusion set, matching the existing shape (`excludedIdentifiers: ReadonlySet<string>`, 5th positional arg of `computeEffectiveReadiness`). What changes is **what a member of that set encodes** — fixing the cross-original suppression bug from §1.

**Why the key must be a triple, not a pair.** The persisted row's natural key is the quadruple `(trackedDeckId, cardIdentifier, slot, substituteIdentifier)` (§2) — `trackedDeckId` is implicit (the exclusion set is always built per-deck), but `slot` is real signal: the same original card can occupy two different slots in a deck (no unique constraint stops it, §2), and a rejection made against one slot's row must not silently suppress the *other* slot's independent suggestion. A pair-only key `(original, substitute)` would do exactly that — reject slot X's row, and slot Y's still-untouched pending row for the same card pair loses its only candidate on the next recompute and gets retired without the user ever acting on it. That is precisely the "silent bug" class AD-006 warns about, so the exclusion key carries `slot` too:

```ts
// packages/engine/src/substitution/exclusion-key.ts
export type TExclusionKey = string & { readonly __brand: 'ExclusionKey' };

export function buildExclusionKey(
  originalCardIdentifier: string,
  slot: string,
  substituteCardIdentifier: string,
): TExclusionKey {
  return `${originalCardIdentifier}::${slot}::${substituteCardIdentifier}` as TExclusionKey;
}
```

**This requires threading `slot` into the candidate search, not filtering after the fact.** The tempting shortcut — leave `findTierMatch` untouched and reject an excluded match in `compute.ts` after `findSubstitution` returns — is wrong: `findTierMatch` already implements "if the best candidate doesn't clear the floor, or is excluded, try the next candidate" (`score.ts:162-181`), which is how a rejected tier-1 pick correctly falls back to an acceptable tier-2 substitute today. Filtering only after `findSubstitution` returns loses that fallback — a slot-locally-rejected top candidate would make the engine report the card as fully missing even when a decent second-best substitute was available and never considered, because `findTierMatch` had no reason to skip past its first (soon-to-be-rejected) pick. So `slot` has to be visible *inside* the candidate loop, exactly where the pair-only exclusion check already lives:

- `findSubstitution` (`packages/engine/src/substitution/find-substitution.ts`) gains a `slot: string` parameter, threaded straight through to both `findTierMatch` calls.
- `findTierMatch` (`packages/engine/src/substitution/score.ts`) gains the same `slot: string` parameter. Its check changes from:

  ```ts
  if (excludedIdentifiers.has(candidate.cardIdentifier)) continue;
  ```

  to:

  ```ts
  if (excludedIdentifiers.has(buildExclusionKey(missingCard.cardIdentifier, slot, candidate.cardIdentifier))) continue;
  ```

- `compute.ts`'s Pass 2 call site (`compute.ts:202-207`) passes `deckCard.slot`, which is already in scope in that loop, as the new argument.

This is a real, if contained, engine signature change (two exported functions in `packages/engine/src/substitution/`, one call site in `packages/engine/src/readiness/compute.ts`), not a one-line tweak — flagging it plainly rather than understating it, since `findSubstitution` is re-exported from the package's public `index.ts` and any consumer calling it directly (none found outside `compute.ts` as of this design, per a repo-wide grep) would need updating too. `excludedIdentifiers` stays `ReadonlySet<TExclusionKey>` (a branded `string`, still trivially serializable, still zero DB dependency in the engine) — only its arity changed, not its type shape.

**Branding matters here, not just style.** Every call site that currently builds a bare-identifier `Set<string>` and passes it through compiles fine today; if the encoding changes but the type stays `Set<string>`, those call sites keep compiling while silently suppressing nothing (a rejected pair would never match a triple-encoded key). Branding `TExclusionKey` and requiring `ReadonlySet<TExclusionKey>` on `computeEffectiveReadiness`'s 5th parameter turns every un-migrated caller into a compile error. The same call sites also need the 6th parameter added now (§0 — `approvedIdentifiers`), so this table covers both in one pass:

| File | Line(s) | What it does today | What it needs now |
|---|---|---|---|
| `apps/api/src/decks/decisions/decisions.service.ts` | `loadExclusions` (153-159) | Returns `Set<string>` of bare rejected `cardIdentifier`. | Superseded — see §7. Replaced by a single `swap_suggestion` query per deck returning both `status = 'rejected'` and `status = 'approved'` rows, partitioned in memory into `excludedIdentifiers`/`approvedIdentifiers` (§0 step 1) — one round trip, not two. |
| `apps/api/src/collection/collection.service.ts` | 109, 116 | Consumes `loadExclusions` output as `excludedIdentifiers`. | Loads and passes both sets. |
| `apps/api/src/decks/decks.service.ts` | 921, 991 | Same — `updateComposition`'s in-transaction and post-commit readiness calls. | Loads and passes both sets; also the site where `currentDeckSlots` (§2) is naturally already available (`freshCards`/`deckInput.cards`), so reconciliation's slot-existence check is cheap to wire in here. |
| `apps/api/src/decks/test/test-deck.service.ts` | 192 | Test helper wrapping `computeEffectiveReadiness`. | Gains an `approvedIdentifiers` parameter (default empty, matching the engine's new default). |
| `apps/api/src/substitution/substitution.service.ts` | 46, 84, 92, 121 | `runReadiness`/`computeAndStoreReadiness`/`computeReadinessWithExclusions`. | All three gain the second set; `computeAndStoreReadiness` is the natural home for invoking `SwapsReconciliationService` after the compute call, since it's already the single choke point every recompute path routes through. |

---

## 5. Schema

### `substitute_decision` is superseded, not extended

The new row needs fields `substitute_decision` never had at all — `slot`, `substituteIdentifier` as a first-class column (today's `cardIdentifier` *is* the substitute id, with no room for the original), `quantity`, `confidence`/`tier`/`rationale` snapshot, `appliedAt`, `rejectedAt`/`rejectionReason`/`rejectionNote`, `outcome`. Extending the existing table would mean adding a nullable `originalCardIdentifier` column and reinterpreting the existing `cardIdentifier` column's meaning under a widened unique index — messier than a clean replacement, and the table already went through one full replacement before (`rejected_substitute` → `substitute_decision`, `apps/api/src/database/migrations/1776621085000-ReplaceRejectedSubstituteWithDecision.ts`) using exactly this same varchar+CHECK style. This design follows that precedent again: drop `substitute_decision`, create `swap_suggestion`.

### Entity

```ts
// apps/api/src/database/entities/swap-suggestion.entity.ts
@Entity({ name: 'swap_suggestion' })
@Index(['trackedDeckId', 'cardIdentifier', 'slot', 'substituteIdentifier'], { unique: true })
@Index(['trackedDeckId', 'status'])
export class SwapSuggestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  trackedDeckId!: number;

  @Column({ type: 'varchar', length: 128 })
  cardIdentifier!: string; // original card

  @Column({ type: 'varchar', length: 64 })
  slot!: string;

  @Column({ type: 'varchar', length: 128 })
  substituteIdentifier!: string;

  @Column({ type: 'int' })
  quantity!: number; // copies currently mapped to this group

  @Column({ type: 'smallint' })
  tier!: 1 | 2;

  @Column({ type: 'float' })
  confidence!: number; // 0-100, normalized (mirrors ReviewAggregateService.normalizeConfidence)

  @Column({ type: 'text' })
  rationale!: string;

  /**
   * varchar+CHECK, not a Postgres enum — same reasoning as substitute_decision's
   * original design note: a future state (e.g. a distinct "expired" state) is a
   * constraint replacement, not a drop-and-recreate of an enum type.
   */
  @Column({ type: 'varchar', length: 32 })
  status!: 'pending' | 'approved' | 'rejected' | 'retired';

  @Column({ type: 'timestamptz', nullable: true })
  appliedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  /** Enum, never the localized display string — the quoted reason in Recusadas
   *  must not freeze to whatever locale was active at rejection time. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  rejectionReason!: 'not_equivalent' | 'dont_own' | 'changes_plan' | 'prefer_original' | 'other' | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionNote!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  outcome!: 'worked' | 'did_not_work' | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @ManyToOne(() => TrackedDeckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trackedDeckId' })
  trackedDeck!: TrackedDeckEntity;
}
```

CHECK constraints, built with `queryRunner.createCheckConstraint(new TableCheck({...}))` exactly as `1776621085000-ReplaceRejectedSubstituteWithDecision.ts` does — never raw `ALTER TABLE` — and quoting camelCase column names (this repo's columns are camelCase throughout, e.g. `trackedDeckId`, `cardIdentifier`; snake_case would silently reference nonexistent columns):

```ts
await queryRunner.createCheckConstraint(
  'swap_suggestion',
  new TableCheck({
    name: 'CHK_swap_suggestion_status_valid',
    columnNames: ['status'],
    expression: `status IN ('pending', 'approved', 'rejected', 'retired')`,
  }),
);

await queryRunner.createCheckConstraint(
  'swap_suggestion',
  new TableCheck({
    name: 'CHK_swap_suggestion_rejection_reason_valid',
    columnNames: ['rejectionReason'],
    expression: `"rejectionReason" IS NULL OR "rejectionReason" IN ('not_equivalent', 'dont_own', 'changes_plan', 'prefer_original', 'other')`,
  }),
);

await queryRunner.createCheckConstraint(
  'swap_suggestion',
  new TableCheck({
    name: 'CHK_swap_suggestion_outcome_valid',
    columnNames: ['outcome'],
    expression: `outcome IS NULL OR outcome IN ('worked', 'did_not_work')`,
  }),
);
```

The migration class itself follows the same naming/timestamp-spacing convention `1776621085000`'s header documents (e.g. `CreateSwapSuggestion<epoch>`, spaced from neighboring migrations per that file's "Timestamp spacing note").

Indexes:
- `IDX_swap_suggestion_natural_key` — unique on `(trackedDeckId, cardIdentifier, slot, substituteIdentifier)`. This is the reconciliation lookup and the DB-level backstop against duplicate groups.
- `IDX_swap_suggestion_deck_status` — `(trackedDeckId, status)`. Powers tab counts and the exclusion-set query (`status = 'rejected'`).

Name/pitch/type/imageUrl for original and substitute are **not** stored on the row — they're resolved at read time from the in-process catalog (`CatalogService.getCard`), same pattern `ReviewAggregateService.lookupName`/`lookupType` already use (`review-aggregate.service.ts:449-470`). This keeps the row small and immune to catalog data changing under it (a snapshot approach here would go stale the same way legacy `substitute_decision` had no way to record it at all).

### Migration path for existing data — settled (D8, SWAP-15)

**Legacy `substitute_decision` rows are discarded, not reconstructed.** Neither `approved` nor `rejected` rows are carried forward into `swap_suggestion`. Consequences, stated plainly rather than left implicit:

- Aplicadas starts empty for every existing user on day one, including the ~47 in the closed pre-launch cohort.
- Every previously-rejected suggestion is proposed once more — SWAP-03's guarantee ("a rejected pair is never re-proposed while it stays rejected") restarts clean from this migration forward; it does not retroactively cover decisions made under the old model.

Two reconstruction approaches were considered and rejected, recorded here so the question isn't reopened: a best-effort join against each deck's latest `deck_readiness_snapshot.breakdown.substituted[]` to recover an `(original, slot)` pairing for legacy rejections, and a deck-wide wildcard carry-forward that skips the join entirely. Both were rejected for the same underlying reason — **the legacy table never recorded the original card or the slot**, only the substitute's identifier (§1), so anything beyond a guess risks exactly the "corrupting readiness" scenario the spec warns against, for a table that reconstructs, at best, an approximation of already-known-buggy suppression behavior (§1's cross-original suppression bug). Discarding is the only option that doesn't risk building new bugs on top of the old table's missing data.

**The old table is dropped in the same migration that creates `swap_suggestion`**, not staged across a release. This follows the repo's own precedent (`1776621085000-ReplaceRejectedSubstituteWithDecision.ts` dropped `rejected_substitute` and created its replacement in one migration, not two), and there's no operational reason to keep a now-orphaned table around at closed-beta scale. The migration's `down()` recreates the `substitute_decision` **table shape** for rollback safety, but **cannot restore its data** — the rows were deleted by `up()` and D8 is explicit that they are not reconstructed from anywhere. This has to be stated plainly in the migration file's own header comment (mirroring how `1776621085000`'s header documents its own design rationale), not left for the next reader to infer from a `down()` that silently produces an empty table where data used to be. Acceptable given the closed-beta, staging-adjacent scale the owner has already accepted for D7's analogous effect — but it's a one-way door, and the comment should say so in those terms.

---

## 6. The five endpoints

All under `apps/api/src/swaps/` (new module), pattern-matched to `DecisionsController`/`ReviewsController` (JWT via global `APP_GUARD`, ownership via a service-level assert, error envelope via the existing `HttpExceptionFilter` which already lifts a `code` field out of the exception payload — see `TOO_MANY_OPERATIONS` in `reviews.controller.ts` for the precedent).

**Ownership is opaque by design**, following `bulkUpsert`'s existing convention ("Opaque error — do NOT distinguish forbidden vs. not-found... to prevent enumeration"): a swap id that doesn't exist and a swap id that belongs to another user both produce the same 404, never a 403 that would confirm the id is valid but not theirs. Concretely, this means the lookup itself is scoped by user, not a separate check after an unscoped lookup — `swapRepo.findOne({ where: { id, userId } })` (using the row's denormalized `userId` column, same pattern `DecisionsService.assertOwnsDeck` uses via `TrackedDeckEntity`), not `findOne({ where: { id } })` followed by an `if (row.userId !== userId) throw Forbidden`. The latter is a common way to accidentally leak a 403 that confirms the id exists.

**Idempotency / state machine.** Every endpoint checks the row's current `status` before writing:

| Endpoint | Legal from | No-op (200, same response) | Illegal (409 `INVALID_TRANSITION`) |
|---|---|---|---|
| `POST /swaps/:id/approve` | `pending` | already `approved` | `rejected`, `retired` |
| `POST /swaps/:id/reject` | `pending` | already `rejected` **with the same reason** (see below) | `approved`, `retired` |
| `POST /swaps/:id/revert` | `approved` | already `pending` | `rejected`, `retired` |
| `POST /swaps/:id/restore` | `rejected` | already `pending` | `approved`, `retired` |
| `POST /swaps/:id/outcome` | `approved` | re-sending the same `outcome` value | any other status |

A repeat call never bumps `appliedAt`/`rejectedAt` — those are set once, on the transition into the state, not on every request that happens to match it. Re-rejecting with a *different* reason than what's stored is treated as an update (not idempotent no-op, not illegal) — it overwrites `rejectionReason`/`rejectionNote` and re-sets `rejectedAt`, since the reason panel can be reopened and resubmitted before the user navigates away (SWAP-08's in-place window).

### DTOs (class-validator, mirroring `DecisionCardIdentifierDto`/`UpsertDecisionDto`'s style)

```ts
// apps/api/src/swaps/dtos/reject-swap.dto.ts
export class RejectSwapDto {
  @IsOptional()
  @IsIn(['not_equivalent', 'dont_own', 'changes_plan', 'prefer_original', 'other'])
  reason?: 'not_equivalent' | 'dont_own' | 'changes_plan' | 'prefer_original' | 'other';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// apps/api/src/swaps/dtos/swap-outcome.dto.ts
export class SwapOutcomeDto {
  @IsIn(['worked', 'did_not_work'])
  outcome!: 'worked' | 'did_not_work';
}
```

`approve`, `revert`, `restore` take no body — the id in the path is the only input, matching the handoff's `POST /swaps/:id/approve` etc. shape literally.

### Controller

```ts
// apps/api/src/swaps/swaps.controller.ts
@Controller('swaps')
export class SwapsController {
  @Post(':id/approve')  approve(@Param('id') id: string, @CurrentUser() user): Promise<ISwapMutationResult>;
  @Post(':id/reject')   reject(@Param('id') id: string, @Body() dto: RejectSwapDto, @CurrentUser() user): Promise<ISwapMutationResult>;
  @Post(':id/revert')   revert(@Param('id') id: string, @CurrentUser() user): Promise<ISwapMutationResult>;
  @Post(':id/restore')  restore(@Param('id') id: string, @CurrentUser() user): Promise<ISwapMutationResult>;
  @Post(':id/outcome')  outcome(@Param('id') id: string, @Body() dto: SwapOutcomeDto, @CurrentUser() user): Promise<ISwapMutationResult>;
}
```

Every mutation returns the **full reconciled row set for the deck** (per §2's "reject cascades" finding), not just the touched row:

```ts
interface ISwapMutationResult {
  readonly deckId: number;
  readonly rows: readonly ISwapRow[]; // every swap_suggestion row for the deck, all statuses except retired
}
```

### Read endpoint

The handoff's "Endpoints implícitos" list (§10) only names the five mutations — it doesn't specify a list endpoint, implicitly assuming the existing `GET /api/reviews` keeps serving reads. This design makes that explicit rather than leaving it implicit: **`GET /api/swaps?state=pending|approved|rejected|all`** is the successor to `GET /api/reviews`, same query shape, now backed by a direct `swap_suggestion` query instead of `ReviewAggregateService.listSubstitutionRows`'s per-request derivation from snapshot JSONB + decision join. It additionally annotates each row with a live `ownedCount` for its `substituteIdentifier`, resolved from the same inventory map `computeEffectiveReadiness` would use — this is what makes the §2 "owned count drops to zero, don't retire" case visibly accurate rather than just quietly not-wrong. `GET /api/reviews` and the `decisions` sub-resource under `/decks/:trackedDeckId/decisions` are retired the same way the old `re-solve` controller was retired to 410 Gone stubs (`decisions.controller.ts`'s own doc comment references that precedent).

**Cache shape.** `GET /api/swaps` is cross-deck (rows from every tracked deck the user owns, same as today's `/api/reviews`), but every mutation endpoint returns rows scoped to one deck (§ "returns the full reconciled row set for the deck", above). The client-side cache update on a mutation response therefore replaces only that deck's slice of the cached cross-deck list — keyed by `trackedDeckId` — not the whole list, and not a single row.

---

## 7. Frontend

### Filter rail, bulk actions and the `all` tab — settled (D9, SWAP-14): all three survive

The handoff's Swaps section (§10) describes three tabs, a row layout, and the reject-reason panel — it draws no filter rail and no bulk-actions bar. The **currently shipped** `/swaps` route has both, confirmed against the live code: `ReviewsFilters` (tier/deck/hero/confidence-range chips), `ReviewsBulkBar` (multi-select bulk approve/reject/reset), and a genuine fourth tab — `ReviewsTabs`' `TTabValue = TReviewState | 'all'` (`ReviewsTabs.tsx:11`) renders `all` as a real pill (`{ value: 'all', label: t('reviews.tabAll') }`, `ReviewsTabs.tsx:51`), not a hidden filter state. The owner has confirmed all three survive, adapted into the handoff's layout — this section states how, and marks plainly what's invented versus carried forward as-is.

- **`all` tab**: kept as a **fourth tab pill**, styled with the handoff's tab visual language (gold active state, same `bg rgba(208,168,76,.14)` / `--acc` treatment FND-01 already establishes for nav) rather than demoted to a filter-rail toggle. This is the more conservative of two options considered — it preserves the exact existing information architecture (a real tab, not a repurposed affordance) and only changes the tab bar's skin, not its structure. **Invented**: the handoff only draws three tabs: a fourth pill alongside them, and its label/position in the row, are this design's addition.
- **Filter rail** (tier, deck, hero, confidence range): kept as a collapsible chip row between the tab bar and the row list. **Invented, but borrowed rather than freehand**: the handoff already specifies a chip/pill visual language elsewhere for filtering — Library's pitch chips and class/talent/set facets (handoff §7, referenced by LIB-01) — so this reuses that existing pattern's token surface (`--surface`, `--line`, `--acc` for the active/selected state) applied to Swaps' four filter dimensions, rather than inventing a new filter chrome. Collapsed behind a single "Filtros" trigger by default so it doesn't compete visually with the handoff's clean row list when unused.
- **Bulk actions**: kept, with one necessary behavior change flagged plainly. Today's `POST /api/reviews/bulk` (`DecisionsService.bulkUpsert`) is atomic — up to 200 operations in one DB transaction, all-or-nothing. The new lifecycle (§6) has no equivalent "upsert a decision" primitive; it has five status-scoped endpoints (approve/reject/revert/restore/outcome). A bulk action under the new model has to become **N sequential calls to whichever single endpoint matches the selected rows' current status and the chosen bulk action** (e.g. "bulk approve" only ever targets `pending` rows and calls `POST /swaps/:id/approve` once per selected id) — not one atomic transaction. This is a real reduction in the transactional guarantee compared to today: a bulk action can now partially succeed. The bulk bar surfaces this honestly rather than implying atomicity it no longer has — on completion it reports success/failure counts (e.g. "8 de 10 aprovadas — 2 falharam"), and failed rows stay selected so the user can retry. **Invented**: the partial-failure reporting UI itself; the underlying five-endpoint dispatch is a direct consequence of §6's endpoint design, not a new choice made here.

### Data layer changes

- `apps/web/src/api/reviews.ts` → superseded by `apps/web/src/api/swaps.ts`. `IReviewRow`/`ISwapRow` gain `id: string` (the server UUID), `slot: string`, `quantity: number`, `appliedAt: string | null`, `rejectedAt: string | null`, `rejectionReason: string | null`, `rejectionNote: string | null`, `outcome: 'worked' | 'did_not_work' | null`.
- `groupReviewRows` (`-swaps.helpers.ts`) is deleted — the API already returns one row per group (§3). `applyFilters`/`computeTabCounts`/`deriveUniqueDecks` are adapted to operate directly on `ISwapRow[]` instead of `IReviewRowGroup[]`.
- `TReviewRowId`/`makeReviewRowId` are deleted — the server UUID is the id, no client-side composite key construction needed anymore.

### Tabs and counts (SWAP-09)

Three tabs — Pendentes / Aplicadas / Recusadas — counts computed by `.filter(r => r.status === X).length` over the current row set, never hardcoded. `retired` rows are excluded from every count and every tab (§2 — invisible bookkeeping state).

### In-place confirmation with Desfazer (SWAP-08)

Implemented as **client-side state layered on top of server state**, per §2's "reject cascades" finding — not as "suppress the refetch":

```
justResolved: { rowId: string; action: 'approved' | 'rejected'; snapshotBeforeAction: ISwapRow } | null
justResolvedTab: TTabValue
```

On approve/reject: call the endpoint, receive the full reconciled row set, update the query cache with it (so a cascade is reflected everywhere else immediately), but keep the acted-on row rendered in its **original** tab position with an in-place banner ("Aprovada — aplicada ao deck" / "Rejeitada — não será sugerida de novo") and a Desfazer button, using `justResolved` purely as a rendering override — the underlying data already moved. Desfazer calls `revert`/`restore` respectively. The row migrates to its real tab only when `justResolved` is cleared — on tab switch or route remount, per the handoff's rule 3.

### Rejection reason panel (SWAP-06)

Five one-click reason chips + optional free-text note, both optional (handoff §10, "Feedback para a engine"). Reason values are the enum from §5/§6 (`not_equivalent | dont_own | changes_plan | prefer_original | other`) — the panel never sends or stores the localized chip label, only the enum key, so the quoted reason shown later in Recusadas is re-localized from `t('swaps.rejectionReason.' + row.rejectionReason)` at render time and follows the active locale, not the locale active when the user clicked the chip.

### Post-play outcome control (SWAP-10)

Two toggle pills (Funcionou / Não rolou) on applied rows, calling `POST /swaps/:id/outcome`. Optional — no default state renders as neither pill active.

### `SwapRow` component (SWAP-11, SWAP-12, SWAP-07 — adapting the handoff's layout)

One component renders every row in every tab; only its trailing action cluster varies by `status`, per the handoff's "Cluster de ações variável por estado" (§10). Fixed structure (handoff §10, SWAP-12):

- **Fixed 150px column**: deck name (clickable → deck detail) + `slot` value (e.g. "Attack · Red"), from the row's `slot` field.
- **Center pair**: outgoing card thumbnail (`CardArt`, not a gradient placeholder — see Code Reuse Analysis) struck through at `opacity .5`, arrow-in-circle divider, incoming card thumbnail (`CardArt`) with the stronger gold border. Both resolved from `cardIdentifier`/`substituteIdentifier` via `CatalogService.getCard` at read time, not stored on the row (§5).
- **90px confidence column**: `confidence` value, colored by band — `≥90` → `--ready`, `70–89` → `--acc`, `<70` → `--warn`. This is a pure display mapping over the row's stored `confidence`, independent of `tier` (tier and confidence band are related but not identical — tier is the engine's internal search-tier classification, confidence band is the display threshold from the handoff).
- **`× N` badge** next to the substitute's name when `quantity > 1` (carried forward from the currently-shipped Reviews row design), and every action label in the trailing cluster reflects the group scope explicitly (e.g. "Aprovar" becomes "Aprovar (× 3)" when `quantity > 1`) so the single decision's blast radius is visible before the user clicks it (SWAP-11).
- **Trailing action cluster, by `status`**:
  - `pending` → Aprovar, Recusar (opens the reason panel in-row).
  - `approved` (Aplicadas tab) → elapsed-time label ("há 3 dias", §7 below) + Reverter, and the post-play outcome pills.
  - `rejected` (Recusadas tab, SWAP-07) → row renders at `opacity .6`; the stored `rejectionReason` re-localized and shown in quotes (`"{{reason}}"`) next to the elapsed time since `rejectedAt`; `rejectionNote` shown below if present; a Restaurar action. When `rejectionReason` is `null` (user rejected without picking one, per the edge case "a rejection without a reason SHALL succeed and the Recusadas tab SHALL render without a quoted reason") the quoted-reason span is omitted entirely, not rendered as an empty pair of quotes.

### Elapsed time ("há 3 dias")

No existing helper for this in the repo (checked — not found), and no dedicated i18next relative-time plugin is installed. Checked the repo's browser-target assumptions directly rather than leaving this unverified: there is no `browserslist` config anywhere in the repo (checked `apps/web/package.json` and root `package.json`), so there's no formal baseline to fail against — but `design/01-foundation.md` (§1.4) already specifies dark-theme tokens using CSS `color-mix(in oklch, ...)`, a 2023-era feature. `Intl.RelativeTimeFormat` has been supported in every evergreen browser since 2020, strictly older than what the redesign's own foundation phase already assumes elsewhere, so there's no independent browser-support risk in using it here.

**Recommendation, revised from the earlier draft of this section: `Intl.RelativeTimeFormat`, but wired through i18next's formatter API, never called bare.** The app already routes every other string through `i18next`/`react-i18next` (`apps/web/src/i18n/index.ts`), including a live language switch that updates `i18n.language` and `document.documentElement.lang` at runtime (Settings' language toggle, per the i18n bootstrap's own doc comment). A standalone `new Intl.RelativeTimeFormat('pt-BR')` call with a hardcoded locale would not react to that switch — the elapsed-time string would stay frozen to whatever locale was active when the component first rendered, which is a real, findable bug, not a style nitpick. Instead, register a custom i18next formatter once, at bootstrap, keyed off the active language:

```ts
// apps/web/src/i18n/index.ts, alongside the existing i18n.on('languageChanged', ...) registration
i18n.services.formatter?.add('relativeTime', (value: Date, lng) => {
  const diffSeconds = (value.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
  // unit selection (days vs hours vs "agora") lives in one small helper here,
  // not duplicated at every call site.
  return formatRelativeTimeUnit(rtf, diffSeconds);
});
```

used in catalog strings as `t('swaps.elapsedSince', { date: row.appliedAt, formatFn: 'relativeTime' })` (i18next's standard formatter-interpolation syntax). This keeps elapsed time inside the same localization pipeline as every other string in the app, reacting to the language toggle exactly like the rest of the UI, and needs no new catalog entries beyond the one interpolation key — no per-unit `_one`/`_other` plural table (that convention is reserved for count-based pluralization elsewhere in `reviews.ts`, e.g. `selectedCount_one`/`_other`; relative-time unit selection is `Intl`'s job, not the catalog's).

### i18n

Every new string needs both catalogs (cross-cutting requirement 1). Extending `apps/web/src/i18n/locales/{pt-BR,en-US}/reviews.ts` (existing namespace for this route) rather than introducing a new namespace, to minimize churn: in-place confirmation banners, Desfazer, the five rejection-reason chip labels, the reason-panel copy, the outcome pills, "× N" action labels, elapsed-time units (if the catalog route is chosen over `Intl.RelativeTimeFormat`), and the retired-row absence (no user-facing copy needed — retired rows render nowhere).

---

## 8. Error handling strategy

| Scenario | Handling | User impact |
|---|---|---|
| Swap id not found, or belongs to another user | `404` (opaque — same response for both cases, per `bulkUpsert`'s enumeration-prevention precedent) | Generic "not found" toast; row disappears from the client's optimistic list if present |
| Illegal state transition (e.g. approve an already-rejected row) | `409` with `{ code: 'INVALID_TRANSITION', message }`, lifted into the envelope by `HttpExceptionFilter` | Toast explaining the row already moved; client refetches to resync |
| Reject with an invalid `reason` enum value | `400` (class-validator `@IsIn`) | Form-level validation error, no request sent in the normal flow (client validates before submit) |
| Recompute fails inside a mutation's transaction (e.g. catalog lookup throws) | Whole transaction rolls back — the status write and the reconciliation must commit together or not at all, since a committed status change with an un-reconciled deck is the exact "silent bug" AD-006 warns about | `500`, generic error toast, row state unchanged |
| A deck's latest snapshot is missing when reconciliation needs it (never computed yet) | Treat as zero fresh groups — every persisted row for that deck retires | Deck shows no swap suggestions until the next full readiness compute runs |

---

## 9. Test strategy per layer

**Engine (`packages/engine`, unit, `.spec.ts`):**
- `buildExclusionKey` round-trips and is stable for the same pair regardless of call order.
- `findTierMatch`/`findSubstitution`: a triple-keyed exclusion `(original, slot, substitute)` now suppresses only that exact position — two fixtures, both regression tests for gaps fixed in §4 that never existed as requirements before this design:
  - Same substitute is a valid match for two *different original cards*: reject it for one, assert the other still proposes it (the original bug — suppression used to be substitute-only).
  - Same original card occupies *two different slots*, both proposing the same substitute: reject the substitution in one slot, assert the other slot's suggestion is untouched (the reason §4's key became a triple instead of a pair — without this case in the suite, a pair-keyed implementation would pass every other test and still ship the bug §4 exists to prevent).
  - Fallback preserved: construct a fixture where the top-scoring candidate is triple-excluded but a lower-tier candidate is still valid; assert the engine returns the fallback candidate rather than reporting the card as fully missing (the reason the exclusion check lives inside `findTierMatch`'s loop, not as a post-filter in `compute.ts`).
- `computeEffectiveReadiness`: existing per-copy expansion tests stay green unchanged (Pass 2 loop untouched); add a case asserting two copies of the same original can resolve to two different substitutes when inventory of the first substitute is exhausted mid-loop (grounds the "one row per group, not per original card" decision in §3).
- New cases for §0's `approvedIdentifiers` gating: a found match with an empty `approvedIdentifiers` set does not count toward `effectivePercent` (the new default); the same match with its key present in `approvedIdentifiers` does count; `ISubstitutedEntry.approved` reflects the flag correctly on both; `notOwned` is identical in both cases (proves the gating doesn't leak into ownership accounting); inventory is consumed identically in both cases (proves gating doesn't change *which* substitute is chosen, only whether it counts).

**Existing tests this design invalidates or requires updating — found by search, not assumed:**

`packages/engine/__tests__/readiness.spec.ts` currently asserts `effectivePercent === 100` (or another value that assumes every found substitution counts) with no concept of approval, because that concept didn't exist before this design. Every one of these needs either a passed-in `approvedIdentifiers` covering the fixture's matches (to keep asserting the old ceiling value where that's still what the test is about) or an updated expected value (where the test's real subject is the new gating itself):
- `'performs a single tier 1 substitution for a missing mainboard card'` (~line 120) — asserts `effectivePercent === 100` from a bare match with no approval step.
- `'rejects substitution when pitch curve tolerance would be exceeded'` (~line 286) — the in-tolerance counterpart also asserts 100 on a bare match.
- `describe('path field')` → `'returns Path B when all missing copies are covered by substitutions'` (~line 344) — Path itself is unaffected (§0), but its `effectivePercent === 100` assertion is not.
- `describe('fidelityPercent field (Path C)')` → `'returns Path B with tier-1-weighted fidelity below 100 when substitutions cover all missing'` (~line 438) — `fidelityPercent`'s own assertion is unaffected (§0 — fidelity is deliberately not gated), but its `effectivePercent === 100` assertion is.
- `describe('tier 2 substitution in readiness')` → `'falls through to tier 2 when no tier 1 candidate is available'` (~line 488) — same pattern.
- `'(regression) rawPercent, effectivePercent, slot, quantity are unchanged by U11'` (~line 746) — this test's actual purpose (proving an unrelated enrichment change, U11, didn't alter substitution behavior) is still valid; recommend passing `approvedIdentifiers` covering every match in its fixture so the assertion stays decoupled from D7's concern rather than conflating two unrelated regressions in one expected value.
- `describe('excludedIdentifiers parameter (re-solve)')` → `'empty exclusion set matches the default no-exclusion behavior'` (~line 603) — a *differential* comparison (`withEmptySet.effectivePercent` vs `withoutArg.effectivePercent`), not an absolute value; likely unaffected since both sides compute under the same (absent) approval state, but flagged to verify against the exact fixture rather than assumed safe.

`apps/api/src/__tests__/plan-b-full-flow.e2e-spec.ts` (DB-backed, **CI-only**) is the one test outside `packages/engine` that exercises the real pipeline end-to-end rather than a mocked `computeEffectiveReadiness` — and its own comments document the exact pre-D7 assumption as intended behavior: *"Approval keeps the substitute active — effectivePercent should stay [the same/≥]"* (steps 6-8, ~lines 321-401). Under D7 this is backwards: `effectivePercent` should be **lower before approval and rise after it**, not stay flat. This test needs a real rewrite of that assertion, not a value tweak — its step 10 (source toggle removes inventory, `effectivePercent` should drop, ~line 401) is orthogonal to D7 and stays correct as-is.

**Checked and confirmed *not* invalidated**, so the next reader doesn't have to re-derive this: `apps/api/src/collection/__tests__/collection.service.spec.ts`, `apps/api/src/decks/__tests__/orphan-cleanup.spec.ts`, `apps/api/src/decks/__tests__/decks.service.update-composition.spec.ts`, and `apps/api/src/substitution/__tests__/substitution.service.spec.ts` all `jest.mock` `computeEffectiveReadiness` at the module boundary — their fixtures assign `effectivePercent`/`rawPercent` directly rather than deriving them from the real function, so D7's internal semantic change doesn't reach them. They only need their **production call sites** updated to pass the new 6th argument (§0's pipeline-order table) — `decks.service.update-composition.spec.ts:563` (`expect(firstCallArgs[4]).toBeInstanceOf(Set)`) specifically should gain a sibling assertion for `firstCallArgs[5]` once that argument exists, since the file already asserts on call-argument shape and would otherwise silently stop covering it. `apps/api/src/reviews/__tests__/review-aggregate.service.spec.ts` and `apps/api/src/reviews/__tests__/state-transition-matrix.spec.ts` carry `effectivePercent`/`rawPercent` in their fixtures too, but the functions under test (`deriveVerdictAndBracket`, `deriveCounters`) only read `breakdown.missing.length`/`breakdown.substituted.length` — never the percent values — so these fixtures are inert with respect to D7. Every `apps/web` test file that references a readiness percentage (`StatusShelves.spec.tsx`, `DeckCard.spec.tsx`, `PopulatedHomeHero.spec.tsx`, `DeckDetailSidebar.spec.tsx`, `ReadinessHero.spec.tsx`, and others found by search) consumes a mocked API response, never the engine directly — `apps/web` has no dependency on `@rathe-arsenal/engine` anywhere near readiness code (confirmed by search; its only two engine imports, `HeroDropdown.tsx` and `useCascadeCheck.ts`, are catalog lookups unrelated to substitution). These files are not invalidated by this design, but their fixture *values* will eventually need review once real API responses reflect D7's new numbers — that review belongs to the Home and Deck detail phases' own build sessions, since they own those fixtures, not to this design.

**API (`apps/api`, unit + e2e):**
- `reconcileSwapSuggestions` (pure function, §2): exhaustive table-driven unit tests, no database — every branch as a separate case: insert, update-in-place, un-retire, retire-pending (position left the deck), retire-approved-orphan (position left the deck), rejected-untouched, **and the two cases that must be visibly distinguished from each other**: (a) unmatched row whose `(cardIdentifier, slot)` is absent from `currentDeckSlots` → `retire` mutation, versus (b) unmatched row whose `(cardIdentifier, slot)` is still present in `currentDeckSlots` (substitute currently at zero owned) → no mutation at all, row unchanged. (b) is the direct test for the spec's "row SHALL still render... rather than disappearing silently" edge case; without a test asserting *no mutation*, an implementation that retires on every unmatched row would still pass every other case in this list. Plus the "no persisted rows + no fresh groups" and "many persisted rows, one fresh group" edges.
- `SwapsController` unit tests (mocked service) for the idempotency/state-machine table in §6 — one test per legal/no-op/illegal cell.
- `SwapsController` **e2e** (`.e2e-spec.ts`, DB-backed, **CI-only** per this repo's documented local-Postgres gap): approve → revert → reject → restore full lifecycle against a real deck, asserting `swap_suggestion` rows and recomputed readiness at each step (readiness assertions here follow §0's gated semantics, not the old ones); the reject-cascade scenario (rejecting one pair changes another row).
- Migration test: run `up` against a seeded `substitute_decision` table (which `up` drops entirely, so there is nothing left to query on that table), and assert `substitute_decision` no longer exists while `swap_suggestion` exists and is empty (D8 — discard, not reconstruct; the backfill script above is a separate, subsequent step, not part of `up` itself). Run `down` and assert it recreates the `substitute_decision` table shape with **zero rows** — the assertion is specifically that `down` does not error and does not fabricate data, not that it restores the pre-migration state, since §5 is explicit that restoration is impossible.
- Backfill script test: seed several tracked decks (with and without substitutable gaps), run the script against a test database, assert `swap_suggestion` contains exactly the expected pending rows per deck and `deck_readiness_snapshot` reflects the new D7-gated numbers.

**Web (`apps/web`, component/unit, Vitest + Testing Library, no Playwright browser needed for these):**
- `reconcileSwapSuggestions`-adjacent pure helpers (`applyFilters`, `computeTabCounts` adapted for §7) — direct port of existing test coverage for `-swaps.helpers.ts`, updated for the new row shape.
- In-place confirmation: approve a row, assert it renders the confirmation banner in its original tab position, assert tab counts update immediately, assert switching tabs migrates it, assert Desfazer calls `revert` and clears the override.
- Rejection reason panel: submit each of the five chips plus the no-reason path, assert the DTO sent matches the enum (never the localized label).
- `× N` grouping: seed a `quantity > 1` row, assert the badge and the action label.
- i18n catalog completeness: this repo already has a `catalog-parity.spec.ts` (`apps/web/src/i18n/__tests__/`) — every new key added to `reviews.ts` must appear in both `pt-BR` and `en-US` or that suite fails, which is the existing enforcement mechanism for cross-cutting requirement 1 (no new test needed, just don't break the existing one).

---

## 10. Summary — resolved decisions and what's still genuinely open

### Resolved by the owner this round (D7/SWAP-13, D8/SWAP-15, D9/SWAP-14)

- **Readiness gating (§0).** Only approved substitutions count toward `effectivePercent`/`pct`. Designed concretely: a branded second set (`approvedIdentifiers`, same `TExclusionKey` encoding as exclusion), a new `ISubstitutedEntry.approved` field, `fidelityPercent` and `rawPercent` and `path` explicitly left ungated, and the resulting DECK-04 tension (Path B completeness vs. a sub-100 `pct`) handed off precisely rather than resolved here (see "still open," below).
- **Legacy migration (§5).** Discard, don't reconstruct — both `approved` and `rejected` legacy rows. Two reconstruction approaches were considered and rejected on the record. Old table dropped in the same migration; `down()` cannot restore the discarded data and must say so in its own header comment.
- **Filter rail, bulk actions, `all` tab (§7).** All three survive, adapted into the handoff's layout: `all` as a fourth tab pill, the filter rail as a collapsible chip row borrowing Library's existing chip visual language, bulk actions re-dispatched as N single-endpoint calls with honest partial-failure reporting (down from today's atomic transaction — a real, flagged reduction in guarantee, not silently absorbed).
- **Elapsed time (§7).** `Intl.RelativeTimeFormat`, wired through a custom i18next formatter keyed to `i18n.language` rather than called bare — verified against the repo's actual (nonexistent) browserslist config and against `design/01-foundation.md`'s own newer CSS baseline, not left unverified.

### Resolved without needing an owner call (determinable from the code)

- **Natural key includes `slot` (§2)** — `deck_card` has no constraint preventing duplicate `(cardIdentifier, slot)` pairs.
- **A substitute dropping to zero owned copies does not retire its row (§2)** — the spec's edge case forbids the row disappearing; it's a display-time concern at `GET /api/swaps`, not a reconciliation-time one.
- **The exclusion key is a triple, not a pair (§4)** — a pair-only key would let one slot's rejection silently retire an untouched sibling row in a different slot.
- **The current rejection-suppression mechanism suppresses by substitute-card-only, not by pair (§1, §4)** — a pre-existing bug, not new scope; AD-006's "rejected-pair suppression input" phrasing is what requires fixing it here.

### Still genuinely open — needs a call from outside this document

1. **The DECK-04/CMP-01 tension §0 surfaces.** A deck can now be Path B (no missing cards, substitutions cover the gap) while `pct` sits below 100 because those substitutions are pending. Whether the Deck detail status strip's "complete" tone should key off Path (today's behavior, unaffected by this design) or additionally require `pct === 100` is a call for that story's own design doc — this document only makes the disagreement visible.

The compatibility shim and its required backfill script (see "Landing sequence," above) are designed, not flagged as pending a call — the coordinator asked for the shim's design, not for permission to have one.

---

## 11. Code Reuse Analysis

### Existing components/services to leverage

| Component | Location | How to use |
|---|---|---|
| `CardArt` | `apps/web/src/components/card-art/CardArt.tsx` (per DECK-08, which mandates it for decklist thumbnails) | `SwapRow`'s outgoing/incoming thumbnails use the same component and fallback chain — not a gradient placeholder, matching DECK-08's requirement for the sibling Deck detail story. |
| `ReviewsTabs` | `apps/web/src/components/reviews/ReviewsTabs.tsx` | Restyled to the handoff's tab visuals; the three-state `TTabValue` contract (pending/approved/rejected) carries over, with `all` added as a filter-rail option rather than a fourth tab pill (§7). |
| `ReviewsFilters` | `apps/web/src/components/reviews/ReviewsFilters.tsx` | Kept per §7's regression-surface flag; restyled, logic (`applyFilters`) adapted to read `ISwapRow[]` directly instead of `IReviewRowGroup[]`. |
| `ReviewsBulkBar` | `apps/web/src/components/reviews/ReviewsBulkBar.tsx` | Kept per §7; its bulk operations need a shape change from `IBulkReviewOperation` (deck+card+decision) to swap-id-scoped (the new model has no "upsert a decision for a card" primitive — bulk actions become "call approve/reject for each selected swap id"). |
| `Toast` (`useToast`) | `apps/web/src/components/ui/Toast/useToast.ts` | Error/success feedback for all five mutations, same as the existing Swaps page already uses it. |
| `CatalogService.getCard` / `lookupName` / `lookupType` pattern | `apps/api/src/reviews/review-aggregate.service.ts:449-470` | The read-time name/type/image resolution pattern for `swap_suggestion` rows (§5 — rows don't store card metadata, they resolve it fresh). |
| `AuthzService.assertOwnsTrackedDeck` | `apps/api/src/auth/authz.service.ts` (used by `SubstitutionService`) | Deck-level ownership check reused wherever a swap mutation needs to assert the *deck* is the user's before running a recompute — separate from the row-level ownership check in §6, which is scoped by the row's own `userId` column. |
| `HttpExceptionFilter` | `apps/api/src/common/filters/http-exception.filter.ts` | Existing global filter already lifts a `code` field out of thrown `HttpException` payloads into the response envelope — reused as-is for `INVALID_TRANSITION` (§8), no new filter needed. |
| `_one`/`_other` plural catalog convention | `apps/web/src/i18n/locales/{pt-BR,en-US}/reviews.ts` | Followed for any new catalog entries this story adds (elapsed-time units, if that path is chosen over `Intl.RelativeTimeFormat`; `× N` action labels). |
| `catalog-parity.spec.ts` | `apps/web/src/i18n/__tests__/catalog-parity.spec.ts` | Existing enforcement for cross-cutting requirement 1 — no new test needed. |

### Integration points

| System | Integration method |
|---|---|
| `packages/engine` | Two exported functions gain a `slot` parameter (`findSubstitution`, `findTierMatch`); one new exported helper (`buildExclusionKey`); `compute.ts`'s Pass 2 call site passes `deckCard.slot` through. No new exports beyond `buildExclusionKey`/`TExclusionKey`. |
| `deck_readiness_snapshot` | Unchanged — still written by every recompute call site, still the source for `path`/`fidelityPercent` derivation (`SubstitutionService.deriveSnapshotFields`). `swap_suggestion` is a parallel table, not a replacement for the snapshot. |
| `review_aggregate` | Unchanged — its `verdict`/`bracket`/`counters` are derived from the snapshot's breakdown JSONB, independent of swap decision state; this story does not touch `ReviewAggregateEntity` or `ReviewAggregateService.computeForDeck`. |
| Every recompute call site (§6 exclusion-set table) | Each now also invokes `SwapsReconciliationService` after computing fresh readiness, inside the same transaction where one exists (`updateComposition`) or as the next statement where one doesn't (`SubstitutionService.computeAndStoreReadiness`, `DecisionsService.bulkUpsert`'s post-commit loop — this last one is itself retired per §6, but any successor bulk-write path needs the same reconcile-after-recompute discipline). |

---

## 12. Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Persist per-copy or per-group | Per-group (§3) | AD-007 explicitly delegated this to this design; per-group is the only choice that satisfies SWAP-11 without a second grouping layer, and it makes the persisted id the id the API exposes. |
| Natural key arity | Quadruple: `(trackedDeckId, cardIdentifier, slot, substituteIdentifier)` (§2) | `deck_card` has no constraint preventing the same card in two slots; a triple would silently merge two independent decisions. |
| Suppression key arity | Triple: `(original, slot, substitute)` (§4) | Matches the row's natural key; a pair-only key would let one slot's rejection silently retire a different slot's untouched pending row. |
| Where the suppression check lives | Inside `findTierMatch`'s candidate loop, not a post-filter in `compute.ts` (§4) | Preserves the existing tier-1→tier-2 fallback behavior; a post-filter would report a card as fully missing instead of falling back to the next viable candidate. |
| `substitute_decision` extended or superseded | Superseded — new `swap_suggestion` table (§5) | The new row needs fields the old table has no room for (`slot`, a first-class substitute column, `quantity`, lifecycle timestamps); the repo already has precedent for a full table replacement over an in-place extension (`rejected_substitute` → `substitute_decision`). |
| Card metadata (name/pitch/image) on the row | Not stored — resolved at read time from the catalog (§5, §11) | Matches the existing `ReviewAggregateService` pattern; avoids the row going stale if catalog data changes, and avoids a second place recording data the catalog already owns. |
| Rejection reason storage | Enum key, never the localized label (§5, §7) | The quoted reason in Recusadas must track the active locale at render time, not freeze to whichever locale was active when the chip was clicked. |
| Retirement condition for an unmatched row | Only when `(cardIdentifier, slot)` has left the deck; never for "substitute currently at zero owned" (§2) | Directly required by the spec's edge case forbidding a silently-disappearing row; the zero-owned case is a display concern, not a lifecycle one. |
| Legacy data migration, `approved` and `rejected` rows alike | Both dropped, not migrated (§5, D8) | No original-card/slot was ever recorded for either; a wrong reconstructed guess risks corrupting readiness, which the spec explicitly warns against. Old table dropped in the same migration, `down()` cannot restore the data. |
| GET list endpoint | New `GET /api/swaps`, successor to `GET /api/reviews` (§6) | The handoff's endpoint list only names the five mutations; a list endpoint is required by the frontend and this makes the assumption explicit rather than silently inheriting the old route. |
| Filter rail / bulk bar / `all` state | Kept, restyled (§7, D9) | Spec's cross-cutting goal requires nothing shipped regresses; confirmed shipped behavior, not the handoff's silence being read as removal. |
| Readiness-gating input shape | Second branded set, `approvedIdentifiers: ReadonlySet<TExclusionKey>` (§0, D7) | Mirrors `excludedIdentifiers`'s existing shape and the slot-aware branding from §4; two sets keep each call site's intent legible (don't-find vs. do-count) rather than merging into one richer decision map. |
| Whether `fidelityPercent` gates by approval | No — deliberately unchanged (§0) | D7/SWAP-13 says "effective percentage" specifically; extending gating to fidelity is a separate decision left to whichever story owns that number's display. |
| Half A / Half B landing order | Half A ships ahead of Home and Deck detail, not just ahead of Half B; a temporary compatibility shim plus a mandatory `backfill-swap-suggestions.ts` script (booting a bare Nest context, same pattern as `variant-queue-worker.ts`) keep the old Swaps screen populated and every deck's `pct` dropping uniformly at deploy time, in the gap before Half B lands (Landing sequence section) | Home/Deck detail render `pct`/`raw`/`fidelity` and would need fixture rewrites if built against pre-D7 numbers; the shim alone leaves the old screen empty and readiness numbers stale until each deck happens to recompute — the backfill is what actually delivers the "every deck drops on deploy" behavior D7 describes, and both together avoid a broken intermediate state, matching the repo's every-phase-committable convention. |

---

## 13. Requirement Traceability

| Requirement | Section(s) |
|---|---|
| SWAP-01 (stable id surviving recompute) | §2, §5 |
| SWAP-02 (retire, never delete) | §2 |
| SWAP-03 (rejected pair excluded from re-proposal) | §4 |
| SWAP-04 (approval applies to deck, contributes to readiness, records `appliedAt`, appears in Aplicadas) | §0 (readiness contribution — cross-workstream), §5 (`appliedAt`), §6, §7 |
| SWAP-05 (revert undoes swap, readiness recomputes, row returns to Pendentes) | §0, §6 (state machine), §7 |
| SWAP-06 (rejection reason panel, both fields optional) | §5 (`rejectionReason`/`rejectionNote`), §6 (`RejectSwapDto`), §7 |
| SWAP-07 (rejected row at `opacity .6`, quoted reason, Restaurar) | §7 (`SwapRow`) |
| SWAP-08 (in-place confirmation + Desfazer, migrates on tab switch/remount) | §2 ("reject cascades" / "restore phantom"), §7 |
| SWAP-09 (tab counts derived from real state) | §7 |
| SWAP-10 (post-play outcome control) | §5 (`outcome`), §6 (`SwapOutcomeDto`), §7 |
| SWAP-11 (`× N` grouping, one decision for all copies) | §3, §7 (`SwapRow`) |
| SWAP-12 (row visual contract: struck-through outgoing, gold-bordered incoming, slot, confidence band color) | §7 (`SwapRow`) |
| SWAP-13 (only approved substitutions count toward the effective percentage; pending never inflates it) | §0 (in full — Half A) |
| SWAP-14 (filter rail, bulk actions, `all` tab survive, adapted into the handoff's layout) | §7 (Half B) |
| SWAP-15 (legacy `substitute_decision` rows discarded, not mapped forward) | §5 (Half A) |
| Edge case: substitute's owned count drops to zero → row still renders, accurate count | §2, §6 (`GET /api/swaps` live `ownedCount`) |
| Edge case: approved suggestion's slot removed by a deck edit → retired, readiness not corrupted | §2 |
| Edge case: rejection without a reason succeeds, no quoted reason shown | §7 (`SwapRow`) |
| Edge case: same substitution rejected in deck A still proposable in deck B | §4 (exclusion set is built and scoped per-deck) |
| Cross-cutting 1 (i18n both locales) | §7 |
| Cross-cutting 2 (touch target / focus visibility, no banned anti-patterns) | Not addressed here — owned by the shared component library / design-token work in the Foundation story (FND-01..07); `SwapRow`'s new interactive elements (reason chips, outcome pills, Desfazer) must be built against those tokens once they exist, not invented locally. |
