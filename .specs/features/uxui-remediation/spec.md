# UX/UI Quality Remediation Pass — Specification

Source of truth for findings: `docs/audit/uxui-2026-06-29/MAP.md` (+ `cluster-*.md`).
Audit method: 8 parallel cluster auditors (visual snapshots + code) under the
impeccable + frontend-design lenses, grounded in `.impeccable.md`.

## Problem Statement

A full UX/UI audit of the Rathe Arsenal web app surfaced 81 findings. The product
is already design-system-disciplined, so the gaps cluster into ~12 systemic patterns
(accessibility, banned visual tells, token drift, loading-state parity) plus a small
number of high-impact structural issues. Left unaddressed, these undercut keyboard/
mobile usability, dilute the brand signature, and bury the app's core value prop
(deck readiness %) on its most important page.

## Goals

- [ ] Resolve every systemic theme T1–T12 so a single disciplined pass clears the
      ~55 findings they absorb, verified by tests/lint/grep guards where applicable.
- [ ] Resolve the headline structural decisions D1 (readiness focal point) and
      D2 (wordmark brass) per owner direction.
- [ ] Eliminate all 3 P0 and all in-scope P1 findings (impeccable bans, a11y blockers).
- [ ] Keep the dark theme visually unchanged except where a finding explicitly
      requires a change; no regressions in the existing visual-regression baseline
      (re-baseline only intentionally-changed surfaces).
- [ ] Leave nothing silently dropped: every deferred finding is recorded in the
      Deferred Backlog table.

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Light theme tone-correction / appearance | Deferred to Plan C by design context; this pass is dark-only. |
| Light-theme toggle disable/hide (D3) | Owner decision: keep interactive as-is until Plan C tunes light. Logged in Assumptions. |
| Per-surface P2/P3 long-tail not absorbed by a theme | Owner scoped this pass to systemic themes + decisions. Captured in Deferred Backlog (not dropped). |
| Backend / API / data-contract changes | This is a presentational + a11y remediation; no server behavior changes. |
| New telemetry / analytics | Not requested; validation is automated (tests/visual-regression) per project philosophy. |
| Mobile (375) + light visual-regression baselines (net-new) | Net-new snapshot surfaces are a follow-up; UXUI-16 only repairs the existing wrong-route fixtures. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| D3 — light-theme toggle | Leave interactive (no change) | Owner chose "deixar como está"; light is a known deferred surface (Plan C). | y (owner) |
| D4 — signature/mono font leaks | Tighten add-cards roman numerals to `--ra-font-display` (drop glow); fix CardLightbox caption raw `'Cinzel'` → `--ra-font-display` token. Ratify home hero aggregate stats (Cinzel) and settings eyebrows (mono) as documented intentional exceptions (they read as deliberate). | Low-risk; preserves the two treatments that look purposeful while removing the genuine signature dilution + raw-token. | n (logged) |
| Onboarding/deck-detail snapshot fixtures show `/decks/new` | Repair fixtures so they capture the true surfaces (UXUI-16) rather than adding net-new mobile/light snapshots | The wrong-route fixtures hide regressions on the two most important surfaces; fixing them is in-scope, net-new surfaces are not. | y (owner scope) |
| Standalone P1s not in a theme (home `window.confirm`, onboarding snapshot coverage) | Kept in scope (UXUI-15, UXUI-16) | Dropping P1 severity to backlog would be poor judgment; owner's "systemic + decisions" scope is honored for P2/P3, not P1. | y (stated) |
| `mark-owned-button` adoption + deck-detail `--ra-fg-muted` contrast fail (both P2, functional/a11y weight) | Folded into themes (T2/T5 → UXUI-02/06) rather than deferred | These carry an a11y/submit-bug risk; cheaper to fix within the relevant sweep than defer. | y (stated) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: UXUI-01 — Standardize `:focus-visible` across inputs & custom controls ⭐ MVP (T1)

**User Story**: As a keyboard user, I want every interactive control to show the
system focus ring so I always know where focus is.

**Why P1**: Includes a P0 (onboarding Step 1 input has no focus indicator). Focus
suppression and wrong-color rings span ~13 surfaces — the single highest-count theme.

**Acceptance Criteria**:
1. WHEN any input, button, switch, or custom control receives keyboard focus THEN it SHALL render `outline: 2px solid var(--ra-accent); outline-offset: 2px` and no shadow/border-only substitute.
2. WHEN a control previously used `outline: none` without a compliant replacement (auth inputs, onboarding Step1, deck-card-search, csv inputs/switch, library search, delete-account input, substitution `.rejectBtn`) THEN it SHALL be converted to `:focus-visible` with the canonical ring.
3. WHEN a control previously used a non-accent focus color (`--ra-border-strong`, `--ra-ready-low`) on modal/destructive buttons THEN it SHALL use `var(--ra-accent)` instead.
4. WHEN a control uses bare `:focus` for the ring THEN it SHALL move to `:focus-visible` so pointer interaction stays clean.

**Independent Test**: Unit/DOM tests assert the focus-ring declaration on representative controls; a CSS grep guard asserts no `outline: none` survives without a sibling `:focus-visible { outline: ...accent }` in the same module.

---

### P1: UXUI-02 — Enforce ≥44×44 touch targets ⭐ MVP (T2)

**Why P1**: ~11 controls fall below the 44px floor (R52), worst on the substitution
flow used on mobile during in-person play.

**Acceptance Criteria**:
1. WHEN any interactive control renders THEN its hit area SHALL be ≥44×44px (via size or padding + `box-sizing: content-box`).
2. WHEN a control sits inside an `overflow: hidden` wrapper that would clip its focus ring (steppers) THEN the wrapper SHALL allow the ring to render (e.g., `overflow: visible`).
3. WHEN `mark-owned-button` renders THEN it SHALL meet the 44px floor and carry `type="button"` (adopting the shared `Button` primitive is the preferred path).
4. WHEN the untrack pin / retired toggle / library stepper / filter-rail drawer controls / variant pill / drawer close / UserMenu trigger render THEN each SHALL meet the floor (no comment claiming 44 while the math yields less).

**Independent Test**: DOM tests assert computed min hit-area ≥44px on representative controls across clusters.

---

### P1: UXUI-03 — Modal/dialog focus management ⭐ MVP (T3)

**Why P1**: Includes a P0 (CardLightbox — the signature lightbox — has no focus trap).
Custom dialogs declare `aria-modal` but leak Tab to the background and drop focus on close.

**Acceptance Criteria**:
1. WHEN a custom dialog (`CardLightbox`, `VariantQueueDrawer`, `LibraryFilterDrawer`) is open THEN Tab/Shift+Tab SHALL cycle only within the dialog.
2. WHEN such a dialog closes THEN focus SHALL return to the element that opened it.
3. WHEN the cascade-warning banner header (`CascadeWarningPanel`) is rendered THEN it SHALL be a native `<button>`, not a `div[role="button"]`.
4. WHEN a dialog opens THEN initial focus SHALL land on a sensible first element (close/confirm) — existing behavior preserved.

**Independent Test**: DOM tests simulate Tab at the last focusable element and assert focus stays inside; assert focus returns to trigger on close.

---

### P1: UXUI-04 — Remove banned side-stripes ⭐ MVP (T4)

**Why P1**: Includes a P0 (Path C banner). impeccable absolute ban on `border-left/right > 1px` colored accents.

**Acceptance Criteria**:
1. WHEN the Path C banner (`decks.$deckId.module.css`), `path-c-result`, or `TestDeckResult` render THEN they SHALL NOT use a colored `border-left/right > 1px` stripe; differentiation SHALL come from perimeter border + background wash + optional `border-top` accent or leading glyph.
2. WHEN the auth error alert renders THEN it SHALL NOT use the `.errorStripe` span as a brass left-stripe, and SHALL use the `--ra-ready-low-*` (error) family rather than brass for an error semantic.
3. WHEN the audit grep guard runs THEN it SHALL find zero `border-left/right` colored stripes > 1px on cards/callouts/list items (CSS-drawn chevrons excluded).

**Independent Test**: CSS grep guard returns zero banned stripes; visual snapshot of Path C / auth-error surfaces re-baselined intentionally.

---

### P1: UXUI-05 — Wordmark solid brass (D2)

**Why P1**: impeccable absolute ban on gradient-text; also fixes stale brass hex in the gradient stops.

**Acceptance Criteria**:
1. WHEN the `.brandRathe` wordmark renders THEN it SHALL fill with a solid `var(--ra-accent)` color and SHALL NOT use `background-clip: text` over a gradient.
2. WHEN the wordmark renders THEN it SHALL NOT reference the stale brass `#d69e2e`; depth may use `text-shadow`.

**Independent Test**: CSS grep guard finds no `background-clip: text` in `TopBar.module.css`; visual snapshot re-baselined.

---

### P1: UXUI-14 — Readiness % becomes the deck-detail focal point (D1)

**Why P1**: The app's core value prop currently has no focal point; owner chose to
mount `ReadinessHero` as a full-width banner atop the canvas.

**Acceptance Criteria**:
1. WHEN a populated deck-detail page renders THEN the effectivePercent readiness SHALL be displayed as the dominant element (the `ReadinessHero` treatment, `.ra-readiness-display`, ~72px) at the top of the main canvas, full-width.
2. WHEN the readiness focal point is mounted THEN the duplicate readiness block in `DeckDetailSidebar` SHALL be removed or demoted so the signature is not shown twice at hero scale.
3. WHEN readiness sub-labels render THEN they SHALL use `--ra-fg-secondary` (AA) not `--ra-fg-muted` (the ReadinessHero already does this; the sidebar variant did not).
4. WHEN the page renders THEN `.ra-readiness-display` SHALL remain used only for effectivePercent (R7 preserved).

**Independent Test**: DOM test asserts the readiness hero renders in the canvas region with the signature class; asserts only one hero-scale readiness instance.

---

### P1: UXUI-15 — Replace native `window.confirm` for untrack (T-ban, home)

**Why P1**: `DeckCard.tsx:109` uses an unstyled native OS dialog — a banned modal pattern on a daily action.

**Acceptance Criteria**:
1. WHEN a user untracks a deck THEN confirmation SHALL use an in-product pattern (inline two-step confirm OR immediate action + undo toast), not `window.confirm`.
2. WHEN the confirmation pattern renders THEN it SHALL be keyboard-accessible and on-brand (dark-themed).
3. WHEN the dead `tracked-deck-card.tsx` (which also holds a `window.confirm`) is removed under UXUI-11 THEN no `window.confirm` SHALL remain in non-test code.

**Independent Test**: grep guard asserts zero `window.confirm` in non-test `*.tsx`; DOM test covers the new confirm/undo flow.

---

### P1: UXUI-16 — Repair onboarding & deck-detail visual fixtures (B coverage)

**Why P1**: The `onboarding`, `deck-detail`, and `deck-detail-edit` snapshots actually
render `/decks/new` (fixture user has decks), so the two most important authenticated
surfaces have no real visual regression coverage — masking any regression from this pass.

**Acceptance Criteria**:
1. WHEN the onboarding visual test runs THEN its fixture SHALL produce the 3-step wizard (zero-deck user / stubbed empty decks), not `/decks/new`.
2. WHEN the deck-detail visual tests run THEN their fixtures SHALL produce a populated deck-detail (and edit-mode) view, not the add-deck empty state.
3. WHEN snapshots are regenerated THEN the new baselines SHALL capture the true surfaces and be committed.

**Independent Test**: the visual test names map to screenshots that visibly show the wizard / populated deck detail (manual confirm during execution).

---

### P2: UXUI-06 — Token drift sweep (T5)

**Acceptance Criteria**:
1. WHEN any `*.module.css` or SVG renders brand brass THEN it SHALL reference `var(--ra-accent)` (or `color-mix`) — no raw `#d69e2e`/`rgba(214,158,46,...)` (TopBar divider, DeckboxDecoration 9 strokes + R glyph, DeckCard deckbox SVG ×7, CardLightbox shimmer).
2. WHEN `mark-owned-button` renders green THEN it SHALL use `--ra-ready-high`, not raw `#38a169`.
3. WHEN `SumExplainer` card-name text renders THEN it SHALL use `--ra-text-caption`, not raw `0.65rem`.
4. WHEN the deck-detail sidebar readiness sub-labels render THEN they SHALL use `--ra-fg-secondary` (folds with UXUI-14 AC3).
5. WHEN a grep guard runs THEN it SHALL find no `#d69e2e`/`#38a169` raw values in `apps/web/src`.

**Independent Test**: grep guard for the stale hex values returns zero.

---

### P2: UXUI-07 — Skeleton ↔ loaded layout parity (T6)

**Acceptance Criteria**:
1. WHEN the home skeleton renders THEN each card placeholder SHALL match the deckbox vessel proportions (`aspect-ratio: 200/240`) so resolving causes no height jump.
2. WHEN the deck-detail skeleton renders at a given breakpoint THEN its column structure SHALL match `DeckDetailLayout` at that breakpoint (single-col < 1280px, `280px 1fr` ≥ 1280px) — retire the 3-col skeleton.

**Independent Test**: DOM tests assert skeleton container aspect-ratio / grid-template matches the loaded layout at the same breakpoint.

---

### P2: UXUI-08 — Close i18n leaks (T7, enforces AD-001)

**Acceptance Criteria**:
1. WHEN `SumExplainer` renders THEN "Source A/B", "Total", and the example card name SHALL come from `t()` keys present in both `en-US` and `pt-BR`.
2. WHEN add-cards manual renders a pitch color in an aria-label THEN the color name SHALL be localized.
3. WHEN `substitution-row` renders the tier badge THEN "Tier" SHALL come from `t()`.
4. WHEN a grep guard runs THEN no user-facing hardcoded literal SHALL remain in the touched components.

**Independent Test**: render the components under each locale; assert no English literal leaks in pt-BR.

---

### P2: UXUI-09 — Reduced-motion for transform-based motion (T8)

**Acceptance Criteria**:
1. WHEN `prefers-reduced-motion: reduce` is set THEN the `CsvSourceRow` dropIn translate and the add-cards `.method:hover` translate SHALL collapse to no transform.

**Independent Test**: CSS assertion that each component defines a reduce override for its transform.

---

### P2: UXUI-10 — Error states look like errors (T9)

**Acceptance Criteria**:
1. WHEN email verification fails THEN the message container SHALL use the error (`--ra-ready-low-*`) treatment, not the neutral `.infoBox`, and SHALL offer a recovery action.
2. WHEN a Fabrary/CSV import error renders THEN its callout SHALL use the danger border/background family, not `--ra-border-strong`.

**Independent Test**: DOM tests assert error containers carry the danger token classes.

---

### P2: UXUI-11 — Remove dead code (T10)

**Acceptance Criteria**:
1. WHEN the cleanup runs THEN `components/readiness-header.tsx`, `components/tracked-deck-card.tsx`, and `components/home/ReadinessShelves.tsx` (all zero non-test imports) SHALL be removed (after confirming no spec/story refs).
2. WHEN the cleanup runs THEN the dead 3-column grid CSS in `decks.$deckId.module.css` SHALL be removed.
3. WHEN UXUI-14 lands THEN `ReadinessHero.tsx` SHALL be mounted (not removed) — it is NOT dead code per D1.

**Independent Test**: typecheck + build pass after removal; grep confirms no remaining references.

---

### P2: UXUI-12 — SPA navigation for internal links (T11)

**Acceptance Criteria**:
1. WHEN `EducationalEmptyState` internal CTAs are clicked THEN navigation SHALL use TanStack `<Link>` (no full-page reload).

**Independent Test**: assert the CTAs render `<a data-* router>`/`Link` not bare `<a href>`; no reload in an interaction test.

---

### P2: UXUI-13 — Custom-control ARIA correctness (T12)

**Acceptance Criteria**:
1. WHEN `ReviewsFilters` popover triggers render THEN they SHALL rely on `aria-expanded` (Radix-managed) and SHALL NOT add conflicting `aria-pressed`.
2. WHEN `Step3FirstReview` decision buttons render THEN they SHALL NOT claim `aria-pressed` toggle semantics the UX cannot fulfill (use disabled-opposite + live region, or implement true toggle-off).
3. WHEN `DeckCardSearchAutocomplete` renders THEN deprecated `aria-owns` SHALL be removed.
4. WHEN a clickable `CardArt` renders THEN the inner SVG SHALL be `aria-hidden` so the button name is announced once.
5. WHEN `ReviewsBulkBar` renders THEN its `aria-live` region SHALL be mounted before the first selection so the count announces.

**Independent Test**: DOM tests assert the corrected ARIA attributes on each control.

---

### P3: UXUI-17 — Signature & typography discipline (D4)

**Acceptance Criteria**:
1. WHEN the add-cards method numerals render THEN they SHALL use `--ra-font-display` (not the ornament font) with no glow, so the signature treatment stays reserved.
2. WHEN the CardLightbox caption renders THEN it SHALL use `var(--ra-font-display)` not a raw `'Cinzel'` stack.
3. WHEN home hero aggregate stats (Cinzel) and settings eyebrows (mono) render THEN they remain as-is, documented as intentional exceptions in the design context.

**Independent Test**: CSS assertions on the numeral/caption font tokens.

---

## Edge Cases

- WHEN `prefers-reduced-motion: reduce` THEN every transform animation SHALL be static (UXUI-09 + global baseline).
- WHEN a keyboard-only user traverses any modal THEN focus SHALL never escape to the background (UXUI-03).
- WHEN the locale is pt-BR THEN no English literal SHALL render in the touched components (UXUI-08).
- WHEN a deck has 0% readiness or no missing cards THEN the readiness hero SHALL still render a sensible focal state (UXUI-14).
- WHEN a control's visual glyph must stay small (stepper, tag remove) THEN the hit area SHALL still reach 44px via padding without enlarging the glyph (UXUI-02).

---

## Requirement Traceability

| Requirement ID | Story | Theme/Decision | Phase | Status |
| -------------- | ----- | -------------- | ----- | ------ |
| UXUI-01 | P1 focus-visible | T1 | Tasks | ✅ Verified |
| UXUI-02 | P1 touch targets | T2 | Tasks | ✅ Verified (AC2 spec-precision gap) |
| UXUI-03 | P1 modal focus | T3 | Tasks | ✅ Verified |
| UXUI-04 | P1 side-stripes | T4 | Tasks | ✅ Verified |
| UXUI-05 | P1 wordmark brass | D2 | Tasks | ✅ Verified |
| UXUI-14 | P1 readiness focal point | D1 | Design+Tasks | ✅ Verified (AC3 spec-precision gap) |
| UXUI-15 | P1 native confirm | home ban | Tasks | ✅ Verified |
| UXUI-16 | P1 visual fixtures | B coverage | Tasks | ⚠️ Deferred-to-CI (env-blocked; fixture code verified) |
| UXUI-06 | P2 token drift | T5 | Tasks | ✅ Verified (AC3/AC4 spec-precision gap) |
| UXUI-07 | P2 skeleton parity | T6 | Tasks | ✅ Verified (AC1/AC2 spec-precision gap) |
| UXUI-08 | P2 i18n leaks | T7 | Tasks | ✅ Verified |
| UXUI-09 | P2 reduced-motion | T8 | Tasks | ✅ Verified |
| UXUI-10 | P2 error states | T9 | Tasks | ✅ Verified |
| UXUI-11 | P2 dead code | T10 | Tasks | ✅ Verified |
| UXUI-12 | P2 SPA nav | T11 | Tasks | ✅ Verified |
| UXUI-13 | P2 ARIA | T12 | Tasks | ✅ Verified |
| UXUI-17 | P3 signature/type | D4 | Tasks | ✅ Verified |

**Coverage:** 17 requirements; mapping to tasks happens in Tasks phase. D3 resolved as no-op.

---

## Deferred Backlog (documented, not dropped)

Per-surface P2/P3 items not absorbed by a theme. Items marked ⚠ carry functional/a11y
weight — recommend pulling into a follow-up soon.

| Finding | Surface | Sev | Note |
| ------- | ------- | --- | ---- |
| Duplicate unique/copies counts (eyebrow + stats bar) | Library | P2 | Visual hierarchy polish |
| Stats bar sticky `top:0` slides under TopBar | Library | P2 ⚠ | Shared `--ra-topbar-height` would fix this + Toast |
| Toast viewport under sticky TopBar | Shell | P2 ⚠ | Same root as above |
| Flat row rhythm — no grouping of substitutes per original card | Swaps | P2 | Needs design; code-only (no populated snapshot) |
| "Back to home" CTA navigates to Approved tab | Swaps | P2 ⚠ | Label/behavior mismatch |
| `aria-invalid` missing on errored auth inputs | Auth | P2 ⚠ | a11y error identification |
| Manual search blank gap during in-flight query | Add-cards | P2 | Add loading branch |
| 1500ms verify-email auto-redirect, no pause | Auth | P2 | Timing-adjustable |
| Onboarding step-III not marked complete on congrats | Onboarding | P2 | Closure signal |
| Onboarding cross-step gap 16 vs 24px | Onboarding | P2 | Rhythm |
| `step1Heading` names artifact not benefit | Onboarding | P2 | UX writing |
| `CsvSourcesEmptyState` heading font vs `LibraryEmptyState` | Library/CSV | P3 | Brand consistency |
| Empty-state copy, ✉ glyph, decoration copy, congrats signature, etc. | Various | P3 | Nice-to-have polish |
| VariantQueuePill status dot color-only | Swaps | P3 ⚠ | Add shape cue for color-blind |
| `BreakdownSections` lightbox title uses cardIdentifier | Deck detail | P3 | Use `entry.name` |

---

## Success Criteria

- [ ] All 3 P0 and all in-scope P1 findings resolved (UXUI-01..05, 14, 15, 16).
- [ ] Grep guards green: no `outline:none`-without-replacement, no banned side-stripes,
      no gradient-text, no `window.confirm`, no stale brass hex.
- [ ] Existing test suite (web typecheck + lint + ~1343 tests) green; new/updated tests
      assert the spec ACs (not the implementation).
- [ ] Visual-regression: only intentionally-changed surfaces re-baselined; fixed
      onboarding/deck-detail fixtures now capture the real surfaces.
- [ ] Deferred Backlog recorded; nothing dropped silently.
