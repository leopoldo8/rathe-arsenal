# Path A / B / C Visual Treatment Spec

**Origin:** Plan C Unit 4 (2026-04-27). Consumed by Unit 5 (legacy cluster migration).
**Status:** Canonical reference. Unit 5 executes this spec when rebuilding `PathBadge`
and migrating the Path C banner and `path-c-result.tsx`.

---

## Purpose

Path A, B, and C are three distinct result states the readiness engine produces for a
tracked deck. They share a word ("Path") but carry different semantic weight:

- **Path A** — the deck is playable as written: every card is owned.
- **Path B** — the deck is playable with approved substitutions from the user's collection.
- **Path C** — the deck cannot be assembled or substituted at high fidelity; the engine
  returns the closest approximation it can construct.

Path A and B share an affordance family: both represent a playable arrangement of cards
the user owns. Path C is a different affordance — a proximity result, less reliable, that
the user must consciously opt into ("track proximal version"). The visual language must
make this distinction legible at a glance without the user reading a tooltip.

**Path C must not be styled as another tab alongside A and B.** It is a semantic
separator, not a progression.

---

## Visual Hierarchy

```text
            visual weight
   high  ←──────────────────→  low

  Path A: brass primary, no badge        ▓▓▓▓▓▓▓▓▓▓
          "play as written"

  Path B: brass secondary, "subbed"      ▓▓▓▓▓▓▓
          eyebrow + count-of-subs label

            ── margin break / rule ──

  Path C: ember ornament, "approximation" ▓▓▓
          eyebrow, distinct section border
```

The break between B and C is not a tab divider — it is a visual gap that signals a
category change.

---

## Path A Treatment

**Semantic meaning:** The deck is fully playable from the user's collection. No
substitutions were needed. This is the "green light" state.

**Badge:** None. Path A is the default success state. Adding a badge would dilute the
badge's signal on B and C.

**Readiness display:** Standard brass readiness percentage using `.ra-readiness-display`
(Cinzel Decorative 900, `var(--ra-accent)`). Effective percent equals raw percent.

**TestDeckResult `PathBadge`:** Render nothing for Path A. Remove the existing green
pastel pill.

**Consumers:**
- `TestDeckResult.tsx` — omit `PathBadge` entirely when `result.path === 'A'`.
- `decks.$deckId.tsx` — no Path A banner; the 3-column readiness layout speaks for itself.
- `ShoppingLine.tsx` — no path-specific treatment; the shopping line is empty or
  collapsed for Path A decks.

---

## Path B Treatment

**Semantic meaning:** The deck is playable with at least one substitution the user has
approved or that the engine has pre-selected. Still a valid, deliberate play configuration.

**Eyebrow label:** `SUBBED` — uppercase, Cinzel or IBM Plex Sans 500, caption size
(`var(--ra-text-caption)`, 0.6875rem), tracked at `0.08em`. Color: `var(--ra-accent-body)`
(#d4a84a on dark — 8.79:1 on canvas, AA body pass).

**Count label:** "N sub" or "N subs" (singular/plural) adjacent to the eyebrow, same
size, `var(--ra-fg-secondary)` color.

**Badge in `PathBadge`:** Replace the blue pastel pill with a brass-secondary pill:
- Background: `var(--ra-accent-soft-bg)` (rgba 197,146,58 at 10%)
- Border: `var(--ra-accent-soft-bd)` (rgba 197,146,58 at 35%)
- Text: `var(--ra-accent-body)` (#d4a84a)
- Font: IBM Plex Sans 500, `var(--ra-text-caption)`, uppercase, letter-spacing 0.08em
- Content: `SUBBED`
- Border-radius: `var(--ra-radius-full)` (pill — badge semantic)

**Consumers:**
- `TestDeckResult.tsx` — `PathBadge` renders the brass-secondary "SUBBED" pill for
  `path === 'B'`. Display sub count in the header row below the deck name.
- `decks.$deckId.tsx` — no dedicated Path B banner. The existing "modified view"
  affordance (clearing rejections) is sufficient context for B.
- `ShoppingLine.tsx` — no path-specific branch needed; shopping line renders normally
  when substitutions exist.

---

## Path C Treatment

**Semantic meaning:** The deck cannot be assembled or substituted at high fidelity. The
engine has produced the closest approximation it can construct, using the user's
collection as a proxy for the missing cards. This is a different affordance from A and B:
the user is not viewing "their deck" but a derived approximation.

**Eyebrow label:** `APPROXIMATION` — uppercase, IBM Plex Sans 500, caption size
(`var(--ra-text-caption)`), tracked at `0.08em`. Color: `var(--ra-path-c-ink)` (#e1a977
on dark — 9.39:1 on canvas, AA body pass).

**Section separator:** Before the Path C content block, insert a full-width horizontal
rule (`<hr aria-hidden="true">`) with `margin-block: var(--ra-space-8)` above it. This
creates the visual "break" that signals category change. Do not use a tab component or
segmented control — a semantic separator is correct.

**Frame ornament:** The Path C header block uses an ember-derived left border to signal
the category break:
- Left border: `3px solid var(--ra-ember)` (#b44a2e — ornamental ember, forge red)
- Background: `var(--ra-path-c-bg)` (rgba 199,123,58 at 10%)
- Border (full perimeter): `1px solid var(--ra-path-c-border)` (rgba 199,123,58 at 40%)
- The left border overrides the perimeter border on the left side only (use
  `border-left-width: 3px` or `border-left-color: var(--ra-ember)` in the module CSS).
- Padding: `var(--ra-space-5)` all sides.
- Border-radius: `var(--ra-radius-md)` (4px).

**Fidelity display:** Distinct from the readiness display — use IBM Plex Sans 700 at
`var(--ra-text-h1)` (2.25rem) in `var(--ra-path-c)` (#c77b3a — 5.85:1 on canvas, AA
body pass). Do not use Cinzel Decorative (that is the readiness display for A/B only).

**Copy strings:**

| Element | Copy |
|---|---|
| Eyebrow | `APPROXIMATION` |
| Fidelity subline | `of this deck can be assembled or substituted from your collection.` |
| Tier summary | `N card(s) substituted at tier 1, N card(s) at tier 2,` |
| Missing suffix | `N card(s) still missing.` |
| Primary CTA | `Track proximal version` |
| Secondary CTA | `Show me what's missing` |
| Missing section heading | `Still missing (N)` |

**Badge in `PathBadge`:** Replace the red pastel pill with an ember-accent badge:
- Background: `rgba(180, 74, 46, 0.10)` (ember at 10% — no named token; inline rgba or
  add `--ra-ember-soft-bg` in Unit 7 if needed by other consumers)
- Border: `rgba(180, 74, 46, 0.40)` (ember at 40%)
- Text: `var(--ra-path-c-ink)` (#e1a977)
- Font: IBM Plex Sans 500, `var(--ra-text-caption)`, uppercase, letter-spacing 0.08em
- Content: `APPROX`
- Border-radius: `var(--ra-radius-full)` (pill)

**Margin break above Path C section:** In `TestDeckResult.tsx`, insert a `<hr>`
separator with `margin-block-start: var(--ra-space-8)` before the `<PathCResult>`
block when `result.path === 'C'`. The separator must not appear for Path A or B.

**Consumers:**
- `TestDeckResult.tsx`:
  - `PathBadge` renders the ember-accent "APPROX" pill for `path === 'C'`.
  - Insert `<hr aria-hidden="true" className={styles.pathCSeparator}>` before
    `<PathCResult>` (class provides the margin-block-start).
- `path-c-result.tsx`:
  - Migrate the orange-border header block to use `var(--ra-path-c-bg)`,
    `var(--ra-path-c-border)`, `var(--ra-ember)` left accent, and
    `var(--ra-path-c-ink)` for the eyebrow.
  - Migrate the fidelity number to `var(--ra-path-c)` at `var(--ra-text-h1)`,
    IBM Plex Sans 700 (not Cinzel Decorative).
  - Eyebrow copy: `APPROXIMATION`.
- `decks.$deckId.tsx`:
  - Replace the current `<div role="status" className={styles.pathCBanner}>` with a
    branded block matching the same frame ornament spec above.
  - Left ember border, `var(--ra-path-c-bg)` background, `var(--ra-path-c-border)`
    perimeter, eyebrow in `var(--ra-path-c-ink)`.
  - Content: keep the existing "Closest playable version. This deck is missing N cards.
    You're currently at X% fidelity." prose — it is accurate; only the visual shell changes.
- `ShoppingLine.tsx`:
  - No path-specific visual branch needed for the shopping line itself. The Path C
    context is communicated by the surrounding section. If a future unit adds a
    Path-C-specific shopping line header, it uses `var(--ra-path-c)` and
    `var(--ra-path-c-ink)` per this spec.

---

## Token Reference

All token names are declared in `apps/web/src/styles/tokens.css`. Values below are for
the dark theme (default). Light-theme equivalents are not yet tone-corrected (Plan C,
Unit 1); Unit 5 should use `var(--ra-*)` exclusively, not hardcoded hex.

| Token | Dark hex | Usage in Path A/B/C |
|---|---|---|
| `--ra-accent` | `#c5923a` | Path A/B readiness display (large-text only) |
| `--ra-accent-body` | `#d4a84a` | Path B "SUBBED" eyebrow text |
| `--ra-accent-soft-bg` | rgba 197,146,58 @ 10% | Path B badge background |
| `--ra-accent-soft-bd` | rgba 197,146,58 @ 35% | Path B badge border |
| `--ra-path-c` | `#c77b3a` | Path C fidelity number |
| `--ra-path-c-bg` | rgba 199,123,58 @ 10% | Path C header block background |
| `--ra-path-c-border` | rgba 199,123,58 @ 40% | Path C header block perimeter border |
| `--ra-path-c-ink` | `#e1a977` | Path C eyebrow text, badge text |
| `--ra-ember` | `#b44a2e` | Path C left-border accent (frame ornament) |
| `--ra-radius-full` | `9999px` | Badge pill radius (Path B + C badges) |
| `--ra-radius-md` | `4px` | Path C header block corner radius |
| `--ra-text-caption` | `0.6875rem` | Badge and eyebrow text size |
| `--ra-text-h1` | `2.25rem` | Path C fidelity number size |
| `--ra-space-8` | `2rem` | Margin above Path C separator rule |
| `--ra-space-5` | `1.25rem` | Path C header block padding |
| `--ra-font-display` | `"Cinzel"` | Path B eyebrow (optional; IBM Plex Sans 500 preferred) |

---

## What This Spec Does Not Cover

- **Inline-style migration** for the other fields in `TestDeckResult.tsx`, `path-c-result.tsx`,
  `breakdown-list.tsx`, etc. — that is Unit 5's full scope. This spec covers only the
  Path A/B/C semantic presentation, not every inline style in those files.
- **ShoppingLine internal styling** — Unit 6 handles the full shopping panel cluster.
- **Light theme token derivation** — Unit 1 owns that. Unit 5 should use `var(--ra-*)`
  tokens, which will automatically pick up the Unit 1 light corrections.
- **`--ra-ember-soft-bg` token creation** — if the ember-at-10% rgba becomes a recurring
  value across more than two consumers, Unit 7 may promote it to a named token. Unit 5
  uses the raw `rgba` value inline in the module CSS.

---

*Authored: 2026-04-27 (Plan C, Unit 4)*
*Consumed by: Unit 5 (TestDeckResult, path-c-result, breakdown-list cluster migration)*
