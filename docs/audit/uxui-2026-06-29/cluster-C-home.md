CLUSTER: HOME (deck dashboard) — 7 findings (P0:0 P1:1 P2:5 P3:1)

---

### [P1] Native `window.confirm()` for untrack — banned modal pattern

- surface: DeckCard / home
- where: `apps/web/src/components/home/DeckCard.tsx:109`
- dimension: ban:modals-where-better-pattern-exists
- problem: The untrack destructive action triggers `window.confirm()` — a native OS dialog with zero dark-theme styling, blocks the event loop, ignores all brand typography and colour, and produces a jarring OS-chrome popup on the most frequented home action.
- why: Impeccable absolute ban: "modals where a better pattern exists." An inline two-step confirmation (tap pin → pin turns red with "Confirm?" state, tap again to confirm) or a post-action undo toast are both unambiguously better patterns here.
- fix: Replace with a two-stage pin interaction: first tap toggles the pin to a destructive-red "confirm remove" state; a second tap (or 3-second timeout) completes the untrack. Alternatively, fire the untrack immediately and offer an undo toast (5-second window). Either eliminates the native dialog.
- effort: M

---

### [P2] Old-brass hex `#d69e2e` drift on deckbox vessel — 7 instances

- surface: DeckCard / deckbox vessel SVG
- where: `apps/web/src/components/home/DeckCard.tsx:293,304,317,332,381,389`; `apps/web/src/components/home/DeckCard.module.css:204`
- dimension: color & balance
- problem: The deckbox vessel's SVG strokes and fills all use the hardcoded old brass `#d69e2e` (RGB 214, 158, 46) — the rim trapezoid border, lid border, inner lid detail, lid R-emblem fill, front-face border, and inner brass frame. `DeckCard.module.css:204` repeats it as `rgba(214, 158, 46, 0.3)` in the card stacking shadow. The active token is `#c5923a` (RGB 197, 146, 58) — more amber, less saturated yellow. The difference is visible against the oxblood SVG fill on the highest-visibility branded element of the page.
- why: Rubric explicitly flags `#d69e2e` (old brass) as a drift finding. Token-based colour is the contract; hardcoded hex on a signature element drifts whenever the token is adjusted.
- fix: Replace all `stroke="#d69e2e"` / `fill="#d69e2e"` SVG attributes with `stroke="var(--ra-accent)"` / `fill="var(--ra-accent)"`. Replace `rgba(214, 158, 46, 0.3)` in `DeckCard.module.css:204` with `rgba(197, 146, 58, 0.3)` or a semantic alpha token if one is defined.
- effort: S

---

### [P2] Retired shelf toggle: 28×28px touch target — below 44px minimum

- surface: RetiredShelf (StatusShelves)
- where: `apps/web/src/components/home/StatusShelves.module.css:81-83`
- dimension: accessibility
- problem: `.retiredToggle` is sized `width: 28px; height: 28px` with no compensating padding, yielding a 28×28px hit area. The chevron-down button is the primary affordance for revealing retired decks — a routine action on the daily home surface.
- why: Design principle 4: touch targets ≥ 44×44 on all interactive elements.
- fix: Add `padding: 8px; box-sizing: content-box` to `.retiredToggle` (bringing the clickable area to 44×44 while keeping the visual icon at 28×28), or increase the element size to 44×44 directly.
- effort: S

---

### [P2] Untrack pin hit area measures 34px, not 44px as claimed

- surface: DeckCard / UntrackPin
- where: `apps/web/src/components/home/DeckCard.module.css:627-641`; comment in `apps/web/src/components/home/DeckCard.tsx:217`
- dimension: accessibility
- problem: The code comment explicitly states "The 32×32 visual is padded out to a 44×44 tap target." The CSS gives `.untrackPinHit { width: 22px; height: 22px; padding: 6px; box-sizing: content-box }` → actual hit area = 22 + 6×2 = **34px** per axis. The claim is incorrect and the target is 10px under the minimum. This matters most during in-person play sessions (mobile use-case).
- why: Design principle 4: touch targets ≥ 44×44. The comment itself acknowledges the intent; the implementation doesn't deliver it.
- fix: Change to `width: 32px; height: 32px; padding: 6px; box-sizing: content-box` → 32 + 12 = 44px, matching the stated intent. Update the comment to reflect the new math.
- effort: S

---

### [P2] HomeSkeleton card shape mismatches deckbox vessel — layout shift on load

- surface: HomeSkeleton (home.tsx)
- where: `apps/web/src/routes/_auth/home.tsx:173-177`
- dimension: states (loading)
- problem: The skeleton card renders three horizontal bars (18px name + 14px meta + 32px readiness) inside a 140px min-height flat card. The loaded DeckCard renders as a tall portrait deckbox vessel (`aspect-ratio: 200/240`, max-width 264px, ~320px tall on a typical viewport). When the skeleton resolves, every card on the page changes height by ~2×, producing a visible layout shift. The code comment says the skeleton "mirrors the populated layout" but it does not.
- why: Dimension 6 (states): skeleton shapes must match loaded content to prevent layout shift and give users an accurate content preview. The skeleton's stated purpose ("no flash of empty") also fails if the shape difference is larger than the empty-state gap.
- fix: Replace the `skeletonCard` with a single `<Skeleton>` sized at `aspect-ratio: 200 / 240; max-width: 264px` — matching the deckbox vessel proportions. The shelf count and header skeletons can remain as-is.
- effort: S

---

### [P2] EducationalEmptyState: bare `<a href>` for internal routes

- surface: EducationalEmptyState
- where: `apps/web/src/components/home/EducationalEmptyState.tsx:69,75,83`
- dimension: states (empty)
- problem: All three internal navigation CTAs — "Track your first deck" (`/decks/new`), "Skip to Library" (`/library`), and "Go to Library" (`/library`) — use bare `<a href="…">` instead of TanStack Router `<Link>`, causing full-page reloads. This is the user's very first interaction with the app; a full reload after clicking the primary CTA is the worst possible first-impression latency.
- why: `PopulatedHomeHero.tsx:141` includes an explicit comment: "Uses TanStack `<Link>` instead of a bare `<a>`." The empty state is inconsistent with the populated state's own precedent. SPA navigation is the expected pattern.
- fix: Replace all three `<a href="…">` with `<Link to="…">` from `@tanstack/react-router`. Zero API surface change, no prop migration required.
- effort: S

---

### [P3] Hero aggregate-stat numbers use Cinzel display, not JetBrains Mono

- surface: PopulatedHomeHero
- where: `apps/web/src/components/home/PopulatedHomeHero.module.css:77-81` (`.statNumber`)
- dimension: typography
- problem: The three hero stats ("2 / 100% / 0") render in `var(--ra-font-display)` (Cinzel Semibold h1). The typography spec assigns JetBrains Mono to "numerals/counts/money" — all three values are aggregate counts or percentages. At h1 display scale the difference is visible: Cinzel proportional serifs vs. Mono tabular glyphs.
- why: Typography spec deviation. The rubric is explicit: "JetBrains Mono (numerals/counts/money)." No design exception is documented for display-scale counts.
- fix: Either (a) change `.statNumber { font-family: var(--ra-font-mono) }` and tune tracking/weight to match the h1 scale, or (b) document the explicit exception in the type spec that says "display-scale aggregate stats use Cinzel for the arcane aesthetic." Code and spec should agree; currently neither documents the exception.
- effort: S

---

COVERAGE:
Files read: `apps/web/src/routes/_auth/home.tsx`, `apps/web/src/routes/_auth/home.module.css`, `apps/web/src/routes/_auth/-home.helpers.ts`, `apps/web/src/components/home/PopulatedHomeHero.tsx`, `apps/web/src/components/home/PopulatedHomeHero.module.css`, `apps/web/src/components/home/DeckCard.tsx`, `apps/web/src/components/home/DeckCard.module.css`, `apps/web/src/components/home/ReadinessShelves.tsx`, `apps/web/src/components/home/ReadinessShelves.module.css`, `apps/web/src/components/home/StatusShelves.tsx`, `apps/web/src/components/home/StatusShelves.module.css`, `apps/web/src/components/home/EducationalEmptyState.tsx`, `apps/web/src/components/home/EducationalEmptyState.module.css`, `apps/web/src/components/home/AggregateCallout.tsx`, `apps/web/src/components/home/AggregateCallout.module.css`, `apps/web/src/components/home/TagFilterChips.tsx`, `apps/web/src/components/home/TagFilterChips.module.css`, `apps/web/src/i18n/locales/en-US/home.ts`, `apps/web/src/i18n/locales/pt-BR/home.ts`.

Screenshots read: `U8-auth-home-visual-dark-desktop.png` (no card art), `U8-auth-home-mixed-visual-dark-desktop.png` (with card art), `U8-auth-home-tag-filter-visual-dark-desktop.png`, `U8-auth-home-retired-collapsed-visual-dark-desktop.png`.

Components found but NOT rendered in the home route: `components/readiness-header.tsx` and `components/tracked-deck-card.tsx` — neither is imported by `home.tsx` or any home-cluster component. Not audited (out of scope for this cluster).

`ReadinessShelves.tsx` is similarly NOT imported by `home.tsx` (which uses `StatusShelves` exclusively). It appears to be a superceded component. Its CSS and logic are structurally identical to `StatusShelves` but readiness-tier-based instead of status-based. Not flagged since it does not render on the live home page.

Dimensions with no findings: visual hierarchy (deckbox vessel gives strong figure-ground, life-token is a correct focal point, hero left/stats right split reads cleanly), motion (lid + card-rise animations are purposeful, reduced-motion path handles lid and card transforms per-element as required), accessibility (aria-pressed on chips, role=meter on life token, aria-expanded + aria-controls on retired toggle, sr-only h3 in card — all correct), UX writing (both locales are complete, action verbs are consistent, empty state teaches rather than just stating absence), and signature/brand (deckbox vessel with R emblem, life-token as FaB life counter, brass diamond shelf markers, oxblood card frames — arcane/tactical/artisanal identity is present and coherent; no gradient-text, no side-stripe, no neon, no glassmorphism in this cluster). `.ra-readiness-display` is used correctly — only on effectivePercent within `HeroLifeToken`, not on the hero aggregate stats.

Mobile: assessed from CSS only (no mobile screenshot). `StatusShelves.module.css:184` and `ReadinessShelves.module.css:76` both have `@media (max-width: 480px) { grid-template-columns: 1fr }` — grid collapses to single column on narrow screens. `PopulatedHomeHero.module.css:131` collapses the hero to a column at 639px. `TagFilterChips` uses `flex-wrap` so chips reflow. Mobile overflow risk: the deckbox vessel max-width 264px with `align-self: center` and `width: 100%` should scale gracefully. Untrack pin hit-area (34px, noted above) is the primary mobile risk beyond the P2 finding already filed.
