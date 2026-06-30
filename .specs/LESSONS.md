# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Test localStorage unavailability for in-memory language fallback by mocking setItem to throw and asserting the language still applies without propagating the error.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `i18n,storage` · harmful: 0
- features: i18n
- evidence: P1-AC8 (i18n,storage)
- last seen: 2026-06-29T20:28:45Z

### L-002 — Assert runtime missing-key fallback behavior with an unknown key, not just that fallbackLng config equals the expected locale.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `i18n,testing` · harmful: 0
- features: i18n
- evidence: P1-AC7 (i18n,testing)
- last seen: 2026-06-29T20:28:51Z

### L-003 — When a component has multiple render branches (collapsed + expanded), test the badge/indicator visibility for BOTH branches with count=1 — the collapsed-state badge is not reached by pending-row tests.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: swap-copies-grouping
- evidence: ReviewsRow.tsx:223 (components)
- last seen: 2026-06-29T23:29:00Z

### L-004 — When an accessible count (aria-label, aria-count) is derived from a computed list (e.g. groups.length vs raw copy count), add a test that asserts the aria text reflects the derived count, not the raw source count.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `a11y` · harmful: 0
- features: swap-copies-grouping
- evidence: SWAPGRP-14 (a11y)
- last seen: 2026-06-29T23:29:10Z

### L-005 — When testing batch operations with an identifier-keyed payload, assert the identifier field across ALL action variants (approve, reject, AND reset) — tests that check only boolean flags (e.g. reset: true) can survive key-field mutations.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `components,bulk-actions` · harmful: 0
- features: swap-copies-grouping
- evidence: ReviewsBulkBar.tsx:82 (components,bulk-actions)
- last seen: 2026-06-29T23:55:00Z

### L-006 — When a spec AC fixes a precise CSS value (aspect-ratio, overflow, font/color token) in CSS only, add a value-pinning assertion in design-guards.spec.ts — guard+visual alone leaves the value unlocked when the visual gate is CI-deferred.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `css,testing` · harmful: 0
- features: uxui-remediation
- evidence: .specs/features/uxui-remediation/validation.md (UXUI-07 AC1/AC2, UXUI-02 AC2, UXUI-06/14) (css,testing)
- last seen: 2026-06-30T13:00:27Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
