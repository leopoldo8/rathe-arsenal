# Implementation notes

## Deviations

### S20 (batch 15)

- C231 is closed here: `GET /api/shared/decks/:token` (missing intent) gives a signed-in visitor `spare` per card and `spareNeedsRule`; the group page shows "Você tem 3 · 1 sobrando" and, while the rule is owed, only the question (the counts and the offer buttons wait for the answer).
- Migration `1778533612000-AddSpareRule` adds `spareRule`, `sellClosingLine` and, only where missing, `shareClosingLine` (journey 4 already added it in `1778533611000`); `down` removes all three, as C258 says. The check on `spareRule` is also on the entity so a synchronized database gets it.
- The spare function is `collection/spare/spare-copies.ts` (pure) behind `SpareCopiesService` (reads active imports by version, live decks and the rule) and `SpareViewService` (the `GET /api/collection/spare` answer). Plan `Surface` rows were added before the code (the answer's shape, `sellClosingLine` on `/auth/me`, `spare` on the group page).
- A deck's hero, weapon and equipment slots count as use, because readiness counts them as copies the deck needs; the Tutor's old sum left the hero out.
- With no rule stored and no card shared between holding decks, every rule gives one count, so the readers use `per_deck` (it never overstates the spare). The Tutor reads the same function now: its `get_collection` and swap candidates stop counting retired and Ideia decks and count the hero, and they use that fallback while a player still owes the question. Its test (`chat-tools.e2e-spec.ts`, "get_collection lists owned copies...") passed unchanged.
- Foil order a deck holds first is Cold, Rainbow, Gold, regular, unknown (the plan's assumption); inside one finish the order is printing code, edition, condition, only to be deterministic.
- `GET /api/collection/spare` rows carry the six fields of C256 plus what the page draws (`name`, `pitch`, `imageUrl`, `setName`, `foilFinishes`, `suggestedCents`, `storeCents`); `why` is per card and `ideaDecks` names each Ideia deck with the card it uses most.
- The want-list reader (`SharedListViewService.view`) now gives a signed-in visitor of a want list `owned` and `spare` per line and `spareNeedsRule`; `spareReason` and the trade screen are S23's.
- Screens: the rule question and "Por que sobra?" are full pages inside the "Sobrando" route (the mockups draw a page with a back link, not a bottom sheet); on the group page the question sits under the page heading with no back link. The settings screen gets a "Cartas sobrando" panel that opens the same question (no mockup draws it, see Needs the owner).
- Tests I changed because a constructor or a fixture shape moved, assertions untouched: `shared-deck-view.service.spec.ts`, `shared-list-view.service.spec.ts`, `preview-missing.spec.ts` (api), `-settings.spec.tsx` (stubs `useSpareQuery` so the page renders with no query client) and `SharedMissingPage.spec.tsx` (its api mock also answers `useApiClient`).

### Stand-in size fix (batch 14, commit before S18)

- `planSuggestedUses` (what "Usar as N" posts) now sizes a use with `computeNeededOnSide(..., 'deck')`, the side `moveCopies` moves by default, so a use adds as many stand-in copies as it removes from the original on the deck side (design rule 7: a use covers only the copies it covers). Inventory copies still missing are not covered by "Usar as N". It fixes the bug S17 left open (see the S17 bullet below).
- The existing row "every missing copy is already held by an active replacement" of `plan-suggested-uses.spec.ts` gained `side: 'deck'` on its replacement fixture, because a real row always carries a side and the new size reads it; its assertion is unchanged. The new case "sizes a use on the deck side only" failed first with 3 copies added against 2 removed.

### S18 (batch 14)

- One migration, `1778533611000-WidenShareChecks`, widens the four checks of door 11 (`share_link.intent`, `share_event.intent`, `share_event.kind`, `user.referredVia`) and adds `user.shareClosingLine` (the part of door 12 this journey needs; `spareRule` and `sellClosingLine` stay with S20 and S21). Its proof (C238) lives in `quote-intent.migration.int-spec.ts` and is written here because `offer` events need the widened kind. `DatabaseModule` also swaps the four checks on a synchronized database that still carries the old lists, as it already does for the import kinds, because `synchronize` compares checks by name only.
- The `missing` page reads the owner's list the way the owner sees it: `DeckMissingService.missingFor(userId, deckId, 'read')`, which never queues a lookup (the owner's call keeps `'queue'`). So a stand-in held by an active replacement is no longer asked for on the group page; before it was, because the old reader ignored replacements. `missing[]` keeps its place in the answer and each card gains `state`, `unitPriceCents`, `lineCents`, `availableCopies`, `foilOnly`, `promoOnly`, `productUrl` and `owned` (the signed-in visitor's own count, null for anyone else and for the owner); `storeSummary` is `{copies, cents}` of the priced cards.
- `GET /api/auth/me` also answers `shareClosingLine`, so the editor can offer the last line without another request (Surface row added in `plan.md`).
- `POST /api/shared/decks/:token/events` takes `{kind: 'offer' | 'quote_sent'}`; `buy` is S23's and answers `400` here. The owner's own taps answer `204` and write nothing.
- The link preview of a `missing` address now counts the copies the store cannot supply, as the group message does ("Caio procura 16 cópias: 3 Reckless Swing (Azul), ..."); when the store can supply every copy it names them all instead of saying "0". The preview image is unchanged (it still says how many cards are missing in all).
- C231 is not marked. Its claim needs the spare count ("Você tem 3 · 1 sobrando") from the spare function, which S20 builds; the page shows "Você tem N" (what the visitor owns, at most the copies asked) and the combined button, and the API answers `owned` per card. S20 adds `spare` and the rule question to the same rows, and then C231 can be closed.
- Existing proofs I had to change, because the screens or contracts they described were replaced by a picked mockup or a check:
  - `ShareDialog.spec.tsx`: "offers both intents" now checks only the deck line (the three lines are C224's new test); "disables the missing option" covers the quote option too; "marks the intents whose link is on" became "draws no badge on a link that is already on" (the mockup draws no badge); "choosing an intent turns that link on and shows its address, WhatsApp and the small actions" now runs on the deck intent, and a new case covers the missing intent; "switches the WhatsApp of this link only" now uses the deck link, and "opened from the shopping-list call to action" now expects the editor in place of the address row.
  - `SharedDeckPage.spec.tsx`, describe "missing-cards link": the header, the contact bar, the sign-up prompt and the matches request are gone from the page (`r3-group-phone` draws none of them), so those five cases were rewritten for the new page; "the missing tiles name the pitch" (C15) and "copies the list as text with the address" are unchanged.
  - `shared-deck-view.service.spec.ts` builds the view service with a stand-in group-ask service that returns the plain missing cards; its assertions are unchanged.
  - `share-meta-tags.spec.ts` and `share-preview.e2e-spec.ts`: the description reads "procura N cópias: 3 Pack Hunt (Vermelho), ..." in place of "procura N cartas: 3x Pack Hunt, ...".
- `sharedDeckModel.buildMissingMessage` and the keys `sharing.dialog.messageMissing`, `sharing.dialog.messageMore`, `sharing.contact.messageMissing` and `sharing.wanted.signUp*` are no longer used by any screen; they stay with their own tests.

### S19 (batch 14)

- `quote` joins `DECK_SHARE_INTENTS`, so `POST /api/decks/:deckId/share` creates or reuses the quote address (C390's test, renamed from "...for the intents that exist today" to the name C390 gives it, now loops over the three intents) and `DELETE` and `PATCH` accept it. `GET /api/decks/:deckId/share` still answers only `deck` and `missing`: the sheet asks `POST` for the quote address, which answers the one it already has, so no existing state assertion changed.
- `GET /api/shared/decks/:token` for a `quote` address answers exactly `intent`, `name`, `hero`, `sharerName`, `contactWhatsapp`, `needed` (each item `cardIdentifier`, `name`, `pitch`, `imageUrl`, `quantity`), built from the owner's list in read mode. `SharedDeckViewService.page` serves the three intents and `view` keeps serving the deck and missing pages only.
- The preview of a quote address: title "Orçamento: cartas para <deck>", description "<sharer> pede orçamento de N cópias.", image kind label "Orçamento"; it counts the copies the owner still needs.
- A sign-up from a quote link stores `user.referredVia = 'quote'`.
- `SharedTopBar` takes `offerSignUp` (default on): the group page and the quote page turn it off, because their screens draw only "Entrar".
- C249 is not marked. Its group-ask half is proven (`SharedMissingGallery.spec.tsx`), but the quote half cannot be: C239 says the quote answer holds exactly the keys `intent`, `name`, `hero`, `sharerName`, `contactWhatsapp`, `needed`, with exactly five keys per needed item, so the page has no field that tells deck copies from inventory copies, and C249 asks the quote page to say "4 do deck, 3 do inventário". The owner decides: add `inventoryQuantity` to the needed items (C239 changes), or drop the quote half of C249.

### S17 (batch 13)

- Plan `Surface`: three rows added (the shape of `GET /api/decks/:deckId/missing`, the `side` in the replacement response with the `409` for a quantity above the need, and the web page `/decks/:deckId/missing`).
- Door 2 migration `1778533610000-AddCardReplacementSide`; `card_replacement.side` is `deck` or `inventory`. A pick without `side` is a deck pick; the copies it may move are the deck's share of the missing copies of that card and slot (inventory share for `side: 'inventory'`), minus the active replacements on that side. `copiesHeld` of the legality check counts deck and inventory copies. `decideAdoption` with a `quantity` above the cut copies or above the room under the copy limit refuses with `REPLACEMENT_ILLEGAL` instead of clamping, so "exactly quantity" holds.
- `PUT /api/collection/owned` answers `400` for a total below what the other imports hold (`OWNED_TOTAL_BELOW_OTHER_SOURCES`, the assumption in the plan) and above the deck's copies of the card (`OWNED_TOTAL_TOO_HIGH`); a card not in the deck is `404` (C216 lists it with the unknown targets). A total that leaves the manual source at 0 deletes its row. The write reads the value it replaces under a row lock inside one transaction, so `previousManualQuantity` is exact; "Desfazer" sends `ownedElsewhere + previousManualQuantity` as the new total.
- `GET /api/decks/:deckId/missing`: a card fully covered by active replacements stays in `lines` with no copies needed so "Desfazer" can be reached. `lookingUp` and `noPrice` count cards; copies of those lines are in none of the five chips (C205).
- Prices come from the store's variant rows (cheapest first, greedy) or the listing row when a card has no variants; the old snapshot-equality check is not used. `promoOnly` reads the edition code with `^(pr|prm|promo)[-\s]?\d*$` ("PR24" is what the store's pages show); no promo list exists in the repository, so this is a guess to confirm.
- The count wording of C221 reuses S5's string: `deckDetail.stripMissingCopies` now takes `{{split}}` and the fragment "4 do deck, 3 do inventário" is the new key `deckDetail.missingSplit`, used by the status strip, the summary card, the list header (C222: "Faltam 7 cópias de 4 cartas · 4 do deck, 3 do inventário", the string the check quotes) and the split line of the summary (C223). With an inventory the deck card reads "Faltam 7 cópias (4 do deck, 3 do inventário)" and leaves out "(M cartas)".
- The chips are filters over the rows (default "Comprar na loja", which holds the priced, `looking_up` and `no_price` rows); the desktop table lists the active chip and, under "Comprar na loja", the two lower sections. "Já tenho" lists the lines of the response that have copies owned, which are the cards still partly missing.
- The status strip stays on the deck page and its "Ver o que falta" link now goes to `/decks/:deckId/missing` (batch 6's handoff); the strip's message, suggestions button and Fabrary link are unchanged.
- The Toast viewport moves to the bottom of the screen under 720 px wide for every toast (C219, "the toast sits at the bottom"); it clears the tab bar.
- Removed from the deck page: `DeckActionPanels` (the old missing panel with its rows, "Já tenho" one-per-tap, alternatives and "Usar" buttons, group callout), the sidebar's shopping block and `ShoppingPanel`, and the mark-owned mutation wiring in the route. Their components, CSS and tests stay in the tree, unused (see Needs the owner). Tests changed for the reversed behaviour, none weakened: `decks-deckId-mutations.spec.tsx` (the DECK-05 block now asserts the summary card and the strip link, the pitch-bar test and the two mark-owned toast tests went with the panel), `DeckDetailView.missing.spec.tsx`, `.suggestions.spec.tsx`, `.recommendations.spec.tsx`, `DeckStatusStrip.spec.tsx` (the link href), `DeckDetailSidebar.spec.tsx` (the shopping block describe), `deckPageKit.tsx`, `suggestions-flow.spec.ts` (the "Usar" case now runs on the list page). `card-alternatives-flow.spec.ts` was deleted: it started from the alternatives button of the old missing rows, which no picked mockup draws.
- Proof files of C222 and C223 are the named `MissingPanel.spec.tsx` and `ShoppingPanel.spec.tsx`; they render the new page, next to the tests of the old components that still exist.
- `tests/support/axe.ts` gains the missing list page (S1 AC 3).

### Resolver page, one line at a time (batch 11, before S14)

- `/library-pending` is rebuilt as `r4-resolve-b-phone` (owner's pick, 2026-10-25). The old list arrangement is gone; no existing test asserted it (`PendingBanner.spec.tsx` and the C150 banner test only read the banner), so no test changed. New tests: `PendingResolver.spec.tsx` and the Playwright test "the page behind "Resolver" fits a phone with no control over another" in `tests/mobile/collection-in-layout.spec.ts`. The page has no visual baseline.
- Dropped as the mockup leaves them out: the page heading "Para resolver", the per-line "Excluir" link, the "Procurar" button (the search runs 350 ms after typing stops), and the grouped list. Their locale keys (`pendingTitle`, `pendingDelete`, `pendingDeleteAria`, `pendingFound`) were removed.
- "Pular" and the "já resolvidas" count live in the page; a deleted line counts as resolved. A skipped line goes to the end of the page's queue. The last resolved or deleted line returns to the collection.

### S14 (batch 11)

- Plan `Surface`: two rows added (the changed `POST /api/decks/import`, and `POST /api/decks/import/preview`); `Flow` step 4 of "Getting cards in" names the preview. The preview exists because `r3-fabrary-found-phone` draws "Você tem 0 de 66 cartas deste deck" before any import, and no route answered that.
- The import answers `201` with the existing deck's id and writes nothing when the player already tracks the deck (the old route answered `skipped`; the Surface has no `409` for it). An answer of "Sim" on a deck already tracked therefore adds no copies.
- A Fabrary payload the service cannot read (`INVALID_PAYLOAD`, which also covers a deck with no hero) answers `404`, the same as a missing or private deck; every other Fabrary failure answers `502`.
- `ownsCards` is read from the raw body (`@Transform`), because the global validation pipe converts types implicitly and would turn the text "yes" into `true`.
- The old `/add-cards/fabrary` tab is removed: it called `POST /api/collection/sources/from-fabrary`, which fills the collection with no question. That API route and its tests are left in place, now unused by the web; the plan does not name it. Its locale keys were removed with the tab.
- Tests that asserted the old import contract were changed to the new one, none weakened: `decks-import.service.spec.ts` (rewritten for one deck, the answer, the preview), `plan-b-full-flow`, `suggested-uses`, the replacements and recommendations fixtures (one request per deck), `chat-eval.cli.ts` (one call per deck, `ownsCards: true`), `ImportFabraryCard.spec.tsx`, `-decks.new.spec.tsx`, `OnboardingWizard.spec.tsx` (the helper picks "Não" before continuing; the 5 s timeout test is unchanged; the private-deck test now reads the preview's 404), `-add-cards.test.tsx` (three tabs, the index page replaces the redirect test). The visual surface `add-cards-fabrary` and its baseline, and the mobile-layout entry of the same name, were removed with the route; the `add-cards` baseline was regenerated (the index no longer redirects to Manual). `design-guards.spec.ts` now reads the gold primary button from `FabraryFound.module.css`.
- `DeckDetailEmptyState` ("Importar um deck do Fabrary") now links to `/decks/new`, since `/add-cards/fabrary` is gone.
- `scripts/fixture/fixture-seed.ts` and `docs/dev-fixtures.md` send one `{text, ownsCards: true}` request per deck (the old default seeded the collection). The seed was not run.

### S15 (batch 11)

- Plan `Surface`: four rows added (the sources list's `copies` and manual label, and the three web pages that changed).
- `/onboarding` renders the first-run chooser, so `FIRST_STEPS_PATH` stays `/onboarding` and C352 needed no repoint; its proofs pass. `OnboardingWizard` (and `Step1PasteUrl`, `Step2ConfirmLibrary`, `Step3FirstReview`) are no longer mounted by any route; their tests still pass. An account with cards and no deck goes to the collection from `/onboarding`.
- `/add-cards` no longer has a tab bar: the entry screen is the paste box and the four rows. Pages below it (`manual`, `csv`) keep the back link to the library and the link to the imports list. The old CSS rules of the tabs and badges stay (a design guard reads them).
- "Importações" (`r3-imports-phone`): the subtitle, the collapsible explainer, the count line, the recently-added banner and the "Enviar CSV" button of the header are gone, because the screen does not draw them. `UploadCsvButton`, `UploadResolveModal` and `SumExplainer` are no longer mounted by any page. Rows lose the type badge, the date, the file name and the Ativa/Inativa word.
- The row keeps the "•••" menu (rename and delete) and the switch, which the screen does not draw: removing an import has no other home and `.design/collection-in.md` says every import is removable. See `## Needs the owner`.
- `csv_source` migration `1778533608000` also moves old Fabrary imports (kind `csv` with a Fabrary `sourceUrl`) to kind `fabrary`; its down step puts them back to `csv`. The route `POST /api/collection/sources/from-fabrary` still creates kind `csv`; the web no longer calls it.
- Counts: every `_one` key of `collectionReader` and `copyVersions` gained a `_zero` form (pt-BR reads 0 as singular), the three counts of `products` became plural keys, and the recently-added banner builds "N cartas importadas por CSV como X" from plural keys (`library.bannerImported`, `bannerAdded`). `collectionReader.linesToResolve` is the tooltip of the row's pending count.
- Tests that asserted the old arrangement and were changed to the picked screens, none weakened: `CsvSourceRow.test.tsx` (badge, date, Ativa/Inativa, manual note), `-library-csv-sources.test.tsx` (count line, explainer), `-add-cards.test.tsx` (tab shell), `-onboarding-redirect.spec.tsx` and the R60 case of `OnboardingWizard.spec.tsx` (the wizard became the chooser), and three Library tests that looked for the old name "Entradas manuais" (`LibraryCardStepper.test.tsx`, `LibraryGrid.test.tsx`, `-library.test.tsx`). Visual baselines regenerated: `onboarding`, `add-cards-manual`, `add-cards-csv`.

### S1 (batch 1)

- C3 and C4 forced edits to three existing tests that asserted the old copy: `LibraryCardStepper.test.tsx` and `-library.test.tsx` now expect the menu item "Entradas manuais" instead of the API's "Manual entries"; `TagChipRow.spec.tsx` expects "Adicionar tag a este deck".
- The first axe scan (C7) found `label-content-name-mismatch` on the top bar brand link, the user menu trigger, the home deck boxes, the Recommendations "Gerar" button and the deck page "Editar cartas" button, and `link-in-text-block` on the sign-in footer link.
  Fixes: those labels now come from content or contain the visible text. The brand link, user menu and deck box carry a `sr-only` span instead of an `aria-label`; the "Gerar" button lost its `aria-label` (the key `recommendations.generateAria` is now unused); `deckDetail.editCardsAria` became "Editar cartas do deck" (en-US "Edit cards of the deck"); `decks.addTagAria` became "Adicionar tag a este deck" (en-US "Add tag to this deck"); the deck box front face is `aria-hidden`; the sign-in footer link is underlined.
- `.sr-only` was used by `Button` and `DeleteSourceModal` but defined nowhere; it is now defined in `src/styles/global.css`.
- Replacement copy beyond the checks' wording: "substituir" for "trocar" outside a deck (as `.design/copy-and-access.md` says), "Ações de ataque" and "Ações sem ataque" for the two English group headings, a comma instead of the dash in `decks.partialUpdateMsg`, and "R$ 0,00" as the placeholder where "R$ —" stood.
- The scan test pins pt-BR through `localStorage` (`rathe.lang`) because the product language is pt-BR and the browser's own language would otherwise pick English, and it sets the fixture user's display name (a share link needs one) before enabling the fixture deck's share link, since the seed does not.
- C9: the `web-e2e` job mirrors the local suite runner (API built and started with `NODE_ENV=development`, so TypeORM creates the schema on boot; no separate migration step exists in the repository).

### S2 (batch 1)

- Surface row added in `plan.md` (additive): the deck detail's replacements gain `originalPitch`.
  C16 needs the original's pitch to name it ("Desfazer a troca de Pack Hunt (Vermelho)"), and neither the replacement view nor the alternatives target carried it.
  Rejected alternative: deriving it in the web from the deck's own entries, which does not work for the missing panel, where the original is not the row's card.
  `buildReplacementViews` takes the pitch resolver as an optional fifth argument; two API specs that assert the exact replacement object now expect `originalPitch`.
- C16 names "the toast after a swap and its undo action", but no toast follows a swap today: the only undo is the button the deck list and the missing list show on a replaced card (`ReplacementControls`).
  The proof tests that button's label ("Desfazer a troca de Pack Hunt (Vermelho)") and the "no lugar de" mark.
  No toast was added (new visible UI needs mockups first).
- `IShoppingLineLine.pitch` is required in the web type (the API always sends it), so every shopping fixture in the web tests gained `pitch: null`; replacement fixtures gained `originalPitch: null`.
- Existing assertions that named cards by their bare name now expect the pitch word (the entry fixtures default to pitch 1): `MissingPanel.spec.tsx`, `AlternativesSheet.spec.tsx`, `ProposalCard.spec.tsx`, `-library.test.tsx`, `decks-deckId-mutations.spec.tsx`.
- Not named with the pitch because no check asks for it: the alternatives sheet's own title ("Alternativas para <card>", the target carries no pitch) and the scanner's `CardName` (it keeps its pitch dot and only reads the pitch word from the helper).
- Dead code left in place: the i18n key `recommendations.generateAria` is unused since S1.

### S30 and S31 (batch 2)

- Interim session cookie (S32 replaces it).
  C352 and C363 need a `ra_session` cookie that `GET /api/auth/me` accepts, but door 17's session table and opaque token are S32's.
  So sign-up, sign-in, codes verify and codes redeem set `ra_session` with door 17's attributes (`HttpOnly`, `SameSite=Lax`, `Path=/api`, 400 days, `Secure` in production), and the value is today's JWT.
  `JwtStrategy` reads the cookie first and the Bearer header second; response bodies still carry `jwt`, so `AuthProvider`, `global-setup.ts` and `fixture-seed.ts` work unchanged.
  The cookie is read with a few lines in `auth/session-cookie.ts`; S32 adds `cookie-parser`.
  `JwtStrategy` tries the Bearer header before the cookie: the extractors do not fall back when the first token fails verification, and `verify-email` still hands out a JWT without a cookie, so a stale cookie must not beat a fresh header.
  Known gap until S32: "Sair" clears `localStorage` but not the HttpOnly cookie, so the API still identifies the signed-out browser (for example `OptionalJwtAuthGuard` on `/d/:token`) until the cookie's JWT expires.
  C378 (S32) must clear the cookie on sign-out, and batch 2 must not ship without S32.
  Left for S32: `user_session`, opaque tokens, revocation, renewal, the origin check, removing Bearer and `jwt` from bodies, the web wrappers, and the 12 bootstraps that skip `configureHttpApp`.
  The cookie's lifetime is capped by the JWT's own expiry (`JWT_EXPIRES_IN`) until then.
- An unconfirmed account now signs in and passes the API (door 14): `JwtStrategy` no longer rejects `emailVerifiedAt` null and `signIn` no longer answers `EMAIL_NOT_VERIFIED`.
  Blocking share-link creation (`403 EMAIL_NOT_CONFIRMED`) is S33, so until S33 lands an unconfirmed account can create share links.
- C352 stays unmarked.
  Both its proofs pass, but its claim ends with journey 2's "Como você quer começar?", a screen C178 (S15) builds.
  Until then the web opens today's first-steps page (`/onboarding`, `FIRST_STEPS_PATH` in `NewAccountStep.tsx`) with the toast.
  The S15 builder repoints that path and marks C352 when its own check lands.
- C354's third proof ("a new account lands back on the list with its toast") sits in `NewAccountStep.spec.tsx`, the code it tests, not in `SharedListPage.spec.tsx` (the toast is raised before the page change, so the list page never sees it).
  Its empty-collection panel needed one API field: `GET /api/shared/decks/:token/coverage` gains `collectionEmpty` (Surface row added in `plan.md`; `sharing.e2e-spec.ts` and `SharedDeckPage.spec.tsx` expectations extended).
  "Colar uma lista" links to `/add-cards` and "Enviar uma planilha (.csv)" to `/add-cards/csv`; journey 2 (S15) reshapes `/add-cards`.
- Existing tests changed for reversed behaviour:
  sign-up answers `201` with a session instead of a generic `202` (about a dozen API e2e fixtures changed `.expect(202)` to `.expect(201)`);
  a sign-up for an existing address answers `409` (`sharing.e2e-spec.ts` "records nothing when the email already exists", `auth.service.spec.ts`);
  sign-in no longer refuses an unconfirmed account (`auth.service.spec.ts`, `jwt.strategy.spec.ts`);
  the forgot and reset tests, `password-reset-email.template.ts` with its spec, `requestPasswordReset`, `resetPassword`, `/forgot-password` and `/reset-password` (API and web) are gone (`auth.controller.e2e-spec.ts`, `auth.service.spec.ts`, `chat-access.e2e-spec.ts`, `AuthProvider.chat-access.spec.tsx`);
  `GoneException` now backs `TOKEN_EXPIRED` (was `400`, unused before);
  the auth context lost `forgotPassword` and `resetPassword` and gained `verifyCode` and `redeemCode`, so six test stubs of `IAuthContext` changed.
- The sign-up throttle is 20 per hour per IP now (AC 257's number; C404 stays S34's).
  Sign-up from one address in the web e2e would hit the old 3 per hour at once.
  `codes`, `codes/verify` and `codes/redeem` got per-IP windows (20 per hour, 10 per minute, 10 per minute) so they are not open until S34; all windows live in `auth/auth-throttle.ts`.
- `createValidationPipe` gained an `exceptionFactory`: a failed `isEmail` answers `400` with `code` `INVALID_EMAIL` (C349 needs a code on start's `400`); every other validation failure keeps its plain message list.
- `turnstileToken` is accepted and ignored on start, sign-up and codes (`forbidNonWhitelisted` would reject it otherwise); verification is S34.
- The lowercased-address unique index is an expression index TypeORM cannot declare: the migration (`1778533602000-LowercaseUserEmails`) creates it in production, and `DatabaseModule`'s `dataSourceFactory` creates it where the schema is synchronized (dev, CI, e2e).
  The other migration (`1778533603000-OptionalPasswordAndSignInCodes`) makes `passwordHash` nullable, adds `signupReturnPath` and the `sign_in_code` table.
  A code is hashed with an HMAC keyed by `JWT_SECRET` (six digits alone could be guessed offline); a replaced code keeps its row, marked consumed, for S34's per-address count.
  After 5 wrong tries the live code is marked consumed.
- The e-mail button links to `${APP_BASE_URL}/entrar?token=<token>`; the web signs in with it on arrival (Surface row for `/entrar` added).
  `/sign-in` and `/sign-up` stay as redirects to `/entrar` because the shared pages and links already handed out point at them.
  The orphaned `auth.*` copy keys of the deleted pages were removed from both locales; `routes/sign-in.module.css` stays because design-guard specs read it.
  `/check-your-email` is unreachable now and was left in place (no check names it; S33 owns the confirmation screens).
- A signed-in visitor on `/` or `/entrar` is redirected to `/home` only when this device restored the session on page load (`restoredSession` on the auth context); a sign-in made on the page is finished by the flow itself.
  A visitor who signs in on this page and then comes back to `/` sees the start page again (the flow's own finish goes to `/home`).
- Copy the checks do not quote, kept to the minimum:
  a malformed address always gets C347's message, whatever the typo;
  the start page for a shared list reuses "Crie a conta para ver quais destas cartas você já tem." (a sell list too);
  "da Bia" or "do Pedro" is chosen by the name's last letter (`a` takes "da"), since the app does not know the owner's gender;
  an e-mailed button that no longer works falls back to the plain start page, with no message (no mockup draws one);
  `apiErrors` gained `INVALID_EMAIL`, `EMAIL_TAKEN` and `INVALID_CODE`.
- The new copy lives in a new `account` namespace, not in `auth`: C360 quotes "Não é você? Trocar", and the S1 locale test bans "trocar" in `auth`.
- Visual and mobile suites that named the removed pages: `all-surfaces.spec.ts`, `mobile-layout.spec.ts` and `scripts/screenshot-all-surfaces.ts` now list `/entrar` instead of sign-in, sign-up, forgot and reset; four baselines were removed and one added.
  The axe scan list gained `/entrar`.
- One commit holds both slices: they share `auth.service.ts`, the controller, `StartFlow` (which mounts the password and code steps), the `account` copy namespace and the auth context, so a commit of S30 alone would not build.
- `shared-deck-view.service.spec.ts` ("counts only exact copies from the visitor collection", "is zero for an empty collection") gained `collectionEmpty`.
- Pre-existing and noticed: `DELETE /api/auth/me` still asks for a password, so a code-only account cannot delete itself (plan open question 7, left alone).

### S32 (batch 3)

- The session is a server-side row in `user_session` and an opaque 32-byte base64url token in the `ra_session` cookie; only the token's sha256 is stored.
  `JwtAuthGuard` and `OptionalJwtAuthGuard` keep their names (the plan names them) but look the hash up in `SessionService`; `JwtStrategy`, passport and `@nestjs/jwt` are gone, and so are `passport`, `passport-jwt`, `@nestjs/passport`, `@nestjs/jwt` and `@types/passport-jwt` from `apps/api/package.json`.
  `JWT_EXPIRES_IN` is still in the environment schema and now read by nothing; `JWT_SECRET` still keys the sign-in code HMAC.
- `AuthService` sign-in methods return `{ body, sessionToken }` and the controller puts the token in the cookie, so no body can carry it (C374).
- `PUT /api/users/me/password` is built here because C380 needs it (it answers `204`, revokes every other session of the account and keeps the caller's).
  It validates only the 10-character minimum; S35 owns the rest of the password screens and the `hasPassword` field.
- `POST /api/auth/verify-email` still opens a session, now as a cookie: the confirmation page signs the player in today and S33 reworks that route (security review item (a)); the service method `verifyEmail` is untouched.
- Item (b) of the security review is closed: a code sign-in that drops a password still on an unconfirmed account revokes every session of that account first, then opens the new one (`sessions.e2e-spec.ts`, "a code sign-in that drops an unproven password ends the sessions opened with it").
- Item (d) is closed by the origin check (C386, C387): `origin-check.middleware.ts` is mounted by `configureHttpApp` after `cookie-parser`.
  It reads `APP_BASE_URL` from `process.env` per request (the shared setup has no `ConfigService` in the minimal test apps), and logs the rejected `Origin` with `Logger.warn`.
- Ten API test bootstraps now call `configureHttpApp` (the two the checks list besides these, `auth.controller.e2e-spec.ts` and `admin-stores.controller.e2e-spec.ts`, too, plus `manual-source-concurrency`); their request paths gained the `/api` prefix the shared setup adds.
  The new hygiene spec `bootstraps-share-http-setup.spec.ts` fails if one of them stops doing so.
- Existing tests changed for reversed behaviour: every API e2e and int spec signs in with the cookie (`session-test-helpers.ts` reads it from `Set-Cookie`; the `jwt` fields of the fixtures became `sessionToken`); `jwt.strategy.spec.ts` is replaced by `jwt-auth.guard.spec.ts` (deleted user, unconfirmed account, revoked row, unknown token); "a stale session cookie does not beat a fresh Bearer token" in `accounts.e2e-spec.ts` now asserts the new contract (an unknown cookie plus an old Bearer JWT answers `401`); the "error response without a code" case in `auth.controller.e2e-spec.ts` now sends a missing password, because the shared pipe gives a malformed e-mail the `INVALID_EMAIL` code (batch 2).
  Web: `AuthProvider.chat-access.spec.tsx` answers the bootstrap `/auth/me` first; the ThemeToggle, Settings and sharing specs drop the token argument; `SharedDeckPage.spec.tsx` and `SharedListPage.spec.tsx` no longer expect a Bearer token; `api-client.test.tsx` was renamed `api-client.spec.ts` so C376's proof command finds it.
- Web: `AuthContext` lost `token` (the page cannot read the cookie); signed-in state is `user !== null`, restored by asking `GET /api/auth/me` on load, and every query that waited for a token waits for `user` instead.
  `authFetch` and `useApiClient` tell the provider when the API answers `401` with no error `code` (the guard's refusal); a `401` with a code (wrong password, wrong sign-in code) is a form error and never opens the sheet.
- C382 is built and both its proofs are green, but it stays unmarked: the sign-in sheet over a page is new visible UI that no mockup draws, built from existing parts only: a bottom sheet around the one-field start (`EmailStep` in a `compact` form, `PasswordStep`, `CodeStep`, `NewAccountStep`), titled with the existing "Entrar", prefilled with the account's address, with no new copy. See `## Needs the owner`.
- A protected page opened signed out goes to `/entrar?next=<page>` (Surface row added to `plan.md`); signing out by hand leaves `next` off, so the next person on a shared device starts at the home.
- `tests/mobile/account-start.spec.ts` "a typo sends no request" attaches its request listener after the page's own load-time `GET /api/auth/me` settled (C376); the assertion still covers every `/api/auth/*` request the typo step sends.
- `scripts/screenshot-all-surfaces.ts` signs in with the browser context's request client (the cookie lands in the context) instead of seeding `localStorage`; it is a manual tool and no suite runs it.
- `docs/phase-1-followups.md` A1 and A3 and `docs/research/phase-0-security-notes.md` carry a "resolved by door 17" note; `docs/dev-fixtures.md` shows a cookie jar instead of a Bearer header.

### S33 (batch 4)

- C390 stays unmarked.
  Its claim says every intent "including `quote`", and `quote` does not exist: `DECK_SHARE_INTENTS` is `['deck', 'missing']` and door 11 (the migration that adds `quote` to the share link and event constraints, C238) belongs to S19.
  The statuses are built and proven under another name, `sharing.e2e-spec.ts` "share creation answers 201, 400 and 404 for the intents that exist today" (every intent in `DECK_SHARE_INTENTS` answers `201`, an unknown intent `400`, a list share with `intent: "quote"` `400`, another user's deck or list `404`).
  The S19 builder adds `quote` to `DECK_SHARE_INTENTS`, writes the proof named in C390 (`-t "share creation answers 201, 400 and 404 by intent and owner"`, which must include `quote`) and marks the check.
- `POST /api/auth/verify-email` no longer opens a session (Surface row added): a confirmation made on another device would have signed that device in, and C394's signed-out branch could not exist.
  It answers `{ verified, returnPath, email }`, and every dead token (unknown, expired, used, replaced by "Errei o e-mail") answers `410` `TOKEN_EXPIRED` instead of `400`.
  `AuthService.verifyEmail` keeps its other behaviour on purpose (it still leaves a password someone else set, and ends no session): items (a) and (h) wait for the owner.
  Every API e2e helper that took its session from the verify response now takes it from the sign-up response (`lists`, `shared-lists`, `sharing`, `list-prices`); the chat-access test lost its verify-email half, and `AuthProvider.chat-access.spec.tsx` its verify-email half.
- `POST /api/decks/:deckId/share` and `POST /api/lists/:listId/share` answer `201` (they answered `200`), behind a new guard (`EmailConfirmedGuard`) that answers `403` `EMAIL_NOT_CONFIRMED`; the sharing e2e specs and the web mocks that expected `200` changed.
  The list route gained a body DTO (`intent` optional, `want` or `sell`) so that `intent: "quote"` answers `400`.
- `POST /api/auth/resend-verification` now reads the session cookie and no body (the Surface row); it answers `202` for an unconfirmed account and for a confirmed or unknown one alike, and sends nothing for the last two.
  `PATCH /api/auth/me/email` is new; its confirmation limit is 10 per hour per IP (`AUTH_THROTTLE.changeEmail`).
- The auth responses' `user` and `GET /api/auth/me` carry `emailConfirmed` (Surface row added).
  The web mirrors it: `IAuthUser.emailConfirmed`, and `AuthContext` gained `changeEmail`; `verifyEmail` now resolves with the confirmation instead of signing in, and marks a signed-in owner of that address confirmed.
- The confirmation e-mail's text says "7 dias" now (it said 24 hours), in both languages.
- Specified but not drawn, built from existing parts (the owner may want a mockup round):
  the "Errei o e-mail" field (a bottom sheet from the home line and an inline step inside the share sheet) reuses the start field, its typo message and "Continuar";
  the expired-link page for a signed-out visitor offers "Entrar" next to "Este link venceu." (the document draws nothing for that page);
  a confirmation with no stored page opens `/home` (open question 8 of the derivation notes).
- Copy beyond the checks' quotes: `account.confirmationSent` ("Mandamos o e-mail de confirmação para {{email}}.") as the toast and the sheet's status after "Reenviar", "Mandar o link de novo" or fixing the address.
- `/entrar` gained `?email=` (Surface row added) so "Entrar" on the confirmed page opens the code sign-in for the account's address and lands on `next`.
- The auth page copy `auth.signUpAgainLink`, `auth.verifySuccess*`, `auth.continueToOnboarding` and the `check-your-email` strings are unused now and were left in place.
- Security review item (c) of `dc65387` is closed here: an unconfirmed account can no longer create share links.

### S34 (batch 4)

- C399 is not marked here: its single proof also covers the Settings password form, which S35 builds, so the test and the mark land with S35.
  The field checks it needs on the start field, the new-account password, the address fix, the sign-in password (under 10 characters) and the six boxes (Enter with fewer than six digits) are built in this slice.
- Requests that fail validation do not use up a limit (AC 255): `ValidRequestsThrottlerGuard` replaces `ThrottlerGuard` as the global guard.
  It validates the route's body DTO itself (found through the controller's route metadata) and skips counting when that fails, only on controllers marked `@ThrottleValidRequestsOnly()` (`AuthController`).
  It extends the stock guard and overrides only `shouldSkip`, so the specs that switch the throttler off by spying on `ThrottlerGuard.prototype.canActivate` still work; `auth.controller.e2e-spec.ts` mounts it in place of the stock guard.
- `SignInDto.password` uses `@IsNotEmpty()` instead of `@MinLength(1)`, so that the `PASSWORD_TOO_SHORT` code (a `minLength` failure on `password`) belongs to sign-up and the Settings password only.
- Item (e) of the security review is closed: five codes per address per hour, counted from `sign_in_code` rows (replaced and consumed rows included), so asking for a new code can no longer give more than 25 tries an hour (`auth-limits.e2e-spec.ts`, "asking for a new code does not give a guesser more than five tries per code").
  The S38 builder must keep `sign_in_code` rows for at least an hour when the housekeeping step purges expired codes: a code expires after 15 minutes, and purging it that early would empty the window this limit counts.
- The limit's `429` carries `Retry-After` and `TOO_MANY_CODES`; the web shows the wait through the existing rate-limit copy (`Retry-After` 300 gives "Aguarde 5 minutos").
- `ConfigService` keeps the first value it read from the environment, so the Turnstile test runs last in `auth-limits.e2e-spec.ts`.
- Copy beyond the checks' quotes: "Entre com a sua senha" (the code screen's way in after a limit, for an account with a password), "Faltam números. O código tem 6 dígitos." (Enter on a code with missing digits), and "Não conseguimos confirmar que você é uma pessoa. Tente de novo." for `CAPTCHA_FAILED`.
- The catalog's `INVALID_EMAIL` lost its final period ("E-mail inválido"), so it reads as C400 quotes it; `PASSWORD_TOO_SHORT` has none either.
- `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` are in `.env.example`; the web widget loads Cloudflare's script only when the site key exists, and asks for a new token after each request.

### S35 (batch 4)

- C399, C409 and C412 are built, and every proof is green, but they stay unmarked (C382's precedent): the opened password form ("Mudar a senha" and "Criar uma senha" open it) is marked "not drawn" in `.design/account.md`, and C399 and C412 run through it and through the address-fix and code-error states that nothing draws.
  The form is one field, "Nova senha", with the rule line ("Pelo menos 10 caracteres."), "Salvar senha" and "Cancelar", built from the Settings panel's existing parts; the owner marks the three checks ` · done` if the forms are accepted as built.
  C399's single test (`auth-form-validation.spec.tsx`) covers the start field, the new-account password, the sign-in password, the six boxes, the Settings password and the address fix.
- The Settings page gained the "Conta" panel first, with the address moved there from "Perfil" and the password row after it; it has six `<h2>` now, so three assertions of `-settings.spec.tsx` that counted five changed to six.
- `hasPassword` is on `GET /api/auth/me` and on the `user` of every auth answer (the Surface row of S33 named it); the web mirrors it (`AuthContext.setHasPassword`).
- Item (f) is followed as C409 is written: no current password is asked, so a holder of one live session can set a password (the other sessions end).
  A related surprise for the owner: a password created in Settings on an account whose address is still unconfirmed is dropped by the next sign-in by code (`dropPasswordSetBeforeAddressWasProven`, items (a) and (h)), because the account cannot tell that password from one an attacker chose at sign-up.
- New copy: "Nova senha", "Salvar senha", "Cancelar", and the panel's heading "Conta" (the other strings are quoted by C408).

### S3 (batch 5)

- Detail params were renamed to the vocabulary of C19, C23 and C27: size and pool problems carry `{ card: null, count, limit, format }` (they carried `total` and `required` or `max`), copy problems carry `{ card, cardIdentifier, pitch, count, limit, format, legendary, restricted }`, the hero problem carries `allowedFormats` (the hero's `legalFormats` within the four, in the engine's format order), and every card problem carries `cardIdentifier` so the editor can focus the row.
  The web's `reasons` catalog (pt-BR and en-US), `format-reasons.ts` and `LegalityBadge` were changed with them; the pt-BR size lines now say "O deck tem N cartas" instead of "O mainboard tem", and the pool line says "Você leva N cartas".
  `too_many_copies_restricted` is a new line for the Living Legend restricted list; `rarity_not_allowed` is gone with the rarity check.
- The engine's order of problems is hero, pool, copies, per card, and the deck size last, so the first reason (the badge subtitle) is never the size when a rule is broken.
  A hero outside the format returns that one hero problem (the young or adult check runs only when the hero is legal in the format), and every other check still runs: a deck of another hero's cards also lists the cards that hero cannot use.
- `findCardScopeViolation` and `findCardRarityViolation` left the engine's exports; `findCardLegalityViolation` now holds ban, format and hero scope, and `getCopyLimit` takes any format string and returns no limit for a format with no rules (replacements, alternatives and the Tutor reach it with the stored format of an unchecked deck).
- `computeDeckLegality` reads cards through `ILegalityCatalog` (only `indices.byIdentifier`) and `ILegalityCard`, the twelve card fields the rules read, so the browser can run it with the fields a deck page already holds (S4).
  `ILegalityDeckCard.inventoryQuantity` is optional and engine-only until S5 stores it.
- Existing tests converted to the new rules, none deleted for being inconvenient:
  `rules.spec.ts` (Blitz 1, Silver Age 55, no `allowedRarities` tests);
  `card-legality.spec.ts` (the two Silver Age rarity rows and the rarity-whitelist test became "not legal in Silver Age"; Blitz limit 1);
  `compute.spec.ts` (size and copy params, and the two copy tests whose fixture repeated Adrenaline Rush in two rows, which per-row counting hid and per-card counting reports as 7 copies);
  `alternatives.spec.ts` (the Silver Age rarity row, and Blitz "0 held + 2 needed" is no longer listable under the limit of 1);
  `adoption-rules.spec.ts` (Blitz held 0 moves 1, held 1 refuses);
  `deck-facts.spec.ts` (Blitz `maxCopies` 1);
  `decks.service.spec.ts` (a deck list row with no hero now also lists the size problem);
  `LegalityBadge.spec.tsx` and `format-reasons.spec.ts` (new params).
- C29's proof also reads `GET /api/decks` (the home list) for the `Draft` deck, since the list path computes the same verdict.

### S4 (batch 5)

- C33 stays unmarked: its fourth row (a Classic Constructed card at 2 in the deck and 1 in the inventory) needs the inventory, which S5 builds.
  The first three rows and a card at 3 in Classic Constructed are proven in `DeckCanvas.edit.spec.tsx`; the S5 builder adds the inventory row and marks C33.
- The browser runs the engine's own rules: `apps/web/engine-legality-alias.ts` maps `@rathe-arsenal/engine/legality` to the engine's legality source (vite, vitest and `tsconfig` paths), so only the rules are bundled and the 17 MB card package is not.
  The browser holds the card facts the rules read: `restrictedFormats`, `legalOverrides`, `specializations` and `legendary` now come from `/catalog/search` and from the deck's breakdown entries (`cardLegalityFacts` in the API), so a card legal by an override or a specialization is not flagged in the browser while the server calls it legal.
  A draft card whose facts did not load (a card added, then restored from `localStorage`) is assumed legal in the format, as the old client check did.
- The editor's "Cartas ilegais" panel and the sidebar badge now read the engine's verdict on the draft (`cascadeFromLegality`, `toDeckLegality`); `useCascadeCheck` the hook is no longer used by any screen (its spec and `cascadeReasonLabel` stay).
- The stage labels in pt-BR changed ("Construindo" to "Montando", "Ativo" to "Jogando") because C48 reads "Etapa: Montando"; `StatusDropdown.spec.tsx` followed. S6 owns the rest of the stage rule. The back link reads "‹ Decks".
- The verdict row (format chip, "Compartilhar", the red chip, "Etapa: ...") sits in the editor header below the name and keeps "Cancelar", "Salvar" and the status control, which the mockup does not draw but the editor needs. Hero, weapon and equipment rows keep a small remove button; the deck rows hide theirs under 640 px (the "-" at 1 removes).
- The draft is `null` until the player edits, so server data that changes under an untouched draft replaces it and nothing is written to `localStorage` (C41); a draft restored from `localStorage` counts as edited.
  A partly owned card arrives as two entries and the hook sums them into one row (C42).
- C43: "Cancelar" on a deck created in this visit (router state `justCreated`) with no cards calls `DELETE /api/decks/:id/permanent` and goes back in history, also when the call fails.
  That route is S8's (C91): until it lands the call answers `404`, the empty deck stays, and the player still goes back.
- C44: `automaticDeckName` is shared by deck creation, `PATCH` and `PUT`; a format change renames only a deck that still carries the automatic name, and a name sent in the same `PATCH` wins.
- C36 and C40 live in `tests/mobile/deck-edit-rules-bar.spec.ts` (the `mobile-*` projects only match `tests/mobile`), same test names. C43's proof sits in `DeckCanvas.edit.spec.tsx` with the real header.
- C45 is proven by the int-spec the check names (controller passes quantity 2 through) and by `deck-composition-save.e2e-spec.ts` against Postgres (stored quantity 2, verdict `illegal`).
- C46 as specified passes only after `deckEdit.deleteConfirmDesc` said "apagados" instead of "serão removidos"; the real offender, the `decks` namespace's "Ao salvar, elas são removidas", was reworded and has its own test.
- Existing tests changed with reversed behaviour: the Fabrary link tests (`fabrary.net`), `decks-deckId-mutations.spec.tsx` (router mock gained `useRouter` and `useRouterState`), `StatusDropdown.spec.tsx`, `decks.service.spec.ts` (breakdown mock card gained `keywords`), `decks.service.update-meta.spec.ts` (the format test gives the stored deck).
- Two web e2e proofs changed with the new rows: `account-flow` "a session that ends mid-edit" lowers the first row's quantity instead of raising it (that row sits at the Classic Constructed limit, so its "+" is disabled), and the `deck-detail-edit` visual baseline was regenerated.
- Noticed, not touched: `CardRowLegalityWarning` and the `illegalCardIds` props of `EditableCardRow` are unused; `GET /api/decks/:id` still reads the stored `hero` display name for the automatic name.

### S5 (batch 6)

- C33's fifth row is added to the table, kept beside the "Classic Constructed card at 3" row batch 5 had put there (the check's own fourth row is a card at 2 in the deck and 1 in the inventory); it asserts both "+" are disabled and the reason that names the inventory.
- C55: the proof for another player's deck is built (`put answers 404 for a deck the player cannot edit`, against Postgres). The deleted-deck half needs `tracked_deck.deletedAt`, which is S8's door 4, so C55 stays unmarked and the S8 builder adds the deleted-deck case to that test.
- The `decks.controller.put.int-spec.ts` proofs of C52, C53, C54 and C68 run in a second `describe` that boots the real app on Postgres (the slim app of the first one mocks the service and could not show what is stored). The 400s come from the DTO (`DeckLineHoldsACopy`, `DeckLinesAreUnique`); a `quantity` of 0 is now valid when the line holds inventory copies.
- Readiness counts the deck and the inventory together in each entry's `quantity` and tells them apart with `inventoryQuantity`, the inventory's share (absent when 0); owned copies cover the deck copies first. The engine's result gains `missingCopies` `{total, deck, inventory}` (C61). The Surface rows in plan.md record the shape. The pitch curves and `rawPercent` count the inventory copies too.
- The deck page's card list (`buildDeckList`) shows deck copies only and leaves out a card that is only in the inventory; the inventory's own list is S7's "Inventário" group. The status strip, the share dialog's count and the home count include the inventory's missing copies.
- Not yet counting the inventory (they read `quantity` only, later slices own them): the Tutor's tools and `deck-facts`, `list-from-deck`, spare copies, the missing and shopping panels (S17), the group ask and the quote (S18, S19). Two places were guarded so no inventory is lost or breaks the new check: copying a shared deck copies `inventoryQuantity`, and a replacement that takes the last deck copy off a row keeps the row when it still has inventory copies.
- Existing proofs adapted to the two steppers: `account-flow.spec.ts` "a session that ends mid-edit" reads `quantity-deck` and the deck "-" (the row now holds two `aria-live` quantities and two "-"), and the `deck-detail-edit` visual baseline was regenerated (new header, column heads, inventory stepper).
- C57's proof is `tests/mobile/deck-edit-inventory.spec.ts` (the `mobile-*` projects only match `tests/mobile`), same test name.
- Weapons and equipment can carry inventory copies (Fabrary imports them), and those copies count in the pool and the verdict, but the editor's loadout rows (hero, weapon, equipment) show no inventory stepper; only the deck rows do.
- C59: the mockup draws the move menu but no control that opens it. The quantity number of each side is the button that opens it ("Mover cartas do deck de X", "Mover cartas do inventário de X" as accessible names); see Needs the owner.
- C62's "Ver o que falta" links to the missing panel on the page (`#deck-missing-panel`), the same target "Ver lista de compras" has; S17 builds `/decks/:deckId/missing` and repoints it.
- The editor always draws two steppers per row, the header "Deck N · Inventário M · Card pool P de L" and the two plain lines (AC 30), also for a deck with no inventory, which `r3-editor-phone` draws with one stepper and no header; C48 still passes because it only reads the order of the texts.

### S6 (batch 6)

- C71 is not met and stays unmarked: `r3-stage-a-phone` lists "Rhinar Blitz" (Jogando), "Rhinar - Blitz" (Montando), "Rhinar CC" (Pronto) in that order, but the home groups the decks by stage ("Ativos" holds Pronto and Jogando, "Construindo" holds Montando), so the real page shows Rhinar Blitz, Rhinar CC, then Rhinar - Blitz.
  The test written instead, "each card of r3-stage-a-phone carries its exact lines", asserts every card's lines in order and not the order of the cards; the group order was not changed.
- Home card: the red chip keeps the test id `legality-illegal` and its class, the deck header's red chip keeps `legality-badge`; three older tests that read the old wording ("Fora do formato", "Ilegal") now read the new verdict wording (`DeckTile.spec.tsx`, `decks-deckId-mutations.spec.tsx`). `home.legalityNotLegalLabel` is no longer used.
- Cause line: kinds are listed copies, banned, outside the format, hero. A problem with no wording in the document (the card pool, a card the hero cannot use, an unknown card) is not named and counts toward "e mais N"; a deck whose only problems are those has no cause line. See Needs the owner.
- The deck page header shows the red chip and the grey "Etapa: Jogando" for a deck with a rule problem; "incomplete" and "unchecked" keep the existing badge there. The cause line sits in the body, under the status strip.
- C68 and C69 hold already: the verdict is never an input of the stage, so the tests prove it; C68's test is in the S5 commit.

### S7 (batch 7)

- The deck page's "Lista" view was a gallery of every card; it is now the text view of AC 47 (`DeckTextList`), grouped Herói, Arma, Equipamentos, Deck, Inventário as C82 says (the screen draws Inventário before Deck, derivation note 5).
  The toggle keeps its three buttons ("Por tipo", "Por custo", "Lista"); `r2-list-view-desktop` draws two ("Imagens", "Lista") and was not rebuilt.
  `decks-deckId-mutations.spec.tsx` "regroups by cost and by list without refetching" asserted the old gallery group `deck-list-group-all`; it now asserts `deck-text-list`.
- The line order of the copied text and of the "Lista" view is the order of the readiness result (owned entries, then missing ones), because the web deck response carries no `cards` list. The fixtures print the order the screens draw.
- C84 forced two copy changes on the deck page list: the heading "Decklist" is "Deck" with "60 cartas" beside it (deck copies only, hero, weapon and equipment left out), and the quantity badge reads "3×" (was "×3"); `decks-deckId-mutations.spec.tsx` line "quantity badge" follows.
- The deck header (`DeckHeroBanner`) is a grid now: breadcrumb, then title, format, verdict and stage, then the actions, so the reading order is the one C84 lists; from 720px up the actions sit at the top right as before.
  The two lines under "Copiar lista" and "Duplicar" ("Copiar lista: texto para o grupo ou para o Fabrary", "Duplicar: cria uma cópia ...") are drawn from 720px up and are screen-reader-only on a phone, so the phone header does not grow by two lines.
- "Copiar" closes the sheet and then shows the toast "Lista copiada"; a refused clipboard keeps the sheet open and shows "Não deu para copiar. Selecione o texto e copie à mão." (copy of mine, no mockup or check draws it). "Duplicar" failing shows "Não deu para duplicar o deck. Tente de novo." under the button (also mine).
- The sheet's warning names one card over its limit with the deck and inventory split (C78). Any other mix of problems is told with the deck's cause line ("Esta lista não vale no X: <cause>. Dá para copiar mesmo assim."); no check or screen words that case.
- The Fabrary-or-Talishar text has no title line, only the five headings of AC 44 and one line per card. The sheet shows the plain "Inventário: ..." line once, above the preview, when the deck has an inventory, as `r3-export-group-desktop` draws; the line "Você escolheu: ..." that screen draws is not built (the selected tab says it).
- The shared deck page's sheet has no warning: the shared deck response carries no verdict.
- `GET`, `PUT` and every owner route now answer `404` for a deleted deck through `AuthzService.assertOwnsTrackedDeck` (C80 needs it); `authz.service.spec.ts` asserts the new `where` (`deletedAt: IsNull()`). `tracked_deck.deletedAt` and its migration landed here so C80 can mark a deck deleted; S8 builds the rest of door 4.
- "Duplicar" copies the cards and the inventory only; replacements, tags, notes and share links stay with the original.

### S8 (batch 7)

- `DELETE /api/decks/:deckId` is the soft delete now and answers `200` with `{deletedAt}`; the old hard delete is `DecksService.permanentDelete` behind `DELETE /api/decks/:deckId/permanent` (`204`). Two unit and e2e tests that called `DecksService.untrack` call `permanentDelete`; the unit test asserts `404` when no row of the caller was deleted instead of the authz call, because ownership is the guard's job on that route.
- Restore and permanent delete must reach a deleted deck, which `OwnsTrackedDeckGuard` hides everywhere else. The guard reads a route marker (`@IncludesDeletedDeck()`) through an optional `Reflector`, so the slim test apps that override the guard class keep booting.
- C92: "the replacement re-solve drain" names no code path (the re-solve routes are `410` stubs); the filter is on the other job drains of the worker, the variant-fetch jobs' `claimNext` and the recommendation runs' `claimNext` and `enqueueAuto`. Readers filtered: readiness recompute after a collection change (collection service, sources, Fabrary and CSV imports), `GET /api/decks` and the aggregate shopping line, the Tutor's deck list, `get_deck`, `get_prices`, recommendations read, the swap tool, deck usage, chat creation bound to a deck, replacements and alternatives, want and sell lists from a deck, the visitor's missing-by-card count, and `SharedDeckLookup.findLive`. The test for C92 puts one drain claim on a shared database, and puts back whatever run or job it claims for another deck.
- C43: with S8 built, `DELETE /api/decks/:id/permanent` removes a live deck with no cards (test "permanent delete drops a live deck with no cards" next to C91's, in `decks-lifecycle.e2e-spec.ts`).
- C55: the deleted-deck case is in the same test as the other-player case (`put answers 404 for a deck the player cannot edit`, `decks.controller.put.int-spec.ts`).
- The deck page's "Excluir deck" asks nothing now: the delete is undoable, so the confirmation dialog of that menu is gone and the home shows the toast. `decks-deckId-mutations.spec.tsx` "asks before deleting the deck from the overflow menu" asserted that dialog; it now asserts there is none and that the delete call is made. The edit screen's own danger zone (`DeckDangerZone`, `DeleteDeckDialog`) still asks and still says "Não dá para desfazer", although `DELETE /api/decks/:deckId` is a soft delete: no check covers it, see Needs the owner.
- The toast got two options, `persistent` (no auto close) and `dismissOnNextAction` (closes at the next tap or key press outside it, armed one tick after it appears). "Next action" is my reading: any pointer-down or key press except Tab and the modifier keys.
- The home card's trash no longer takes `onUntrack` and `isUntracking` props from `StatusGroups` and the route: `DeckTile` deletes through `useDeleteDeckWithUndo`, the same hook the deck page menu uses. `DeckTile.spec.tsx` lost the two tests of the old 4.8 second timer (their behaviour is the F57 bug) and has the C94 tests instead.
- The toast on a refused delete ("Não foi possível excluir o deck. Tente de novo.") and on a refused undo ("Não foi possível desfazer. Abra Excluídos recentemente para restaurar o deck.") are copy of mine; so are "Nenhum deck excluído.", the question of "Excluir de vez" ("Excluir "X" de vez?" with "Manter" and "Excluir de vez") and the error line of the list. No mockup draws them.
- The deleted list shows each deck's total deck copies (inventory left out) as "N cartas".
- The row "Excluídos recentemente (N) · ficam 30 dias" is also drawn under the empty-state of the home, so the last deck deleted can still be reached.
- The day-30 purge is S38 (derivation note 9); nothing deletes a deck for good on a schedule yet.

### S9 (batch 8)

- `/decks/new` follows `r2-new-deck-hero-phone` and `r2-new-deck-format-phone`: three rows, the search under "Começar do zero", then a second step for the format.
  The old page (two cards side by side, a hero dropdown plus a format dropdown) and `StartScratchCard` with its spec are gone.
  `-decks.new.spec.tsx` was rewritten for the new screen; the old tests of the two-column grid, "no icon tile", the four-option format dropdown and the "← Início" link had nothing equivalent left (the mockup draws round icons, a "‹ Decks" link and the format as radio cards).
  The "hero illegal in the chosen format" tests of `StartScratchCard.spec.tsx` cannot happen any more: only the hero's own formats are offered.
  The Fabrary import tests are kept, after opening the row.
  `design-guards.spec.ts` block "New deck" now checks the new classes; `tests/e2e/scratch-deck-flow.spec.ts` follows the new screen.
- The search filters each hero's formats to the four the engine knows (Open, Draft and the others are not shown) and leaves out a hero that plays none of the four.
- The panel for a hero outside the format (`HeroOutsideFormatPanel`) is always mounted by `DeckDetailView`, so its green "Este deck vale em X." block survives the refetch after the switch.
  The browser evaluates the other formats with the engine on the saved deck (`useOtherFormatVerdicts`), not the API.
  The cause line under the header is hidden while the panel shows, because the panel states the same problems.
- The r2 header chip "Importado do Fabrary · 2 problemas" is not built: round 3 and S6's header win.
  The mockups leave out the status strip, the medallion and the analysis row that the deck page still shows.
- The shared deck page gets `legality` from the API (Surface row added to `plan.md`): the API runs the engine because the public answer does not carry every card's legality facts.
  `SharedLegalityBlock` sits between the header and "Copiar lista" as `r3-shared-phone` draws; the line "Você tocou em X" is drawn by the mockup and is built.
- `computeDeckLegalityInOtherFormats` (engine) is used by the API; `RULE_CHANGES` and `IRuleChange` are exported from the engine's barrel for S10.

### S10 (batch 8)

- The notice sits in the deck page's view mode, under the header: the notice, the eight cards with their red line and a single stepper, "Deixar 1 de cada" with its explanation, and "Prefiro escolher carta por carta".
  Both mockups draw the editor's rows, but the editor exists only in `?edit=1`, and "Deixar 1 de cada" saves at once (C114), so the rows are a smaller row of their own (`RuleChangedRow`) with only the controls the mockup draws; the editor's inventory stepper and remove button are not drawn.
  The row's "-" takes one copy out and saves with one `PUT`, with no toast; "+" is always disabled because the card is over its limit.
  "Prefiro escolher carta por carta" hides the notice, its button and its explanation, and keeps the rows.
- `RULE_CHANGES` is read by the web through the engine's browser entry; the entry has no field for which problem it explains, so `ruleChangedModel.ts` maps `summaryKey` to the problem it covers (`blitz_one_copy_each`: a non-legendary, non-restricted card with exactly 2 copies in Blitz). A card with 3 or more copies is not part of the change and is not listed.
  `Flow` in `plan.md` no longer says `DecksService` reads `RULE_CHANGES`.
- The bar "32 de 40 cartas · nenhum problema" of `r2-one-each-phone` is a status line shown after "Deixar 1 de cada" until "Desfazer"; the view mode has no always-on rules bar (only the editor does).
- C118's stage chip: a deck short of cards and with no rule problem now shows the chip "Jogando · 32 de 40 cartas" in the deck header instead of the "Incompleto" badge, and the list heading reads "32 de 40 cartas no deck · coloque mais 8". S6's table says only the stage chip shows there; the check wins.
- While the notice shows, the red cause line is hidden (the notice names the same cards).
- `DeckDetailView.recommendations.spec.tsx` and `DeckDetailView.suggestions.spec.tsx` render the view with no toast provider or query client; they now stub the toast hook, or the two new children, which changes only their setup.
- The visual baselines of `deck-detail` and `decks-new` were refreshed: the first fixture deck is a hero outside its format and now shows the panel.

### S11 (batch 9)

- C119: `card_list_line.condition` already existed, nullable, with a check that refuses `''`. It is converted in place: nulls become `''`, the column is NOT NULL with default `''`, and the check is renamed `CHK_card_list_line_condition_values` (synchronize compares checks by name only, so a database built before this change would have kept the old expression). The entity maps `''` to `null` with a column transformer, so the lists code, its unit tests and the lists API keep saying null until S21 moves the sell lines onto the four fields.
- C123: the check's example spells the key segments out (`WTR167.unlimited.rainbow`), but the keys stored today use codes (`WTR167.UE.RF`, from `buildPrintingKey`). The migration reads both. A key without a foil segment leaves `finish` `''` (the key does not say the finish is plain), and a key it cannot read keeps only its collector code and logs the line id. The `printing` column stays until S21 stops writing it.
- C133 stays unmarked: its claim names `PATCH /api/collection/pending/:id`, which S12 builds with door 7. The proof covers the batch and the card move today; the S12 builder adds the pending case to the same test, `assertVersionBelongsToCard` is ready for it, and then marks C133.
- C134 and C136 say `200` "as today", but `POST /api/collection/cards/batch` and `POST /api/collection/cards/decrement` answer `201` today and the existing tests assert it. They still answer `201`; nothing else about their status changed.
- C134: the body parser turns `printingCode: 12` into the text `"12"`, so the `400` comes from the catalog check (`VERSION_NOT_AVAILABLE`), not from the type check.
- `csv_source.cardCount` keeps counting rows (decrement's own comment says so), now rows per card and version; moving copies and bulk marking recount it.
- Decrement: `sourceId` is optional. Without it the card must have exactly one row (`400` `SOURCE_REQUIRED` when it has more, `404` when none); with it, the row is found by import and version (a part left out is `''`).
- Plan `Surface`: five rows added before the code (card version options, an import's copies, `collector-codes` extended with `editions` and `finishes`, the import's versions page, and `contributions` of the Library answer).
- Scanner: two printings of one card scanned in one session are two tray rows (keys `card` and `card@CODE`), because their copies are not one version. "É foil?" is asked only when the code exists both plain and in a foil finish, "Sim" records the finish only when the code has one foil finish (with several it stays `''`), "Não" records `none`, and an unanswered question records nothing.
- Existing tests touched without changing what they assert: four entity fixtures gained the four version fields; `CsvSourceRow.test.tsx` stubs the router `Link` now that the row links to the versions page; `-add-cards_.scan.test.tsx` expected the commit body to be exactly `{cardIdentifier, quantity}`, which C134 changes, so it now expects each item with its `printingCode`.
- The Library "−" picker is drawn in the page body (a portal, fixed to the bottom of the screen) so it fits a 360 px phone; its press-outside check now treats the picker as inside.
- The axe scan list gained the page "Versões desta importação"; its context takes the fixture user's first import, or a nil id (the page then shows its error state) when it has none.
- Noticed, not touched: the CSV re-upload that replaces an import (`CsvUploadService.updateSource`) and the duplicate detection (`DuplicateDetectionService`) both assume one row per card and import. After copies of an import were given versions, a re-upload sets the new quantity on one of the rows and leaves the others. S12 rewrites the reader and the import path.

### S12 (batch 10)

- C133 is marked with this slice: the test "a version the card does not have is refused on every write" now also sends two bad versions to `PATCH /api/collection/pending/:id` (unknown printing `WTR023`, and `first` on `WTR167`), expects `400` and checks the pending line and the copies are unchanged.
- The pasted-list screen's "Escolher por linha" chip has no mockup for what it opens, so it is selected state only and behaves like "Não sei" (each line keeps only the version its own words settled). "Sem foil · NM" sends `defaultVersion` with the import; the API applies finish and edition only where the card has such a printing and condition always.
- `r3-product-search-phone` and the report draw nothing for a file that was already imported. A `409` shows one line and a button, copy of mine, see Needs the owner.
- Plan `Surface`: four rows added (the shape of `POST /api/collection/imports`, the shape of `GET /api/collection/pending`, `PATCH` and `DELETE` of a source accepting every kind but `manual`, and the three new web pages).
- `PATCH` and `DELETE /api/collection/sources/:id` used to accept only `kind = 'csv'`; they accept every kind but `manual` now, or a pasted import could not be renamed or removed.
- The dev database keeps the old kind check (`synchronize` compares checks by name only), so the database module replaces `CHK_csv_source_kind_valid` when its definition does not name `paste`, in the same place the lowercased e-mail index is created.
- `GET /api/collection/pending` returns `quantityHint`, `options` and `suggestion` per line. Door 7's shape has no quantity, so `asks_color` and `bad_quantity` lines store the card they point at in `suggestedCardIdentifier` and the hint is a number found in the original text.
- Version words read from a pasted line ("foil", "cold foil", "1ª", "NM", ...) are resolved against the card's printings: one printing left records its version, several left record only what they agree on, and "foil" over several foil finishes keeps the note "foil · existe em N versões foil: escolha". The stored "escolha a versão" state of `r3-version-bulk-phone` is not built: no check names it and storing it needs a column door 1 does not have.
- C157 reads "the tabs `Coleção` and `Importações`"; `r3-pending-phone` draws the heading "Coleção" with a link "Importações" at its right, and that is what is built (heading, then link, then the count line).
- The collection page is now headed "Coleção" (`library.libraryTitle`), with the count line "612 cópias (241 cartas)" under the header; the navigation label stays "Biblioteca".
- Entry points: no check builds the add-cards entry (S15 does). Until then `/add-cards/csv` has a link "Colar uma lista" to `/add-cards/list`, and choosing a file there opens `/add-cards/sheet`. The old tab test (four tabs in order) forbids a fifth tab.
- `/add-cards/csv` no longer calls the old upload route (`POST /api/collection/csv`, which stays for "Importações" re-upload). Obligation 4: that old route still sets one quantity on one row when a re-upload replaces an import whose copies carry several versions, and its duplicate detection compares one row per card; the new import route keeps copies that differ only by version apart (tested) and hashes them with their versions.
- A paste or file of 5,000 lines is refused (`IMPORT_TOO_MANY_ROWS`); a pasted body above Express's 100 kb JSON limit answers `413` before the reader sees it.
- Existing tests touched: `-library.test.tsx` got a mock of the new pending query (the page mounts the banner); `csv-parser.service.spec.ts` got the card "Rhinar, Reckless Rampage" in its catalog fixture and new tests; `collection-versions.e2e-spec.ts` got the pending case of C133.
- Notes the reader writes are pt-BR sentences from the API (`"(3)" lido como Azul`, `lemos "..." certo`), as C139 and C145 require; an English-language session shows them in Portuguese.

### Security fixes on the reader (batch 10)

- Both findings were real. The line reader ran trailing-word patterns that can match a run of blanks in many ways; a 20,000 character line took 1.5 s, and a line cannot be shorter than the 2 MB a file may hold. Blanks are collapsed before the patterns run, and a line over 2,000 characters is kept as not found without being matched.
- A spreadsheet row with many cells made the unquoted-comma step join cells one by one, each join over the whole row (18 s for 30,000 cells). It joins at most five cells now; the text kept for a line is cut at 2,000 characters, which is what a pending line accepts.
- The limits that already existed stay as they are (2 MB per file, 5,000 lines, refused with `400`); the 2,000 character cut is not shown to the player (a longer line reads as "Não achamos"), so no new copy.

### S13 (batch 10)

- Product files live in `apps/api/src/products/data/` (one JSON per product, copied to `dist` by the Nest asset setting) and `pnpm products:import <url>` writes into the source folder even when it runs from `dist`. The Armory Deck: Kayo file was written by that command from the official page (`https://fabtcg.com/decklists/kayo-armory-deck/`, fetched with a browser user agent as `docs/research/ip-posture.md` allows): 26 cards, 66 copies, no differences with the catalog. It is the only product, as plan Assumptions say.
- The command names a product from the catalog: the product is the set of the hero's printings that matches the kind of the address (`Armory Deck: <hero>`, `<hero> Blitz Deck`, `<hero> Silver Age Deck`), the key is the kind and the hero's first word (`armory-kayo`), and the format follows the kind. The hero is read from the page title.
- A copy from a box carries the printing code and, when the catalog has one row for that code in the product, its edition and finish (Hide Tanner comes in Rainbow Foil). Where the product has two rows for a code nothing more is recorded. This goes beyond C162, which only asks for the printing code.
- `r3-product-search-phone` draws a "Deck pronto" chip and a kind chip on each row, and `r3-product-confirm-phone` draws the eyebrow "Deck pronto"; C160 says no row carries "Deck pronto" and C161 lists the confirm screen's blocks without it, so none of them is built.
- The footnote of the confirm screen names Agility and Might as C161 quotes; a product with other tokens would still say those two (the file does not record which tokens it left out).
- The confirm screen takes the product from the list answer (`cards` added to `GET /api/products`), so opening it directly by address reads the whole list once.
- Created decks start at stage Montando (`building`), as Fabrary imports do.
- Plan `Surface`: three rows added (the list answer with cards, the import route's extra statuses, the two pages).
- "Comprei um deck pronto" on `/decks/new` now opens `/add-cards/product` (batch 8 obligation). S15 may point its first-run row there too.

### S16 (batch 12)

- Plan `Landing` got a row for door 10 (what a lookup job is and what counts as a lookup) and `Surface` got two rows (`GET /api/decks/:deckId/missing` lines, `GET /api/variant-jobs` removed), before the code, in this commit.
- The migration deletes every `variant_fetch_job` row, not only the pending and running ones the plan's Impact names: a per-deck row has no per-card meaning, and the table is a queue no view shows after two minutes. It also drops `userId` and `deckId`, because a job is shared by every user.
- `GET /api/decks/:deckId/missing` exists with `lines` only (`cardIdentifier`, `deckNeeded`, `inventoryNeeded`, `state`), because C189 needs it to open a list. `summary` and the price fields are S17 (C204). The needed copies come from `breakdown.notOwned` of the same `computeEffectiveReadiness` call the shared missing list uses, so the inventory is counted as S5 counts it.
- C199 is unmarked: its `quote` address is built in S19 and the group page carries no store states until S18. The read-only path it needs already exists (`StoreAnswersService.read` queues nothing; only `openForOwner` does), and S18 writes the proof.
- Tests removed because the behavior they asserted left with the per-deck lookup (AC 123, door 10):
  - `variant-fetch.controller.spec.ts`, `variant-jobs.controller.spec.ts`, `variant-fetch.service.spec.ts` (api): the removed controller, the removed jobs list and the one-hour per-deck freshness check.
  - Two cases of `variant-fetch-queue.service.spec.ts` (a job per deck is returned instead of duplicated; ETA from remaining cards); the file now holds the per-card proofs.
  - The decks-lifecycle e2e lines that inserted a per-deck job and asserted the drain skips a deleted deck (the plan's Assumptions row says the job holds no deck now).
  - Web: the `variant-queue` pill and drawer specs, `variant-jobs` api specs, the CTA, progress, partial failure, polling and per-card failure cases of `shopping-line-variants.test.tsx`, five `MissingPanel.spec.tsx` cases about "Obter preços exatos", cooldown, polling and the failed badge, the two `design-guards.spec.ts` cases about the exact-price button styles, the TopBar and AppShell pill cases, the pill's touch-target case, and the failed-badge assertion at the end of the S2 case in `ShoppingLine.spec.tsx` (the badge is gone with the button).
- `ShoppingLine.spec`-era API types stay: `IVariantFetchProgress` and `variantFetchProgress` in the web and API shopping-line types, and `computeVariantFetchInterval` in `api/deck-detail.ts`, are now unused by any producer. They die with the old shopping panels in S17.
- The queue of lookups is claimed per card; a job whose card lost its product page is finished with an error instead of a lookup.
- Each of the six new environment variables is optional in `env.dto.ts`; the worker's availability step reads them from `process.env` (strings), the API from `ConfigService`; both go through `readStoreAnswersConfig`.
- The availability step runs on the worker's 3-second poll, and checks the store row each time; it asks for a URL sync only when a pass is due, none is queued or running, the last failure is over an hour old, and the budget fits.

### Budget gate on the worker (security finding on fd8e3de)

`claimNext` now returns no job while automatic lookups are stopped or the credit read fails (fail closed). Jobs queued before the budget ran out stay `pending` and their lines keep reading `looking_up` (a pending lookup outranks the stopped budget in `classifyStoreRow`, C186) until the next month lets the worker run them. No check names this.

## Settled by the owner

- 2026-10-24, C16: accepted as built. No toast follows a swap today, so the pitch is named in the undo action, "Desfazer a troca de Pack Hunt (Vermelho)"; no swap toast is to be added.
- 2026-10-25, the page behind "Resolver" (`/library-pending`), built in batch 10 with no mockup: the owner asked for two mockup alternatives; the page stays as built until the owner picks one, and the pick is built afterwards.
  Picked the same day: B, one line at a time (`.design/mockups/collection-in/r4-resolve-b-phone.png`, brief `BRIEF-round-4.md`); A (`r4-resolve-a-phone.png`) was not picked.
- 2026-10-25, the Armory Deck: Kayo decklist fetched once from the official page `https://fabtcg.com/decklists/kayo-armory-deck/` through `pnpm products:import`: accepted.
- 2026-10-25, the admin credits line in Settings (C201), which no mockup drew when batch 12 built S16: the owner was shown two alternatives and picked B, a thin bar with "Créditos do Firecrawl este mês" and "120 de 1000", amber when lookups stop (`.design/mockups/close-the-deck/r5-credits-b-phone.png`, brief `BRIEF-round-5.md`); A (`r5-credits-a-phone.png`, one sentence) was not picked.
  The stopped state shows "As consultas automáticas de preço pararam." and "A sincronização manual continua funcionando.".

## Needs the owner

- "Não é você? Trocar" (C360, from `.design/account.md`) collides with S1's rule that bans "trocar" in the `auth` namespace; the string sits in the `account` namespace, outside the rule.
  Decide whether the rule should name an exception or the copy should change.
- An e-mailed button that is used twice, or after 15 minutes, now drops the visitor on the plain start page with no word on why. No mockup draws that state; it needs a screen or a line of copy.
- The start step reveals whether an address has an account, and a deleted account (its row kept 30 days) answers like a live one: `password` or `code`, then a refusal that offers a code that is never sent.
  No check covers a deleted account at the start step.
- Security review of `dc65387` (findings parked, each belongs to S32 or S33).
  (a) Pre-hijacking through the confirmation link: someone signs up with a victim's address and a password of their own; if the victim clicks the confirmation e-mail instead of signing in by code, `verifyEmail` marks the address confirmed and leaves the attacker's password in place.
  `verifyEmail` cannot tell that apart from a legitimate owner who chose their own password, so clearing the password there would wipe every honest sign-up.
  Proposed fix (S33): confirming from a browser that is not signed in as that account keeps the password only if the confirmation request proves the password (or ends every other session and asks the owner to set a new password); at the least S32's revocation must end every session of the account when the address is confirmed.
  The code sign-in path is fixed: a code that reached the inbox drops a password still on an unconfirmed account.
  (b) The attacker's own session survives the owner taking over: the JWT (and the interim `ra_session` cookie) issued at sign-up stays valid until it expires. S32 must revoke every `user_session` of an account when a code sign-in drops an unproven password. RESOLVED in S32 (batch 3).
  (c) Share links for unconfirmed accounts: `JwtStrategy` no longer gates on `emailVerifiedAt` (door 14), and `POST /api/decks/:deckId/share` is open to an unconfirmed account until S33's `403 EMAIL_NOT_CONFIRMED` (C389). Not a flaw in the strategy; batch 2 must not ship without S33. RESOLVED in S33 (batch 4).
  (d) The interim cookie is accepted on writes without the origin check of C386/C387 (S32). Until then only `SameSite=Lax` protects it, which does not stop a request from a sibling subdomain; batch 2 must not ship without S32. RESOLVED in S32 (batch 3).
  (e) Per-address code limits: asking for a new code resets the 5 tries, so only the per-IP windows slow a guesser until S34's per-address count (C404 range). RESOLVED in S34 (batch 4).
- Security review of `94b56ce` (second pass).
  (f) Changing or creating a password needs only a signed-in session (`PUT /api/users/me/password`, C409 says no current-password input), so whoever holds one live session of the account can take it over by setting a password of their own.
  Every other session is ended by the change (C380) and the account can still be recovered by a code sign-in, but the holder of the stolen session keeps access.
  A guard that fits C409 (for example a session opened in the last few minutes, or a code asked at that moment) needs a screen no mockup draws, so it is parked: pick between a fresh-sign-in rule with a re-sign-in sheet, or accepting the risk.
  (g) A session carried by a request is not ended when the same browser signs in again (a new token is always issued, never reused or taken from the request, so classic session fixation does not apply: tokens only come from server-created rows).
  Ending the carried session on sign-in is hardening only; not done.
  (h) `verifyEmail` still keeps a password someone else set and still ends no session: this is item (a) above, waiting for the owner.
- Lockout by a stranger (security review of `205a634`, found by the orchestrator's check of the per-address limit; the numbers are C404's, so nothing was changed).
  Someone who only knows an address can ask for its five codes in an hour, and can spend the live code's five tries with wrong guesses, so the owner gets `429` on "Reenviar" and cannot sign in by code for up to an hour (the oldest of the five codes must age out).
  A stranger cannot block the password sign-in (its limit is per IP, not per address), a code-only owner's other devices already signed in, or any other address; the web offers "Entre com um código por e-mail" and "Entre com a sua senha" next to the limit message, so a password account keeps a way in.
  An account with no password has no other way in during that hour, and each stranger request also e-mails the owner a code they did not ask for.
  A gentler variant would count only codes that were asked and never tried, or let the e-mail button of the newest code sign in after the limit; both change what C404 counts, so the owner decides.
- Resolved in S32: items (b) and (d) of the security review above. (b): a code sign-in that drops an unproven password revokes every other session of the account. (d): the origin check on writes is mounted for the cookie.
- The session-ended sign-in sheet (C382, AC 239) is not drawn by any mockup in `.design/mockups/account/`; the document only says "a sign-in sheet over the page, after it the same page, the draft kept".
  It was built from the existing start steps inside a bottom sheet and shows no copy of its own, so check how it looks and whether it needs a mockup round.
  C382 stays unmarked until the owner picks a design (mark it ` · done` if the sheet is accepted as built); the code and both proofs (`SignInSheet.spec.tsx`, the Playwright test "a session that ends mid-edit keeps the page and the draft") are green.
- Production's `APP_BASE_URL` must be the exact origin the app is served from: a write from any other origin (for example the Railway domain next to a custom one) now answers `403` `ORIGIN_REJECTED`.
- Every JWT issued before this deploy stops working, so each signed-in player signs in once more (Impact row "existing JWTs"); the migration `1778533604000-AddUserSession` runs on boot outside development.

- C59: no mockup draws what opens the "Mover 1 para o inventário" menu. It is built as a tap on the quantity number, with no extra element; confirm that or pick another opener.
- The cause line has no wording for a card-pool problem, a card the hero cannot use or an unknown card; give the three phrases if they should appear on the home card.
- C71 conflicts with the home's grouping by stage, see Deviations, S6; decide whether the check or the grouping changes.

- The edit screen's danger zone and its dialog say a deleted deck cannot be undone, but the delete is a soft delete now (S8); give the wording, or let it call the same delete with the toast of the deck page menu.

- S9, "Comprei um deck pronto" links to `/add-cards`, which today opens the manual add and creates no deck; the ready-made decks are S13, whose builder repoints the row.
  "Tenho um link do Fabrary" opens the existing import card under the row (no mockup draws the open row).
- S9, copy of mine, no check or mockup gives it:
  - `/decks/new`: "Nenhum herói encontrado." (a search with no result); "Classic Constructed: pelo menos 60 cartas, até 3 cópias de cada" and "Living Legend: pelo menos 60 cartas, até 3 cópias de cada, e só 1 de uma carta restrita" (from the rules table of `.design/deck-building.md`); a hero that is not young shows no line under "Você escolheu X".
  - Deck page, hero outside the format: "Não foi possível mudar o formato. Tente de novo." (a refused switch or undo); "Em X" as the heading of each format when none is valid; the sentence of the red block for a card problem other than a ban uses the existing localized reasons.
  - Shared deck page: "O deck tem N cartas; o mínimo no X é N.", "N é lendária e só pode ter 1 cópia; tem N.", "... é restrita no X ...", the steps "tirar N carta", "tirar carta", "escolher outro herói ou outro formato", "tirar N cartas do deck"; the answers of a tapped chip "Em X: vale.", "Em X: não vale. <primeiro motivo>", "Em X: ainda não vale. <tamanho>".
- S10, copy of mine: "Não foi possível salvar o deck. Tente de novo." (a refused save from the notice's buttons and rows); the singular forms of the notice and of its explanation ("1 carta deste deck tem 2.", "Tira 1 cópia da carta ..."); the "Deixar 1 de cada" toast says "do deck" even if the copy came from the inventory of a card with no deck copy.
- S11, differences from the picked mockups, and what I added:
  - Nothing on today's Library grid opens a card, so the card sheet (`r3-version-card-phone`) opens from the card's name under the art (the same text, now a button); the mockup draws the Library as a list of rows, which this slice does not rebuild.
  - "Mudar versão" acts on the copies with no version, or on the first group when every copy has a version; the mockup draws one button for the whole card.
  - `r3-version-card-phone` offers NM, LP, MP and HP, while `.design/collection-in.md` says `DMG` is offered in the card picker (derivation note 1 of getting cards in): built as drawn, no `DMG`.
  - The picker lists the printings in the catalog's order (Snatch (Vermelho) starts with its Silver Age decks); the mockup shows Welcome to Rathe, History Pack 1 and Armory Deck: Ira first, and no rule for that order is in the repository.
  - `r3-imports-phone`: only the link "Versões desta importação" was added to each row; the rest of that screen (the copy, "cópias", the order, the controls the screen leaves out) is C181 in S15.
  - `r3-version-bulk-phone` draws one preview row, "foil · escolha a versão", for a pasted version word that left more than one printing; that stored state belongs to the reader (S12) and is not built. Its "Mudar" opens the card sheet.
  - The preview shows the chosen marking on every row with no version, including cards the API will skip; the skipped ones are listed after applying, as the document says.
- S11, copy of mine, no check or mockup gives it:
  - Card sheet: "Carregando as versões…", "Não foi possível carregar as versões. Tente de novo.", "Nenhuma versão com esse nome." (a search with no match), "Salvando…", "Não foi possível salvar. Tente de novo.", the singular "+ 1 versão".
  - Versions page: "Aplicando…", "Não foi possível aplicar. Tente de novo.", "Não foi possível carregar esta importação.", "Esta importação não tem cópias.", "Ficaram como estavam, porque a carta não existe nessa versão:" (heading of the skipped cards), "Mudar a versão de <carta>" (aria-label of "Mudar"), "Aplicar à 1 cópia sem versão" (singular).
  - Scanner review: "Qual é a edição?", "Sim", "Não" (the check gives "É foil?"); "1ª edição", "Gold Foil" and "Sem foil" come from the bulk screen and the sell lists' labels.
  - The remove picker's version line: "<import> · <printing code> · <edition> · <finish> · <condition>".
- S12, copy of mine, no check or mockup gives it:
  - Pasted list: the textarea placeholder `Uma carta por linha, como "3x Snatch (Red)"`, "Lendo a lista…", "Não foi possível ler a lista. Tente de novo.", "Não foi possível adicionar. Tente de novo.", "Adicionando…".
  - Summary of a list with lines the screen does not draw: "N com nome parecido" and "N com quantidade a corrigir" (a near name not yet accepted, a bad quantity).
  - Line answers: "Esta linha não tem quantidade" (an empty quantity cell), the cap note "quantidade acima de 20: lemos 20" (from the API), "essa carta não tem essa versão" (pasted version words no printing has), the version chip "Sem foil · NM" sends finish and condition even where the card has no plain printing (condition only then).
  - Report: the group "Não achamos" for a line no card matches (the report draws three groups), the file chooser page ("Planilha", "Escolher o arquivo", "Um arquivo .csv com uma carta por linha.", "Lendo <arquivo>…", "Escolher outro arquivo"), the duplicate answer `Você já adicionou esta planilha como "<nome>".` with "Adicionar de novo".
  - Errors: `apiErrors.IMPORT_UNREADABLE` ("Não conseguimos ler esse arquivo. Confira se é um arquivo de texto (.csv), com uma carta por linha, e se tem até 2 MB.") and `IMPORT_TOO_MANY_ROWS`, both in en-US too.
  - The page behind "Resolver" (`/library-pending`) is drawn by no mockup: it reuses the lines of the report (the same colors, near names, quantity field and search) and adds a "Excluir" link per line, a heading "Para resolver", the empty line "Nada para resolver." and two error lines. Each line is added to its import as soon as it is answered.
  - The link "Colar uma lista" on `/add-cards/csv` is the only way to the pasted-list page until S15 builds the entry.
- Resolver page (`r4-resolve-b-phone`), what the mockup does not draw:
  - A line that asks a color (`asks_color`) has no step in the mockup; it shows "Qual cor?" with the three color buttons inside the card, "Adicionar" stays off until one is chosen.
  - The quantity stepper is also drawn on the near-name step with the suggestion's own quantity; the line's hint (`quantityHint`) fills it, 1 when there is none.
  - The quantity message reads the second comma cell of the line (`"três" não é um número. Quantas cópias?`); a pasted line with no comma shows "Esta linha não tem quantidade. Quantas cópias?".
  - Copy of mine: "Menos uma cópia" and "Mais uma cópia" (stepper labels), "Buscar a carta pelo nome" (the field's label), "Linhas resolvidas" (the bar's label), and the en-US versions of every new line. The "Pular deixa a linha na lista..." note shows under every step, the mockup draws it under the first only.
  - The header leaves out "depois desta" on the last line and "já resolvidas" while none is resolved.
  - A search shows one result, the card the reader reads (or its near name), not a list: the mockup draws only the empty answer.

- S14, copy of mine, no check or mockup gives it:
  - "Procurando o deck…" while the preview loads.
  - After a "Não" import the card says "Deck importado." with a link "Ver o deck" (the check only names "Colar a lista do que eu tenho"; a "Sim" import opens the deck at once, as the old card did).
  - `apiErrors.INVALID_URL`: "Esse texto não tem um link de deck do Fabrary." (a `400` the paste box cannot normally reach).
  - On `/decks/new` and in onboarding the found card is the same question; the onboarding step keeps its "Continuar" button as the import trigger, disabled until an answer is picked, and shows the found line and "Você tem X de Y" as one sentence.
  - The paste box opens the list reader on paste, not while typing; typing a list by hand stays in the box.

- S15, differences from the picked mockups:
  - `r3-imports-phone` draws no "•••" menu; each non-manual row keeps it (rename, delete) because removing an import has no other place. Decide where rename and delete live, or accept the menu.
  - The "Enviar CSV" button of the old page is gone and nothing replaces it: re-uploading a spreadsheet to update an import (the exact-match and update choices in `UploadResolveModal`) has no screen now; `/add-cards/csv` always adds a new import.
  - The empty "Importações" page keeps its old empty state; its button opens `/add-cards/csv`.
  - The mockup's first row "Armory Deck: Kayo · 66 cartas" reads "cópias" like every row (derivation note 2 of the checks).
- S15, copy of mine, no check or mockup gives it:
  - en-US versions of every new line; "Entradas à mão" is also the stored English-free name the API answers for the manual source ("Hand entries" for en-US).
  - `csvSources.importsNote` is the check's note; the tooltip of the pending count reads "11 linhas para resolver".
  - First-run: the link icon on "Tem um link ou uma lista? Colar aqui", the upload and camera icons on the other rows (the PNG draws them; no check names them).

- S13, copy of mine, no check or mockup gives it:
  - Search: "Nenhum deck encontrado.", "Não foi possível carregar os decks. Tente de novo.", "Não achamos esse deck." (an address with a key no file has), the label "Buscar o deck pelo nome do produto ou do herói" of the search field.
  - Confirm: "Adicionando…", "Não foi possível adicionar. Tente de novo.", and the button "Adicionar outra caixa" that confirms the repeated box (C164 gives only the question).

- S16, copy of mine, no check or mockup gives it:
  - The tooltip on the estimated price tilde no longer points to "Obter preços exatos": it reads "Preço estimado pelo anúncio da loja."
- S16: C201 is not built. It needs a visible line in the admin Settings page that no picked mockup draws, and the batch rule says not to draw it. `GET /api/admin/stores/:slug/credits` (C200) is built and answers the numbers; the line needs a mockup pick first.
- S16: C199 stays unmarked until S18 (states on the group page) and S19 (the `quote` address) add what its proof reads.
- S16 touched the proofs of two checks marked done in earlier batches; the owner decides whether they stand:
  - C14 (`ShoppingLine.spec.tsx`, "the row names the pitch"): the last assertion named the pitch in the aria-label of the row's "failed to fetch" badge. The badge left with the fetch button (AC 123), so that label no longer exists; the link's aria-label and the row text are still asserted.
  - C92 (`decks-lifecycle.e2e-spec.ts`, "a deleted deck is left out of every reader"): the case also checked that the variant job drain skipped a deleted deck. C92's claim does not list that reader, and a job holds no deck now (door 10), so the lines were removed.
- S17, the alternatives sheet lost its only entry point: it opened from a button on each row of the old missing panel, and no picked mockup draws that button on the new list (or anywhere on the deck page). `AlternativesSheet` and its unit tests are intact; the e2e flow that started from the button was deleted. Decide where the sheet opens from (it needs a mockup).
- S17, copy that no check or mockup gives, written short: "Nada falta neste deck." (list with nothing missing), "Nenhuma carta aqui." (a chip or filter with no row), "Não foi possível carregar a lista. Tente de novo." with "Tentar de novo", "Nada para comprar na Cúpula DT agora" (title when no copy is priced), "N cartas sem preço agora" (summary note for `no_price` lines), "só tem promo", "A loja tem 2. As outras 2 estão no pedido do grupo." (a shortfall of two or more), "A Cúpula DT não tem esta carta agora" (`store_lacks` row), "N na loja" (table cell under a shortfall), "Não deu para guardar. Tente de novo.", "Não deu para desfazer. Tente de novo.", "Não deu para copiar a lista. Tente de novo.", and the aria labels "Comprar X no site da Cúpula DT", "Ver X no site da Cúpula DT", "Procurar X no site da Cúpula DT", "Usar X no lugar de Y", "Desfazer a troca de X", "Quantas cópias de X você já tem". C208 quotes "1 cartas ainda buscando preço", so the note does not take a singular.
- S17, differences from the mockups: the deck page keeps its status strip above the card (the mockup draws only the card), and on desktop the stand-in cell is the dashed block with its button instead of plain text with a link. The mockups' "Ver as 66 sem descontar" link is left out, as the design document says. A row shows "cada" after the unit price unless it needs one copy and the owner has none, which fits both drawn rows; confirm that rule. The summary on a phone is sticky under the top bar and the share bar sits above the tab bar.
- S17, code left in the tree and now unused by any screen: `DeckActionPanels`, `MissingPanel`, `MissingRowStore`, `MissingStoreSummary`, `missingStoreModel`, `MarkOwnedButton`, `SuggestionUseButton`, `ShoppingPanel`, the `ShoppingLine` family with `StoreProductLink`, `AlternativesSheet`, `useMarkOwnedMutation`, the `POST /api/collection/mark-owned` route and the deck detail's `shoppingLine` field; their tests still pass. Removing them also means editing `design-guards.spec.ts`, which reads their CSS.
- S17, the deck page's card reads `GET /api/decks/:deckId/missing`, and that route queues lookups (C186), so an owner who only opens the deck page now queues the price lookups the list would, and spends credits sooner than AC 115 and the design document ("only the owner's list can trigger a lookup") describe. A read-only variant (a query parameter, or the card reading `StoreAnswersService.read`) would keep the lookups to the list; it changes `Surface`, so the owner decides.
- S17 deleted `apps/web/tests/e2e/card-alternatives-flow.spec.ts` ("pick an alternative and undo it"), the proof of C58 of `.specs/features/card-alternatives/checks.md`; it started from the alternatives button of the old missing rows. Other proofs of earlier features still exist and pass, but their claims name the old panel: `.specs/features/swaps-into-alternatives/checks.md` C16 (`suggestions-flow.spec.ts`, same title, the "Usar" now runs on the list page and checks the deck list afterwards) and the `MissingPanel.spec.tsx` and `DeckActionPanels.spec.tsx` proofs, which test components no screen mounts any more. Tests removed from `decks-deckId-mutations.spec.tsx`: "colours the missing-row pitch bar by the card pitch", "marks a missing card as owned through the mutation with its identifier", "routes a markOwned failure through Toast"; its DECK-05 cases were rewritten ("renders the missing panel and no swaps panel while the deck is incomplete", "omits the panels when the deck is complete", "gives the missing panel the id the strip anchor points at", "lists the cards still to buy with their missing count", "links Comprar to the store product page when the shopping line has one", "shows no Comprar link for a card the store does not list" are gone), and the `DeckDetailSidebar.spec.tsx` describe "shopping block" (two cases).
- S17, a bug older than this batch, not fixed here: `useSuggestions` and `planSuggestedUses` size a use with `computeNeeded`, which counts deck and inventory copies, while `moveCopies` defaults to the deck side. When inventory copies are missing, a "Usar as N" can add more stand-in copies than it takes off the original.
- S18, the group step of the share sheet follows `r3-message-phone` and draws only the message, the switch and "Abrir no WhatsApp". The mockup leaves out what the old missing link step had: the address row with "Copiar", the "Mostrar meu WhatsApp" switch with its inline number field, "Baixar imagem das cartas" and "Desativar link". So an owner can no longer turn off a `missing` address, hide the number on it or download its image from the sheet (the `deck` address keeps all four). Say if the mockup should grow them back.
- S18, copy of mine, no check or mockup gives it: the closing line has no label when it is empty (the field has only its placeholder), with the accessible name "Linha final da mensagem"; the switch line when it is on ("A mensagem leva também as N que a loja tem."); the store section's price note ("Preços conferidos recentemente. O preço final aparece no site da loja.", the mockup says "nos últimos 30 dias" but the page answer carries no day count); "Copiar o texto" on the offer sheet when the link shows no number; "Não deu para copiar o texto. Tente de novo."; the intent line of an option that is off when nothing is missing, reusing "Não falta nenhuma carta.". The English side of every new line is also mine.
- S18 and S19, differences from the mockups: the store rows of the group page show no "+ 11 cartas" truncation (the open section lists every priced row); the offer sheet has the close button of the share frame; the quote page has the "Prévia da mensagem" block always on screen, as the mockup draws it, and "Ver mensagem e enviar" sends it (C244 words it as a step after the tap); the preview block says "Marque as cartas que você tem para ver a mensagem." until one card is marked.
- S19, the share sheet step for "Pedir orçamento a uma loja" has no picked mockup (`r3-share-phone` draws only the three options, `r3-quote-phone` the store's page). I built it from the parts of the deck step: the quote address with "Copiar" and the "Enviar no WhatsApp" button carrying "Oi! Pode me passar um orçamento destas cartas? <address>". It has no contact switch, no image download and no turn-off. Say if it needs a drawing.
- S19, copy of mine, no check or mockup gives it: the toast "Lista copiada" after "Copiar a lista para a sua planilha"; "Não deu para copiar o texto. Tente de novo."; "Nenhuma carta foi pedida." when a quote has no card; the field labels "Tenho 2 de <carta>", "Preço por unidade de <carta>" and "Observação de <carta> (edição, condição)" for assistive technology. The English side is also mine.
- S19, the quote message leaves out a row marked 0 and a price field left empty (the line then has no "R$ ... cada"); the total adds only the rows that carry a price. Prices are read in reais: "120", "120,00" and "1.200,00" are accepted, anything else counts as no price.
- C231 (S18) stays open until S20: it needs the spare count on the group page rows. C249 (S19) stays open: its quote half conflicts with C239's exact keys, see the S19 deviations.
- S20, copy of mine, no check or mockup gives it: "Sobra 1 cópia" / "Sobram 0 cópias" (the option count, singular only for one), the title "Sobrando · N cópias", "Nenhuma cópia sobrando agora.", "Contando o que sobra…", "Não foi possível carregar o que sobra. Tente de novo.", "Salvando…", "Não foi possível salvar. Tente de novo.", "Antes de mostrar o que você tem" (the question's heading on the group page), "Cartas sobrando", "Você ainda não escolheu como contar o que sobra.", "Escolher", "‹ Configurações", the rows of "Por que sobra?" other than the one the check quotes ("Ficam no Kayo CC" under `any_deck` and `per_deck`, "o deck que mais usa: ..." under the rule that sets one number), "Dash ideia e Velho não contam: ..." (plural). The English side of every line is also mine.
- S20, the settings panel "Cartas sobrando" (C264) is drawn by no mockup; it is a heading, the player's rule line and a "Mudar" or "Escolher" button that opens the same question. Say if it needs a drawing.
- S20, the "Sobrando" notice names the card without its pitch ("Dash ideia usa 3 Head Jab."), as C267 and the mockup quote it, although the S2 rule writes the pitch after every pitched name.
- S20, `r3-library-banner-phone` draws the Library as a list of rows under the banner; the banner is above the existing grid and filter rail.
- S20, an unmarked copy reads "Versão não informada" only beside a marked copy of the same card (C267 quotes both forms); otherwise the line is "N sobrando".

