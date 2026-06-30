# UX/UI Remediation — Context

**Gathered:** 2026-06-30
**Spec:** `.specs/features/uxui-remediation/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Remediate the systemic UX/UI themes T1–T12 from `docs/audit/uxui-2026-06-29/MAP.md`
plus the headline decisions D1, D2 (D3 resolved as no-change, D4 as a logged default),
plus the two standalone P1s (home `window.confirm`, onboarding/deck-detail snapshot
fixtures). Dark theme only. Per-surface P2/P3 long tail is deferred backlog, not dropped.
No backend/API/data-contract changes.

---

## Implementation Decisions

### D1 — Readiness focal point (deck detail)
- Mount `ReadinessHero` as a **full-width banner at the top of the main canvas** (above
  the breakdown sections), not in the sidebar.
- Remove/demote the duplicate readiness block in `DeckDetailSidebar` so the signature
  `.ra-readiness-display` shows once at hero scale (R7 preserved: effectivePercent only).
- Sidebar/hero readiness sub-labels use `--ra-fg-secondary` (AA), never `--ra-fg-muted`.
- This is the one item that needs real layout design (design.md).

### D2 — Wordmark
- Replace the gradient-clip `.brandRathe` with a **solid `var(--ra-accent)` fill**;
  depth via `text-shadow` if desired. No `background-clip: text`. No stale `#d69e2e`.

### D3 — Light-theme toggle
- **No change.** Owner keeps the light toggle interactive; light remains a deferred
  (Plan C) surface. The H/P1 "trap" finding is intentionally accepted for now.

### D4 — Signature / typography (logged default, P3)
- Tighten add-cards roman numerals to `--ra-font-display` (drop the glow) so the
  ornament/signature treatment stays reserved.
- Fix `CardLightbox` caption raw `'Cinzel'` → `var(--ra-font-display)`.
- Ratify home hero aggregate stats (Cinzel) + settings eyebrows (mono) as **intentional
  documented exceptions** (they read as deliberate; not dilution).

### Shared mechanisms (cross-theme)
- **Focus ring** (T1): one canonical pattern — `:focus-visible { outline: 2px solid
  var(--ra-accent); outline-offset: 2px }` + `:focus:not(:focus-visible){outline:none}`
  where pointer-clean is wanted. Consider a shared utility class / documented snippet.
- **Focus trap** (T3): one small `useFocusTrap` hook (collect focusables, cycle
  Tab/Shift+Tab, store+restore `activeElement`) reused by the 3 dialogs.
- **Grep guards** (CI/test): regressions locked by greps — no `outline:none`-without-
  replacement, no `border-left/right>1px` colored stripe, no `background-clip:text`,
  no `window.confirm`, no stale `#d69e2e`/`#38a169`.

### Scope
- Plan = systemic themes T1–T12 + D1/D2/D4 + standalone P1s (UXUI-15, 16).
- Deferred backlog table in spec.md captures every non-theme P2/P3 (with ⚠ on the
  functional/a11y-weight ones) — recommend a fast follow-up for those.

### Agent's Discretion
- Exact in-product untrack confirmation pattern (inline two-step vs undo-toast) — pick
  the one that fits the existing Toast system best during Design/Execute.
- Whether T3's focus-trap is a custom hook or a tiny vendored utility — builder's call.

### Declined / Undiscussed Gray Areas → Assumptions
- D3 (declined to change) and D4 (not explicitly asked) are logged in spec.md
  Assumptions with chosen defaults + rationale.

---

## Specific References

- "Mount ReadinessHero as a banner atop the canvas" (D1, owner-selected option).
- "Solid brass fill" for the wordmark (D2, owner-selected).
- Visual language + token names: `.impeccable.md`, `apps/web/src/styles/tokens.css`.

---

## Deferred Ideas

- Net-new mobile (375) + light-theme visual-regression baselines (separate follow-up;
  UXUI-16 only repairs the existing wrong-route fixtures).
- Shared `--ra-topbar-height` token to fix both the Library stats-bar and Toast
  sitting under the TopBar (two ⚠ backlog items share this root) — quick follow-up.
- Full per-surface P2/P3 polish pass (Deferred Backlog table).
