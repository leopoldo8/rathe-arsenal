# Foundation Design — Tokens, Typography, App Shell

**Spec**: `.specs/features/product-redesign/spec.md` — story "P1: Redesigned foundation — tokens, typography, app shell" (FND-01..FND-07) + Cross-Cutting Requirement 5.
**Handoff**: `.specs/features/product-redesign/design-handoff.md` — sections "Design Tokens", "Tipografia", "Espaçamento, raio e sombra", and the nav row of "Interactions & Behavior".
**Status**: Draft

This is the contract every other `product-redesign` workstream (medallion, deckbox, Home, deck detail, Library, Swaps, edit/settings, sign-in/onboarding) builds against. It touches exactly two kinds of files: `apps/web/src/styles/tokens.css` / `global.css` (token values and global element rules), and the nav-related files under `apps/web/src/components/shell/`. It does not touch any screen-level component.

---

## 0. How to read this document

Every existing `--ra-*` token in this repo is a **value slot with a name**, not a name tied to one value forever. 84–91 files reference tokens like `--ra-fg-primary` and `--ra-accent` by name only; none of them hardcode a hex. That means the single highest-leverage move available to this phase is: **keep the names, replace the values**. Every consumer of those names — including screens no later phase has touched yet — picks up the new palette for free, with zero component edits. This is deliberate, not a side effect: D1 says phases may land as separate PRs without leaving the app "half-redesigned," and a token-value swap is exactly the mechanism that keeps colors and type consistent across redesigned and not-yet-redesigned screens simultaneously.

Where the handoff introduces a concept the repo has no slot for (`--surface-2`, `--ink-2`, three pitch colors beyond red/yellow/blue), a new token is added. Where the repo has a slot the handoff doesn't use or contradicts, that is called out explicitly — silence would mean a future session assumes the old rule still holds.

All hex/rgba values below were computed with the exact WCAG 2.1 relative-luminance formula used in `apps/web/src/styles/__tests__/contrast.spec.ts` (verified by re-implementing it and cross-checking two existing matrix rows — see §6). Contrast claims are not estimates.

---

## 1. Color tokens — dark theme (the default)

### 1.1 Backgrounds, borders, foreground scale

| Handoff token | Value | Existing `--ra-*` slot | Old value | Change |
|---|---|---|---|---|
| `--bg` | `#0b0c0f` | `--ra-bg-canvas` | `#0c0d10` | value swap |
| `--surface` | `#14161c` | `--ra-bg-surface` | `#15171c` | value swap |
| `--surface-2` | `#0e1016` | `--ra-bg-surface-2` **(new)** | — | added |
| `--line` | `rgba(255,255,255,.07)` | `--ra-border-subtle` | `#2a2e37` (opaque) | value swap, **hex → translucent overlay** |
| `--line-strong` | `rgba(255,255,255,.12)` | `--ra-border-strong` | `#3d424d` (opaque) | value swap, hex → overlay |
| `--ink` | `#e8e6e1` | `--ra-fg-primary` | `#ece6d7` | value swap |
| `--ink-2` | `#c8cad2` | `--ra-fg-secondary` | `#b0a898` | value swap (see §1.3) |
| `--dim` | `#8b8d96` | `--ra-fg-tertiary` **(new)** | — | added (see §1.3) |
| `--dim-2` | `#7a7c84` | `--ra-fg-muted` | `#6b6658` | value swap (see §1.3) |
| `--muted` | `#5c5e66` | `--ra-fg-subtle` | `#555040` | value swap (see §1.3) |

**`--ra-border` (existing, 79 consumers, no handoff counterpart as a third tier):** in the *current* dark theme `--ra-border` and `--ra-border-subtle` already resolve to the identical hex (`#2a2e37`) — the three-tier system was already two-deep in practice. Retire it as a distinct value and alias it: `--ra-border: var(--ra-border-subtle);` in both themes. All 79 consumers keep working unedited. In light theme this shifts `--ra-border` consumers from `#dcd4be` to `#e5dfc9` — both are the same warm-parchment hairline family, a sub-perceptible hue change for a 1px divider, not a redesign.

**`--ra-bg-raised` (46 consumers) and `--ra-bg-muted`/`--ra-bg-sunken` (7 and 14 consumers):** the handoff has no "lighter than surface" or "sunken well" concept — every screen either uses `--bg`, `--surface`, or `--surface-2`. These three existing tokens have no handoff mandate to change and are **kept unchanged**. They're what current hover/elevated/inset states use app-wide (e.g. `TopBar.module.css` `.navLink:hover { background-color: var(--ra-bg-raised); }`); retiring them would require rewriting every hover state this phase doesn't otherwise touch. Flagged as an open item for whichever phase next needs a "raised" surface defined by the handoff's language rather than inherited from the old system.

### 1.2 Consequence of the `--line` overlay change

`rgba(255,255,255,.07)` composited over the new `--bg` (`#0b0c0f`) renders as approximately `#1c1d20` — visibly *fainter* than the old opaque `#2a2e37`. This is the handoff's intent (translucent dividers read as lighter, more "premium dark" than flat opaque gray), but it is a real, visible, app-wide consequence: every divider and card border in the app gets subtler the moment this token lands, including on screens no later phase has redesigned yet. Call this out in the phase's PR description so it isn't mistaken for a regression.

One consumer needs a second look before this ships: `apps/web/src/components/deck-detail/CascadeWarningPanel.module.css` (lines 12, 39) does `border: 1px solid color-mix(in oklch, var(--ra-ready-low) 30%, var(--ra-border))`. Mixing 30% of an opaque color with 70% of a *translucent* color in `color-mix()` produces a result with reduced alpha (roughly 65–70% opaque, not 100%), which will look different (more see-through) than it does today. This is not a bug to fix in this phase — CascadeWarningPanel belongs to a later deck-detail phase — but flag it so that phase's visual-regression baseline catches the shift rather than treating it as expected.

### 1.3 Foreground scale, in detail

The handoff has **five** text-weight tiers below "primary." The repo has **four**. Rather than force-fit five values into four slots (which would make two handoff tiers share one repo token and become visually indistinguishable), one new token is added:

`--ra-fg-primary` (ink) → `--ra-fg-secondary` (ink-2) → **`--ra-fg-tertiary` (dim, new)** → `--ra-fg-muted` (dim-2) → `--ra-fg-subtle` (muted)

This mapping is not arbitrary — it's anchored in the repo's *own* existing comments. `--ra-fg-secondary`'s current doc comment literally says "texto secundário forte" (secondary-strong text), which is the exact Portuguese phrase the handoff uses for `--ink-2`. `--ra-fg-muted`'s documented role ("eyebrow/caption large-text") matches the handoff's `--dim-2` ("labels/eyebrows") role description, not its contrast profile. `--ra-fg-subtle`'s documented role ("separator/ghost, never body text") matches `--muted`'s role ("ícones e texto terciário").

Contrast of the new dark values (all computed against both `--bg` `#0b0c0f` and `--surface` `#14161c`):

| Token | Value | on `--bg` | on `--surface` | AA body (≥4.5) |
|---|---|---|---|---|
| `--ra-fg-primary` | `#e8e6e1` | 15.68 | 14.50 | pass |
| `--ra-fg-secondary` | `#c8cad2` | 11.95 | 11.05 | pass |
| `--ra-fg-tertiary` (new) | `#8b8d96` | 5.91 | 5.47 | pass |
| `--ra-fg-muted` | `#7a7c84` | 4.70 | 4.34 | pass on `--bg`, **fails by 0.16 on `--surface`** — large-text only there |
| `--ra-fg-subtle` | `#5c5e66` | 3.03 | 2.80 | fails both — decorative/large-only (matches its existing documented role) |

**Every value in this table is higher-contrast than the token it replaces** (`fg-secondary` 8.24→11.95, `fg-muted` 3.39→4.70, `fg-subtle` 2.41→3.03, all vs. `--bg`). This is the argument that the swap is safe to ship on the 84+ files that reference these tokens without this phase touching them: no pairing this phase changes gets *harder* to read; several marginal ones get easier.

### 1.4 Accent

| Handoff token | Value | Slot | Old value | Change |
|---|---|---|---|---|
| `--acc` | `#d0a84c` | `--ra-accent` | `#c5923a` | value swap |
| `--acc-hi` | `#f0c060` | `--ra-accent-hi` **(new)** | — | added |
| `--acc-deep` | `#b8863a` | `--ra-accent-deep` | `#5a4218` | value swap (role unchanged: bg-fill/gradient-start, never text) |

**`--ra-accent-body` collapses in dark, stays split in light — and that asymmetry is intentional, not an inconsistency.** The old dark `--ra-accent` (`#c5923a`) was 6.98:1 on canvas — passes AA-large but not comfortably AA-body, which is why `--ra-accent-body` (`#d4a84a`) was introduced as a separate body-safe companion. The new `--acc` (`#d0a84c`) is 8.74:1 on `--bg` / 8.08:1 on `--surface` — it clears AA-body on its own. There's no longer a contrast reason to keep two dark values, so:

```
--ra-accent-body: var(--ra-accent);   /* dark: now an alias, same value */
```

59 consumers of `--ra-accent-body` keep working unedited and automatically pick up `#d0a84c`. **Light theme cannot do this** — its independently-derived `--ra-accent` (`#8f6a22`) is 4.38:1 on canvas, below AA-body — so light keeps the existing split (`--ra-accent` decorative-only, `--ra-accent-body` `#7d5e1d` for body text). Document this asymmetry explicitly wherever the token file is read, so a future session doesn't "fix" it by collapsing light too.

`--ra-accent-hover` (19 consumers): the handoff has no separate hover-state token — its stated hover rule is generic ("botões: escurecer/clarear 6–8%"). Rather than invent a new value, alias it to the new bright-gold token in dark: `--ra-accent-hover: var(--ra-accent-hi);` (`#f0c060` — a legible brightening on hover, consistent with "clarear"). Leave light theme's `--ra-accent-hover` (`#6f521a`) unchanged — on a light background, "brighter" would *reduce* legibility, so the existing darkened hover value already points the correct direction and needs no change. This hover-token choice is agent's discretion (the handoff doesn't specify a hover token); flag for confirmation if a screen's actual hover treatment reads too bright.

### 1.5 Status / semantic colors

| Handoff token | Value | Slot | Old value / old role | Change |
|---|---|---|---|---|
| `--ready` | `#63b678` | `--ra-ready-high` | `#6ea968` | value swap |
| `--miss` | `#d0645a` | `--ra-ready-low` | `#c0574a` | value swap — **see below, this resolves a known test failure** |
| `--warn` | `#c8843c` | `--ra-ready-mid` | `#c5923a` (was literally an alias of the old accent hex) | value swap — now genuinely distinct from `--acc` |
| `--building` | `#4a7fc0` | `--ra-status-building` | was `var(--ra-accent-dim)` (brass, not blue) | **repointed to an independent value** |
| `--idea` | `#8f7cf0` | `--ra-status-idea` | was `var(--ra-fg-muted)` (gray, not purple) | **repointed to an independent value** |

**`--miss` resolves the documented `ready-low` AA-body failure.** The current `--ra-ready-low` (`#c0574a`) sits at 4.35:1 on canvas — 0.15 below the 4.5:1 AA-body threshold. `contrast.spec.ts` (lines 183–199) carries a `describe.skip` block that documents this exact known failure, and `contrast-matrix.md` calls it "BORDERLINE." The handoff's `--miss` (`#d0645a`) computes to **5.26:1 on `--bg` / 4.87:1 on `--surface`** — a clean AA-body pass everywhere. When this phase's token values land, delete the `describe.skip` block and its two associated code comments (in `contrast.spec.ts` and `tokens.css`); they'll describe a bug that no longer exists.

**D5 (ready/active share one color) turns out to already be one line.** `--ra-status-ready` currently aliases `var(--ra-accent)` (gold) and `--ra-status-active` already aliases `var(--ra-ready-high)` (green) — they're *already different colors today*. The redesign's Home groups both statuses under the single green "Ativos" treatment (HOME-02: "Ativos · `--ready`"). The entire fix is repointing one alias:

```
--ra-status-ready: var(--ra-ready-high);   /* was var(--ra-accent) */
--ra-status-active: var(--ra-ready-high);  /* unchanged — already correct */
```

**`--ra-status-retired` needs no edit at all.** It already aliases `var(--ra-fg-subtle)`, and `--ra-fg-subtle`'s new value (`#5c5e66`, see §1.3) is the *exact literal hex* the handoff gives for "Aposentados" in the Home spec (`docs`: "Aposentados · `#5c5e66`"). This is a strong cross-check that the fg-scale mapping in §1.3 is correct.

**`--building` and `--idea` genuinely change role**, not just value: today both are recolored aliases of neutral/brass tokens (blue and purple don't exist anywhere in the current palette). They become the first true blue and true purple in the system. `--ra-info` (a pre-existing, unrelated blue used in 6 files for a different feature) is deliberately **not** reused or aliased for `--building` — the hues are close but not identical, and collapsing them would visibly deviate from the handoff's specified `#4a7fc0`.

### 1.6 Pitch colors (7)

| Handoff pitch | Value | Slot | Change |
|---|---|---|---|
| `red` | `#c0473e` | `--ra-pitch-red` | value swap (was `#b44a2e`) |
| `yellow` | `#d6a83e` | `--ra-pitch-yellow` | value swap (was `#c5923a`) |
| `blue` | `#4a7fc0` | `--ra-pitch-blue` | value swap (was `#4a6a94`) — **same hex as `--building`**, intentional per handoff (deck-status blue and pitch-blue are visually the same blue) |
| `colorless` | `#8a8d94` | `--ra-pitch-colorless` **(new)** | added |
| `weapon` | `#8a8d94` | `--ra-pitch-weapon` **(new)** | added — **aliases `--ra-pitch-colorless`**, because the handoff gives them the identical hex |
| `hero` | `#5a8f6b` | `--ra-pitch-hero` **(new)** | added |
| `equipment` | `#9c7b4a` | `--ra-pitch-equipment` **(new)** | added |

All existing `--ra-pitch-*` consumption is decorative (`background-color` on dots/borders — grep confirms no consumer uses a pitch token as text color), so none of these need a body-AA claim; large-text/decorative status applies uniformly for the base swatches above. **The base pitch tokens are for fills, borders, and dot/swatch treatments only — never for text.** §1.6a below adds the text-safe companion.

### 1.6a Pitch `-ink` tokens — text-safe companions (added after initial review)

The base pitch hexes in §1.6 were derived purely as decorative fills, matching every consumption site that existed when this design was written. The Library redesign introduces a new consumption site the handoff never anticipated — coloured pitch **text** (pitch pills, stat labels) directly on `--ra-bg-surface` — and two of the seven base hexes fail AA body size there:

| Base token | Value | on `--ra-bg-canvas` | on `--ra-bg-surface` | AA body (≥4.5) |
|---|---|---|---|---|
| `--ra-pitch-red` | `#c0473e` | 3.92 | 3.63 | **fails both** |
| `--ra-pitch-yellow` | `#d6a83e` | 8.88 | 8.21 | pass |
| `--ra-pitch-blue` | `#4a7fc0` | 4.74 | 4.38 | **fails on surface** |
| `--ra-pitch-colorless` | `#8a8d94` | 5.88 | 5.44 | pass |
| `--ra-pitch-hero` | `#5a8f6b` | 5.19 | 4.80 | pass |
| `--ra-pitch-weapon` | (= colorless) | 5.88 | 5.44 | pass |
| `--ra-pitch-equipment` | `#9c7b4a` | 4.98 | 4.60 | pass |

The handoff gives one hex per pitch and never distinguishes fill-use from text-use, so this gap is invisible from the handoff alone — it only surfaces once a real screen puts one of these colors on text, which is exactly what happened.

Following the naming pattern the repo already uses for this exact situation (`--ra-info-ink`, `--ra-path-c-ink`, `--ra-card-frame-{color}-ink` — a `-ink` suffix marking "the text-safe variant of this color family"), add one `--ra-pitch-{color}-ink` per pitch, both themes. Where the base already clears AA body on both backgrounds, the `-ink` token is simply an alias of the base (no reason to invent a second hex when the first one already works) — only red and blue in dark, and only yellow in light, need a genuinely new value:

**Dark theme:**

| Token | Value | on `--ra-bg-canvas` | on `--ra-bg-surface` | AA body |
|---|---|---|---|---|
| `--ra-pitch-red-ink` | `#d97068` **(new value)** | 6.02 | 5.57 | pass |
| `--ra-pitch-yellow-ink` | `var(--ra-pitch-yellow)` (alias — base already passes) | 8.88 | 8.21 | pass |
| `--ra-pitch-blue-ink` | `#6fa0d8` **(new value)** | 7.17 | 6.63 | pass |
| `--ra-pitch-colorless-ink` | `var(--ra-pitch-colorless)` (alias) | 5.88 | 5.44 | pass |
| `--ra-pitch-weapon-ink` | `var(--ra-pitch-colorless-ink)` (alias, matching weapon's base aliasing) | 5.88 | 5.44 | pass |
| `--ra-pitch-hero-ink` | `var(--ra-pitch-hero)` (alias) | 5.19 | 4.80 | pass |
| `--ra-pitch-equipment-ink` | `var(--ra-pitch-equipment)` (alias) | 4.98 | 4.60 | pass |

**Light theme** (backgrounds `--ra-bg-canvas #f5f1e8`, `--ra-bg-surface #ffffff`):

| Token | Value | on canvas | on surface | AA body |
|---|---|---|---|---|
| `--ra-pitch-red-ink` | `var(--ra-pitch-red)` (alias — base already passes: `#8b3518`) | 7.11 | 8.01 | pass |
| `--ra-pitch-yellow-ink` | `var(--ra-accent-body)` **(new — reuses the existing brass-body token, not a fresh hex)** | 5.34 | 6.02 | pass |
| `--ra-pitch-blue-ink` | `var(--ra-pitch-blue)` (alias — base already passes: `#2b4d7a`) | 7.62 | 8.59 | pass |
| `--ra-pitch-colorless-ink` | `var(--ra-pitch-colorless)` (alias) | 5.14 | 5.79 | pass |
| `--ra-pitch-weapon-ink` | `var(--ra-pitch-colorless-ink)` (alias) | 5.14 | 5.79 | pass |
| `--ra-pitch-hero-ink` | `var(--ra-pitch-hero)` (alias) | 5.45 | 6.14 | pass |
| `--ra-pitch-equipment-ink` | `var(--ra-pitch-equipment)` (alias) | 5.59 | 6.30 | pass |

The asymmetry mirrors §1.4's `--ra-accent`/`--ra-accent-body` split exactly: **dark needs real ink derivations for red and blue; light needs one only for yellow** (light's base yellow, `#8f6a22`, is the same value as `--ra-accent` and fails AA body on canvas at 4.38 for the same reason `--ra-accent` does — reusing `--ra-accent-body` for `--ra-pitch-yellow-ink` isn't a coincidence, it's the same underlying brass hue hitting the same threshold). No pitch color needed a new derivation in both themes at once.

**Which token to use where — this is the part the handoff can't tell you:**
- **Fill, border, dot, swatch, background tint** → the base token (`--ra-pitch-red`, etc.). Nothing about this role changes.
- **Text — pitch pill labels, stat counts, any place the pitch color itself is the glyph color, not a background** → the `-ink` companion (`--ra-pitch-red-ink`, etc.).

**Open question this phase does not resolve — flagged for whichever phase wires them up:** the app's current data model represents pitch as `1 | 2 | 3 | null` (red/yellow/blue/colorless). `CardArt.tsx`'s `resolvePitchKey()` maps *every* non-1/2/3 pitch — including hero, weapon, and equipment cards — to `'colorless'`; card `type` only selects the glyph, never the frame color (`apps/web/src/components/card-art/CardArt.tsx:114-120`). The handoff defines three additional swatches (hero/weapon/equipment) but no screen description in the handoff visibly distinguishes them from `colorless` in any concrete UI (Library's pitch stats are R/Y/B/— only four buckets; the deck-detail pitch-distribution bar is red/yellow/blue only). This phase adds the tokens because FND-01's acceptance criterion literally requires "the seven pitch colors" to exist and be mapped — it does **not** decide whether or how `CardArt` or the decklist group headers (`DECK-05`'s "Hero·Weapon·Equipment" group) should consume `--ra-pitch-hero`/`-weapon`/`-equipment` instead of falling through to colorless. That's a data-model + component decision for the Deck detail (DECK) or Library (LIB) workstream, not this one.

### 1.7 Satellite tokens (`*-bg` / `*-border` / `*-ink` / `*-dark` / `*-accent`)

`tokens.css` has ~15 hand-written rgba/hex "satellite" tokens derived from a base color at authoring time (e.g. `--ra-ready-low-bg: rgba(192, 87, 74, 0.10)`, where `192,87,74` is the *old* `--ra-ready-low`'s RGB, hardcoded, not computed from the variable). Changing the base token's value does **not** propagate to these — they are literals, not `color-mix()` expressions. Every satellite whose base color changes in this phase needs its own literal edit or it goes stale (mismatched hue against its own base token). Computed new values, alpha unchanged from today unless the handoff gives an explicit literal (it does for `ready-low`, see below):

| Satellite | New value | Basis |
|---|---|---|
| `--ra-accent-soft-bg` | `rgba(208,168,76,.14)` | new `--acc` RGB; alpha set to the handoff's literal nav-active value (FND-06, §5.3) rather than the old `.10` |
| `--ra-accent-soft-bd` | `rgba(208,168,76,.35)` | new `--acc` RGB, alpha unchanged (no handoff literal contradicts `.35`) |
| `--ra-ready-high-bg` | `rgba(99,182,120,.10)` | new `--ready` RGB, alpha unchanged |
| `--ra-ready-high-border` | `rgba(99,182,120,.40)` | new `--ready` RGB, alpha unchanged |
| `--ra-ready-mid-bg` | `rgba(200,132,60,.10)` | new `--warn` RGB, alpha unchanged |
| `--ra-ready-mid-border` | `rgba(200,132,60,.40)` | new `--warn` RGB, alpha unchanged |
| `--ra-ready-mid-accent` | `#d6954c` | same +14/+17/+16 RGB delta the old value applied to the old base — **derived, not from the handoff literally; sanity-check visually** |
| `--ra-ready-low-bg` | `rgba(208,100,90,.08)` | **handoff literal** — deck-detail status strip: `bg rgba(208,100,90,.08)`. RGB `208,100,90` is exactly `--miss`'s hex, confirming the mapping. Alpha corrected from old `.10` to the handoff's `.08`. |
| `--ra-ready-low-border` | `rgba(208,100,90,.25)` | **handoff literal**: `borda rgba(208,100,90,.25)` (same section). Alpha corrected from old `.40`. |
| `--ra-ready-low-dark` | `#984942` | same ~0.73 scale-down the old value applied to the old base — derived, sanity-check visually |

`--ra-info-*` and `--ra-path-c-*` have no handoff counterpart and are **left untouched** (out of the redesign's vocabulary, unrelated features). `--ra-ember*` is addressed separately in §1.8 below, since it needed its own decision rather than a blanket "left untouched."

**Recommendation, not a mandate for this phase:** converting these satellites to `color-mix(in srgb, var(--ra-X) <alpha>%, transparent)` would make them self-updating and prevent this exact drift from recurring. The codebase already uses `color-mix()` at consumption sites (`TopBar.module.css`, `ReviewsRow.module.css`, `CascadeWarningPanel.module.css`), so browser-support precedent exists. Doing this inside `tokens.css` itself is a larger, separate cleanup and is deliberately not bundled into this phase's diff.

### 1.8 `--ra-ember` — decision: keep the token, retire the reservation

The components workstream is right that the redesign's deckbox has no oxblood in it — the handoff's deckbox is hero-art, brass, and (for idea-status) purple, and nothing in the 11-screen handoff uses an oxblood/ember hue anywhere. `.impeccable.md`'s reservation of `--ra-ember` as "the deckbox SVG accent" no longer describes anything real.

But that reservation undercounts the token's actual footprint. Grepping consumers directly (not trusting the doc comment) turns up **`--ra-ember` in five usage sites across four files that have nothing to do with the deckbox**: `components/path-c-result.module.css` (border-top, background, plus `--ra-ember-hover`), `components/library/LibraryStatsBar.module.css` (a text `color`), `components/reviews/ReviewsBulkBar.module.css` (a `color-mix()` background/border tint), and `routes/_auth/decks.$deckId.module.css` (a border-top strip). None of these four files are touched by this phase or named in the handoff at all — `DeckboxDecoration.module.css`, the actual shell deckbox component, doesn't reference `--ra-ember` even once today (its SVG likely hardcodes the oxblood hex directly, outside the token system).

**Decision: keep the CSS custom property defined in `tokens.css`, unchanged; retire only its documented brand-palette reservation.** Deleting the token now would break four files this phase has no scope or context to fix (they belong to the path-c, Library, Swaps, and Deck-detail workstreams respectively), and the components workstream's framing ("both of that token's existing consumers") undercounts the real number — a full retirement needs those four files migrated first, which is a separate, scoped cleanup, not a side effect of this phase's token-value pass. What this phase *does* do: mark it in `tokens.css` as a legacy token retained only for its existing non-deckbox consumers, and correct `.impeccable.md` to stop calling it a reserved brand color (§6.2).

---

## 2. Color tokens — light theme

D4: light is ported, not retired, and `contrast.spec.ts` must stay green. Light backgrounds (`--ra-bg-canvas #f5f1e8`, `--ra-bg-surface #ffffff`, `--ra-bg-raised #ece7d8`) are **unchanged** — the handoff has no light-theme opinion, and these three are already tone-corrected and tested.

| Slot | New dark value | Light value | Basis | on canvas | on surface | on raised | AA body |
|---|---|---|---|---|---|---|---|
| `--ra-fg-primary` | `#e8e6e1` | `#1a1814` (unchanged) | existing, unaffected | 15.73 | 17.73 | 14.34 | pass |
| `--ra-fg-secondary` | `#c8cad2` | `#4f4a3f` (unchanged) | existing, unaffected | 7.82 | 8.81 | 7.13 | pass |
| `--ra-fg-tertiary` (new) | `#8b8d96` | `#635d4e` | derived: cool-neutral dark hue → warm mid-brown for legibility on parchment | 5.81 | 6.55 | 5.30 | pass |
| `--ra-fg-muted` | `#7a7c84` | `#726b58` (unchanged) | existing, already matches "labels/eyebrows" role | 4.71 | 5.30 | 4.29 | pass canvas/surface; marginal-fail raised (existing, documented) |
| `--ra-fg-subtle` | `#5c5e66` | `#9a937f` (unchanged) | existing, decorative-only both themes | 2.72 | 3.06 | 2.48 | fails (intentional, decorative-only) |
| `--ra-accent` | `#d0a84c` | `#8f6a22` (unchanged) | existing; **stays large/decorative-only in light** (see §1.4) | 4.38 | 4.94 | 3.99 | large-only |
| `--ra-accent-body` | alias of `--ra-accent` | `#7d5e1d` (unchanged) | existing body-safe companion | 5.34 | 6.02 | 4.87 | pass |
| `--ra-accent-hi` (new) | `#f0c060` | `#7d5c1c` | derived: light-mode "bright" gold needs to go *darker* to stay legible; close to existing accent-hover | 5.65 | 6.37 | 5.15 | pass |
| `--ra-accent-hover` | alias of `--ra-accent-hi` | `#6f521a` (unchanged) | existing, no change needed | 6.43 | 7.25 | 5.86 | pass |
| `--ra-accent-deep` | `#b8863a` | `#3d2c0e` (unchanged) | existing, decorative/fill only | 11.90 | 13.42 | 10.86 | n/a (never text) |
| `--ra-ready-high` (`--ready`) | `#63b678` | `#4a7a3e` (unchanged) | existing | 4.50 | 5.07 | 4.10 | pass canvas/surface (4.50 exactly clears); marginal raised |
| `--ra-ready-low` (`--miss`) | `#d0645a` | `#8b3518` (unchanged) | existing | 7.11 | 8.01 | 6.48 | pass |
| `--ra-ready-mid` (`--warn`) | `#c8843c` | `#7a5019` **(changed)** | derived: was aliased to the same value as `--ra-accent` (`#8f6a22`); given warn is now visibly distinct from accent in dark, light gets an equally distinct value | 6.23 | 7.03 | 5.68 | pass |
| `--ra-status-building` (`--building`) | `#4a7fc0` | `#3462a0` **(new)** | derived blue, own value (not reusing `--ra-info`'s `#2b6cb0` — kept as a separate, unrelated existing token) | 5.48 | 6.18 | 5.00 | pass |
| `--ra-status-idea` (`--idea`) | `#8f7cf0` | `#5c46a8` **(new)** | derived violet — no existing analog in the repo at all | 6.43 | 7.25 | 5.87 | pass |
| `--ra-pitch-hero` (new) | `#5a8f6b` | `#3f6b4c` | derived | 5.45 | 6.14 | 4.97 | pass (decorative use, not required) |
| `--ra-pitch-colorless` / `--ra-pitch-weapon` (new, aliased) | `#8a8d94` | `#6b6558` | derived | 5.14 | 5.79 | 4.68 | pass (decorative use, not required) |
| `--ra-pitch-equipment` (new) | `#9c7b4a` | `#7a5a30` | derived | 5.59 | 6.30 | 5.10 | pass (decorative use, not required) |
| `--ra-bg-surface-2` (new) | `#0e1016` | `var(--ra-bg-canvas)` (`#f5f1e8`) | no handoff light opinion; reuses the already-vetted canvas tone rather than inventing a new hex | n/a (a background, not text) | | | |

**Nothing this phase changes fails AA-body in light**, except the pre-existing, intentionally-decorative `--ra-accent`/`--ra-fg-subtle` split that already exists and is already tested. `--ra-fg-muted` and `--ra-ready-high` carry a pre-existing "marginal on raised" caveat that this phase does not introduce (same pattern already documented for `--ra-fg-muted` in the current matrix).

`--ra-border-subtle` / `--ra-border-strong` in light: **kept as opaque hex, unchanged** (`#e5dfc9` / `#b8af93`). Dark moves to a translucent white-overlay system because the handoff specifies `rgba(255,255,255,...)`; light has no handoff-specified overlay equivalent, and inventing an `rgba(0,0,0,...)` overlay to force theme-parity isn't warranted — the existing opaque light borders are already vetted and the handoff gives no reason to touch them. This is an intentional, flagged asymmetry between themes, not an oversight.

---

## 3. Typography

### 3.1 Font-family token mapping

| Handoff usage | Font | Existing slot | Old value | Consumers | Change |
|---|---|---|---|---|---|
| All UI text (labels, buttons, nav, inputs, body, metadata, eyebrows, badges) | Hanken Grotesque | `--ra-font-ui` | `"IBM Plex Sans", system-ui, ...` | 59 CSS files | value swap |
| Page/deck titles | Newsreader | `--ra-font-display` | `"Cinzel", ui-serif, Georgia, serif` | 67 CSS files | value swap |
| Readiness numbers (hero stats) | Newsreader | `--ra-font-ornament` | `"Cinzel Decorative", "Cinzel", serif` | 10 CSS files | **repointed to alias `--ra-font-display`** (not a separate family anymore — the handoff has no decorative-weight tier) |
| Wordmark, R monogram | UnifrakturCook 700 | `--ra-font-gothic` | already `"UnifrakturCook", "Cinzel", serif` | 1 CSS file (`TopBar.module.css` `.brandRathe`) | **no change** — this is already correct; note it explicitly so nobody "adds" UnifrakturCook loading again |

`--ra-font-sans` / `--ra-font-body` (back-compat aliases, both point at `--ra-font-ui`): unaffected, keep as-is.

**`--ra-font-serif` (IBM Plex Serif, 14 CSS files) and `--ra-font-mono` (JetBrains Mono, 29 CSS files) have no counterpart in the handoff's three-family list** (Hanken Grotesque, Newsreader, UnifrakturCook — the handoff's own Assets table names exactly these three as the Google Fonts to load, nothing else).

**Decided (orchestrator ruling, 2026-08-16, see §9): keep both `--ra-font-serif` and `--ra-font-mono` unchanged, still loading IBM Plex Serif and JetBrains Mono.** This phase's original draft proposed aliasing `--ra-font-serif` to `--ra-font-display` and dropping JetBrains Mono in favor of tabular-nums on Hanken Grotesque — those options are recorded below for context, but neither ships. The handoff's Assets table constrains what the three *new* families are used for; it says nothing about retiring families the handoff never mentions, and 29 (mono) + 14 (serif) files' actual visual context was never individually reviewed as part of this design, so consolidating on an inference from silence was the wrong default. Revisit only if a later phase finds a specific surface where the extra family reads as visibly wrong.

- **`--ra-font-serif`**: sample consumers (`LibraryEmptyState`, `ImportFabraryCard`, `StartScratchCard`, `AuthLayout`, `SubstitutionRow`) suggest italic/flourish treatments — plausibly the same role as the Sign-in page's "citação em itálico" the handoff describes. The considered-and-rejected option was aliasing `--ra-font-serif: var(--ra-font-display)` (Newsreader also renders italic well) to consolidate to 3 loaded families — not taken, per the ruling above.
- **`--ra-font-mono` (29 consumers)**: the old design principle reserved mono for "percentages, counts, money" — the handoff's type scale table has no monospace entry, and its readiness numbers are explicitly Newsreader, not mono. The considered-and-rejected option was dropping JetBrains Mono from the font request and repointing `--ra-font-mono: var(--ra-font-ui)` with `font-variant-numeric: tabular-nums` — not taken, per the ruling above. JetBrains Mono stays in the Google Fonts request unchanged.

### 3.2 Type scale

**The single largest global visual change in this phase**: `--ra-text-body` (the default `body { font-size }`, 46 consumers, and the value every unstyled paragraph in the app inherits) moves from `1rem` (16px) to `14px`. The handoff's entire scale tops out its "standard" tier at 14px ("corpo padrão, nav, inputs") — there is no 16px anywhere in its scale table. This is a deliberate, app-wide density change flowing from the token, not a mistake; call it out explicitly in the phase's PR description, because every page's default running text shrinks the moment this lands, including pages no later phase has touched.

| Handoff size | Role | Slot | Old value | Change |
|---|---|---|---|---|
| 10.5px | badges/tiny counters, uppercase | `--ra-text-2xs` **(new)** | — | added |
| 11px | eyebrows, uppercase | `--ra-text-caption` | `0.6875rem` (11px) | **no change** — already correct |
| 12px | metadata, captions | `--ra-text-xs` (legacy alias) | `0.75rem` (12px) | **no change** — already correct |
| 13px | secondary body, small buttons | `--ra-text-small` | `0.875rem` (14px) | value swap |
| 13.5px | card body | `--ra-text-card-body` **(new)** | — | added |
| 14px | standard body, nav, inputs | `--ra-text-body` | `1rem` (16px) | **value swap — the app-wide change above** |
| 15px | page subtitle | `--ra-text-subtitle` **(new)** | — | added |
| 17–18px | card titles | `--ra-text-h3` | `1.125rem` (18px) | **no change** — already sits at the top of the handoff's range |
| 30–38px | page/deck titles | `--ra-text-h1` | `2.25rem` (36px) | **no change** — already within range; only its font-family and weight change (below) |
| 28–54px | readiness numbers | `--ra-text-hero` | `3.25rem` (52px) | **no change** — already within range; only font-family changes |

`--ra-text-h2` (24px, uppercase Cinzel, the `.ra-h2` utility) **has no counterpart anywhere in the handoff.** Section/group headers that might look like an "h2" (e.g. Home's group headers) are specified as Hanken Grotesque 15px/700 in the handoff, not the display serif at all. Flagged, not resolved here: whichever phase implements Home's group headers (`HOME-02`) should confirm whether `h2`/`.ra-h2` gets retired or repurposed — this phase does not decide it, since it's a component-level call, not a token-level one.

The legacy scale aliases (`--ra-text-xs/sm/base/lg/xl/2xl/3xl/4xl/5xl`) are currently **hardcoded independent rem literals**, not `var()` references to the primary scale tokens they duplicate — e.g. `--ra-text-sm: 0.875rem` is a second, separate definition of the same 14px that `--ra-text-small` also defines, and today they happen to agree only because nobody has edited one without the other. Converting them to aliases (`--ra-text-base: var(--ra-text-body);` etc.) inside `tokens.css` is a zero-risk, in-file fix that prevents this phase's edits from silently going stale in the legacy family, and is included in this phase's scope since it's confined to the token file.

### 3.3 `global.css` — element-level rules and utility classes

Bare `<h1>`/`<h2>`/`<h3>` element selectors in `global.css` cascade to every page that renders those tags, **even on components that supply their own CSS-Module class** — a component's `.heading { font-family: ... }` only overrides what it explicitly declares; if it never sets `text-transform`, the global `h2 { text-transform: uppercase }` still applies. 18 files render bare `<h2>` today (`LibraryEmptyState`, `StatusShelves`, `LibraryGrid`, `VariantQueueDrawer`, others), and a sample check shows every one supplies its own class for layout/color but none resets `text-transform`. Fixing this at the global rule, not per-component, is the only way to guarantee no page silently keeps shouting uppercase titles the handoff explicitly doesn't want:

```css
h1, .ra-h1 {
  font-family: var(--ra-font-display); /* now Newsreader via §3.1 */
  font-weight: 500;        /* was var(--ra-weight-bold) / 700 */
  font-size: var(--ra-text-h1);
  line-height: 1.08;
  letter-spacing: -0.01em; /* was var(--ra-track-h1) / 0.04em */
}

h2, .ra-h2 {
  font-family: var(--ra-font-display); /* now Newsreader via §3.1 */
  font-weight: 500;
  font-size: var(--ra-text-h3); /* pending HOME-02 resolution above — do not assume 24px stays */
  line-height: 1.25;
  letter-spacing: -0.01em;
  /* text-transform: uppercase — REMOVED, contradicts the handoff on every screen */
}

h3, .ra-h3 {
  font-family: var(--ra-font-ui); /* now Hanken Grotesque via §3.1, unchanged from today's mechanism */
  /* size/weight otherwise unchanged */
}
```

Other `global.css` utility classes, by consumer count (grep for the class name in `.tsx`, plus bare-tag cascade where relevant):

| Class | Consumers | Disposition |
|---|---|---|
| `.ra-readiness-display` | 4 files (real usage) | font-family → Newsreader via `--ra-font-ornament` repointing (§3.1); no per-consumer edit needed |
| `.ra-diamond` (the ◆ motif) | 0 files | **retire outright** — the spec's Problem Statement explicitly bans this motif, and nothing renders it today, so removing it is zero-risk |
| `.ra-hero`, `.ra-eyebrow`, `.ra-caption`, `.ra-meta` | 0 `.tsx` consumers found | not referenced by any component today; leave defined (harmless) but do not extend their usage — new eyebrow/caption treatments should use the `--ra-font-ui` + the new 10.5–12px tiers directly, not these classes, since their current definitions still reference the retiring ornament/mono families |

---

### 3.4 Font loading strategy — FND-07

**Current state** (`apps/web/index.html`): a single render-blocking `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...&display=swap">`, preceded by `preconnect` hints. No self-hosting, no `@fontsource`-style package in `apps/web/package.json`. This is the existing, established pattern — no build-time font infrastructure exists to build on.

FND-07 has two independent requirements that pull in different directions, and no single change satisfies both without a real cost — this must be named, not asserted away:

- **"No blocking of first paint."** The current `<link rel="stylesheet">` *is* render-blocking today — the browser will not paint until that stylesheet is fetched (`display=swap` controls what happens to *already-rendered* text when the font arrives late; it does nothing about the initial paint being blocked on the CSS file itself). Making it non-blocking means loading it asynchronously — e.g. the standard `<link rel="preload" as="style" onload="this.rel='stylesheet'">` + `<noscript>` fallback pattern.
- **"No layout shift on swap."** Loading asynchronously guarantees the fonts arrive *after* first paint — meaning fallback-font text is what paints first, and swapping to the web font when it loads is exactly what causes shift, unless the fallback font is metric-matched to the real one (matching x-height / advance widths via `size-adjust`/`ascent-override`/`descent-override` in a local `@font-face` block). The CDN link alone, with or without the async trick, does not provide metric matching — Google Fonts' `css2` endpoint doesn't emit metric-adjusted fallback declarations.

**The combination that satisfies both halves is self-hosting** (download the three `.woff2` files, serve them from `apps/web/public/fonts/`, declare local `@font-face` rules with `font-display: optional` or `swap` plus a metric-matched fallback `@font-face` for each). That is a real infrastructure addition this repo doesn't have today (no self-hosted font pipeline, no fontsource dependency) — a genuine build/tooling decision, not a CSS-only token change.

**Recommendation for this phase, flagged as a tradeoff rather than asserted as sufficient:** keep the existing Google Fonts CDN approach (consistent with current convention, zero new build tooling), but convert the `<link rel="stylesheet">` to the async preload pattern to satisfy the *first-paint* half of FND-07. Layout-shift avoidance under this approach relies on the fallback stack already declared in each `--ra-font-*` token (`system-ui, -apple-system, sans-serif` / `ui-serif, Georgia, serif`) being reasonably close in shape to Hanken Grotesque / Newsreader — **this is not verified** (no browser measurement was taken as part of this design), and the acceptance criterion's "no layout shift" clause should be checked with an actual CLS measurement (e.g. Chrome DevTools Performance panel or a Lighthouse run against the shell) before this phase is marked verified, not assumed from the token change alone. If that measurement shows visible shift, self-hosting with metric-matched fallbacks is the fallback plan, at the cost of adding font files + `@font-face` infrastructure to the repo.

Font request drops `Cinzel` and `Cinzel Decorative` from the CDN URL (both fully superseded — see `--ra-font-display`/`--ra-font-ornament` in §3.1), adds `Hanken Grotesque` and `Newsreader` at the weights the handoff's typography table specifies, and keeps `IBM Plex Serif` and `JetBrains Mono` per the §3.1 ruling. `UnifrakturCook` stays, unchanged.

---

## 4. Spacing, radius, shadow

### 4.1 Radius — supersedes R6

The repo's current radius system is capped at 4px by an explicit, committed design rule: *"tight/architectural (2–4px)... capped at 4px per R6; pills reserved for badges"* (`tokens.css` comment, `.impeccable.md` doesn't currently mention R6 but inherits its effect). The handoff's radius scale runs from 6px to 16px for the same categories (badges, buttons, cards, panels) — **this phase supersedes R6 outright**; it is not a refinement of the old rule, it's a reversal of it, and `.impeccable.md` needs to say so explicitly (§6) so a future session doesn't "fix" a redesigned card's radius back down to 4px thinking it's honoring R6.

| Handoff tier | px | Slot | Old value | Consumers | Change |
|---|---|---|---|---|---|
| badges, small chips, internal faces | 6–7 | `--ra-radius-xs` **(new)** | — | — | added |
| small buttons, icon-buttons | 8–9 | `--ra-radius-sm` | `2px` | 52 files | value swap → `9px` |
| inputs, buttons, state chips | 10–11 | `--ra-radius-md` | `4px` | 52 files | value swap → `11px` |
| content cards | 14 | `--ra-radius-lg` | `4px` | 7 files | value swap → `14px` |
| large panels | 16 | `--ra-radius-xl` | `4px` | 0 files | value swap → `16px` (zero-risk, unused today) |
| pills, toggles, rings | ~100 | `--ra-radius-full` | `9999px` | 21 files | **no change** — functionally identical to 100px for any control shorter than 200px tall |

### 4.2 Spacing — the handoff breaks the existing 4px-grid naming

The repo's `--ra-space-N` tokens follow `N × 4px` exactly (`--ra-space-1` = 4px, `--ra-space-6` = 24px, etc.), with 54–80 consumers each on the smallest ones. The handoff's spacing steps (4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 34, 44, 60) include values that are **not multiples of 4** (6, 10, 14, 18, 22, 26, 34, 44) — they cannot be expressed by extending the existing `N × 4px` index scheme at any integer `N` without colliding with an existing token's meaning (e.g. a naive `--ra-space-6` for "6px" would collide with the existing `--ra-space-6` that already means 24px, breaking 46 consumers).

**Resolution:** add a second, self-describing token family alongside the existing index-based one, using the literal pixel value in the name so it can never collide or be confused with the index family:

```css
--ra-space-4px:  0.25rem;  /* = existing --ra-space-1, alias it */
--ra-space-6px:  0.375rem;
--ra-space-8px:  0.5rem;   /* = existing --ra-space-2, alias it */
--ra-space-10px: 0.625rem;
--ra-space-12px: 0.75rem;  /* = existing --ra-space-3, alias it */
--ra-space-14px: 0.875rem;
--ra-space-16px: 1rem;     /* = existing --ra-space-4, alias it */
--ra-space-18px: 1.125rem;
--ra-space-20px: 1.25rem;  /* = existing --ra-space-5, alias it */
--ra-space-22px: 1.375rem;
--ra-space-24px: 1.5rem;   /* = existing --ra-space-6, alias it */
--ra-space-26px: 1.625rem;
--ra-space-28px: 1.75rem;
--ra-space-32px: 2rem;     /* = existing --ra-space-8, alias it */
--ra-space-34px: 2.125rem;
--ra-space-44px: 2.75rem;
--ra-space-60px: 3.75rem;
```

Where a handoff value coincides with an existing index-token's output, define it as `var()` alias of that existing token (not a duplicate literal), so there remains exactly one source of truth per pixel value. The existing `--ra-space-1..12` family is **not deprecated or touched** — it keeps serving its 300+ existing consumers; the new `-px`-suffixed family is for handoff-driven spacing in redesigned components going forward. This is an agent's-discretion naming call (the handoff doesn't propose a token scheme, only raw pixel steps) — flag for confirmation if a shorter name is preferred.

### 4.3 Shadow

| Handoff shadow | Value | Slot | Old value | Consumers | Change |
|---|---|---|---|---|---|
| card | `0 10px 20px rgba(0,0,0,.45)` | `--ra-shadow` | `0 1px 3px rgba(0,0,0,.6), 0 1px 2px rgba(0,0,0,.3)` | 19 files | value swap — visibly deeper, intentional |
| flutuante (floating) | `0 16px 40px -12px rgba(0,0,0,.8)` | `--ra-shadow-md` | `0 4px 10px rgba(0,0,0,.55), 0 2px 4px rgba(0,0,0,.3)` | 11 files | value swap |
| hero banner | `0 40px 90px -30px rgba(0,0,0,.8)` | `--ra-shadow-lg` | `0 16px 40px rgba(0,0,0,.65), 0 4px 8px rgba(0,0,0,.3)` | 7 files | value swap |
| deckbox chão (floor) | `radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.6), transparent 70%)` | `--ra-shadow-deckbox-floor` **(new)** | — | — | added — **this is not a `box-shadow` value; it's a `background` value consumed by a pseudo-element** (`.ib2-back-scene::before` in the handoff's CSS). Named as a shadow token because that's its design role, but flag this explicitly for the deckbox (BOX) workstream so it isn't wired into a `box-shadow` property by mistake. |

`--ra-shadow-sm` (1 consumer) and `--ra-shadow-glow` / `--ra-inset` (0 consumers): no handoff counterpart, **left unchanged**.

---

## 5. App shell — nav active-item logic (FND-06)

### 5.1 The bug this phase fixes

Both `TopBar.tsx` and `BottomTabBar.tsx` independently compute active-item state today, and neither implements the handoff's rule:

```tsx
// TopBar.tsx (current)
data-active={pathname === '/home' || pathname.startsWith('/home/') ? 'true' : undefined}
// other items: pathname === item.to || pathname.startsWith(item.to + '/')
```

Under this logic, `/decks/$deckId` (deck detail) and `/decks/new` never activate Home; `/library-csv-sources` and `/add-cards` never activate Library. `BottomTabBar.tsx` has the identical gap (same two patterns, duplicated, not shared). The handoff's rule (Interactions & Behavior table): *"Library fica ativo também em Fontes e Add cards; Home fica ativo em Deck, Editar e Novo deck."*

### 5.2 Route reality check

Confirmed against `apps/web/src/routeTree.gen.ts` and the route files:

- Deck detail and its edit mode are **the same route** — `/decks/$deckId` with an optional `?edit=1` search param (`apps/web/src/routes/_auth/decks.$deckId.tsx:42-87`), not two separate routes. "Home active on Deck, Edit and New deck" therefore requires exactly two path checks (`/decks/$deckId` and `/decks/new`), not three — the edit state is a search param on the first, invisible to pathname matching.
- "Sources" is the route `/library-csv-sources` (file `library-csv-sources.tsx`), not `/library/sources` as the handoff's route-naming sketch suggests — the handoff's suggested routes section is a sketch, not binding (spec.md: handoff wins on pixel values, spec wins on scope/data model; route paths are neither — treat the actual `routeTree.gen.ts` as ground truth).
- `/add-cards` has three child routes (`/add-cards`, `/add-cards/manual`, `/add-cards/fabrary`, `/add-cards/csv`) — a prefix match on `/add-cards` covers all four correctly.
- `/reviews` is a legacy redirect to `/swaps` (`apps/web/src/routes/_auth/reviews.tsx`) and never renders as its own page — no nav-active handling needed for it.

### 5.3 Design: one shared helper, explicit map, not prefix-matching

Prefix matching (`pathname.startsWith('/library')`) happens to also match `/library-csv-sources` today — the right answer for an accidental reason (a hyphen, not a slash, follows the prefix). That's fragile: it silently breaks if a new route like `/library-settings` is ever added and shouldn't count as Library. Replace it with an explicit route-to-nav-key map, in one new file both `TopBar.tsx` and `BottomTabBar.tsx` import:

```ts
// apps/web/src/components/shell/nav-active.ts
export type TNavKey = 'home' | 'library' | 'swaps';

const HOME_PATHS: readonly string[] = ['/home', '/decks/new'];
const HOME_PREFIXES: readonly string[] = ['/home/', '/decks/'];
const LIBRARY_PATHS: readonly string[] = ['/library', '/library-csv-sources'];
const LIBRARY_PREFIXES: readonly string[] = ['/add-cards'];
const SWAPS_PATHS: readonly string[] = ['/swaps'];

export function resolveActiveNavKey(pathname: string): TNavKey | null {
  if (HOME_PATHS.includes(pathname) || HOME_PREFIXES.some((p) => pathname.startsWith(p))) return 'home';
  if (LIBRARY_PATHS.includes(pathname) || LIBRARY_PREFIXES.some((p) => pathname.startsWith(p))) return 'library';
  if (SWAPS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return 'swaps';
  return null;
}
```

`/decks/$deckId?edit=1` activates Home via `pathname.startsWith('/decks/')` alone — the search param never enters the check, matching the route-reality finding above. `/settings`, `/about`, `/onboarding`, and any unmatched path resolve to `null` — no nav item highlighted, which is the correct default the handoff never contradicts (it only specifies *which extra pages* count as Home/Library, not that every page must highlight something).

Both `TopBar.tsx` and `BottomTabBar.tsx` call `resolveActiveNavKey(pathname)` once and compare the result against each item's own key, replacing their separate inline per-item conditionals. This is a genuine shared-logic fix, not a token change — flagged here because FND-06's acceptance criterion is specifically about the active-item *rule*, and the current code doesn't implement it at all, independent of any token value.

### 5.4 Active-item visual treatment — canonical values

FND-06's literal text: *"o item ativo ganha `bg rgba(208,168,76,.14)` + texto `--acc`"* — no border is specified for nav, unlike other active-state treatments elsewhere in the handoff (Library filter pills use `.12`/`.3` border; Edit's status segments use `.14`/`.4` border). These are three different alpha pairs for conceptually similar "active" states, and picking one canonically here prevents each later phase from reinventing its own number.

**Canonical for nav** (`TopBar.module.css` `.navLink[data-active]`, and the equivalent `BottomTabBar.module.css` rule):

```css
background-color: var(--ra-accent-soft-bg); /* now rgba(208,168,76,.14) per §1.7 */
color: var(--ra-accent-body);               /* now #d0a84c in dark, aliasing --ra-accent per §1.4 */
border-color: transparent;                   /* was var(--ra-accent-soft-bd) — dropped: the handoff's nav rule names no border */
```

Filter pills (`.12`/`.3`) and edit segments (`.14`/`.4`) belong to HOME-05 and EDIT-02 respectively, out of this phase's scope — they should introduce their own locally-scoped values rather than assume `--ra-accent-soft-bg`/`-bd` covers every "active" case in the app; the three known alpha pairs are recorded here (§1.7, §5.4) so those phases don't each start from zero.

### 5.5 Footer / disclaimer survives unchanged

`apps/web/src/components/shell/Footer.tsx` (the `pre-launch-hardening` fan-content disclaimer + `/about` link) consumes only `styles from './Footer.module.css'` and i18n strings — no hardcoded colors, no font-family overrides beyond what it inherits from `global.css` body defaults. It requires **zero code changes** in this phase; it automatically renders in the new palette and body type scale once `tokens.css`/`global.css` land, satisfying AUTH-05's survival requirement by construction. Confirmed by reading the component directly — it has no dependency this phase touches beyond the ambient token cascade.

---

## 6. `.impeccable.md` and `docs/design/v1/contrast-matrix.md` (Cross-Cutting Requirement 5 / FND-05)

### 6.1 `contrast-matrix.md`

This phase adds and changes enough tokens that a line-by-line diff isn't sufficient — **every row needs recomputing, not just the new ones.** While verifying this design, two existing rows were spot-checked with the identical formula `contrast.spec.ts` uses and came back different from what the doc currently states: `--ra-fg-subtle` on canvas is **2.72**, not the doc's `2.57`; `--ra-fg-primary` on surface is **17.73**, not `17.56`. The doc's existing numbers already have small drift independent of this phase — recompute the whole table rather than trusting the old figures as a baseline to diff against.

Required content changes beyond the recompute:
- Replace the dark/light background swatches (`--bg`, `--surface`, `--surface-2`) and every fg/accent/status row per §1–§2 above.
- Add rows for every new token introduced here: `--ra-fg-tertiary`, `--ra-accent-hi`, `--ra-status-building`, `--ra-status-idea`, and the pitch additions (base and `-ink`, §1.6a).
- Remove or rewrite the note documenting `--ra-ready-low` as a known AA-body borderline/failure (§1.5) — it no longer applies.
- `contrast.spec.ts` itself needs the matching edits: update the hardcoded hex constants (`DARK_CANVAS`, `DARK_FG_SECONDARY`, etc. — the file's own header comment says these "must mirror `apps/web/src/styles/tokens.css`," and today nothing enforces that beyond a human keeping them in sync by hand — flag this as a latent risk, not something to fix in this phase), add `it()` blocks for the new tokens listed above, and delete the `describe.skip` block for the resolved `ready-low` failure.

**The `-ink` tokens from §1.6a need their own assertions, not just a row in this doc — a token that exists specifically to fix a contrast failure is the one case where "the table says it passes" isn't enough; the test has to say so.** Add, as new `describe` blocks (or extend the existing dark/light body-size blocks):

```ts
// New constants (dark)
const DARK_PITCH_RED = '#c0473e';
const DARK_PITCH_RED_INK = '#d97068';
const DARK_PITCH_BLUE = '#4a7fc0';
const DARK_PITCH_BLUE_INK = '#6fa0d8';

// New constants (light)
const LIGHT_PITCH_YELLOW = '#8f6a22';
const LIGHT_PITCH_YELLOW_INK = LIGHT_ACCENT_BODY; // '#7d5e1d' — same token, see §1.6a

describe('dark theme — pitch -ink tokens (AA body >= 4.5:1)', () => {
  it('--ra-pitch-red-ink on --ra-bg-canvas', () => {
    expect(contrast(DARK_PITCH_RED_INK, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
  it('--ra-pitch-red-ink on --ra-bg-surface', () => {
    expect(contrast(DARK_PITCH_RED_INK, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
  it('--ra-pitch-blue-ink on --ra-bg-canvas', () => {
    expect(contrast(DARK_PITCH_BLUE_INK, DARK_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
  it('--ra-pitch-blue-ink on --ra-bg-surface', () => {
    expect(contrast(DARK_PITCH_BLUE_INK, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});

describe('dark theme — pitch base tokens are documented fill/border only, not text', () => {
  // Negative assertions, kept skipped: these exist to make the fill/text distinction
  // executable, not just written prose. They document that the BASE token is not
  // meant to pass body-AA — if a future change makes it pass, that's fine (not a
  // failure), but if these ever start failing in the other direction it means the
  // base value moved further from AA, which is worth a human look.
  it.skip('--ra-pitch-red base is below AA body on surface (fill/border only, use -ink for text)', () => {
    expect(contrast(DARK_PITCH_RED, DARK_SURFACE)).toBeLessThan(AA_BODY);
  });
});

describe('light theme — pitch -ink tokens (AA body >= 4.5:1)', () => {
  it('--ra-pitch-yellow-ink on --ra-bg-canvas', () => {
    expect(contrast(LIGHT_PITCH_YELLOW_INK, LIGHT_CANVAS)).toBeGreaterThanOrEqual(AA_BODY);
  });
  it('--ra-pitch-yellow-ink on --ra-bg-surface', () => {
    expect(contrast(LIGHT_PITCH_YELLOW_INK, LIGHT_SURFACE)).toBeGreaterThanOrEqual(AA_BODY);
  });
});
```

The remaining `-ink` tokens (yellow/colorless/hero/equipment in dark; red/blue/colorless/hero/equipment in light) are aliases of bases that already pass — covering the base token's existing assertion also covers its `-ink` alias by construction, so no separate `it()` is needed for those; only the four values that are *genuinely new hexes* (red-ink and blue-ink in dark, yellow-ink in light) need dedicated tests. This keeps the suite proportional to what could actually regress.

### 6.2 `.impeccable.md`

Several sections state things this phase makes false, and `CLAUDE.md` points every future UI session at this file as the design source of truth — leaving it stale would misdirect the next session more than not writing it at all:

- **Brand Personality → "Arcane"** currently says *"Decorative accents (◆, roman numerals, hand-set type) belong."* This directly contradicts the spec's Problem Statement, which names the ◆ and roman numerals as defects being removed. Rewrite this line — the arcane/tactical/artisanal framing itself doesn't need to change, only this one sentence's example.
- **Aesthetic Direction → Palette**: full rewrite to the new hex values (§1), replacing "Brass accent `#d69e2e`" and the oxblood/parchment/pitch-frame paragraph. Drop `--ra-ember`'s billing as a reserved brand color entirely (§1.8) — it stops being introduced as "oxblood, reserved for the deckbox SVG" and, if mentioned at all, is noted as a legacy token kept only for four non-deckbox consumers pending their own migration, not as part of the redesign's palette.
- **Aesthetic Direction → Typography**: full rewrite — Cinzel → Newsreader, IBM Plex Sans → Hanken Grotesque, and (pending the §3.1 flags) note whether Cinzel Decorative/JetBrains Mono are dropped or retained.
- **Aesthetic Direction → Theme**: currently reads *"Light tokens exist but are not yet tone-corrected (Plan C). Do not optimize for light-theme appearance in Plan A deliverables."* This is **already stale independent of this phase** — `contrast-matrix.md`'s own status line says light was "resolved 2026-04-27, Plan C Unit 1." Since this phase is the one touching the file, fold in the correction: light is tone-corrected, tested, and — per D4 — actively maintained, not a deferred concern.
- **Design Principles**: item 1 needs more than a font-name update — it needs to document a split that didn't exist before. `.ra-readiness-display` hardcodes `color: var(--ra-accent)` (`global.css`), which is exactly why the new readiness medallion (CMP workstream) does **not** reuse it: the handoff's medallion number is a fixed cream (`#f0e4cc`/`#f0e4cc`-family) regardless of which color the surrounding ring is currently drawn in (`--ready`/`--acc`/`--building`, per CMP-02) — a number that changed color with the ring's status would be illegible against some ring colors and defeats the medallion's own "one glance, one number" purpose. So going forward there are **two distinct readiness-number treatments, not one**: the legacy `.ra-readiness-display` utility (kept, now Newsreader instead of Cinzel Decorative per §3.1, still brass-colored, still used wherever it's already consumed) for surfaces this redesign hasn't reached yet, and the new medallion's own fixed-cream number style, owned by the CMP workstream and not exposed as a shared global utility class. `.impeccable.md` should name both rather than implying `.ra-readiness-display` is still the one signature readiness treatment app-wide. No item currently states the R6 radius cap; if it's added elsewhere, it must be superseded per §4.1's reversal, not merely amended.

---

## 7. Tech decisions (non-obvious calls, summarized)

| Decision | Choice | Rationale |
|---|---|---|
| Rename vs. repurpose existing tokens | Repurpose values, keep names, wherever an existing slot's role matches a handoff concept | 84–91 files reference tokens by name only; a value swap propagates to every consumer for free, matching D1's "no half-redesigned gap" |
| `--ra-accent-body` in dark | Alias to `--ra-accent` (values now equal) | New `--acc` (`#d0a84c`) clears AA-body on its own; the split existed only because the old value didn't |
| `--ra-accent-body` in light | Keep split, unchanged | Light's independently-derived accent (`#8f6a22`) still fails AA-body; the split is load-bearing there |
| `--ra-border` (3rd tier) | Retire, alias to `--ra-border-subtle` | Dark theme already resolves both to the same hex today; light's difference is a sub-perceptible hairline shift |
| `weapon` pitch token | Alias `--ra-pitch-colorless` | Handoff gives both the identical hex (`#8a8d94`) |
| Spacing scale for non-4px-multiple steps | New `--ra-space-{N}px` family, alongside the existing index-based one, aliasing where they overlap | The handoff's steps aren't expressible in the existing `N×4px` index scheme without colliding with existing token meanings |
| Radius scale | Value swap in place, 4px cap superseded | Handoff is a full inversion of the R6 rule, not a refinement |
| `--ra-font-ornament` | Alias to `--ra-font-display` (Newsreader) rather than kept as a separate family | Handoff has no decorative-weight tier; readiness numbers are explicitly Newsreader |
| `--ra-font-mono` / `--ra-font-serif` retention | **Decided: keep both, unchanged** (orchestrator ruling, 2026-08-16) | Handoff's asset list constrains the 3 new families' use, not whether other families may exist; dropping a 4th sight-unseen on 29 (mono) / 14 (serif) files was the wrong default |
| Pitch `-ink` companions | Added per §1.6a, aliasing to base wherever the base already passes AA body | Library's pitch pills put pitch color directly on text; the base swatches were only ever verified as fills/borders |
| `--ra-ember` | Keep the token defined, retire only its brand-palette reservation | 5 usage sites across 4 non-deckbox files still consume it; deleting it now would break scope this phase doesn't own |
| Font loading | Keep Google Fonts CDN, switch to async-preload pattern | No self-hosting infra exists today; satisfies "no first-paint block" but leaves "no layout shift" unverified — self-hosting + metric-matched fallback is the fallback plan if CLS measurement fails |
| Nav active-item logic | Explicit route map in a shared helper, not prefix matching | Current prefix match on `/library` only works for `/library-csv-sources` by accident (hyphen, not slash); `BottomTabBar` duplicates the same broken logic independently |
| Nav active-item alpha | Canonical `.14` bg / no border, from FND-06's literal text | Handoff uses three different alpha pairs across nav/filter-pills/edit-segments for similar "active" states; nav's is the only one this phase's scope covers |

---

## 8. Requirement traceability

| ID | Covered by |
|---|---|
| FND-01 (token mapping, all colors) | §1, §2, §7 |
| FND-02 (Hanken Grotesque for UI text) | §3.1 |
| FND-03 (Newsreader for titles/readiness numbers) | §3.1, §3.2 |
| FND-04 (UnifrakturCook for wordmark/monogram) | §3.1 (no change needed — already correct) |
| FND-05 (`.impeccable.md` + contrast-matrix updates) | §6 |
| FND-06 (nav active-item rule) | §5 |
| FND-07 (font loading: no first-paint block, no layout shift) | §3.4 |
| Cross-Cutting 5 (design docs updated) | §6 |

Not covered here, explicitly out of this workstream's scope: CMP (medallion), BOX (deckbox), HOME, DECK, LIB, SWAP, EDIT, AUTH stories — each consumes the tokens and nav helper defined above but owns its own component design.

---

## 9. Open items requiring confirmation before or during implementation

> **Orchestrator rulings, 2026-08-16.** Items 2 and 3 are decided here so implementation is not blocked:
> **keep both `--ra-font-mono` and `--ra-font-serif` as they are.** Dropping a family that 29 and 14 files
> consume, without having looked at what those files render, buys nothing this phase needs — the handoff
> constrains what the three new families are used *for*, not what else may exist. Revisit only if a later
> phase finds a surface where the extra family is visibly wrong.
>
> **Additional requirement not in the list below:** the `describe.skip` block at
> `apps/web/src/styles/__tests__/contrast.spec.ts:193` ("borderline dark tokens — body-size failures
> documented as known") must be **un-skipped and passing** when this phase lands. §1.5 argues the new
> `--miss` value resolves the `--ra-ready-low` failure that block documents; if any assertion in it still
> fails after the token swap, that is a phase-1 defect to fix, not a skip to carry forward. A green suite
> with a skipped known-failure is not green.
>
> Items 1, 4, 5 and 6 stand as written.


1. **CLS measurement for FND-07** — the async-CDN font-loading recommendation is unverified for actual layout shift; measure before marking FND-07 verified (§3.4).
2. ~~`--ra-font-mono` retention~~ — **resolved by the ruling above: keep, unchanged.**
3. ~~`--ra-font-serif` retention~~ — **resolved by the ruling above: keep, unchanged.**
4. **`--ra-ready-mid-accent` and `--ra-ready-low-dark` derived values** (`#d6954c`, `#984942`) — computed by applying the old value's delta/scale to the new base color, not sourced from an explicit handoff literal; sanity-check visually (§1.7).
5. **`.ra-h2` / `--ra-text-h2` fate** — no handoff counterpart found; whether it's retired or repurposed is left to the phase that implements Home's group headers (§3.2, §3.3).
6. **`--ra-pitch-hero/-weapon/-equipment` consumption** — tokens exist per FND-01's literal requirement, but no handoff screen visibly distinguishes them from `colorless`; wiring them into `CardArt` or decklist group headers is a data-model decision for a later phase (§1.6).
7. **`--ra-ember` migration** — the token is kept defined (§1.8) but its 4 non-deckbox consumers (`path-c-result`, `LibraryStatsBar`, `ReviewsBulkBar`, `decks.$deckId`) were never asked whether they still want an oxblood treatment now that it's no longer a reserved brand color; a full retirement needs those files migrated by whichever workstream owns each, not assumed here.
8. **`--ra-pitch-{color}-ink` consumption** — the tokens and their contrast proof exist (§1.6a), but no component in this phase's scope consumes them; the Library workstream that surfaced the gap is responsible for actually using `-ink` for pitch pill text rather than the base token.
