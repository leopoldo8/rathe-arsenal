# UX/UI Remediation — Design

**Spec**: `.specs/features/uxui-remediation/spec.md`
**Context**: `.specs/features/uxui-remediation/context.md`
**Status**: Draft

Most of the 17 requirements are **mechanical sweeps** over existing CSS modules /
components (focus rings, touch targets, side-stripes, token drift, i18n, motion, SPA
links, ARIA attributes) and need no architecture — they are designed inline at Execute.
This document covers only the parts with real design decisions: the **three shared
mechanisms**, the **one layout change** (UXUI-14), and the **test/guard strategy**.

Active project decisions checked: **AD-001..AD-004** (i18n). UXUI-08 (close i18n leaks)
*conforms to and enforces* AD-001 ("no hardcoded user-facing literals") — no conflict,
no supersede. No other AD applies. No confirmed lessons in the store yet.

---

## Architecture Overview

```mermaid
graph TD
    subgraph Shared mechanisms (Phase 0)
      FR[focus-ring convention + guard test]
      FT[useFocusTrap hook]
      GD[design-guards.spec.ts: grep guards as tests]
    end
    subgraph P1 a11y + bans (Phase 1)
      T1[UXUI-01 focus-visible] --> FR
      T3[UXUI-03 dialogs] --> FT
      T2[UXUI-02 touch targets]
      T4[UXUI-04 side-stripes] --> GD
      T5w[UXUI-05 wordmark brass] --> GD
    end
    subgraph Structural (Phase 2)
      RH[UXUI-14 mount ReadinessHero in canvas]
      DC[UXUI-11 remove dead code]
    end
    GD --- T4
    GD --- T5w
```

The work is a coordinated sweep, not a new subsystem. Phase 0 builds the two reusable
pieces (a focus-trap hook + a guards test) so later phases plug into them.

---

## Code Reuse Analysis

### Existing Components / Utilities to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `Button` primitive | `components/ui/Button/` | Already enforces ≥44px + canonical `:focus-visible`. Adopt it for `mark-owned-button` (UXUI-02) and reference its focus CSS as the canonical pattern for T1. |
| `ReadinessHero` | `components/deck-detail/ReadinessHero.tsx` | Mount it (UXUI-14). Already implements the 72px signature display + `--ra-fg-secondary` sub-labels — exactly the fix D1 wants. Currently unimported. |
| `ToastProvider` / `useToast` | `components/ui/Toast/` | Power the untrack undo-toast (UXUI-15). Reuses the existing aria-live toast region. |
| `t()` / locale catalogs | `i18n/` + `i18n/locales/{en-US,pt-BR}/` | All new strings (UXUI-08) go through `t()` per AD-001. |
| Design tokens | `styles/tokens.css` | All color/spacing/type fixes reference tokens (`--ra-accent`, `--ra-ready-*`, `--ra-fg-secondary`, `--ra-text-caption`, `--ra-font-display`). |
| Global focus baseline | `styles/global.css:39-42` | The canonical `:focus-visible` rule already lives here — T1 makes per-module overrides conform to it. |
| Visual suite | `tests/visual/all-surfaces.spec.ts` | Re-baseline changed surfaces; repair onboarding/deck-detail fixtures (UXUI-16). |

### Integration Points

| System | Integration |
| ------ | ----------- |
| TanStack Router | `EducationalEmptyState` swaps bare `<a>` for `<Link>` (UXUI-12). |
| Radix dialogs vs custom dialogs | Radix-based modals already trap focus; the 3 **custom** dialogs (CardLightbox, VariantQueueDrawer, LibraryFilterDrawer) do not — `useFocusTrap` fills that gap (UXUI-03). |

---

## Components

### useFocusTrap (new)
- **Purpose**: Confine Tab/Shift+Tab within an open dialog and restore focus to the opener on close.
- **Location**: `apps/web/src/hooks/useFocusTrap.ts` (+ `__tests__/useFocusTrap.test.tsx`).
- **Interface**:
  - `useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean, opts?: { initialFocusRef?; restoreFocus?: boolean }): void`
  - On `active` true: records `document.activeElement`, focuses initial element; on `keydown Tab` cycles within focusables; on `active` false / unmount: restores focus.
- **Dependencies**: React only (no new package).
- **Reuses**: focusable-selector convention; mirrors existing dialog focus handling in the 3 components.

### ReadinessHero mount (modify)
- **Purpose**: Make readiness % the deck-detail focal point (D1 / UXUI-14).
- **Location**: `routes/_auth/decks.$deckId.tsx` + `components/deck-detail/DeckDetailLayout.tsx` (render `ReadinessHero` full-width atop the canvas); `components/deck-detail/DeckDetailSidebar.tsx` (remove the duplicate readiness block + its CSS).
- **Interface**: pass the existing readiness/effectivePercent props (already computed for the sidebar) to `ReadinessHero`.
- **Dependencies**: `ReadinessHero` component (already exists).
- **Reuses**: existing readiness data flow; `.ra-readiness-display` (R7 preserved — single hero-scale instance).

### Untrack confirmation (modify)
- **Purpose**: Replace `window.confirm` (UXUI-15) with an on-brand pattern.
- **Decision**: **optimistic untrack + undo toast** (reuses Toast; no modal, keyboard-accessible, fits the daily-action frequency). Inline two-step is the fallback if optimistic mutation rollback proves awkward.
- **Location**: `components/home/DeckCard.tsx` (+ test). Uses `useToast`.

### design-guards.spec.ts (new)
- **Purpose**: Lock the bans/drift as regressions (UXUI-04/05/06/15 + T1 suppression).
- **Location**: `apps/web/src/styles/__tests__/design-guards.spec.ts` (fs-reads `apps/web/src/**`).
- **Asserts**: no `border-left/right > 1px` colored stripe on callouts; no `background-clip:text`; no `window.confirm` in non-test `*.tsx`; no raw `#d69e2e`/`#38a169`; no `outline:none` in a module lacking a sibling `:focus-visible{outline:...accent}`. (Chevron false-positive excluded by pattern.)

---

## Error Handling Strategy

| Scenario | Handling | User Impact |
| -------- | -------- | ----------- |
| Untrack mutation fails after optimistic remove | Toast switches to error + restores the deck card | Deck reappears; "Couldn't untrack — try again" |
| Email verification token invalid/expired (UXUI-10) | Render error (`--ra-ready-low-*`) container + recovery link | Clear failure + a way forward |
| Import (Fabrary/CSV) error (UXUI-10) | Danger-token callout | Reads as an error, not info |

---

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| ------- | -------- | ------ | ---------- |
| Visual tests require a running dev server + seeded Postgres; they `test.skip` otherwise | `tests/visual/all-surfaces.spec.ts:212` | UXUI-16 re-baseline + any snapshot update can't run headless-only | Execution task brings up api+web+DB per `docs/dev-fixtures.md`; if DB unavailable locally, defer snapshot regen to CI and gate on unit/typecheck/lint (mirrors the i18n feature's known env limitation in STATE.md). |
| Onboarding/deck-detail baselines currently capture the wrong surface | `tests/visual/__snapshots__/*onboarding*`, `*deck-detail*` | Regressions on the two most important surfaces are invisible | UXUI-16: verify each baseline's real content, fix the fixture (seed a zero-deck user for onboarding; ensure a populated deck resolves for deck-detail), regenerate. |
| Existing tests assert `window.confirm` / sidebar-readiness DOM | `home/__tests__`, `deck-detail/__tests__` | Changing behavior (UXUI-15, UXUI-14) will fail those tests | These are EXPECTED updates — the test asserts old behavior; update it to the new spec AC (not a silent weakening). Flag in the task. |
| Touch-target fixes inside `overflow:hidden` steppers | `EditableCardRow`, `add-cards.manual`, `LibraryCardStepper` | Enlarging hit area can clip focus ring or shift layout | Use padding + `box-sizing:content-box`; switch wrapper to `overflow:visible`; re-baseline affected surface. |
| Removing `DeckDetailSidebar` readiness block | `DeckDetailSidebar.tsx/.module.css` | Could leave orphan CSS / shift sidebar layout | Remove block + its CSS together; visual re-baseline of deck-detail (which UXUI-16 fixes anyway). |
| `ReadinessShelves.tsx` removal | dead, 0 imports | Low — but confirm no lazy/dynamic import | grep dynamic import strings before delete (UXUI-11). |

---

## Tech Decisions (non-obvious)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Focus-trap mechanism | Small custom `useFocusTrap` hook | No new dependency; the 3 dialogs are simple (close button + content); mirrors existing manual focus code. |
| Untrack confirm pattern | Optimistic + undo toast | Reuses the Toast aria-live region; no modal (impeccable); fits a frequent action better than a confirm gate. |
| Focus-ring DRY | Convention + guard test, not a shared class | CSS Modules can't easily share a declaration; the global baseline already defines it; a guard test prevents regression cheaply. |
| Guards | vitest fs-read spec, not a new ESLint rule | Faster to add, runs in the existing `vitest` gate, no eslint-plugin authoring; an ESLint rule can be a later hardening. |
| Snapshot scope | Re-baseline only changed surfaces | Keeps the diff reviewable; avoids masking unrelated drift. |

> **Project-level decision candidates** (append to STATE.md as AD-005/006 at Execute if ratified): (a) canonical `:focus-visible` convention + guard; (b) no-raw-brand-hex guard. Both are conventions future features must follow → worth recording.

---

## Tips applied
- Reuse-first: `Button`, `ReadinessHero`, `Toast`, tokens, `t()` all already exist.
- One layout change only (UXUI-14); everything else is a conforming sweep.
- Guards turn "we fixed it" into a regression-locked invariant.
