# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-010 - Pin both sides of every numeric threshold in a decision rule: assert the last accepted value and the first rejected one.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web,state-machine` · harmful: 0
- features: card-scanner
- evidence: verification round 1: VOTE_WINDOW 6->7 and REARM_AFTER_MISSES 3->2 survived (scan-session.spec.ts:48,72) (web,state-machine)
- last seen: 2026-10-04T16:33:36Z

### L-011 - Prove query-selection logic against the real database with one row that must be excluded and one row that must not be counted twice; a mock that returns canned rows cannot fail on the query.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api,repo-layer` · harmful: 0
- features: card-scanner
- evidence: verification round 1: affected-deck query without card filter or DISTINCT survived (collection.service.ts:540-541) (api,repo-layer)
- last seen: 2026-10-04T16:33:36Z

### L-012 - Assert which layer rejected an invalid input, not only the status code, because implicit type conversion can make a validator unreachable while a later check returns the same status.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api,validation` · harmful: 0
- features: card-scanner
- evidence: verification round 2: @IsString replaced by @Allow survived (add-cards-batch.dto.ts:17, collection-batch.e2e-spec.ts:206) (api,validation)
- last seen: 2026-10-04T16:33:36Z

### L-013 - When a check claims an order (oldest first), seed at least two rows whose order the query must decide, or a reversed ORDER BY survives.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/api/queue` · harmful: 0
- features: card-recommendations
- evidence: round1 F1 recommendation-queue.service.ts:92 (apps/api/queue)
- last seen: 2026-10-06T22:18:11Z

### L-014 - Compute timestamps a test compares with the database clock in SQL (clock_timestamp), never with Date.now() in the app, or host and container clock skew makes the bound flaky.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `apps/api/e2e` · harmful: 0
- features: card-recommendations
- evidence: round1 C20/C21 recommendation-worker.e2e-spec.ts:198 (apps/api/e2e)
- last seen: 2026-10-06T22:18:11Z

### L-015 - Keep a process entry point to a boot plus one exported function, and prove the entry point itself with the framework factory mocked, or its wiring survives every fault.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/api/worker` · harmful: 0
- features: card-recommendations
- evidence: round2 N6b/N6c variant-queue-worker.ts main() (apps/api/worker)
- last seen: 2026-10-06T22:18:11Z

### L-016 - Pin a new table's column type, length, nullability and default from one shared table, compared against both the migration and a synchronize build of the entities.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/api/migrations` · harmful: 0
- features: card-recommendations
- evidence: round2 N8, round3 M1 recommendation-columns.ts (apps/api/migrations)
- last seen: 2026-10-06T22:18:12Z

### L-017 - Before freezing a plan's Surface and Landing, diff every field and column type against the binding design, and log each intended difference as a deviation.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `plan` · harmful: 0
- features: card-recommendations
- evidence: round1 binding sources run.status, error text (plan)
- last seen: 2026-10-06T22:18:12Z

### L-018 - To prove a windowed aggregate (median of the latest N), seed enough out-of-window rows to change the answer if the window flips or the limit goes away; one outlier cannot move a median.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api/aggregates` · harmful: 0
- features: recommendations-rail
- evidence: apps/api/src/recommendations/recommendations.service.ts ORDER BY finishedAt DESC (api/aggregates)
- last seen: 2026-10-11T06:03:48Z

### L-019 - For each animation criterion, write a negative case (when it must not play) and a timing case (state just after the trigger), not only the end state.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `web/animation` · harmful: 0
- features: recommendations-rail
- evidence: AC 26, AC 31, AC 33 (web/animation)
- last seen: 2026-10-11T06:03:48Z

### L-020 - A proof through a path that catches and logs its own failure (deck import recompute) must assert the side effect, such as a new snapshot row, never only the HTTP status.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/api` · harmful: 0
- features: swaps-into-alternatives
- evidence: apps/api/src/decks/import/decks-import.service.ts:205 (apps/api)
- last seen: 2026-10-11T09:06:13Z

### L-021 - A removal proof written as a negated git grep must exclude test files that name the removed thing to assert its absence, and must be run once before the checks are approved.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: swaps-into-alternatives
- evidence: checks.md C34, C36 (checks)
- last seen: 2026-10-11T09:06:13Z

### L-022 - Before naming a single test with -t as a proof, run it alone; int-specs whose tests share one seeded schema must be proven as the whole file.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: swaps-into-alternatives
- evidence: checks.md C35 (checks)
- last seen: 2026-10-11T09:06:13Z

### L-023 - Pin every numeric bound at its exact edge, one case on each side, not with a value well past it
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: ai-chat
- evidence: verification round 1 F3, chat-history.ts:3 (tests)
- last seen: 2026-10-11T19:18:34Z

### L-024 - Prove the step that branches on a due check, not only the due check it calls
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `worker` · harmful: 0
- features: ai-chat
- evidence: verification round 1 F4, reference-step.ts:17 (worker)
- last seen: 2026-10-11T19:18:34Z

### L-025 - Drive a dispatcher's refusal path through the real dispatcher, never through a stub that throws the expected error
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: ai-chat
- evidence: verification round 1 C51, chat-tools.ts:169 (tests)
- last seen: 2026-10-11T19:18:34Z

### L-026 - Derive every UI state check from the binding mockup frame that draws it, never from memory of the flow: an applied-swap card drew Desfazer and the check said Abrir deck.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `apps/web ui checks` · harmful: 0
- features: ai-chat-screens
- evidence: C29 / AC 35 (verification round 1) (apps/web ui checks)
- last seen: 2026-10-12T04:32:55Z

### L-027 - Feed ordering tests their input out of order; a fixture already sorted cannot fail when the sort is removed.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/web tests` · harmful: 0
- features: ai-chat-screens
- evidence: ChatThread.spec.tsx C12 (round 1) (apps/web tests)
- last seen: 2026-10-12T04:32:55Z

### L-028 - Give every arrangement a mockup draws (column width, bubble side, card columns, where a chip sits per breakpoint) its own Playwright check with measured boxes; copy-only checks pass a different composition.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/web ui checks` · harmful: 0
- features: ai-chat-screens
- evidence: C50/C51 (rounds 1-2) (apps/web ui checks)
- last seen: 2026-10-12T04:32:55Z

### L-029 - A field promised in an HTTP response needs a proof that boots the real controller; a service-level test survives the controller dropping it.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/api auth` · harmful: 0
- features: ai-chat-screens
- evidence: C1 controller mutant (round 1) (apps/api auth)
- last seen: 2026-10-12T04:32:55Z

### L-030 - When a screen branches on a stored status, enumerate every value the entity's CHECK allows, not only the ones the happy path reaches.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/web ui checks` · harmful: 0
- features: ai-chat-screens
- evidence: C52 / card-replacement.entity.ts:40 (round 2) (apps/web ui checks)
- last seen: 2026-10-12T04:32:55Z

### L-031 - Assert a pinned element while the page is mid-scroll, not only at the document end where a static element also fits the viewport
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-e2e` · harmful: 0
- features: persona-rethink
- evidence: E3 C36 (web-e2e)
- last seen: 2026-10-26T15:48:47Z

### L-032 - Assert the accessible name of a dialog in every proof that claims the dialog, not only the text inside it
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-e2e` · harmful: 0
- features: persona-rethink
- evidence: E5 C425 (web-e2e)
- last seen: 2026-10-26T15:48:47Z

### L-033 - Match each element of an ordered list by its own node, not by indexOf from the previous match, so a substring of the preceding text cannot satisfy it
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web-unit` · harmful: 0
- features: persona-rethink
- evidence: C48 C118 (web-unit)
- last seen: 2026-10-26T15:48:48Z

### L-034 - A test that compares the application clock with a database timestamp must pass in the full suite run, not only alone
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `api-e2e` · harmful: 0
- features: persona-rethink
- evidence: C452 share-report-queries.e2e-spec.ts (api-e2e)
- last seen: 2026-10-26T15:48:48Z

### L-035 - Assert the queued lookups and the no_price lines when a budget claim names them, not only the allow flag and the warning count
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `stores` · harmful: 0
- features: persona-rethink
- evidence: C195 (stores)
- last seen: 2026-10-26T15:48:48Z

### L-036 - When a check names an order of parts inside one row, the test fixture needs a row that carries every named part together, or swapping two of them survives every proof.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web e2e layout, fixtures` · harmful: 0
- features: persona-rethink
- evidence: P3a: apps/web/src/components/missing-list/MissingListRow.tsx:156 (C219) (web e2e layout, fixtures)
- last seen: 2026-10-26T17:17:55Z

### L-037 - When a claim names a screen the player reaches through a route, add one browser proof that walks to it, because a component test renders the screen without the route tree and stays green while the page never mounts.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `web routes` · harmful: 0
- features: persona-rethink
- evidence: C161 apps/web/tests/e2e/product-add-flow.spec.ts (web routes)
- last seen: 2026-10-26T19:44:12Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
