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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
