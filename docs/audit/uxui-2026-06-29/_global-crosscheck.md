# Global cross-check (parent-run, complements per-cluster agents)

## Confirmed BAN violations
- BAN2 gradient-text: `apps/web/src/components/shell/TopBar.module.css:56-65` `.brandRathe`
  wordmark — linear-gradient(180deg,#f7e29a,#d69e2e,#a56619) + background-clip:text + color:transparent.
  Nuance: it's the brand wordmark (logo-like). ALSO uses legacy brass #d69e2e (current token is #c5923a) hardcoded.
  Options: (a) solid brass token fill, (b) make it a real SVG logo asset (exempt from text ban),
  (c) keep gradient but acknowledge as logo. Decision needed.
- BAN1 side-stripe border-left (3 real, confirmed pre-i18n; re-confirm line numbers on current main):
  - `apps/web/src/components/TestDeckResult.module.css` border-left:4px var(--ra-ready-mid)
  - `apps/web/src/components/path-c-result.module.css` border-left:3px var(--ra-ember)
  - `apps/web/src/routes/_auth/decks.$deckId.module.css` border-left:3px var(--ra-ember)

## False positives (do NOT flag)
- `components/home/StatusShelves.module.css` border-right:2px — CSS-drawn `.chevron`, not a stripe.

## Systemic signals (mostly healthy)
- Inline styles: ~1 total historically (AuthLayout.tsx). CSS-modules principle essentially clean.
- Reduced-motion: global.css has universal `*` reduce baseline → broad coverage exists.
  Only flag transform-based motion (lightbox tilt) needing its own reduce path.
- Modals (~7): delete-account, UploadResolveModal, DeleteSourceModal, DraftRestoreModal,
  SaveCascadeConfirmModal, ShoppingPanel, DiscardChangesConfirm. Most legit (destructive confirms).
  ShoppingPanel-as-modal is the candidate to reconsider (drawer/inline panel?).
- Old brass hex `#d69e2e` appears (TopBar) vs token `#c5923a` — raw-hex drift to sweep.

NOTE: line numbers above were captured on the feat branch pre-pull. Agents must re-confirm
exact line numbers against current main.

## SYSTEMIC THEME — focus suppression (confirmed by clusters A + B, swept globally)
`outline: none` appears in 17 CSS modules. Where it lacks a compliant
`:focus-visible { outline: 2px solid var(--ra-accent); outline-offset: 2px }`
replacement, it violates design principle 5 (and is an a11y blocker for keyboard users).
Blast radius (verify each in context — some may pair a proper focus-visible elsewhere):
- routes/auth-form.module.css:35, routes/sign-in.module.css:35 (flagged P1 by cluster A)
- components/onboarding/Step1PasteUrl.module.css:79 (flagged P0 by cluster B)
- components/csv-sources/CsvSourceRow.module.css:30,99,186; DeleteSourceModal.module.css:143
- components/deck-card-search/DeckCardSearchAutocomplete.module.css:42
- components/deck-detail/DeckNameInline.module.css:85; FormatDropdown.module.css:84;
  HeroDropdown.module.css:40; StatusDropdown.module.css:94; TagAutocompleteCombobox.module.css:19
- components/delete-account-modal.module.css:89
- components/library/LibrarySearchAddBar.module.css:41
- components/reviews/ReviewsRow.module.css:63
- components/ui/Toast/Toast.module.css:20 (Toast is non-interactive container — likely OK)
=> Treat as ONE consolidated synthesis theme: "Standardize focus-visible across inputs/custom controls."

## SYSTEMIC THEME — native window.confirm (ban: modals/native dialogs)
- `components/home/DeckCard.tsx:109` (LIVE — untrack confirm) — flagged P1 by cluster C.
- `components/tracked-deck-card.tsx:23` (DEAD component — see below).
=> Replace live one with inline two-step confirm or undo-toast.

## SYSTEMIC THEME — dead/unused components (cleanup)
Confirmed 0 non-test imports:
- `components/readiness-header.tsx` (also carries a target=_blank)
- `components/tracked-deck-card.tsx` (also carries a window.confirm)
- `components/home/ReadinessShelves.tsx` (superseded by StatusShelves)
1 import each (live, keep): substitution-row, mark-owned-button, path-c-result, TestDeckResult.
=> Synthesis theme: remove dead components (also erases 1 native-confirm + 1 _blank from the tree).

## TOUCH TARGETS < 44px (recurring across clusters B/C/F — sweep more in D/E/G/H)
Confirmed: home retired toggle 28px, untrack pin 34px (claims 44), library stepper 28px,
filter-rail drawer controls 30-32px, auth ghostBtn 36px. => Consolidated theme.

## target=_blank (verify rel=noopener noreferrer in D/G):
readiness-header.tsx:51 (DEAD), StoreProductLink.tsx:50, deck-detail/ReadinessHero.tsx:67,
deck-detail/DeckDetailSidebar.tsx:367. (5 rel usages exist; agents confirm pairing.)
