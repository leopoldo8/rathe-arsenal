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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
