CLUSTER: Deck Detail — 10 findings (P0:1 P1:4 P2:3 P3:2)

---

### [P0] Side-stripe border ban on Path C banner
- surface: `decks.$deckId.tsx` → `.pathCBanner`
- where: `apps/web/src/routes/_auth/decks.$deckId.module.css:110`
- dimension: ban:side-stripe
- problem: `.pathCBanner` applies `border-left: 3px solid var(--ra-ember)` as a colored accent alongside a uniform perimeter border. The code comment explicitly frames it as "ember accent (3px ornamental)" — the comment acknowledges the decision, but the CSS rule is an exact match for the impeccable ban. The surrounding uniform border (`border: 1px solid var(--ra-path-c-border)`) already frames the callout; the 3px override is the banned pattern.
- why: Impeccable absolute ban: `border-left`/`border-right` > 1px as a colored accent on callouts/list items.
- fix: Remove the `border-left: 3px solid var(--ra-ember)` override (line 110). Reinforce the Path C signal through background tint alone (`--ra-path-c-bg`) or by adding a top-border ornament (`border-top: 2px solid var(--ra-ember)`) which is not specifically banned and reads as a header stripe rather than a category-stripe reflex.
- effort: S

---

### [P1] ReadinessHero not mounted — readiness has no unmistakable focal point
- surface: `decks.$deckId.tsx` → `DeckDetailLayout` → `DeckDetailSidebar`
- where: `apps/web/src/components/deck-detail/ReadinessHero.tsx` (exists but not imported by the route); `apps/web/src/components/deck-detail/DeckDetailSidebar.module.css:137–143` (active readiness display)
- dimension: visual hierarchy
- problem: `ReadinessHero.tsx` defines the 72px Cinzel Decorative effectivePercent number (`.ra-readiness-display`) as Column A's unmistakable focal point. The production route does not mount `ReadinessHero` — grep confirms it is only referenced by its own spec and an unrelated manual route. The active readiness display lives in `DeckDetailSidebar` at `--ra-text-h2` (~1.75rem) inside a 280px sticky sidebar, competing for space with hero art, format pill, legality badge, and shopping panel. At 1440px desktop, the biggest number the user sees is approximately 28px in a narrow column — not a focal point. The app's entire value prop ("What percentage of this deck can I play?") is buried rather than broadcast.
- why: Visual hierarchy principle: the primary number must dominate. The current layout inverts the hierarchy — the canvas (breakdown sections) fills 75% of viewport width but has no readiness signal at all. A first-time viewer scanning left-to-right encounters hero art → readiness number (sidebar) → card list, with no clear visual anchor saying "this deck is 87% ready."
- fix: Mount `ReadinessHero` in the canvas area (as a full-width banner above the breakdown sections or as the header of the main column), or increase the sidebar's readiness number to match `ReadinessHero`'s 4.5rem treatment and deduplicate the component. Whichever path is chosen, the `ReadinessHero.tsx` and `DeckDetailSidebar` readiness block should converge to one implementation.
- effort: M

---

### [P1] Touch targets below 44px on core interactive controls
- surface: SubstitutionRow, EditableCardRow, MarkOwnedButton, TagChipRow
- where:
  - `apps/web/src/components/deck-detail/SubstitutionRow.module.css:313-316` — `.row__btn { padding: var(--ra-space-2) var(--ra-space-3); }` renders Approve/Reject/Reset at ~27px height
  - `apps/web/src/components/deck-detail/SubstitutionRow.module.css:148-162` — `.changeBtn` same padding, same height
  - `apps/web/src/components/deck-detail/EditableCardRow.module.css:68-70` — `.stepperBtn { width: 24px; height: 24px; }` explicitly 24×24px
  - `apps/web/src/components/deck-detail/MarkOwnedButton.module.css:14-16` — `.btn { padding: var(--ra-space-2) var(--ra-space-3); }`, caption font, ~27px effective height
  - `apps/web/src/components/deck-detail/TagChipRow.module.css:31-36` — `.removeBtn { width: 16px; height: 16px; }`, explicitly 16×16px
- dimension: responsive / mobile
- problem: Every core action in the deck detail cluster — approving/rejecting substitutes, adjusting card quantities, marking cards owned, removing tags — is rendered as a sub-44px touch target. The substitution row buttons are the primary interaction for the app's value prop; on mobile they are nearly impossible to hit without mis-taps. The quantity stepper at 24px and the tag remove button at 16px are worse.
- why: Design principle 4: touch targets ≥ 44×44 on interactive elements. This surface is described as mobile-used "during in-person play sessions" — sub-44px targets are a P1 mobile usability failure.
- fix: Add `min-block-size: 44px; min-inline-size: 44px` to `.row__btn`, `.changeBtn`, and `.btn` (MarkOwnedButton). For `.stepperBtn`, replace `width/height: 24px` with a padding-based approach to keep visual size while expanding the hit area (`padding: var(--ra-space-3)`). For `.removeBtn` in TagChipRow, use a wrapping click target or `min-block-size: 44px; min-inline-size: 44px` with `overflow: visible`.
- effort: S

---

### [P1] Focus-visible wrong token on modal cancel/discard buttons
- surface: SaveCascadeConfirmModal, DraftRestoreModal
- where:
  - `apps/web/src/components/deck-detail/SaveCascadeConfirmModal.module.css:91` — `.cancelBtn:focus-visible { outline: 2px solid var(--ra-border-strong); }`
  - `apps/web/src/components/deck-detail/DraftRestoreModal.module.css:92` — `.discardBtn:focus-visible { outline: 2px solid var(--ra-border-strong); }`
- dimension: accessibility
- problem: These two modal secondary buttons use `var(--ra-border-strong)` (a gray border token) as the focus ring color instead of the system-specified `var(--ra-accent)`. On the dark surface (`#15171c`), `--ra-border-strong` likely fails the 3:1 WCAG focus indicator contrast requirement against the modal background and may be visually indistinguishable from the button's own border. When focus lands on "Cancel" or "Discard" in these high-stakes modals, the ring becomes invisible to low-vision users.
- why: Design principle 5: focus-visible must be `outline: 2px solid var(--ra-accent); outline-offset: 2px`. No deviation. `--ra-border-strong` is not an accent color and does not provide the required visual distinctiveness.
- fix: Replace `var(--ra-border-strong)` with `var(--ra-accent)` in both rules. These are non-destructive secondary buttons; using the accent ring is correct and consistent.
- effort: S

---

### [P1] CascadeWarningPanelBanner header implemented as div[role=button]
- surface: `CascadeWarningPanelBanner` (mobile edit mode)
- where: `apps/web/src/components/deck-detail/CascadeWarningPanel.tsx:196–212`
- dimension: accessibility
- problem: The collapsible banner header — "N cards may be illegal" + chevron toggle — is a `<div>` with `role="button"`, `tabIndex={0}`, `onClick`, and a manual `onKeyDown` handler covering Enter and Space. Native `<button>` elements handle activation semantics automatically (Space/Enter, activated state, disabled propagation, correct ARIA role emission) and are more reliably announced by screen readers. The div pattern is a known source of subtle SR bugs: some assistive technologies do not treat `role="button"` divs identically to `<button>` elements for virtual cursor navigation.
- why: Accessibility principle: native HTML semantics are more robust than ARIA role imitation, especially for interactive controls. The expand/collapse toggle of a critical edit-mode panel falls squarely within native button territory.
- fix: Replace the `<div role="button" tabIndex={0} onClick={...} onKeyDown={...}>` with a `<button type="button" onClick={...}>`. Remove the `onKeyDown` handler and the `tabIndex`. The Radix or browser default gives correct keyboard activation. The `aria-expanded` attribute transfers to the button element.
- effort: S

---

### [P2] Sidebar readiness sub-labels use --ra-fg-muted (contrast fail)
- surface: `DeckDetailSidebar`
- where: `apps/web/src/components/deck-detail/DeckDetailSidebar.module.css:183` (`.readinessMeta__count`) and `:189` (`.readinessMeta__raw`)
- dimension: color & balance
- problem: Both labels under the readiness % number use `color: var(--ra-fg-muted)`. The `ReadinessHero.module.css` comments explicitly document that `--ra-fg-muted` on the dark surface (`#15171c`) is only 3.13:1 — a WCAG AA body-text fail — and switched those same labels to `--ra-fg-secondary` (7.60:1). The sidebar readiness block is a parallel implementation that did not receive the same fix. The provisioned count and raw percent labels are small text (caption size) making the contrast requirement even harder to meet.
- why: Design principle 2: dark contrast must be AA (4.5:1 body). Caption-size text at 3.13:1 fails WCAG AA.
- fix: Change both `color: var(--ra-fg-muted)` at lines 183 and 189 to `color: var(--ra-fg-secondary)`. This mirrors the fix already applied in `ReadinessHero.module.css:156`.
- effort: S

---

### [P2] Skeleton renders 3-column layout at 960px; real layout is single-column until 1280px
- surface: `DeckDetailSkeleton` → transition to populated `DeckDetailLayout`
- where:
  - `apps/web/src/components/deck-detail/DeckDetailSkeleton.module.css:13–15` — `@media (min-width: 960px) { grid-template-columns: 1fr 2fr 1fr; }`
  - `apps/web/src/components/deck-detail/DeckDetailLayout.module.css:54–58` — `@media (min-width: 1280px) { grid-template-columns: 280px 1fr; }`
- dimension: states
- problem: At 960–1279px viewport width, the skeleton presents a 3-column layout (`1fr 2fr 1fr`) that structurally implies colA (hero/readiness), colB (breakdown), and colC (shopping) — matching the old 3-column design. The populated page renders a single-column stacked layout in this range (sidebar collapsed above canvas). The loading-to-loaded transition produces a jarring structural shift: 3 columns disappear, a sidebar appears above the canvas, and the column proportions change entirely. This is a layout flash on every deck navigation at typical laptop viewport widths.
- why: States dimension: loading states must structurally anticipate the populated state. A skeleton that shows wrong layout structure teaches the user to expect content in positions where it will not appear.
- fix: Update `DeckDetailSkeleton.module.css` to match `DeckDetailLayout`'s breakpoints: single-column below 1280px (with a sidebar-width block above), 2-column (`280px 1fr`) at ≥1280px. Retire the 3-column structure from the skeleton entirely.
- effort: M

---

### [P2] Focus-visible uses --ra-ready-low (semantic red) instead of --ra-accent on destructive buttons
- surface: CascadeWarningPanel, LegalityBadge, DiscardChangesConfirm
- where:
  - `apps/web/src/components/deck-detail/CascadeWarningPanel.module.css:163` — `.removeOneBtn:focus-visible { outline: 2px solid var(--ra-ready-low); }`
  - `apps/web/src/components/deck-detail/CascadeWarningPanel.module.css:195` — `.removeBtn:focus-visible { outline: 2px solid var(--ra-ready-low); }`
  - `apps/web/src/components/deck-detail/LegalityBadge.module.css:71` — `.badge--illegal:focus-visible { outline: 2px solid var(--ra-ready-low); }`
  - `apps/web/src/components/deck-detail/DiscardChangesConfirm.module.css:123` — `.discardBtn:focus-visible { outline: 2px solid var(--ra-ready-low); }`
- dimension: accessibility
- problem: Four components across the deck-detail cluster use `--ra-ready-low` (the semantic danger red) for the focus-visible outline on destructive-intent buttons. Using a semantic color for focus rings creates inconsistency: a keyboard user tabbing through the page encounters the standard brass accent ring on most elements but a red ring when landing on these specific buttons — before activating them. The ring signals danger on focus rather than serving as a consistent "where is focus" indicator.
- why: Design principle 5: focus-visible = `outline: 2px solid var(--ra-accent)`. No alternative color is specified. Semantic-color rings create an inconsistent focus indication model.
- fix: Change all four `outline: 2px solid var(--ra-ready-low)` to `outline: 2px solid var(--ra-accent)`. The danger semantics of the action are already communicated by the button's border color, text color, and label; the focus ring does not need to reduplicate them.
- effort: S

---

### [P3] Dead CSS classes in decks.$deckId.module.css never applied in the route
- surface: `decks.$deckId.tsx` route
- where: `apps/web/src/routes/_auth/decks.$deckId.module.css:5–68` — `.page`, `.layout`, `.colA`, `.colB`, `.colC` and their responsive variants
- dimension: layout, spacing & rhythm
- problem: The route stylesheet defines a complete 3-column grid layout (`.layout`, `.colA`, `.colB`, `.colC`) with responsive overrides, but the route TSX never references these classes. The route exclusively uses `<DeckDetailLayout>` (which has its own CSS module) plus the route-local `.pathCBanner`, `.errorMsg`, and `.retryBtn`. The 5 layout classes and their `@media` variants are dead code.
- why: Dead CSS in a stylesheet tied to the highest-traffic route degrades maintainability and creates a false paper trail — future engineers may try to hook into `.colA`/`.colB` assuming they are active, or keep updating classes that have no effect. The code comment "3-column grid: Hero (1fr) | Breakdown (2fr) | Shopping (1fr)" at line 40 compounds the confusion by describing a layout structure that no longer exists.
- fix: Delete lines 5–68 from `decks.$deckId.module.css` (`.page` through end of `.colC`). Verify no test or storybook references these class names before removing.
- effort: S

---

### [P3] BreakdownSections.tsx uses entry.cardIdentifier as lightbox title (should be entry.name)
- surface: `BreakdownSections` (used in `add-cards.manual.tsx`)
- where: `apps/web/src/components/deck-detail/BreakdownSections.tsx:112`
- dimension: UX writing
- problem: In the Exact matches card grid, the lightbox `name` parameter is set to `entry.cardIdentifier` (a raw API identifier string like `"iro001"`) rather than `entry.name` (the human-readable card name like `"Iron Maiden"`). The `DeckCanvas.tsx` equivalent (`ExactMatchesGrid`) correctly uses `entry.name`. The bug means that any surface still rendering `BreakdownSections` (currently `add-cards.manual.tsx`) shows the card identifier in the lightbox title bar instead of the card name.
- why: UX writing principle: labels must identify content in user-understandable terms. A lightbox displaying `"iro001"` instead of `"Iron Maiden"` fails basic content labelling.
- fix: Change `name: entry.cardIdentifier` to `name: entry.name` at line 112 in `BreakdownSections.tsx`. Verify that `DeckCanvas.tsx` remains the canonical implementation and consider deprecating `BreakdownSections.tsx` or aligning it to `DeckCanvas.tsx`'s slot-grouping structure.
- effort: S

---

COVERAGE: Files read: `apps/web/src/routes/_auth/decks.$deckId.tsx`; `apps/web/src/routes/_auth/decks.$deckId.module.css`; `apps/web/src/components/deck-detail/ReadinessHero.tsx`; `ReadinessHero.module.css`; `DeckDetailLayout.tsx`; `DeckDetailLayout.module.css`; `DeckDetailHeader.tsx`; `DeckDetailHeader.module.css`; `DeckDetailSidebar.tsx`; `DeckDetailSidebar.module.css`; `DeckCanvas.tsx`; `DeckCanvas.module.css`; `SubstitutionRow.tsx`; `SubstitutionRow.module.css`; `BreakdownSections.tsx`; `BreakdownSections.module.css`; `ModifiedViewBanner.tsx`; `ModifiedViewBanner.module.css`; `CascadeWarningPanel.tsx`; `CascadeWarningPanel.module.css`; `LegalityBadge.module.css`; `DeckDetailSkeleton.module.css`; `DeckDetailEmptyState.tsx`; `DeckDetailEmptyState.module.css`; `SaveCascadeConfirmModal.tsx`; `SaveCascadeConfirmModal.module.css`; `DraftRestoreModal.tsx`; `DraftRestoreModal.module.css`; `DiscardChangesConfirm.module.css`; `EditableCardRow.module.css`; `MarkOwnedButton.module.css`; `CardRowLegalityWarning.module.css`; `HeroDropdown.module.css`; `TagChipRow.module.css`.

Screenshots read: Both assigned PNGs — both render the "Add new deck" empty state (the visual fixture populates a deck-detail URL that resolves to the new-deck screen, not a populated deck). Neither screenshot shows the populated deck detail view, the substitution rows, the edit-mode canvas, or the sidebar readiness display. ALL visual-hierarchy, density, and color-balance observations in this report are therefore code-anchored only; no visual confirmation of the populated state was possible.

Not assessed: `StatusDropdown.tsx/css`, `FormatDropdown.tsx/css`, `DeckNameInline.tsx/css`, `SidebarCollapseToggle.tsx/css`, `StatusBullet.tsx/css`, `LegalityReasonsPopover.tsx/css`, `ShoppingPanel.tsx/css` — not read in this session due to depth budget. `LegalityReasonsPopover` in particular carries popover/focus-trap risk that remains unverified. `ShoppingPanel` mobile sticky-bar behavior is unverified visually. The cluster's overall density at 1280–1440px cannot be confirmed without a populated screenshot.
