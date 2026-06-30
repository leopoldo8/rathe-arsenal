CLUSTER: Reviews + Swaps + Shopping/Variant — 13 findings (P0:0 P1:3 P2:8 P3:2)

---

### [P1] ban:side-stripe — PathCResult header ember left border

- surface: PathCResult component / deck detail page
- where: `apps/web/src/components/path-c-result.module.css:19`
- dimension: ban:side-stripe
- problem: `.header` applies `border-left: 3px solid var(--ra-ember)` as a colored accent stripe on the Path C frame header block. The comment in the file explicitly names this the "ember left border" frame ornament. A 3px colored side stripe on a content block is the exact pattern the impeccable ban prohibits.
- why: impeccable absolute ban — `border-left` > 1px as a colored accent on cards/callouts/list items.
- fix: Remove `border-left: 3px solid var(--ra-ember)`. Differentiate the Path C frame using the full `border: 1px solid var(--ra-path-c-border)` perimeter already present (line 17) plus the `background: var(--ra-path-c-bg)` wash. The ember character can enter via the eyebrow color (`var(--ra-path-c-ink)`) or a top-border treatment using `border-block-start: 2px solid var(--ra-ember)`, which reads as a top accent rather than an editorial side stripe.
- effort: S

---

### [P1] ban:side-stripe — AlreadyTrackedCallout brass left border

- surface: TestDeckResult component
- where: `apps/web/src/components/TestDeckResult.module.css:101`
- dimension: ban:side-stripe
- problem: `.alreadyTrackedCallout` applies `border-left: 4px solid var(--ra-ready-mid)` on top of a full perimeter border (`border: 1px solid var(--ra-ready-mid-border)` at line 100). The 4px left stripe is a colored side-accent on an info callout — the canonical banned pattern.
- why: impeccable absolute ban — `border-left` > 1px as a colored accent on callouts.
- fix: Remove the `border-left: 4px solid var(--ra-ready-mid)` override. The existing perimeter border plus `background: color-mix(in oklch, var(--ra-ready-mid) 6%, var(--ra-bg-surface))` (line 99) already differentiates the callout. If extra emphasis is needed, increase the top-border to 2px or add a left-side indicator as an absolutely positioned `::before` pseudo-element with `width: 3px` and `inset-block: 0; inset-inline-start: 0` (this does not qualify as the banned stripe because it is a decorative element, not a border-left override).
- effort: S

---

### [P1] VariantQueueDrawer: focus trap absent on role="dialog" aria-modal="true"

- surface: VariantQueueDrawer
- where: `apps/web/src/components/variant-queue/VariantQueueDrawer.tsx:111-128`
- dimension: accessibility
- problem: The drawer sets `role="dialog"` and `aria-modal="true"` and focuses the close button on open, but there is no programmatic focus trap. Tab from the last focusable element inside the drawer (last DeckLink or section) moves focus into the page behind the backdrop. For keyboard and screen-reader users this is a dialog escape that breaks the expected modal contract implied by `aria-modal="true"`.
- why: WCAG 2.1 §2.1.2 (No Keyboard Trap) and the related ARIA dialog pattern require that focus stays within a modal dialog while it is open. `aria-modal="true"` does NOT implement trapping — it is only a hint to AT.
- fix: Add a focus-trap loop in the existing `useEffect` block (VariantQueueDrawer.tsx:111): query all focusable elements inside the `aside`, and on `keydown Tab` (Shift+Tab) cycle focus back to the last (first) element. A minimal approach uses `querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')` on the `<aside>` ref. Also track `document.activeElement` before opening and restore it on `onClose` (addressing the sibling P2 finding below).
- effort: M

---

### [P2] ReviewsRowList "no-subs" CTA says "Back to home" but navigates to Approved tab

- surface: ReviewsRowList / ReviewsEmptyState (no-subs variant)
- where: `apps/web/src/components/reviews/ReviewsRowList.tsx:86-91`; `apps/web/src/routes/_auth/swaps.tsx:213-224`
- dimension: UX writing
- problem: When `totalRowCount === 0` (no substitutions exist), `ReviewsRowList` renders `ReviewsEmptyState variant="no-subs"` and passes `onNavigateApproved` as the `onNavigate` prop. The CTA label resolves to `reviews.noSubsCta` = "Back to home" / "Voltar ao início", but the callback (`handleNavigateApproved`) navigates to `/swaps?state=approved` — still on the Swaps page, still showing an empty list. The label says "home" and the action goes nowhere useful.
- why: The label names a destination (home) that doesn't match the action; this violates the UX writing principle that labels describe what happens and the accessibility expectation that `aria-label` on buttons tells AT the true destination.
- fix: In `ReviewsRowList.tsx`, when `variant="no-subs"`, pass a home-navigation callback instead (e.g., `useNavigate` to `/`). Update `reviews.noSubsCta` copy to match whatever destination is chosen: "Back to home" if it goes to `/`, or omit the CTA entirely (pass `onNavigate={undefined}`) since there are no approved subs to view and navigating to the Approved tab is pointless.
- effort: S

---

### [P2] ReviewsFilters: `aria-pressed` on Popover triggers instead of `aria-expanded`

- surface: ReviewsFilters (Tier, Deck, Hero, Confidence chips)
- where: `apps/web/src/components/reviews/ReviewsFilters.tsx:133, 180, 231, 275`
- dimension: accessibility
- problem: All four filter chips pass `aria-pressed={active}` (or `aria-pressed={!isDefault}`) on the `<Popover.Trigger asChild>` button. `aria-pressed` is the ARIA attribute for toggle-buttons; Radix Popover triggers semantically disclose a panel and should use `aria-expanded`. Radix itself will inject `aria-expanded` on the trigger — having a developer-supplied `aria-pressed` alongside creates a conflicting attribute that confuses screen reader state announcements (a toggle button that is also a disclosure control).
- why: ARIA spec: `aria-pressed` is for toggle buttons with a pressed/unpressed state. `aria-expanded` is the correct attribute for controls that reveal/hide a panel. Conflicting attributes produce unreliable AT behavior.
- fix: Remove `aria-pressed` from all four filter chips. Radix Popover's Trigger already manages `aria-expanded` and `aria-haspopup="dialog"`. If the active/inactive visual state needs to be communicated, the CSS class `chip--active` is sufficient for sighted users; AT reads `aria-expanded` for the panel state.
- effort: S

---

### [P2] substitution-row `.rejectBtn` has no `:focus-visible` rule

- surface: SubstitutionRow (deck detail breakdown / PathCResult context)
- where: `apps/web/src/components/substitution-row.module.css` (entire file — no `:focus-visible` rule for `.rejectBtn`)
- dimension: accessibility
- problem: `.rejectBtn` has hover styling that changes color but no `:focus-visible` rule. In all other interactive elements across this cluster (ReviewsRow buttons, BulkBar buttons, filter chips, empty-state CTAs), `outline: 2px solid var(--ra-accent); outline-offset: 2px` is applied on `:focus-visible`. The reject button on inline substitution rows (which are embedded in the deck detail page) is the only interactive element in this cluster missing the standard ring.
- why: Design principle 5: focus-visible = `outline: 2px solid var(--ra-accent); outline-offset: 2px` on every interactive element. Absence is a P2 a11y gap.
- fix: Add to `substitution-row.module.css`: `.rejectBtn:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px; }`.
- effort: S

---

### [P2] ReviewsBulkBar aria-live region conditionally mounted — unreliable AT announcement

- surface: ReviewsBulkBar
- where: `apps/web/src/components/reviews/ReviewsBulkBar.tsx:59, 104-110`
- dimension: accessibility
- problem: `ReviewsBulkBar` returns `null` when `count === 0` and renders the full bar (including `aria-live="polite"`) only when items are selected. ARIA live regions must exist in the DOM before content changes to reliably trigger announcements. Because the element is unmounted/mounted on first selection and on deselection, screen readers do not receive the "N selected" announcement when the bar first appears.
- why: WCAG 2.1 §4.1.3 (Status Messages) + ARIA authoring guidance: live regions should be pre-mounted (empty) and populated in place; dynamically inserting a live region does not guarantee announcement across all major AT/browser combos.
- fix: Keep the `<div role="region" aria-live="polite" ...>` always mounted (outside the `if (count === 0) return null` guard). Move the return-null logic to the bar's inner content: when `count === 0`, render the outer live region but leave its content empty. CSS `visibility: hidden` or `display: none` on the inner `.inner` when `count === 0` will keep the DOM node inert without removing the live region.
- effort: S

---

### [P2] VariantQueuePill button touch target 34×34px (below 44×44 minimum)

- surface: VariantQueuePill (navbar)
- where: `apps/web/src/components/variant-queue/VariantQueuePill.module.css:13-17`
- dimension: responsive / mobile
- problem: `.button` is set to `inline-size: 34px; block-size: 34px` — 10px short of the 44×44px minimum on both axes. The pill appears in the navbar and is also the entry point for the price-fetch queue on mobile devices (where the app is used during in-person play sessions). At 34px the button is undersized for reliable touch input.
- why: Design principle 4: touch targets ≥ 44×44 on interactive elements. Mobile is the session medium during in-person play — this button is frequently needed there.
- fix: Change `inline-size` and `block-size` to `44px` in `.button`. Adjust `padding: 0` if the icon needs to stay visually centered. The icon itself can remain `18px` via explicit size on `.icon`.
- effort: S

---

### [P2] VariantQueueDrawer close button touch target 36×36px (below 44×44 minimum)

- surface: VariantQueueDrawer header
- where: `apps/web/src/components/variant-queue/VariantQueueDrawer.module.css:82-87`
- dimension: responsive / mobile
- problem: `.closeButton` is `width: 36px; height: 36px` — 8px short of the 44×44 minimum on both axes. The close button is the first focused element when the drawer opens and the primary escape route for keyboard and touch users.
- why: Design principle 4: touch targets ≥ 44×44 on interactive elements.
- fix: Change `.closeButton` `width` and `height` to `44px`. The button already uses flexbox centering, so the glyph inside will stay centered without further changes. Adjust gap in `.header` if the larger button crowds the title.
- effort: S

---

### [P2] VariantQueueDrawer: focus not returned to trigger element on close

- surface: VariantQueueDrawer / VariantQueuePill
- where: `apps/web/src/components/variant-queue/VariantQueueDrawer.tsx:111-128`; `apps/web/src/components/variant-queue/VariantQueuePill.tsx:44-57`
- dimension: accessibility
- problem: When the drawer closes (Escape key or backdrop click), `onClose` sets `open = false` which unmounts the `<aside>`. There is no mechanism to return focus to the pill button that opened the drawer. Focus is dropped to the document body, which is disorienting for keyboard and screen-reader users.
- why: ARIA dialog pattern: "When the dialog closes, focus should return to the element that activated the dialog." WCAG 2.4.3 Focus Order.
- fix: In `VariantQueueDrawer.tsx`, before the drawer closes, read `document.activeElement` (or accept a `triggerRef` prop from the caller) and call `.focus()` on the trigger. Simpler: in `VariantQueuePill.tsx`, add a `ref` to the pill `<button>` and call `buttonRef.current?.focus()` inside the `() => setOpen(false)` close handler, so focus reliably returns regardless of how the drawer was closed.
- effort: S

---

### [P2] Swaps row list: no visual grouping for multiple substitutes of the same original card

- surface: ReviewsRowList / ReviewsRow (populated Pending tab)
- where: `apps/web/src/components/reviews/ReviewsRowList.tsx:108-129` (flat map over rows)
- dimension: layout, spacing & rhythm / visual hierarchy
- problem: `ReviewsRowList` renders every `IReviewRow` as a flat, visually identical horizontal band. When a card has two or three viable substitutes, each row shows the same original card thumbnail on the left with a different substitute on the right — with no visual grouping that signals "these three rows all concern the same missing card." Users must read the card name on each row to detect the relationship. In long lists with repeated originals, the identical spacing and structure create a monotonous rhythm that buries the decision hierarchy: which original card is most critical vs. which has an easy substitute already picked.
- why: Audit dimension 1 (Visual hierarchy) and 4 (Layout, spacing & rhythm). The primary decision unit is the original card, not the individual pair row; the layout inverts this.
- fix: Group rows by `cardIdentifier` in `ReviewsRowList` before rendering. Render a group header (card name + original thumbnail, Cinzel small, muted brass border-bottom) followed by indented sub-rows for each substitute option. This converts the flat band pattern into a two-level hierarchy that makes the "pick the best substitute for Card X" task obvious. Effort scales to M because it requires a grouping pass in the render function and a new group-header CSS treatment.
- effort: M

---

### [P3] SubstitutionRow "Tier" label hardcoded in English — not i18n'd

- surface: SubstitutionRow (deck detail / PathCResult context)
- where: `apps/web/src/components/substitution-row.tsx:65`
- dimension: UX writing
- problem: `<span className={styles.tierBadge}>Tier {match.tier}</span>` hardcodes the English word "Tier" directly in the JSX. The ReviewsRow component (which handles the same data) uses `t('reviews.tierI')` / `t('reviews.tierII')` / `t('reviews.tierIII')` for localized tier labels. SubstitutionRow is the older component and was missed during the i18n migration; PT-BR users see "Tier 1" / "Tier 2" / "Tier 3" rather than a localized string.
- why: UX writing principle: all user-visible copy belongs in i18n files. The app is explicitly bilingual (PT-BR / EN-US).
- fix: Add `tierBadge: 'Tier {{tier}}'` to `decks.ts` in both locales (or use the existing `reviews.tierCheckboxLabel` pattern) and replace the hardcoded `Tier {match.tier}` with `t('decks.tierBadge', { tier: match.tier })`.
- effort: S

---

### [P3] VariantQueuePill status dot is color-only signal

- surface: VariantQueuePill (navbar)
- where: `apps/web/src/components/variant-queue/VariantQueuePill.module.css:49-68`
- dimension: color & balance / accessibility
- problem: The `.dot` uses color alone to encode three states: brass/gold (active), green (done), red (failed). No shape, icon, or pattern differentiates the states visually. Users with red-green color blindness (~8% of males) cannot reliably distinguish `.done` from `.failed`. The button's `aria-label` covers the a11y base for screen readers, but the sighted color-blind user receives no visual signal.
- why: Design principle — avoid color-only signaling for meaningful state. Audit dimension 8 (Accessibility).
- fix: Pair each dot state with a minimal shape cue: `.active` keeps the pulse animation; `.done` adds a `✓` glyph inside the dot (as SVG or pseudo-element) at ~6px; `.failed` adds a `✕`. Since the dot is 9px, the glyph can be omitted at this size — an alternative is to use shape: circle for done, diamond clip-path for failed, animated ring for active. The aria-label already covers AT; this fix is purely for sighted color-blind users.
- effort: M

---

COVERAGE: Files read: `routes/_auth/swaps.tsx`, `routes/_auth/swaps.module.css`, `routes/_auth/-swaps.helpers.ts`, `routes/_auth/reviews.tsx`; `components/reviews/ReviewsTabs.tsx`, `ReviewsTabs.module.css`, `ReviewsFilters.tsx`, `ReviewsFilters.module.css`, `ReviewsRowList.tsx`, `ReviewsRowList.module.css`, `ReviewsRow.tsx`, `ReviewsRow.module.css`, `ReviewsBulkBar.tsx`, `ReviewsBulkBar.module.css`, `ReviewsEmptyState.tsx`, `ReviewsEmptyState.module.css`; `components/variant-queue/VariantQueueDrawer.tsx`, `VariantQueueDrawer.module.css`, `VariantQueuePill.tsx`, `VariantQueuePill.module.css`; `components/substitution-row.tsx`, `substitution-row.module.css`; `components/ShoppingLine.tsx`, `ShoppingLine.module.css`, `ShoppingLineFetchControls.tsx`, `ShoppingLineFetchControls.module.css`, `StoreProductLink.tsx`; `components/path-c-result.tsx`, `path-c-result.module.css`, `TestDeckResult.tsx` (first 60 lines), `TestDeckResult.module.css`; `i18n/locales/en-US/reviews.ts`, `i18n/locales/pt-BR/reviews.ts`, `i18n/locales/en-US/variantQueue.ts`, `i18n/locales/pt-BR/variantQueue.ts`. Screenshots read: `Visual-regression-—-dark-desktop-1440x900-U8-auth-swaps-visual-dark-desktop.png` (shows Swaps page, empty/no-subs state, Pending tab active, empty state "ALL PLAYABLE AS WRITTEN" with "Back to home" CTA).

CANNOT ASSESS — reviews route: `/reviews` is a redirect shim to `/swaps`; there is no reviews-specific UI to audit. No screenshot exists for the populated (non-empty) Swaps row list — findings on populated-state visual hierarchy (F11) are from code inspection only and cannot be confirmed against a rendered screenshot. `ShoppingLineVariantBreakdown.tsx` and `breakdown-list.tsx` were not read; variant breakdown table and breakdown-list UX are unverified in this audit pass. Mobile behavior verified only via CSS `@media` rules — no mobile screenshots available for any surface in this cluster. `TestDeckResult.tsx` was read only partially (first 60 lines) — the body of the component (Path A/B/C branch rendering) was not read; any findings specific to that portion are not covered.

Typography dimension: this cluster is clean — body IBM Plex Sans, display Cinzel used only for headers and tab labels, JetBrains Mono used correctly for counts and prices. Cinzel Decorative 900 (`.ra-readiness-display`) is not used anywhere in this cluster — no dilution found. Color-only signaling within ReviewsRow decision badges (approved/rejected) is not color-only: both states carry icon glyphs (✓ / ✕) and text labels in addition to color. Gradient text ban: not present in this cluster.
