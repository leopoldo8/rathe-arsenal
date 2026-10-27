# Persona rethink checks

Profile: ui
Plan: `.specs/features/persona-rethink/plan.md`

454 checks in 39 slices · 19 one-way doors · 7 open, of which 4 block go-live and none blocks the build

Proof commands, by suite (each proof below names its file and test):

- web unit: `pnpm --filter @rathe-arsenal/web exec vitest run <file> -t "<test>"` (files relative to `apps/web`)
- web e2e: `pnpm --filter @rathe-arsenal/web exec playwright test --project=<project> <file> -g "<test>"` with the dev server up (`pnpm dev`); projects from `apps/web/playwright.config.ts`: `e2e-chromium`, `mobile-360`, `mobile-390`, `visual-dark-desktop`; after door 19, CI runs `e2e-chromium`
- api unit: `pnpm --filter @rathe-arsenal/api exec jest <file> -t "<test>"` (files relative to `apps/api`)
- api e2e: `DATABASE_URL=postgresql://postgres:dev@localhost:5432/rathe_arsenal pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.e2e-spec\.ts$' --forceExit --runInBand <file> -t "<test>"`
- api int: `pnpm --filter @rathe-arsenal/api exec jest --testRegex '.*\.int-spec\.ts$' --forceExit <file> -t "<test>"`
- engine unit: `pnpm --filter @rathe-arsenal/engine exec jest <file> -t "<test>"` (files relative to `packages/engine`)

Test names are the ones the builder writes from these claims; a proof's file may move with the code it tests, its test name and assertion do not.
Where a binding screen and its document's state table disagree on copy, the checks follow the document's words and the screen's arrangement; each case is listed under `## Derivation notes`.

Conventions per journey:

- gates and words: Binding sources read: plan.md S1, S2, S36, S37, doors 18 and 19, Surface `/termos`; `.design/copy-and-access.md`; screens `r2-pitch-sheet-phone`, `b2-stage-retire-phone`, `r2-glossary-phone` (text extracted from their HTML on 2026-10-23).
- building a deck: Engine test files are relative to `packages/engine` and live in its top-level `__tests__/` folder, as today.
- building a deck: Screen ids are files under `.design/mockups/deck-building/`.
- building a deck: Where a screen and a criterion disagree, the criterion wins (plan precedence); each such case is listed under Gaps.
- getting cards in: Card names and printing codes used below come from the binding screens (`.design/mockups/collection-in/r3-*.html`) or from `.design/collection-in.md` ("WTR167", "Snatch (Vermelho)", "Armory Deck: Kayo", Agility and Might as its tokens).
- getting cards in: Screen checks render the component in pt-BR with a fixture shaped like the screen's data, and assert the strings and the order of the blocks.
- closing the deck: Strings come from `.design/close-the-deck.md` (state tables) and the r3 screens it names; where the two differ, the document's state table wins for copy and the screen for arrangement (see Gaps).
- closing the deck: Examples use the binding screens' data: deck "[CC] Brute do Caio" (Rhinar), sharer "Caio", 66 copies of 27 cards, 43 to buy for R$ 452,28, 14 the store lacks, 2 off the site, 5 owned, 2 stand-in.
- selling and trading: Shared scenario of the spare checks, the one `r3-why-spare-phone` draws, for "Duda": 6 copies of Pack Hunt (Azul); `Kayo CC` (Classic Constructed, `building`) uses 3, `Rhinar CC` (Classic Constructed, `ready`) uses 2, `Rhinar SA` (Silver Age, `active`) uses 2, `Dash ideia` (`idea`) uses 3.
- selling and trading: The spare function is a pure function at its own layer (`apps/api/src/collection/spare/spare-copies.ts`, new) behind a service that reads the collection, the decks and `user.spareRule` (`spare-copies.service.ts`, new); the builder may place them differently, and the test files move with them.
- the Tutor: No proof calls a real model.
- the Tutor: API tool tests call `runChatTool` on `ChatToolsService.forTurn(...)` as `chat-tools.e2e-spec.ts` does.
- the Tutor: Turn tests script the model with `scriptedFetch([...])` and `fixture.drain(stub.fetch)` as `chat-worker.e2e-spec.ts` does.
- the Tutor: The eval's checks are unit-tested on recorded traces as `chat-eval-scenarios.spec.ts` does; the eval itself runs only by hand.
- the Tutor: Card fixtures follow the audit (F29, F34): a Classic Constructed Rhinar deck with Pack Hunt (Vermelho) (`pack-hunt-red`) at 3 in the deck and 1 in the inventory (door 3, `deck_card.inventoryQuantity`), Pack Hunt (Amarelo) 3 and (Azul) 3.
- the Tutor: Other cards are picked by name in the test, as `proposal-validation.spec.ts` does, because their identifiers were not verified here.
- accounts, housekeeping, counts: Every API e2e test below that signs in boots through `configureHttpApp`: either `bootFixture` from `src/replacements/__tests__/replacements-e2e.fixture.ts` or a bootstrap that calls `configureHttpApp` (C387).
- accounts, housekeeping, counts: The sign-in code and the confirmation token are read in API e2e tests from a capturing `EmailService` double, never from a real mailbox.

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - Locale and accessibility gates in CI · 19 files · 132 KB · ~41k

**C1** - The locale rule function returns a violation for a pt-BR value containing U+2014 ("x — y") and for one containing U+2013 ("x – y"), and none for "x - y"; the test walks every leaf string of the pt-BR catalog exported by `i18n/locales/pt-BR/index.ts` and fails listing `namespace.key` for each value with either dash (AC 1, AC 5) · done
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "flags an em dash and an en dash in a value"`
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "no pt-BR value contains an em or en dash"`

**C2** - The rule function flags `troca`, `trocas` and `trocar` (whole word, any case) in values of the `home`, `auth` and `onboarding` namespaces and does not flag them in `deckDetail` or `alternatives`; it flags the literals "Manual entries" and "Attack Actions" in a value of any pt-BR namespace; the one stated exception is the string "Não é você? Trocar" of the `account` namespace (C360, from `.design/account.md`), which the rule does not scan because it covers only `home`, `auth` and `onboarding` (AC 2) · done · amended 2026-10-27 (delegation, D55)
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "flags troca outside a deck and the leaked English literals"`

**C3** - The current pt-BR catalog passes both rules after S1: `home.emptyLead`, `home.step2Body`, `auth.decorationCopy`, `onboarding.step2BodySingle`, `onboarding.step2BodyMultiple` and `onboarding.congratsBody` contain no `troca`/`trocas`/`trocar`; `deckDetail.groupAttack` and `deckDetail.groupNonAttack` are not English; `decks.partialUpdateMsg`, `lists` `totalPlaceholder` and `price` contain no em dash, so "R$ —" is gone (AC 4, AC 5) · done
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "the pt-BR catalog passes every copy rule"`

**C4** - With `kind: 'manual'` the Library shows the pt-BR label of the manual source and the text "Manual entries" appears nowhere on the page in pt-BR, although the API still sends `label: 'Manual entries'` (AC 2, AC 4) · done
Proof: `web unit src/components/library/__tests__/LibraryGrid.test.tsx -t "the manual source reads in Portuguese"`

**C5** - The automatic deck name joins hero and format with " - " (U+002D): hero display name "Dorinthea Ironsong" and format "Classic Constructed" give "Dorinthea Ironsong - Classic Constructed", "Rhinar" and "Blitz" give "Rhinar - Blitz", and the saved name contains no U+2014 (AC 5) · done
Proof: `api unit src/decks/__tests__/decks.service.create-scratch.spec.ts -t "composes name as \"{heroDisplayName} - {format}\""`

**C6** - The axe filter keeps a violation of impact `serious` and one of `critical` and drops `minor` and `moderate` (AC 3) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/accessibility.spec.ts -g "the axe filter keeps serious and critical issues only"`

**C7** - The scan list exported by `tests/support/axe.ts` contains these six pages, the first five in this order: home, deck page (the fixture deck), Library, shared deck page (`/d/<fixture token>`), sign-in (`/sign-in`, signed out), and the shopping list, which is the fixture deck's missing list (`/decks/<fixture deck id>/missing`); later slices add their own pages after them; for each page `new AxeBuilder({ page }).analyze()` returns zero violations of impact `serious` or `critical`, and a failing page names the axe rule id and the selector (AC 3, AC 4; door 18) · done · amended 2026-10-27 (delegation, D25)
Proof: `web e2e --project=e2e-chromium tests/e2e/accessibility.spec.ts -g "no serious or critical axe issue on"`

**C8** - `apps/web/package.json` lists `@axe-core/playwright` under `devDependencies` and not under `dependencies` (door 18) · done
Proof: `web unit src/__tests__/ci-workflow.spec.ts -t "axe is a dev dependency of the web app"`

**C9** - `.github/workflows/ci.yml` has a job `web-e2e` whose block contains a service with `image: postgres:16`, a step running `playwright install --with-deps chromium`, a step running `playwright test --project=e2e-chromium`, the API e2e job's `APP_BASE_URL: http://localhost:5173`, and no `continue-on-error: true` (AC 3; door 19) · done
Proof: `web unit src/__tests__/ci-workflow.spec.ts -t "the web-e2e job runs Playwright against Postgres 16"`

### S2 - Every card is told apart by name · 30 files · 184 KB · ~60k

**C10** - `cardName(name, pitch, t)` in `src/lib/card-name.ts` returns, in pt-BR, "Pack Hunt (Vermelho)" for pitch 1, "Pack Hunt (Amarelo)" for 2, "Pack Hunt (Azul)" for 3, and "Pack Hunt" for `null` and for 0; in en-US "Pack Hunt (Red)", "(Yellow)", "(Blue)" (AC 6, AC 7) · done
Proof: `web unit src/lib/__tests__/card-name.spec.ts -t "names the pitch as a word"`

**C11** - A weapon, an equipment and a hero (pitch `null`) render by their name alone on the deck page decklist tile and in the missing list (AC 7) · done
Proof: `web unit src/lib/__tests__/card-name.spec.ts -t "a card with no pitch keeps its name"`
Proof: `web unit src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "a card with no pitch is named alone"`

**C12** - With "Pack Hunt" missing at pitch 1 and pitch 3, the missing list shows the visible names "Pack Hunt (Vermelho)" and "Pack Hunt (Azul)", and the buy link's aria-label reads "Comprar Pack Hunt (Vermelho) na loja" and "Comprar Pack Hunt (Azul) na loja" (AC 6) · done
Proof: `web unit src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "two pitches of one name read differently"`

**C13** - "Já tenho" has the aria-label "Já tenho Pack Hunt (Vermelho)" for the pitch-1 line and "Já tenho Pack Hunt (Azul)" for the pitch-3 line (AC 8) · done
Proof: `web unit src/components/deck-detail/__tests__/MarkOwnedButton.spec.tsx -t "names the card it marks"`

**C14** - The shopping row keeps the API's `pitch` (`api/shopping-line.ts` no longer drops it) and renders "Pack Hunt (Vermelho)" in its text and in every aria-label of the row (AC 6) · done
Proof: `web unit src/components/__tests__/ShoppingLine.spec.tsx -t "the row names the pitch"`

**C15** - The deck page tile (`CardGalleryCell`), the editor row (`EditableCardRow`), the Library tile (`LibraryGrid`), the shared deck tile (`SharedGallery`), the shared missing tile (`SharedMissingGallery`), the shared list tile (`SharedListGallery`), the list line (`LineTile`) and the Tutor's swap proposal (`ProposalCard`) each render "Pack Hunt (Vermelho)" in visible text and in the tile's aria-label for a pitch-1 Pack Hunt (AC 6) · done
Proof: `web unit src/components/card-gallery/__tests__/CardGalleryCell.spec.tsx -t "names the pitch"`
Proof: `web unit src/components/deck-detail/__tests__/EditableCardRow.spec.tsx -t "names the pitch"`
Proof: `web unit src/components/library/__tests__/LibraryGrid.test.tsx -t "names the pitch"`
Proof: `web unit src/components/shared-deck/__tests__/SharedGallery.spec.tsx -t "names the pitch"`
Proof: `web unit src/components/shared-deck/__tests__/SharedDeckPage.spec.tsx -t "the missing tiles name the pitch"`
Proof: `web unit src/components/shared-list/__tests__/SharedListPage.spec.tsx -t "the list tiles name the pitch"`
Proof: `web unit src/components/lists/__tests__/LineTile.spec.tsx -t "names the pitch"`
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "both cards of a swap name the pitch"`

**C16** - The toast after a swap and its undo action read with the pitch: "Desfazer a troca de Pack Hunt (Vermelho)" for a pitch-1 Pack Hunt (AC 6) · done
Proof: `web unit src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "the swap toast names the pitch"`

**C17** - Outside `src/lib/card-name.ts` and the locale files, no source file under `apps/web/src` (tests excluded) contains a pitch-number map: none contains `'library.pitchRedLabel'`, `'deckDetail.pitchRed'` or `'reasons.rationale.pitchRed'` next to the number 1, so `CardFace.tsx`, `AlternativesSheet.tsx`, `DeckAnalysisRow.tsx` and `card-naming.ts` import the module instead (AC 9) · done
Proof: `web unit src/lib/__tests__/card-name.spec.ts -t "the pitch words live in one module"`

### S3 - The rules engine knows the current rules and returns every problem · 14 files · 122 KB · ~33k

**C18** - `FORMAT_RULES` holds `maxCopies` 3, 3, 1, 2 and `maxCardPool` 80, 80, 52, 55 for Classic Constructed, Living Legend, Blitz and Silver Age, and no `allowedRarities` field remains (AC 10, AC 12, AC 14) · done
Proof: `engine unit __tests__/legality/rules.spec.ts -t "copy and pool limits per format"`

**C19** - For each of the four formats, a card at the limit gives no copy problem and one copy over gives one problem with `count` and `limit`, where the copies are split across `mainboard`, inventory, `weapon` and `equipment` (3 deck + 1 inventory in Classic Constructed and Living Legend gives count 4, limit 3; Silver Age limit 2; Blitz limit 1); table-driven over 4 formats x 2 rows (AC 10) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "copy limit counts deck, inventory, weapons and equipment in every format"`

**C20** - Copies are keyed by name and pitch: in Blitz, Pack Hunt (Red) x1 plus Pack Hunt (Yellow) x1 gives no copy problem; Pack Hunt (Red) x2 gives one problem for that card only (AC 10) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "copies are counted per name and pitch"`

**C21** - A Legendary card at 2 gives a copy problem with limit 1 in each of the four formats; a card restricted in Living Legend at 2 gives limit 1 in Living Legend and no problem in Classic Constructed (AC 11) · done
Proof: `engine unit __tests__/legality/card-legality.spec.ts -t "legendary and living legend restricted copy limits"`

**C22** - The pool counts deck + inventory + weapons + equipment and never the hero: 80 passes and 81 fails in Classic Constructed and Living Legend, 52 passes and 53 fails in Blitz, 55 passes and 56 fails in Silver Age; table-driven over 8 rows (AC 12) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "card pool limit per format without the hero"`

**C23** - A Blitz deck at 31 of 40 with Pack Hunt (Red) x2 returns both problems in one call, the size problem and the copy problem, each detail carrying its card (null for size), count and limit, with `category` `illegal` (AC 13) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "every check runs and every problem is returned"`

**C24** - `category` follows the table: no problem gives `legal`; only the size problem gives `incomplete`; any rule problem gives `illegal`, both with the size full and with the size short; table-driven over 4 rows (AC 13) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "category from the set of problems"`

**C25** - Ban, format and hero-scope checks run on every slot: a banned card in `equipment`, a format-illegal card in `weapon` and another hero's specialization in the inventory each give their own problem (AC 14) · done
Proof: `engine unit __tests__/legality/card-legality.spec.ts -t "per-card checks run on every slot"`

**C26** - Silver Age legality comes from the catalog's `legalFormats`: Blade Dance gives no problem in Silver Age, and a card whose `legalFormats` lacks Silver Age gives a format problem (AC 14) · done
Proof: `engine unit __tests__/legality/card-legality.spec.ts -t "silver age legality comes from legalFormats"`

**C27** - A hero outside the deck's format gives one hero problem whose params carry `allowedFormats` equal to that hero's `legalFormats` within the four, and the detail has no date and no history field (AC 15) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "a hero outside the format names where it is allowed"`

**C28** - A deck whose format is outside the four returns `category` `unchecked` with an empty problem list and does not throw (AC 16) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "an unknown format is unchecked"`

**C29** - A deck stored with format `Draft` keeps that format, and `GET /api/decks/:deckId` answers `200` with `legality.category` `unchecked` (AC 16) · done
Proof: `api e2e src/decks/__tests__/deck-legality-read.e2e-spec.ts -t "a format outside the four is stored and read as unchecked"`

**C30** - `LegalityBadge` with `category` `unchecked` renders the grey chip "Formato não conferido" (AC 16) · done
Proof: `web unit src/components/deck-detail/__tests__/LegalityBadge.spec.tsx -t "an unchecked deck reads Formato não conferido"`

**C31** - A Blitz deck saved with Pack Hunt (Red) x2 before the rule change (inserted straight into `deck_card`) reads back from `GET /api/decks/:deckId` with `legality.category` `illegal` and a copy detail for that card with count 2 and limit 1 (AC 17) · done
Proof: `api e2e src/decks/__tests__/deck-legality-read.e2e-spec.ts -t "a saved blitz 2-of is illegal on the next read"`

### S4 - The editor shows the draft's verdict and the whole checklist · 17 files · 149 KB · ~43k

**C32** - In edit mode on a saved legal Blitz deck, raising Pack Hunt (Vermelho) from 1 to 2 changes the header chip to "Não vale no Blitz" before any save, and no `PUT /decks/:deckId` is called (AC 18) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx -t "the verdict follows the draft before saving"`

**C33** - The "+" of a card at its limit is disabled with one reason shown: "Máximo 1 no Blitz" (Blitz, 1 copy), "Máximo 1: carta lendária" (Legendary card at 1), "Máximo 1 em Living Legend: carta restrita" (restricted card at 1 in Living Legend); in Classic Constructed a card at 2 in the deck and 1 in the inventory has its "+" disabled; table-driven over 4 rows (AC 19) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx -t "the plus button is disabled at the limit with its reason"`

**C34** - A Blitz row at 2 copies shows "2 cópias · o Blitz permite 1 · tire 1" (AC 20) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx -t "a row over the limit says what to take out"`

**C35** - The bottom bar reads "31 de 40 cartas · 1 problema" for 31 cards and one copy problem, and "32 de 40 cartas · nenhum problema" for 32 cards and no rule problem (AC 21) · done
Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "the bar counts cards and rule problems"`

**C36** - On a 390 px phone, after scrolling the editor to its last row, the bar is still inside the viewport (AC 21) · done
Proof: `web e2e --project=mobile-390 tests/e2e/deck-edit-flow.spec.ts -g "the rules bar stays visible while scrolling"`

**C37** - The sheet for `r3-checklist-phone`'s deck lists, in order: "Herói: Rhinar joga Blitz" (green), "Todas as cartas são permitidas no Blitz" (green), "Cartas que você leva: 35 de 52" with "o deck, o inventário, a arma e os equipamentos; o herói não conta. No torneio isto se chama card pool." (green), "Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1" with "Ir para a carta" (red), "Tamanho: 31 de 40 cartas · coloque mais 9" (neutral), then "Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 30, então coloque mais 10 cartas." and "Fechar" (AC 22, AC 29) · done
Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "matches r3-checklist-phone"`

**C38** - With two rule problems the sheet lists both red lines at once (AC 22) · done
Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "every problem is listed at once"`

**C39** - "Ir para a carta" closes nothing and moves focus to the Pack Hunt (Vermelho) row (AC 22) · done
Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "go to the card focuses its row"`

**C40** - On a 390 x 844 phone the open sheet's height is between 40% and 50% of the viewport, the list above it stays visible, a scroll of the page leaves it open, and it closes by "Fechar" and by its handle (AC 22) · done
Proof: `web e2e --project=mobile-390 tests/e2e/deck-edit-flow.spec.ts -g "the checklist sheet opens at about half height and closes only by handle or Fechar"`

**C41** - With no edit made, a new server payload replaces the draft's cards, and `localStorage.setItem` is not called for the draft key (AC 23) · done
Proof: `web unit src/hooks/__tests__/useCompositionDraft.persistence.spec.ts -t "a pristine draft resets to new server data without writing storage"`

**C42** - A payload with a partly owned card (Pack Hunt (Red), quantity 3, 1 owned) gives one draft row for that card and slot with quantity 3 (AC 24) · done
Proof: `web unit src/hooks/__tests__/useCompositionDraft.spec.ts -t "one draft row per card and slot for a partly owned card"`

**C43** - "Cancelar" on a deck created in this visit with no cards calls `DELETE /decks/:deckId/permanent` and navigates to the location the player came from (AC 25) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx -t "cancel on a new empty deck discards it and goes back"`

**C44** - Changing the format of a deck named "Rhinar - Blitz" (the automatic name) to Silver Age renames it "Rhinar - Silver Age"; a deck named "Meu Rhinar" keeps its name (AC 26) · done
Proof: `api unit src/decks/__tests__/decks.service.update-meta.spec.ts -t "the automatic name follows the format"`

**C45** - `PUT /api/decks/:deckId` with a Blitz composition holding Pack Hunt (Red) x2 answers `200`, stores quantity 2, and returns `legality.category` `illegal` (AC 27) · done
Proof: `api int src/decks/__tests__/decks.controller.put.int-spec.ts -t "a deck with problems is saved as is"`

**C46** - No pt-BR value of the `deckDetail` and `deckEdit` namespaces matches `/ser(á|ão) removid|vamos tirar|tiraremos/i` (AC 27) · done
Proof: `web unit src/i18n/__tests__/catalog-parity.spec.ts -t "no deck copy promises a removal"`

**C47** - "Ver no Fabrary" in the sidebar and in the status strip points to `https://fabrary.net/decks/<ULID>` (AC 28) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckStatusStrip.spec.tsx -t "the fabrary link uses fabrary.net"`
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailSidebar.spec.tsx -t "the fabrary link uses fabrary.net"`

**C48** - The editor for `r3-editor-phone`'s deck shows, top to bottom: "‹ Decks", "Rhinar - Blitz", the chip "Blitz", "Compartilhar", the red chip "Não vale no Blitz", "Etapa: Montando"; the hero, weapon and three equipment rows; the heading "Deck" with "31 de 40 cartas no deck · coloque mais 9"; the Pack Hunt (Vermelho) row with "Ação · custo 2", "2 cópias · o Blitz permite 1 · tire 1", "Máximo 1 no Blitz" and its stepper at 2; and the bar last (AC 29) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckCanvas.edit.spec.tsx -t "matches r3-editor-phone"`

**C49** - No pt-BR value of `deckDetail` contains "trocas de cartas"; the replacements are named "as substituições" (AC 29, copy rule 7) · done
Proof: `web unit src/i18n/__tests__/catalog-parity.spec.ts -t "replacements are as substituições"`

### S5 - The inventory · 20 files · 205 KB · ~57k

**C50** - After the migration, `deck_card."inventoryQuantity"` is `integer`, `NOT NULL`, default `0`; every existing row reads 0; and the check `quantity >= 0 AND "inventoryQuantity" >= 0 AND quantity + "inventoryQuantity" > 0` exists (AC 30; door 3) · done
Proof: `api int src/database/migrations/__tests__/deck-card-inventory.migration.int-spec.ts -t "adds inventoryQuantity with its check"`

**C51** - The check rejects `(quantity -1, inventory 0)`, `(0, -1)` and `(0, 0)`, and accepts `(0, 1)`, `(1, 0)` and `(3, 2)`; table-driven over 6 rows (door 3) · done
Proof: `api int src/database/migrations/__tests__/deck-card-inventory.migration.int-spec.ts -t "the deck_card check accepts and rejects"`

**C52** - `PUT /api/decks/:deckId` with rows carrying `inventoryQuantity` answers `200`, stores them, and the response and `GET /api/decks/:deckId` return each row's `inventoryQuantity` (AC 30) · done
Proof: `api int src/decks/__tests__/decks.controller.put.int-spec.ts -t "composition rows carry inventoryQuantity"`

**C53** - `PUT /api/decks/:deckId` answers `400` and writes nothing for `inventoryQuantity` -1, for `inventoryQuantity` 1.5, and for a row with both quantities 0 (AC 30) · done
Proof: `api int src/decks/__tests__/decks.controller.put.int-spec.ts -t "invalid inventory quantities are rejected"`

**C54** - `PUT /api/decks/:deckId` answers `400` and writes nothing when two rows repeat the same card and slot (Relations: one row per deck, card and slot) · done
Proof: `api int src/decks/__tests__/decks.controller.put.int-spec.ts -t "a repeated card and slot is rejected"`

**C55** - `PUT /api/decks/:deckId` answers `404` for another player's deck and for a deleted deck, and writes nothing (AC 30, AC 55) · done
Proof: `api int src/decks/__tests__/decks.controller.put.int-spec.ts -t "put answers 404 for a deck the player cannot edit"`

**C56** - For `r3-inventory-desktop`'s deck the editor header reads "Deck 60 · Inventário 15 · Card pool 80 de 80", followed once by "Inventário: cartas que você leva ao torneio além do deck. Entre um jogo e outro da mesma partida, dá para trocar cartas do deck por elas." and the card pool line of copy rule 6, "Cartas que você leva: 80 de 80" with "o deck, o inventário, a arma e os equipamentos; o herói não conta. No torneio isto se chama card pool." (the same line sits in the checklist row, C37); the header and its card pool line show only for a deck that has inventory copies; the table heads are "Carta", "No deck", "No inventário"; each row has two steppers (AC 30, AC 35) · amended 2026-10-27 (delegation, D3, D42) · done
Proof: `web unit src/components/deck-detail/__tests__/EditableCardRow.inventory.spec.tsx -t "matches r3-inventory-desktop"`

**C57** - On a 390 px phone each row's two steppers sit under the card name, the deck stepper above the inventory stepper (AC 30) · done
Proof: `web e2e --project=mobile-390 tests/e2e/deck-edit-flow.spec.ts -g "the inventory steppers stack on the phone"`

**C58** - In Classic Constructed, Pack Hunt (Vermelho) at 3 in the deck and 1 in the inventory shows "3 no deck e 1 no inventário, 4 no total. O Classic Constructed permite 3 · tire 1", and both "+" are disabled with "Máximo 3 no Classic Constructed, contando o inventário" (AC 31) · done
Proof: `web unit src/components/deck-detail/__tests__/EditableCardRow.inventory.spec.tsx -t "over the limit across deck and inventory"`

**C59** - The row menu of a card at 3 in the deck offers "Mover 1 para o inventário" and "Mover todas (3) para o inventário"; "Mover 1" leaves 2 and 1 in the draft; a card with inventory copies offers "Mover 1 para o deck" and "Mover todas (N) para o deck" (AC 32) · done
Proof: `web unit src/components/deck-detail/__tests__/EditableCardRow.inventory.spec.tsx -t "the row menu moves copies between deck and inventory"`

**C60** - A Fabrary deck whose card has `quantity` 2 and `sideboardQuantity` 1 is imported as one `deck_card` row with `quantity` 2 and `inventoryQuantity` 1; a card with `quantity` 0 and `sideboardQuantity` 3 becomes one row with `quantity` 0 and `inventoryQuantity` 3 (AC 33; door 3) · done
Proof: `api unit src/decks/import/__tests__/decks-import.service.spec.ts -t "sideboardQuantity is stored as the inventory quantity"`

**C61** - Readiness counts inventory copies: 4 missing deck copies and 3 missing inventory copies give `missing` 7 with a deck part 4 and an inventory part 3 (AC 34) · done
Proof: `engine unit __tests__/readiness.spec.ts -t "missing copies include the inventory and keep the split"`

**C62** - The deck page shows "Faltam 7 cópias (4 do deck, 3 do inventário) · Ver o que falta" for that deck (AC 34) · done
Proof: `web unit src/components/deck-detail/__tests__/EditableCardRow.inventory.spec.tsx -t "the missing line splits deck and inventory"`

**C63** - The missing panel's inventory line is copy rule 6's, never the round-2 "jogo 1" line: no pt-BR value contains "jogo 1" (AC 35) · done
Proof: `web unit src/i18n/__tests__/catalog-parity.spec.ts -t "the inventory line is the one of copy rule 6"`

**C64** - `GET /api/shared/decks/:token` for a `deck` link answers `200` with each card line's `inventoryQuantity` beside its quantity, and still hides what is private and marks the page noindex (Surface `GET /api/shared/decks/:token`; door 3) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "returns the enriched deck, hides what is private and marks noindex"`
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "the deck intent carries each line's inventory"`

### S6 - The stage and the verdict on the home card · 8 files · 39 KB · ~14k

**C65** - A home card with no rule problem shows the stage chip: "Pronto" with "60 cartas" for a full deck; "Montando · 31 de 40 cartas" for a deck short of cards (AC 36) · done
Proof: `web unit src/components/home/__tests__/DeckTile.spec.tsx -t "no rule problem shows the stage chip with the size when short"`

**C66** - A home card with a rule problem shows, top to bottom, the red chip "Não vale no Blitz", the red line "8 cartas com 2 cópias", and the grey line "Etapa: Jogando · 40 cartas"; when short, the grey line is "Etapa: Montando · 31 de 40 cartas" (AC 37) · done
Proof: `web unit src/components/home/__tests__/DeckTile.spec.tsx -t "a rule problem shows the verdict, the cause and the stage in grey"`

**C67** - The cause line follows the table, one case per row: all copy problems at 2 gives "8 cartas com 2 cópias"; copy problems at mixed counts gives "N cartas acima do limite de cópias"; banned gives "N cartas banidas"; out of format gives "N cartas fora do formato"; hero gives "herói fora do formato"; three kinds give the first two joined by " · " then "e mais 1"; one card gives "1 carta com 4 cópias"; and no output of any row contains "jogar" or "pronto" (AC 38) · done
Proof: `web unit src/components/home/__tests__/deckVerdictLine.spec.ts -t "the cause line table"`

**C68** - A deck at stage `active` whose verdict is `illegal` keeps `status` `active` after `GET` and after a `PUT` (AC 39) · done
Proof: `api int src/decks/__tests__/decks.controller.put.int-spec.ts -t "the verdict never writes the stage"`

**C69** - The stage control on a deck with a rule problem is enabled and offers Ideia, Montando, Pronto, Jogando, Aposentado (AC 39) · done
Proof: `web unit src/components/deck-detail/__tests__/StatusDropdown.spec.tsx -t "the stage stays editable on a deck with problems"`

**C70** - The deck page header of a deck with a rule problem shows the red chip "Não vale no Blitz" and the grey "Etapa: Jogando", with the causes in the body and not in the header (AC 40) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailLayout.spec.tsx -t "the header shows the verdict and the stage apart"`

**C71** - The home keeps its stage grouping and each card of `r3-stage-a-phone` carries its exact lines: the groups come in the order "Ativos", "Construindo", "Ideias", "Aposentados", a group with no decks is left out, and a ready deck sits under "Ativos" with the active ones; "Rhinar Blitz" (active) / "Não vale no Blitz" / "8 cartas com 2 cópias" / "Etapa: Jogando · 40 cartas" and "Rhinar CC" (ready) / "Não vale no Classic Constructed" / "1 carta com 4 cópias" / "Etapa: Pronto · 60 cartas" sit under "Ativos"; "Rhinar - Blitz" (building) / "Não vale no Blitz" / "1 carta com 2 cópias" / "Etapa: Montando · 31 de 40 cartas" sits under "Construindo"; the picked screen draws one flat list, and the grouping that predates this feature is kept (AC 40) · amended 2026-10-27 (delegation, D1)
Proof: `web unit src/routes/_auth/__tests__/-home.spec.tsx -t "renders four groups with ready and active under one Ativos group"`
Proof: `web unit src/routes/_auth/__tests__/-home.spec.tsx -t "each card of r3-stage-a-phone carries its exact lines"`

**C72** - A home card for a format outside the four shows the grey chip "Formato não conferido" and a grey line with the stage (AC 40) · done
Proof: `web unit src/components/home/__tests__/DeckTile.spec.tsx -t "an unchecked format reads Formato não conferido"`

### S7 - Getting the list out · 15 files · 110 KB · ~38k

**C73** - The deck page header shows "Copiar lista" with "texto para o grupo ou para o Fabrary" and "Duplicar" with "cria uma cópia para testar mudanças sem mexer neste" as visible buttons; "Excluir deck" is absent from the header and present inside "⋯" (AC 41) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailLayout.spec.tsx -t "copy list and duplicate are visible, delete only in the menu"`

**C74** - "Copiar lista" opens a sheet with the tabs "Para o grupo" and "Para Fabrary ou Talishar", neither selected, no preview and "Copiar" disabled; tapping a tab shows its full text before "Copiar" is enabled; no text in the sheet contains "GEM" (AC 42, AC 44) · done
Proof: `web unit src/components/deck-detail/__tests__/CopyListSheet.spec.tsx -t "two tabs, none chosen, full preview before copying"`

**C75** - "Copiar" writes exactly the previewed text to the clipboard and shows "Lista copiada" (AC 42) · done
Proof: `web unit src/components/deck-detail/__tests__/CopyListSheet.spec.tsx -t "copy writes the previewed text"`

**C76** - The group text for `r3-export-group-desktop`'s deck is, line by line: "Rhinar CC · Classic Constructed", "Herói", "1x Rhinar, Reckless Rampage", "Arma", "1x Romping Club", "Equipamentos", the four equipment lines, "Deck (60 cartas)", twenty lines from "3x Pack Hunt (Vermelho)" to "3x Springboard Somersault (Amarelo)", "Inventário (15 cartas, fora do deck)", and seven lines from "1x Pack Hunt (Vermelho)" to "2x Snatch (Vermelho)" (AC 43) · done
Proof: `web unit src/components/deck-detail/__tests__/deckListText.spec.ts -t "the group text matches r3-export-group-desktop"`

**C77** - The Fabrary-or-Talishar text uses English names with the pitch as "(Red)", "(Yellow)" or "(Blue)", one line per card as "3x Pack Hunt (Red)", under the headings Hero, Weapon, Equipment, Deck, Inventory in that order, with no card on a heading line (AC 44) · done
Proof: `web unit src/components/deck-detail/__tests__/deckListText.spec.ts -t "the fabrary text has one english line per card"`

**C78** - For a pool over the limit the sheet shows, above the preview, "Esta lista não vale no Classic Constructed: Pack Hunt (Vermelho) aparece 4 vezes (3 no deck, 1 no inventário), o limite é 3. Dá para copiar mesmo assim." and "Copiar" stays enabled (AC 45) · done
Proof: `web unit src/components/deck-detail/__tests__/CopyListSheet.spec.tsx -t "a rule warning does not block copying"`

**C79** - `POST /api/decks/:deckId/duplicate` answers `201` with a new `deckId`; the new deck is named "Rhinar CC (cópia)", has `status` `idea`, and has the same `deck_card` rows with the same `quantity` and `inventoryQuantity`; the original is unchanged (AC 46) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "duplicate copies cards and inventory at stage idea"`

**C80** - `POST /api/decks/:deckId/duplicate` answers `404` for another player's deck, a deleted deck and an unknown id, and creates nothing (AC 46) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "duplicate answers 404 for a deck the player cannot see"`

**C81** - "Duplicar" calls the duplicate route and navigates to `/decks/<new deckId>` (AC 46) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailLayout.spec.tsx -t "duplicate opens the new deck"`

**C82** - The "Lista" view groups lines under Herói, Arma, Equipamentos, Deck, Inventário in that order; a line reads "3x Pack Hunt (Vermelho) · custo 2 · Ação" followed by its problem "4 no total, o limite é 3, tire 1", and a partly owned card's line ends with "faltam 3" (AC 47) · done
Proof: `web unit src/components/deck-detail/__tests__/deckListModel.spec.ts -t "the list view groups and annotates each line"`

**C83** - The shared deck page, with no session, shows "Copiar lista" with "texto para o grupo ou para o Fabrary", and it opens the same two-tab sheet (AC 48) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedDeckPage.spec.tsx -t "a visitor can copy the list"`

**C84** - The deck page for `r3-deck-actions-desktop`'s deck shows, top to bottom: "‹ Decks", "Rhinar CC", "Classic Constructed", "Não vale no Classic Constructed", "Etapa: Pronto", the actions "Copiar lista", "Duplicar", "⋯", then "Deck" with "60 cartas" and the card rows with "3×" (AC 49) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailLayout.spec.tsx -t "matches r3-deck-actions-desktop"`

### S8 - A deleted deck can come back for 30 days · 22 files · 186 KB · ~56k

**C85** - After the migration, `tracked_deck."deletedAt"` is `timestamp with time zone`, nullable, and every existing row reads null (door 4) · done
Proof: `api int src/database/migrations/__tests__/tracked-deck-soft-delete.migration.int-spec.ts -t "adds a nullable deletedAt"`

**C86** - `DELETE /api/decks/:deckId` answers `200` with `deletedAt` set to now; the row, its `deck_card` rows and its share links stay; `GET /api/decks` no longer lists it and `GET /api/decks/:deckId` answers `404` (AC 50, AC 55) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "delete sets deletedAt and hides the deck"`

**C87** - `DELETE /api/decks/:deckId` answers `404` for another player's deck, an already deleted deck and an unknown id (AC 50) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "delete answers 404 for a deck the player cannot see"`

**C88** - `GET /api/decks/deleted` answers `200` with only the caller's deleted decks, each with `deletedAt` and `purgeAt` equal to `deletedAt` plus 30 days; it is not shadowed by `GET /api/decks/:deckId` (no `400` from the integer pipe); without a session it answers `401` (AC 51) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "deleted decks are listed with their purge date"`

**C89** - `POST /api/decks/:deckId/restore` answers `200` with the deck; afterwards the deck is listed again with the same cards, inventory quantities, replacements and tags, and its share address answers `200` (AC 52) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "restore brings back cards, inventory, replacements, tags and links"`

**C90** - `POST /api/decks/:deckId/restore` answers `404` for a deck that is not deleted, another player's deck and an unknown id (AC 52) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "restore answers 404 for a deck that is not the player's deleted deck"`

**C91** - `DELETE /api/decks/:deckId/permanent` answers `204`; the deck, its `deck_card`, `card_replacement` and tag rows are gone and its share links are deleted, as today's delete does; it answers `404` for another player's deck and an unknown id (AC 53) · done
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "permanent delete removes the deck with today's cascades"`

**C92** - While a deck is deleted it is left out of each reader, one case per reader: readiness recompute for a collection change, the home counts of `GET /api/decks`, the Tutor's deck list and `get_deck`, and the recommendation queue's enqueue and drain; the three re-solve routes stay 410 stubs and read nothing (AC 55; door 4) · done · amended 2026-10-27 (delegation, D6)
Proof: `api e2e src/decks/__tests__/decks-lifecycle.e2e-spec.ts -t "a deleted deck is left out of every reader"`
Proof: `api e2e src/decks/re-solve/__tests__/re-solve.controller.e2e-spec.ts -t "returns 410 Gone with structured deprecation payload"`

**C93** - While a deck is deleted, its `deck` and `missing` addresses answer `404` with `code` `SHARE_LINK_UNAVAILABLE`; after restore both answer `200` (AC 55; door 4: `SharedDeckLookup.findLive`) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "a deleted deck's links answer 404 until it is restored"`

**C94** - Tapping the trash on a home card calls `DELETE /decks/:deckId` at once, removes the card from the list, and shows "Rhinar Blitz v2 foi para Excluídos recentemente" with "Desfazer"; with fake timers advanced 60 seconds the toast is still shown; the next action dismisses it; "Desfazer" calls `POST /decks/:deckId/restore` (AC 50) · done
Proof: `web unit src/components/home/__tests__/DeckTile.spec.tsx -t "delete is recorded at once and the toast waits for the next action"`

**C95** - "Excluir deck" inside "⋯" on the deck page makes the same `DELETE /decks/:deckId` call and shows the same toast on the home (AC 50) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailLayout.spec.tsx -t "excluir deck soft-deletes and returns home with the toast"`

**C96** - Unmounting the home while the toast is shown makes no further call, and the deck stays deleted (AC 56) · done
Proof: `web unit src/routes/_auth/__tests__/-home.spec.tsx -t "leaving the home keeps the recorded delete"`

**C97** - The home shows "Excluídos recentemente (1) · ficam 30 dias" under the decks when one deck is deleted, and no such row when none is (AC 51) · done
Proof: `web unit src/routes/_auth/__tests__/-home.spec.tsx -t "the recently deleted row appears only with deleted decks"`

**C98** - The deleted list for `r2-deleted-list-phone` shows "‹ Meus decks", "Excluídos recentemente", "Um deck excluído volta com as cartas, as substituições e o histórico.", then per deck "Rhinar Blitz v2", "Ideia · 12 cartas · excluído hoje · some de vez em 30 dias", the button "Restaurar" and the plain link "Excluir de vez" (AC 51, AC 57) · done
Proof: `web unit src/routes/_auth/__tests__/-decks.deleted.spec.tsx -t "matches r2-deleted-list-phone"`

**C99** - "Excluir de vez" asks once; confirming calls `DELETE /decks/:deckId/permanent` once; declining calls nothing (AC 53) · done
Proof: `web unit src/routes/_auth/__tests__/-decks.deleted.spec.tsx -t "excluir de vez asks once"`

**C100** - The home after a delete matches `r2-delete-toast-phone` for the order of its parts (the remaining deck cards, the row "Excluídos recentemente (1) · ficam 30 dias", the toast), with the card lines of the stage rule (S6) instead of round 2's "Jogando · não pode jogar no Blitz" (AC 57) · done
Proof: `web unit src/routes/_auth/__tests__/-home.spec.tsx -t "matches r2-delete-toast-phone with the stage rule"`

### S9 - Starting a deck with the hero, and a hero outside the format · 15 files · 110 KB · ~36k

**C101** - `/decks/new` offers "Comprei um deck pronto", "Tenho um link do Fabrary" and "Começar do zero", none selected (AC 58) · done
Proof: `web unit src/routes/_auth/__tests__/-decks.new.spec.tsx -t "three ways to start a deck"`

**C102** - Searching "rhinar" shows "Rhinar · jovem" with the chips "Blitz" and "Silver Age" and "Rhinar, Reckless Rampage" with "Classic Constructed" and "Living Legend", each with its art, no result highlighted, and "Herói jovem: versão para Blitz e Silver Age, decks de 40 cartas." exactly once (AC 59) · done
Proof: `web unit src/routes/_auth/__tests__/-decks.new.spec.tsx -t "matches r2-new-deck-hero-phone"`

**C103** - After picking the young Rhinar the screen shows "‹ Escolher outro herói", "Você escolheu Rhinar", "Herói jovem", "Formato", then "Blitz" with "Blitz: 40 cartas, 1 cópia de cada" and "Silver Age" with "Silver Age: 40 cartas, até 2 cópias, só cartas que já saíram como comum ou rara", neither checked, and "Começar a montar" disabled until one is chosen; a hero with one format shows it unchecked (AC 60) · done
Proof: `web unit src/routes/_auth/__tests__/-decks.new.spec.tsx -t "matches r2-new-deck-format-phone"`

**C104** - The engine evaluates a deck in each other supported format and returns, per format, its category and problems: the `r2-retired-hero-desktop` Kayo deck is `illegal` in Classic Constructed and `legal` in Living Legend (AC 61) · done
Proof: `engine unit __tests__/legality/compute.spec.ts -t "a deck is evaluated in every other format"`

**C105** - The deck page for `r2-retired-hero-desktop`'s deck shows, in order: "Este deck não vale no Classic Constructed", "Kayo, Armed and Dangerous não é permitido em Classic Constructed. É permitido em Living Legend.", "Mandible Claw está banida no Classic Constructed.", "Em Living Legend este deck é válido: o herói e a Mandible Claw são permitidos lá.", the button "Mudar para Living Legend" and "As cartas do deck não mudam, só o formato em que ele é conferido." (AC 61, AC 65) · done
Proof: `web unit src/components/deck-detail/__tests__/HeroOutsideFormatPanel.spec.tsx -t "matches r2-retired-hero-desktop"`

**C106** - "Mudar para Living Legend" calls `PATCH /decks/:deckId` with `format` `Living Legend`; the chip reads "Living Legend", the block reads "Este deck vale em Living Legend.", the toast reads "Formato mudado para Living Legend" with "Desfazer", and "Desfazer" calls `PATCH` with the old format (AC 62, AC 65: `r3-retired-hero-switched-desktop`) · done
Proof: `web unit src/components/deck-detail/__tests__/HeroOutsideFormatPanel.spec.tsx -t "the switch changes the format with undo"`

**C107** - When no supported format makes the deck valid, the panel lists the problems under each format and shows no "Mudar para" button (AC 63) · done
Proof: `web unit src/components/deck-detail/__tests__/HeroOutsideFormatPanel.spec.tsx -t "no valid format offers no switch"`

**C108** - The shared page for `r3-shared-phone`'s deck shows "Blitz · ainda não pode jogar", "O deck tem 31 de 40 cartas.", "Pack Hunt (Vermelho) tem 2 cópias; o Blitz permite 1.", "Para jogar no Blitz: tirar 1 Pack Hunt (Vermelho) e colocar mais 10 cartas.", then "Conferir em outro formato:" with the chips "Classic Constructed", "Living Legend", "Silver Age", none pressed (AC 64, AC 65) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedLegalityBlock.spec.tsx -t "matches r3-shared-phone"`

**C109** - Tapping "Living Legend" shows "Em Living Legend: não vale. O Rhinar jovem joga só Blitz e Silver Age." under the chips, and the block above keeps its exact text; a legal Blitz deck's block reads "Blitz · pode jogar" (AC 64) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedLegalityBlock.spec.tsx -t "another format's result never changes the own-format block"`

### S10 - A rule changed under a saved deck · 8 files · 32 KB · ~14k

**C110** - `RULE_CHANGES` is exported from `packages/engine/src/legality/rules.ts` as an array of `{ format, effectiveDate, summaryKey, sourceUrl }`; its first entry has `format` `Blitz` and `effectiveDate` `2026-03-09`, an `effectiveDate` matching `YYYY-MM-DD`, and `sourceUrl` `https://fabtcg.com/rules-and-policy-center/change-log-tournament-rules-and-policy/`, the official tournament rules change log recorded in `.design/deck-building.md` (door 9) · done
Proof: `engine unit __tests__/legality/rules.spec.ts -t "RULE_CHANGES shape and first entry"`

**C111** - A Blitz deck with eight cards at 2 shows "Desde 9 de março de 2026, o Blitz permite 1 cópia de cada carta (antes eram 2). 8 cartas deste deck têm 2." and "ver o anúncio", whose `href` equals the entry's `sourceUrl` and which opens in a new tab with `rel="noopener noreferrer"` (AC 66) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "the notice reads the curated entry"`

**C112** - With the entry's `effectiveDate` replaced by `2026-04-01` in the test, the notice reads "Desde 1 de abril de 2026"; with no entry for the deck's problem, no date is rendered (AC 69) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "the date comes only from the entry"`

**C113** - No pt-BR value of any namespace matches `/\b\d{1,2} de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \d{4}\b/` (AC 69) · done
Proof: `web unit src/i18n/__tests__/rule-dates.spec.ts -t "no locale value prints a literal date"`

**C114** - "Deixar 1 de cada" on that deck leaves each of the eight cards at 1, saves once, shows "8 cópias tiradas do deck" with "Desfazer", makes no collection call, and the bar reads "32 de 40 cartas · nenhum problema"; "Desfazer" puts the eight cards back at 2 (AC 67) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "keep one of each takes one copy out with undo"`

**C115** - "Prefiro escolher carta por carta" closes the notice and each row keeps its "-" enabled (AC 71) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "choosing by hand closes the notice"`

**C116** - A deck with a banned card and no curated entry for it shows the verdict and the cause, with no "Desde" and no "antes eram" anywhere on the page (AC 68) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "a change with no entry has no date"`

**C117** - The notice is shown while at least one card breaks the Blitz copy rule and gone once none does; rendering it makes no network request (AC 70) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "the notice lasts until the problem is gone and sends nothing"`

**C118** - The deck page for `r3-rule-changed-deck-phone`'s deck shows, in order: "‹ Decks", "Rhinar Blitz", "Blitz", "Não vale no Blitz", "Etapa: Jogando", the notice with "ver o anúncio", the eight rows each with "2 cópias · o Blitz permite 1 · tire 1", "Deixar 1 de cada" with "Tira 1 cópia de cada uma das 8 cartas. O deck fica com 32 de 40 e você coloca mais 8. As cartas continuam na sua coleção.", and "Prefiro escolher carta por carta"; after the tap (`r2-one-each-phone` with the stage rule) the stage reads "Jogando · 32 de 40 cartas" and the deck count "32 de 40 cartas no deck · coloque mais 8" (AC 71) · done
Proof: `web unit src/components/deck-detail/__tests__/RuleChangedNotice.spec.tsx -t "matches r3-rule-changed-deck-phone and r2-one-each-phone"`

### S11 - The version of each copy · 33 files · 143 KB · ~54k

**C119** - The migration adds `printingCode`, `edition`, `finish` and `condition` to `collection_card` and to `card_list_line`, each `varchar NOT NULL DEFAULT ''`, and every row that existed before the migration reads `''` in all four (AC 72; door 1) · done
Proof: `api int src/database/migrations/__tests__/copy-versions.migration.int-spec.ts -t "adds the four version columns with the empty default on both tables"`

**C120** - After the migration, inserting `finish` `'none'`, `'rainbow'`, `'cold'`, `'gold'` and `''` succeeds and `'foil'` fails its check; `edition` accepts `''`, `'first'`, `'unlimited'`, `'alpha'` and rejects `'second'`; `condition` accepts `''`, `'NM'`, `'LP'`, `'MP'`, `'HP'`, `'DMG'` and rejects `'nm'` (AC 72; door 1) · done
Proof: `api int src/database/migrations/__tests__/copy-versions.migration.int-spec.ts -t "the version check constraints accept exactly their vocabulary"`

**C121** - `collection_card` has one unique index on `("userId","cardIdentifier","sourceId","printingCode","edition","finish","condition")` and no other unique index on `(userId, cardIdentifier, sourceId)`; two rows for the same user, card and import that differ only in `finish` (`''` and `'none'`) both insert, and a second row equal on all seven columns is refused (AC 72; door 1) · done
Proof: `api int src/database/migrations/__tests__/copy-versions.migration.int-spec.ts -t "collection_card is unique on the seven columns"`

**C122** - Two increments of 2 copies of the same card with no version into the same import leave one row with `quantity` 4 (the `ON CONFLICT` on the seven-column key fires on `''`); an increment that brings a row past 20 stores 20 (door 1) · done
Proof: `api e2e src/collection/__tests__/collection-batch.e2e-spec.ts -t "copies with no version increment one row and cap at 20"`

**C123** - The migration splits each existing `card_list_line.printing` key `collectorCode[.edition][.foiling]` into the four fields (`WTR167.unlimited.rainbow` gives `WTR167`, `unlimited`, `rainbow`); a key it cannot read keeps its collector code in `printingCode`, leaves `edition` and `finish` `''`, and writes one log line naming the line id (door 1; Impact `card_list_line.printing`) · done
Proof: `api int src/database/migrations/__tests__/copy-versions.migration.int-spec.ts -t "splits the sell-line printing key and keeps an unreadable collector code"`

**C124** - With one card held as 2 copies `''`/`''`/`''`/`''` and 1 copy `WTR167`/`unlimited`/`rainbow`/`NM` in one import, and 1 more copy in a second active import, readiness reads 4 copies of that card and the Library row shows 4 (AC 73) · done
Proof: `api unit src/collection/__tests__/collection-read.service.spec.ts -t "owned copies sum every version and every active import"`
Proof: `api unit src/collection/__tests__/library.service.spec.ts -t "the library quantity sums every version of a card"`

**C125** - A copy with no version renders in the card's copy list as "sem versão informada" in the muted text token, with no badge, no count of unversioned copies and no button other than "Mudar versão"; nowhere else (Library grid, "Importações", deck page) shows an unversioned count or call to action (AC 74) · done
Proof: `web unit src/components/collection-versions/__tests__/CardVersionsSheet.spec.tsx -t "an unknown version is grey text with no badge or call to action"`
Proof: `web unit src/components/library/__tests__/LibraryGrid.test.tsx -t "the grid shows no unversioned count"`

**C126** - `PATCH /api/collection/sources/:id/versions` with `{ finish: 'none', condition: 'NM' }` on an import holding 11 copies with no version and 1 copy already `rainbow` changes the 11 only, leaves the marked copy as it was, and answers `200` with `applied` 11; a card with no printing in the chosen finish or edition is left unchanged and listed in `skipped` by `cardIdentifier` (AC 75) · done
Proof: `api e2e src/collection/__tests__/collection-versions.e2e-spec.ts -t "bulk marking changes only unversioned copies and lists the skipped cards"`

**C127** - `PATCH /api/collection/sources/:id/versions` answers `400` for `finish: 'foil'` and for a body with none of `edition`, `finish`, `condition`; `404` for an import id the user does not own and for an unknown id (AC 75; Surface) · done
Proof: `api e2e src/collection/__tests__/collection-versions.e2e-spec.ts -t "bulk marking refuses a bad body and a foreign import"`

**C128** - In "Versões desta importação" (`r3-version-bulk-phone`), with nothing picked the apply button is disabled; after picking "Sem foil" and "NM" every unversioned row of the preview reads "Sem foil · NM", the button reads "Aplicar às 11 cópias sem versão" with "As que você já marcou não mudam." under it, and after applying, the skipped cards appear under a list naming each card (AC 75) · done
Proof: `web unit src/components/collection-versions/__tests__/VersionBulkSheet.spec.tsx -t "previews the marking and applies only to copies with no version"`

**C129** - `r3-version-bulk-phone` shows, in order: "‹ Importações", the heading "Versões desta importação", "Lista colada em 21/10 · 12 cópias", "Marcar de uma vez", the "Edição" group "1ª edição", "Alpha", "Unlimited", "Não sei" with "Edição: 1ª edição, Alpha ou Unlimited, escrito na carta", the "Foil" group "Sem foil", "Rainbow Foil", "Cold Foil", "Não sei" with "Foil: o acabamento brilhante", the "Estado" group "NM", "LP", "MP", "HP", "Não sei" with "Estado: NM quase nova, LP pouco usada, MP usada, HP muito usada", the apply button, "As que você já marcou não mudam.", then "Prévia" with one row per card ("3 Snatch (Vermelho)" / "Sem foil · NM" / "Mudar"); no option is selected on open and "DMG" is not offered (AC 80) · done
Proof: `web unit src/components/collection-versions/__tests__/VersionBulkSheet.spec.tsx -t "matches r3-version-bulk-phone copy and order"`

**C130** - `GET` of a card's version options for Snatch (Vermelho) returns only that card's printings (`WTR167` among them, with set name and image) and, for `WTR167`, only the editions `alpha` and `unlimited` and the finishes `none` and `rainbow`; the catalog method is table-driven over 3 cards: one with a single printing, one with editions absent from its printings, and `WTR167` (AC 76) · done
Proof: `api unit src/catalog/__tests__/catalog.service.spec.ts -t "version options come from the card's own printings"`

**C131** - Opening one card (`r3-version-card-phone`) shows "Snatch (Vermelho)", "3 cópias", the groups "2 sem versão informada" and "1 Welcome to Rathe · Unlimited · Rainbow Foil · NM", and "Mudar versão"; the picker shows, in order, "Versão das cópias", the "Versão" field with "Procurar versão", the printings with set name and footer code ("Welcome to Rathe" / "WTR167", "History Pack 1" / "1HP371", "Armory Deck: Ira" / "ASR013") and "+ 7 versões", "Versão: a coleção e a arte da carta (o código no rodapé, como WTR023)", the "Edição" group with only "Alpha" and "Unlimited" and its explanation, the "Foil" group with only "Sem foil" and "Rainbow Foil" and its explanation, the "Estado" group and its explanation, "Isso vale para:" with "as 2 cópias" and "só 1", and "Salvar"; nothing is pre-selected (AC 76, AC 80) · done
Proof: `web unit src/components/collection-versions/__tests__/CardVersionsSheet.spec.tsx -t "matches r3-version-card-phone copy and order"`

**C132** - `PATCH /api/collection/cards/:cardIdentifier/versions` moving 1 of 2 unversioned copies to `WTR167`/`unlimited`/`rainbow`/`NM` answers `200` with the card's copies by version (1 unversioned, 2 at that version when one existed); `400` when `quantity` is 0 or above the copies in `from`; `404` for a card the user holds no copy of (AC 76; Surface) · done
Proof: `api e2e src/collection/__tests__/collection-versions.e2e-spec.ts -t "moving copies between versions answers 200, 400 and 404"`

**C133** - A version naming a printing the card does not have (`printingCode` `WTR023` on Snatch (Vermelho)), or an edition or finish absent from that printing (`first` on `WTR167`), is refused with `400` and changes no row, on `PATCH /api/collection/cards/:cardIdentifier/versions`, on `POST /api/collection/cards/batch` and on `PATCH /api/collection/pending/:id` (AC 78) · done
Proof: `api e2e src/collection/__tests__/collection-versions.e2e-spec.ts -t "a version the card does not have is refused on every write"`

**C134** - The scanner commit sends each card's collector code; `POST /api/collection/cards/batch` with `{ cardIdentifier, quantity: 1, printingCode: 'WTR167' }` stores `printingCode` `WTR167`; a batch with no version fields answers `201` as today and stores `''` in all four; a batch item with `printingCode: 12` answers `400` (AC 77; Surface `cards/batch` `201`, `400`) · done · amended 2026-10-27 (delegation, D7)
Proof: `api e2e src/collection/__tests__/collection-batch.e2e-spec.ts -t "the batch records the scanned printing code"`
Proof: `web unit src/components/card-scanner/__tests__/scan-session.spec.ts -t "the commit carries each card's collector code"`

**C135** - After a scan of `WTR167` the review asks the edition with "Alpha" and "Unlimited" (the code exists in two editions) and asks "É foil?" (it exists in Rainbow Foil); for a code that exists in one edition and no foil finish neither question appears (AC 77) · done
Proof: `web unit src/components/card-scanner/__tests__/ReviewSheet.spec.tsx -t "asks the edition and foil only when the code has more than one"`

**C136** - `POST /api/collection/cards/decrement` with `sourceId` and a version removes one copy from that row only; `400` when `sourceId` is missing and the card has copies in more than one import or version; `404` when no row matches the import and version (AC 79; Surface `decrement` `201`, `400`, `404`) · done · amended 2026-10-27 (delegation, D7)
Proof: `api e2e src/collection/__tests__/collection-versions.e2e-spec.ts -t "decrement takes one copy from the named import and version"`

**C137** - On a 360 px phone, "−" on a card with copies in two imports or two versions opens the picker with its whole box inside the viewport (left ≥ 0, right ≤ 360, bottom ≤ 740), listing each import and version with its copies (AC 79) · done
Proof: `web e2e --project=mobile-360 tests/mobile/collection-in-layout.spec.ts -g "the remove picker opens inside the screen"`
Proof: `web unit src/components/library/__tests__/LibraryCardStepper.test.tsx -t "minus on a card with several imports or versions opens the picker"`

**C138** - `r3-imports-phone` rows each end with the link "Versões desta importação", which opens the bulk sheet of that import (AC 80) · done
Proof: `web unit src/components/csv-sources/__tests__/CsvSourceRow.test.tsx -t "each import links to its versions"`

### S12 - One reader for lists and spreadsheets, and nothing dropped · 28 files · 107 KB · ~51k

**C139** - The pitch reader is table-driven over 10 tokens: "(Red)", "red", "(Yellow)", "(Blue)", "vermelho", "Amarelo", "azul", "(1)", "(2)", "(3)" each read to its pitch, and the numeric ones carry a note; a line "3x Pack Hunt (3)" reads 3 Pack Hunt (Azul) with the note "\"(3)\" lido como Azul" (AC 81) · done
Proof: `api unit src/collection/reader/__tests__/pitch-token.spec.ts -t "reads pitch in English, Portuguese and as a number"`
Proof: `api unit src/collection/reader/__tests__/line-reader.spec.ts -t "a numeric pitch is read and noted"`

**C140** - "4 Pummel" (a card printed in three colors, no color, no color column) has outcome `asks_color` with the options Vermelho, Amarelo, Azul and "Não sei"; a card printed in one color with no color is `ready`; with a `cor` column present, an empty color cell is `asks_color` only for a card printed in several colors (AC 82) · done
Proof: `api unit src/collection/reader/__tests__/line-reader.spec.ts -t "a several-color card with no color asks which color"`

**C141** - "comand and conquer" (one edit from exactly one card name) has outcome `suggestion` naming Command and Conquer with its image, and is not counted in `ready`; a text two edits away, or one edit from two card names, is `not_found` (AC 83) · done
Proof: `api unit src/collection/reader/__tests__/line-reader.spec.ts -t "one typo from exactly one card suggests it"`

**C142** - In the reader, the suggestion line shows "Você quis dizer <card>?" with the card image, "Usar esta" and "Corrigir"; the count of ready lines and copies on the add button changes only after "Usar esta", and the line then shows "Você aceitou: Command and Conquer (Vermelho) · Desfazer" (AC 83) · done
Proof: `web unit src/components/collection-reader/__tests__/ListReader.spec.tsx -t "a suggestion counts only after Usar esta"`

**C143** - A line matching no card shows "Não achamos \"Mistery Card\"" with an edit field holding the text and "Procurar"; editing it to a known name and tapping "Procurar" re-reads that line only (AC 84) · done
Proof: `web unit src/components/collection-reader/__tests__/ListReader.spec.tsx -t "a line with no match offers edit and search"`

**C144** - The CSV reader reads the headers `nome`, `quantidade`, `cor`, `versão`, `estado` in any order, and today's English headers (`name`, `card name`, `quantity`, `qty`, `count`, `set`, `set code`); table-driven over 3 header orders; the result's `columns` lists the columns read (AC 85) · done
Proof: `api unit src/collection/__tests__/csv-parser.service.spec.ts -t "reads Portuguese and English headers in any order"`

**C145** - A CSV row `Rhinar, Reckless Rampage,1` (a known card name with a comma, no quotes) is read as that card with a note on that line; a row whose comma does not complete a known name is not merged (AC 85) · done
Proof: `api unit src/collection/__tests__/csv-parser.service.spec.ts -t "an unquoted comma inside a known card name is read and noted"`

**C146** - `POST /api/collection/imports/read` with `text` answers `200` with one `lines` entry per input line, each with `lineNumber`, `originalText` and `outcome` in `ready`, `asks_color`, `suggestion`, `not_found`, `bad_quantity`, and `columns`; with a file it reads the same way; `400` for a body with neither `text` nor a file and for an empty or non-text file (code `IMPORT_UNREADABLE`); `413` for a file over 2 MB; it creates no import in any case (AC 81, AC 86; Surface) · done
Proof: `api e2e src/collection/__tests__/collection-imports.e2e-spec.ts -t "reading a paste or a file answers 200, 400 and 413 and creates nothing"`

**C147** - A file that cannot be read shows the localized `apiErrors.IMPORT_UNREADABLE` text, in pt-BR and en-US, saying what to check, and no raw JSON; `GET /api/collection/sources` afterwards lists no new import (AC 86) · done
Proof: `web unit src/components/collection-reader/__tests__/ImportReport.spec.tsx -t "an unreadable file shows a localized error"`
Proof: `api e2e src/collection/__tests__/collection-imports.e2e-spec.ts -t "an unreadable file leaves no empty import"`

**C148** - `POST /api/collection/imports` with 6 ready lines and 2 pending lines answers `201` with one `source` holding the 6 lines' copies and `pendingCount` 2; the 2 pending rows store the import id, line number and original text; `400` for a `kind` outside `csv`, `paste`, `product`, `fabrary`, `manual` and for zero ready and zero pending lines; `409` for a file whose content hash matches an existing import when no duplicate strategy is given (AC 87; Surface) · done
Proof: `api e2e src/collection/__tests__/collection-imports.e2e-spec.ts -t "an import stores ready lines and keeps the rest pending"`

**C149** - "Adicionar as N prontas" sends the ready lines and the unresolved lines in one request, and the note under it reads "As 2 que faltam ficam em \"Para resolver\", no topo da sua coleção." (AC 87) · done
Proof: `web unit src/components/collection-reader/__tests__/ListReader.spec.tsx -t "adding the ready lines keeps the rest for later"`

**C150** - With 11 pending lines from `colecao-lucas.csv` the collection shows "11 linhas de colecao-lucas.csv para resolver · Resolver" at its top; resolving one shows 10; deleting the last one removes the banner; with lines from two imports there is one banner per import (AC 88) · done
Proof: `web unit src/components/collection-reader/__tests__/PendingBanner.spec.tsx -t "the banner counts down and disappears at zero"`

**C151** - `GET /api/collection/pending` answers `200` with the pending lines grouped by import and `401` with no session; `PATCH /api/collection/pending/:id` with a card and quantity answers `200`, adds the copy to that line's import and deletes the line; `400` for a quantity below 1; `404` for another user's line; `DELETE /api/collection/pending/:id` answers `204` and `404` for an unknown id (AC 88; Surface) · done
Proof: `api e2e src/collection/__tests__/collection-pending.e2e-spec.ts -t "pending lines list, resolve and delete with their statuses"`

**C152** - `import_pending_line` has `sourceId` referencing `csv_source` with `ON DELETE CASCADE`, `userId`, `lineNumber`, `originalText`, `reason`, and a nullable `suggestedCardIdentifier`; deleting the import row deletes its pending rows (AC 89; door 7) · done
Proof: `api int src/database/migrations/__tests__/import-kinds-and-pending.migration.int-spec.ts -t "import_pending_line cascades from its import"`
Proof: `api e2e src/collection/__tests__/collection-pending.e2e-spec.ts -t "removing an import removes its pending lines"`

**C153** - For every import the reader's counts satisfy ready + asked + kept = lines read, table-driven over the paste of `r3-list-phone` (8 lines: 6, 1, 1) and a CSV of 300 lines; a quantity of 25 for one card is read as 20 with a note, and 20 stays 20 with no note (AC 90) · done
Proof: `api unit src/collection/reader/__tests__/line-reader.spec.ts -t "every line is counted once and quantities cap at 20"`

**C154** - "três" in the quantity column is outcome `bad_quantity` with the suggestion 3, shown as "\"três\" não é um número" with the field prefilled 3 and "Usar 3"; a word for a number above twenty gets no suggestion (AC 91; `.design/collection-in.md` Reader and report) · done
Proof: `api unit src/collection/reader/__tests__/line-reader.spec.ts -t "a quantity word up to twenty is suggested as a number"`

**C155** - `r3-list-phone` shows, in order: "‹ Adicionar cartas", the heading "Lista colada", the pasted text, "Versão das cartas desta lista" with "Não sei", "Sem foil · NM" and "Escolher por linha", "Lemos 8 linhas: 6 prontas · 1 precisa de cor · 1 não achamos", the numbered lines each with its outcome mark and original text under it (line 3 "foil · existe em 2 versões foil: escolha", line 5 "4 Pummel · Qual cor?" with "Vermelho", "Amarelo", "Azul", line 7 "\"(3)\" lido como Azul", line 8 "Não achamos \"Mistery Card\"" with "Procurar"), the button "Adicionar as 6 prontas (12 cópias)" and the note (AC 91) · done
Proof: `web unit src/components/collection-reader/__tests__/ListReader.spec.tsx -t "matches r3-list-phone copy and order"`

**C156** - `r3-report-phone` shows, in order: "‹ Adicionar cartas", the file name, "289 linhas prontas · 612 cópias (241 cartas)", "Lemos as colunas nome, quantidade e cor.", "Esta planilha não tem coluna de versão: as cartas entram sem versão informada.", "Linha 8: lemos \"Rhinar, Reckless Rampage\" certo.", "11 para resolver", then the groups "Sem cor" (7 lines, each "Linha N", its original text, "Vermelho", "Amarelo", "Azul", "Não sei"), "Nome parecido" (3 lines with "Você quis dizer <card>?", "Usar esta", "Corrigir"), "Quantidade" (1 line), the button "Adicionar as 289 prontas" and "As 11 que faltam ficam em \"Para resolver\", no topo da sua coleção." (AC 85, AC 91) · done
Proof: `web unit src/components/collection-reader/__tests__/ImportReport.spec.tsx -t "matches r3-report-phone copy and order"`

**C157** - `r3-pending-phone` shows, in order: the banner "11 linhas de colecao-lucas.csv para resolver" with "Resolver", the heading "Coleção" with one link, "Importações" (to `/library-csv-sources`), "612 cópias (241 cartas)", then the card grid; there are no tabs (AC 88, AC 91) · done · amended 2026-10-27 (delegation, D8)
Proof: `web unit src/routes/_auth/__tests__/-library.test.tsx -t "matches r3-pending-phone: the pending banner sits above the collection"`

**C453** - Arrangement of `r4-resolve-b-phone` at 390 px, one line at a time (picked in round 4): under the app bar, "‹ Coleção" and "Sair e continuar depois"; the progress "3 de 11" with "colecao-lucas.csv · 8 depois desta · 2 já resolvidas"; "Linha 12 do arquivo · lemos assim" and the raw line "Snach,2,Vermelho" in the monospace face; then in the near-name step "Você quis dizer", "Snatch (Vermelho)", "Quantas cópias" with the stepper "−" 2 "+", the primary button "Adicionar 2 Snatch (Vermelho)", "Não é esta, buscar", "Pular", "Excluir esta linha" and last the note "Pular deixa a linha na lista. Ela volta na próxima vez que você abrir Resolver."; the unknown-word step ("Linha 31", "Mistery Card,1,") shows "Não achamos essa carta. Busque pelo nome." and a search box holding "Mistery" first, then "Nenhuma carta com esse nome. Tente só uma palavra.", the stepper at 1, "Adicionar" disabled until a card is chosen, "Pular" and "Excluir esta linha"; the unreadable-quantity step ("Linha 141", "Savage Beatdown,três,Vermelho") shows the known card "Savage Beatdown (Vermelho)", ""três" não é um número. Quantas cópias?", the stepper at 3, "Adicionar 3 Savage Beatdown (Vermelho)", "Pular" and "Excluir esta linha"; every button and stepper control is at least 44 px high, and the page has no horizontal scroll (AC 88, AC 91) · done
Proof: `web unit src/components/collection-reader/__tests__/PendingResolver.spec.tsx -t "arranges the three steps as r4-resolve-b-phone"`
Proof: `web e2e --project=mobile-390 tests/mobile/collection-in-layout.spec.ts -g "the page behind Resolver follows r4-resolve-b-phone at 390 px"`

### S13 - Ready-made decks · 22 files · 33 KB · ~32k

**C158** - Every file in the product folder parses as `{ key, name, kind, format, hero, cards: [{ cardIdentifier, printingCode, quantity }] }` with `kind` in `armory`, `blitz`, `silver_age`, every `cardIdentifier` and `printingCode` existing in the catalog with that printing, every `quantity` ≥ 1, and no card whose type is token; the Armory Deck: Kayo file has 26 distinct cards and no Agility or Might (AC 96, AC 97; door 8) · done
Proof: `api unit src/products/__tests__/product-files.spec.ts -t "every stored product file has the decklist shape and no tokens"`

**C159** - `GET /api/products?q=kayo` answers `200` with only products that have a stored file, each with hero image, product name, one format label (Classic Constructed, Blitz or Silver Age) and card count; with a product file removed from the fixture folder that product is not returned; `q` matches the product name and the hero name (AC 92, AC 96; Surface `GET /api/products` `200`) · done
Proof: `api e2e src/products/__tests__/products.e2e-spec.ts -t "searching products returns only stored decklists"`

**C160** - `r3-product-search-phone` shows, in order: "‹ Adicionar cartas", "Qual deck você comprou?", "Armory Deck, Blitz Deck ou Silver Age.", the search field, and one row per result with hero image, product name and format label ("Armory Deck: Kayo" / "Classic Constructed"); no row carries a "Deck pronto" label (AC 92, AC 98) · done
Proof: `web unit src/components/products/__tests__/ProductSearch.spec.tsx -t "matches r3-product-search-phone copy and order"`

**C161** - `r3-product-confirm-phone` shows, in order: "‹ Escolher outro", "<Product> · N cartas" with N the sum of the file's quantities, the format label, the switch "Colocar as N cartas na minha coleção" with "Você comprou a caixa, então essas cartas são suas.", the switch "Criar um deck com elas" with "Para ver se o deck está completo e o que vale comprar depois.", both on, "Ver as N cartas" collapsed, "As cartas entram com a versão que vem na caixa, inclusive as foil. Agility e Might são marcadores do jogo, não cartas de deck, e ficam de fora." (this sentence holds for the one product file the repo has, Armory Deck: Kayo; another box gets its token names from its own file), and "Adicionar" (AC 93, AC 98) · done · amended 2026-10-27 (delegation, D9, D63) · proof extended 2026-10-27 (delegation)
Proof: `web unit src/components/products/__tests__/ProductConfirm.spec.tsx -t "matches r3-product-confirm-phone copy and order"`
Proof: `web e2e --project=e2e-chromium tests/e2e/product-add-flow.spec.ts -g "choosing Kayo shows the confirm screen of the box"`
Proof: `web e2e --project=mobile-360 --project=mobile-390 tests/mobile/product-add-flow.spec.ts -g "choosing Kayo shows the confirm screen of the box"`

**C162** - `POST /api/products/armory-kayo/import` with `addCards` and `createDeck` true answers `201` with a `source` of kind `product`, `productKey` `armory-kayo`, named "Armory Deck: Kayo", whose copies carry each card's `printingCode` from the file, and a `deckId` whose deck has the product's name, hero and format and the file's cards; with only `addCards` it returns no `deckId`, with only `createDeck` no `source` (AC 94) · done
Proof: `api e2e src/products/__tests__/products.e2e-spec.ts -t "importing a product creates the import and the deck"`

**C163** - A second import of the same product without `confirmRepeat` answers `409` with the first import's date and writes nothing; with `confirmRepeat: true` it answers `201` and names the import "Armory Deck: Kayo #2"; an unknown `productKey` answers `404` (AC 95; Surface `POST /api/products/:productKey/import` `201`, `404`, `409`) · done
Proof: `api e2e src/products/__tests__/products.e2e-spec.ts -t "a repeated product asks before a second box"`

**C164** - On `409` the confirm screen asks "Você já adicionou Armory Deck: Kayo em <date>. Adicionar outra caixa?" with the date of the first import, and confirming resends with `confirmRepeat` (AC 95) · done
Proof: `web unit src/components/products/__tests__/ProductConfirm.spec.tsx -t "a repeated product asks before adding another box"`

**C165** - The decklist reader, given a saved official decklist page (fixture HTML with "1x Kayo, Armed and Dangerous" and "3x Bare Fangs (red)"), returns each card with its quantity and pitch, maps each to the catalog's printing tagged with that product, leaves the token cards out, and returns every difference between the page and the catalog's printings for that product as a list (AC 97) · done
Proof: `api unit src/products/__tests__/official-decklist.parser.spec.ts -t "reads an official decklist, drops tokens and lists differences"`

**C166** - The `products:import` command writes or replaces exactly one file named after the product key, prints each difference on its own line, and exits non-zero with the URL in its message when the fetch fails; root `package.json` has `products:import` and it builds the API then runs the API's CLI, as `prices:sync` does (AC 97; Observable `pnpm products:import`) · done
Proof: `api unit src/products/__tests__/products-import.cli.spec.ts -t "writes one product file, prints differences, and fails with the URL"`

**C167** - `csv_source` has `productKey varchar NULL`, set only on imports of kind `product` (AC 94; door 6) · done
Proof: `api int src/database/migrations/__tests__/import-kinds-and-pending.migration.int-spec.ts -t "csv_source gains a nullable productKey"`

### S14 - A Fabrary deck asks whose cards they are · 22 files · 123 KB · ~37k

**C168** - The link finder returns the deck id from, table-driven over 8 inputs: `https://fabrary.net/decks/<id>`, `fabrary.net/decks/<id>`, `www.fabrary.net/decks/<id>/`, `http://www.fabrary.com/decks/<id>`, `fabrary.com/decks/<id>`, "olha esse deck www.fabrary.net/decks/<id>/ valeu", a WhatsApp text with two links (the first one's id), and a lower-case id; text with no Fabrary deck link returns nothing (AC 99) · done
Proof: `api unit src/fabrary/__tests__/parse-url.spec.ts -t "finds the first Fabrary deck link inside any text"`

**C169** - `POST /api/decks/import` with `text` holding a link and `ownsCards: true` answers `201` with `deckId` and a `source` named "Fabrary: <deck name>" of kind `fabrary` holding the deck's cards; with `ownsCards: false` it answers `201` with `deckId` only and the collection is unchanged (AC 99, AC 102) · done
Proof: `api e2e src/decks/import/__tests__/decks-import.e2e-spec.ts -t "the ownership answer decides whether the collection changes"`

**C170** - `POST /api/decks/import` without `ownsCards`, or with `ownsCards: 'yes'`, answers `400` and creates no deck and no import; with text holding no Fabrary link it answers `400` (AC 101; Surface `400`) · done
Proof: `api e2e src/decks/import/__tests__/decks-import.e2e-spec.ts -t "an import without an ownership answer is refused"`

**C171** - With the Fabrary client answering "not found" or "private" the route answers `404`, and with it timing out or failing to connect the route answers `502`; neither writes anything (AC 103, AC 104; Surface `404`, `502`) · done
Proof: `api e2e src/decks/import/__tests__/decks-import.e2e-spec.ts -t "a missing deck answers 404 and an unreachable Fabrary 502"`

**C172** - The import service has no default for the ownership answer: `DecksImportService.run` called without it throws before any write, and no caller in the repository passes `seedInventory` (AC 105) · done
Proof: `api unit src/decks/import/__tests__/decks-import.service.spec.ts -t "the ownership answer has no default"`

**C173** - `r3-fabrary-found-phone` shows, in order: the heading "Adicionar cartas", the pasted text, "Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas", "Você tem 0 de 66 cartas deste deck", "Essas cartas são suas?" with "Sim, colocar na minha coleção" and "Não, só quero comparar com o que eu tenho", neither selected, "Importar o deck" disabled until one is picked, and "Colar a lista do que eu tenho" (AC 100, AC 106) · done
Proof: `web unit src/components/fabrary-import/__tests__/FabraryFound.spec.tsx -t "matches r3-fabrary-found-phone and waits for an answer"`

**C174** - After "Não" and "Importar o deck" the card offers "Colar a lista do que eu tenho", which opens the reader with an empty paste box; the request sent carried `ownsCards: false` (AC 102) · done
Proof: `web unit src/components/fabrary-import/__tests__/FabraryFound.spec.tsx -t "a no answer imports only the deck and offers to paste a list"`

**C175** - A `404` shows "Esse deck não existe ou é privado no Fabrary." and a `502` shows "Não conseguimos falar com o Fabrary agora. Tente de novo em alguns minutos."; neither mentions the catalog (AC 103, AC 104) · done
Proof: `web unit src/components/fabrary-import/__tests__/FabraryFound.spec.tsx -t "a missing deck and an unreachable Fabrary say so"`

**C176** - The onboarding import shows the same question with no answer selected and cannot continue until it is answered; the request it sends carries the answer (AC 105) · done
Proof: `web unit src/components/onboarding/__tests__/OnboardingWizard.spec.tsx -t "the onboarding Fabrary import asks whose cards they are"`

**C177** - `r3-add-phone` paste box: pasting text with a Fabrary link switches the screen to the found deck (`r3-fabrary-found-phone`); pasting a card list opens the reader (`r3-list-phone`) (AC 99, AC 106) · done
Proof: `web unit src/routes/_auth/__tests__/-add-cards.test.tsx -t "the paste box routes a link to the deck and a list to the reader"`

### S15 - One way in, and the "Importações" list · 19 files · 51 KB · ~21k

**C178** - `r3-first-run-phone`: a new account sees, in order, "Como você quer começar?", the large "Comprei um deck pronto" with "Armory Deck, Blitz Deck ou Silver Age, na caixa", then the rows "Tem um link ou uma lista? Colar aqui", "Enviar uma planilha (.csv)", "Fotografar ou digitar as cartas", and "Pular por agora" (AC 107, AC 112) · done
Proof: `web unit src/components/onboarding/__tests__/FirstRunChooser.spec.tsx -t "matches r3-first-run-phone copy and order"`

**C179** - Only signing up sends an account with no deck, no card and no import to the first-run screen; an account in that state that signs in later, or opens `/home`, sees the home empty state ("Comece por um deck" with the import button); an account with a deck or an import does not land on the first-run screen, and any import counts, including one whose lines are all unresolved, which goes to the Library with its pending lines (AC 107) · amended 2026-10-27 (delegation, D10, D11) · done
Proof: `web unit src/routes/_auth/__tests__/-onboarding-redirect.spec.tsx -t "a new account starts on the first-run chooser"`

**C180** - `r3-add-phone`: "Adicionar cartas" shows, in order, the paste box "Cole aqui" with "Cole um link de deck (do Fabrary, por exemplo) ou uma lista de cartas", then "Comprei um deck pronto", "Enviar uma planilha (.csv)", "Fotografar as cartas", "Digitar o nome"; the old "Deck do Fabrary" tab is gone (AC 108, AC 112) · done
Proof: `web unit src/routes/_auth/__tests__/-add-cards.test.tsx -t "matches r3-add-phone copy and order"`

**C181** - `r3-imports-phone`: the page "Importações" shows "‹ Coleção", the summing note once ("Se a mesma carta aparece em duas importações, as quantidades somam. Desligue uma importação que repete cartas que você já tinha."), then one row per import with its name, its copies and, when above zero, its "para resolver" count ("colecao-lucas.csv · 612 cópias · 11 para resolver"), and "Entradas à mão · 4 cópias" with "Sempre incluídas" (AC 109, AC 112) · done
Proof: `web unit src/components/csv-sources/__tests__/CsvSourceList.spec.tsx -t "matches r3-imports-phone copy and order"`

**C182** - On a 360 px phone a 40-character import name wraps to a second line: its text element is not truncated (`scrollWidth` ≤ `clientWidth`, no ellipsis) and the full name is in the DOM (AC 109) · done
Proof: `web e2e --project=mobile-360 tests/mobile/collection-in-layout.spec.ts -g "long import names wrap on a phone"`

**C183** - The manual source label is "Entradas à mão" in pt-BR and "Hand entries" in en-US in every locale file that names it, and the API's source label for kind `manual` returns "Entradas à mão" for `Accept-Language: pt-BR`; no locale value or API label contains "Manual entries" (AC 110) · done
Proof: `api unit src/collection/__tests__/source-label.util.spec.ts -t "the manual source is Entradas à mão"`
Proof: `web unit src/i18n/__tests__/collection-in-locales.spec.ts -t "the manual source has one name in every locale"`

**C184** - Counts use plural rules, table-driven over 0, 1 and 2 in pt-BR and en-US: "0 cartas importadas", "1 carta importada", "2 cartas importadas"; "0 cópias", "1 cópia", "2 cópias"; "1 linha para resolver", "2 linhas para resolver" (AC 111) · done
Proof: `web unit src/i18n/__tests__/collection-in-locales.spec.ts -t "collection counts use plural forms"`

**C185** - `csv_source` accepts `kind` `csv`, `paste`, `product`, `fabrary` and `manual` and refuses `deck`; existing Fabrary imports (`kind = 'csv'` with a `sourceUrl`) read `fabrary` after the migration (door 6) · done
Proof: `api int src/database/migrations/__tests__/import-kinds-and-pending.migration.int-spec.ts -t "the import kind constraint has the five kinds"`

### S16 - One honest store answer per card, under a monthly budget · 40 files · 254 KB · ~80k

**C186** - `resolveStoreState` returns exactly one of `priced`, `store_lacks`, `not_on_site`, `looking_up`, `no_price` for each row of the document's Store answers table: listed in the latest pass with a stocked lookup → `priced`; a lookup newer than the pass with zero stock → `store_lacks`; not listed in the latest completed pass and no newer lookup with stock → `store_lacks`; a newer lookup with stock overrides an absent listing → `priced`; no `store_stock` row → `not_on_site`; a row with no product URL → `not_on_site`; listed with a pending lookup → `looking_up`; listed with the budget stopped → `no_price`; listed with the last lookup failed → `no_price` (AC 113, AC 114) · done
Proof: `api unit src/stores/__tests__/store-state.spec.ts -t "every input row gets exactly one store state"`

**C187** - Before any availability pass has completed (`store.lastAvailabilityPassAt` null), a card with a product URL resolves to `looking_up`, `no_price` or `priced` and never to `store_lacks`, for every lookup outcome except a zero-stock lookup (AC 117) · done
Proof: `api unit src/stores/__tests__/store-state.spec.ts -t "before the first pass a listed card is never store_lacks"`

**C188** - Opening the owner's missing list queues one `variant_fetch_job` per needed card that the store lists with no price or a price older than `STORE_PRICE_VALID_DAYS`: with the default 30, a price 29 days old queues nothing and one 31 days old queues a job; with `STORE_PRICE_VALID_DAYS=10`, a price 11 days old queues a job (AC 115) · done
Proof: `api unit src/stores/__tests__/variant-fetch-queue.service.spec.ts -t "queues a lookup only for a card with no price or a price past the validity window"`

**C189** - Two users whose decks need the same card both open their missing lists: exactly one `pending` `variant_fetch_job` row exists for that `cardIdentifier`, and both lists show it as `looking_up` (AC 115; door 10) · done
Proof: `api e2e src/decks/__tests__/deck-missing.e2e-spec.ts -t "two owners needing one card share a single pending lookup"`

**C190** - Door 10, lookups: after the migration `variant_fetch_job` has `cardIdentifier` and no `deckId`; a second `pending` row for the same `cardIdentifier` fails with a unique violation on the partial index; a `pending` row next to a `done` row for that card inserts; `down()` restores the per-deck column (door 10) · done
Proof: `api int src/database/migrations/__tests__/store-answers.migration.int-spec.ts -t "allows one pending lookup per card"`

**C191** - Door 10, store columns: `store_stock."listedInStockAt"` and `store."lastAvailabilityPassAt"` exist as nullable `timestamptz` and read `null` on rows that existed before the migration (door 10) · done
Proof: `api int src/database/migrations/__tests__/store-answers.migration.int-spec.ts -t "adds the nullable availability timestamps"`

**C192** - Door 10, credits: `firecrawl_usage` has `month char(7)` as primary key and `credits int not null`; twenty concurrent increments of 5 for `2026-10` leave one row with `credits = 100` (door 10) · done
Proof: `api int src/database/migrations/__tests__/store-answers.migration.int-spec.ts -t "counts credits per month atomically"`

**C193** - The worker's availability step runs the in-stock URL sync when `lastAvailabilityPassAt` is null or older than `STORE_AVAILABILITY_PASS_DAYS` (default 7: 6 days old does not run, 8 days old runs; `STORE_AVAILABILITY_PASS_DAYS=3` with 4 days old runs); on completion every `store_stock` row the pass listed has `listedInStockAt` equal to the pass time and `lastAvailabilityPassAt` is set to it (AC 116) · done
Proof: `api unit src/stores/__tests__/availability-pass.spec.ts -t "runs the pass when the last one is past the interval and stamps every listed row"`

**C194** - A pass that fails or stops partway stamps no row, leaves `lastAvailabilityPassAt` unchanged, and the next worker tick does not retry it until an hour has passed (59 minutes: no run; 61 minutes: runs) (AC 116) · done
Proof: `api unit src/stores/__tests__/availability-pass.spec.ts -t "a failed pass marks nothing and waits an hour"`

**C195** - With `FIRECRAWL_MONTHLY_CREDIT_BUDGET=1000` and `FIRECRAWL_CREDITS_PER_PASS=150` (the defaults): 850 used leaves 150 and lookups are queued; 851 used leaves 149 and no automatic lookup is queued, the affected lines resolve to `no_price`, and one warning is logged; a second list open in the same month logs nothing more; the first open of the next month logs again (AC 118) · done
Proof: `api unit src/stores/__tests__/credit-budget.service.spec.ts -t "stops automatic lookups when what is left would not pay for one pass"`

**C196** - When what is left would not pay for the pass itself, the availability step does not start and availability keeps the last completed pass; the admin's manual URL sync runs whatever the budget and its credits are counted (AC 118, AC 119) · done
Proof: `api unit src/stores/__tests__/availability-pass.spec.ts -t "the pass waits for the next month and the manual sync always runs"`

**C197** - Each Firecrawl call adds to the current month's `firecrawl_usage` row: 5 per product page and 1 per listing page by default, `FIRECRAWL_CREDITS_PER_DETAIL=7` makes it 7; with `SCRAPER_FETCH_PROVIDER=direct` no row is written; a call on `2026-11-01` writes month `2026-11` (AC 119) · done
Proof: `api unit src/stores/__tests__/firecrawl-client.service.spec.ts -t "counts credits per call kind and nothing for the direct provider"`

**C198** - A failed lookup leaves the line `no_price`; a list open 59 minutes later queues no job for that card and one 61 minutes later queues one (AC 120) · done
Proof: `api unit src/stores/__tests__/variant-fetch-queue.service.spec.ts -t "a failed lookup is retried no sooner than an hour later"`

**C199** - Opening a `missing` and a `quote` address returns the stored states and leaves the `variant_fetch_job` row count unchanged, even for a card whose price is past the validity window (AC 121) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "a public page reads the stored store states and queues no lookup"`

**C200** - `GET /api/admin/stores/:slug/credits` answers `200` `{ creditsUsed, budget, lookupsStopped }` for an admin (`120`, `1000`, `false` after 120 credits counted this month; `lookupsStopped: true` after 851) and `403` for a signed-in non-admin (AC 122) · done
Proof: `api e2e src/stores/__tests__/store-admin-credits.e2e-spec.ts -t "shows the month's credits to an admin only"`

**C201** - For an admin, Settings shows the credits used and the budget ("120" and "1000") inside the same section as the URL sync button, and, when `lookupsStopped` is true, a line saying lookups have stopped; a non-admin's Settings has neither (AC 122) · done
Proof: `web unit src/routes/_auth/__tests__/-settings.spec.tsx -t "the URL sync section shows the month's credits and when lookups stopped"`

**C202** - `POST /api/decks/:deckId/fetch-variants` answers `404`, and the deck page renders no "Obter preços exatos" button and no variant queue drawer (AC 123) · done
Proof: `api e2e src/decks/__tests__/deck-missing.e2e-spec.ts -t "the fetch-variants route is gone"`
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailView.missing.spec.tsx -t "the deck page has no price fetch button or drawer"`

**C454** - Arrangement of the credits bar of `r5-credits-b-phone` in Settings, for an admin: inside the URL sync section, under the line "Última sincronização: 412 produtos · 22/10/2026 03:10", a divider, then the label "Créditos do Firecrawl este mês" on the left and "120 de 1000" on the right, then a bar 8 px high with 4 px rounded ends that has `role="img"` and the name "120 de 1000 créditos usados" and a fill 12% wide in the accent color; when `lookupsStopped` is true, with 880 of 1000 used, the fill is 88% wide in the amber of the `--warn` color (`#c8843c` in the picture) and under the bar come "As consultas automáticas de preço pararam." and "A sincronização manual continua funcionando." in the amber ink (`#d6954c` in the picture); with lookups running neither line shows (AC 122) · done
Proof: `web unit src/routes/_auth/__tests__/-settings.spec.tsx -t "the credits bar sits under the sync line and turns amber when lookups stop"`

### S17 - The owner's missing list · 46 files · 251 KB · ~95k

**C203** - With something missing, the deck page shows one card with "Faltam 66 cópias (27 cartas)", "Na Cúpula DT: 50 cópias por R$ 753,28 · 14 a loja não tem · 2 fora do site" and the link "Ver o que falta" to `/decks/:deckId/missing`, and renders no shopping panel, no sidebar shopping panel and no "Pedir nos grupos"; with nothing missing it renders no card (AC 124, AC 133) · done
Proof: `web unit src/components/deck-detail/__tests__/MissingSummaryCard.spec.tsx -t "one card says what is missing in copies and links to the list"`
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailView.missing.spec.tsx -t "the old shopping panels and the group callout are gone"`

**C204** - `GET /api/decks/:deckId/missing` answers `200` with `summary` holding `totalCopies`, `buyCopies`, `buyCents`, `lacksCopies`, `notOnSiteCopies`, `ownedCopies`, `standInCopies`, `lookingUp`, `noPrice`, `availabilityCheckedAt`, `priceValidDays`, and `lines` each holding `cardIdentifier`, `deckNeeded`, `inventoryNeeded`, `state` and the price fields; another user's deck and an unknown id answer `404` (AC 124, AC 125; route) · done
Proof: `api e2e src/decks/__tests__/deck-missing.e2e-spec.ts -t "returns the summary and lines to the owner and 404 to anyone else"`

**C205** - The summary's `buyCopies + lacksCopies + notOnSiteCopies + ownedCopies + standInCopies` plus the copies of `looking_up` and `no_price` lines equals `totalCopies`, for a table of decks: all priced; all owned; one shortfall (store has 2 of 3, so 2 count to buy and 1 to lacks); one stand-in; one `looking_up`; one `no_price`; one card in the inventory only (AC 126, AC 133) · done
Proof: `api unit src/decks/__tests__/deck-missing.service.spec.ts -t "the copy counts add up to the deck's total copies"`

**C206** - The list's summary reads "Falta comprar: 43 cópias · R$ 452,28 na Cúpula DT" and "Já descontei 5 cópias que você tem e 2 que você troca por cartas suas.", then once "Preços conferidos nos últimos 30 dias. Estoque conferido em 19/10. O preço final aparece no site da loja.", and no row carries a date (AC 125, AC 133) · done
Proof: `web unit src/components/missing-list/__tests__/MissingListPage.spec.tsx -t "the summary counts copies and states the price window once"`

**C207** - The chips read "Comprar na loja 43", "A loja não tem 14", "Fora do site 2", "Já tenho 5", "No lugar 2"; "Sem preço" and "Buscando" chips appear only while a `no_price` or a `looking_up` line exists (AC 126) · done
Proof: `web unit src/components/missing-list/__tests__/MissingListPage.spec.tsx -t "the chips carry copy counts and the price chips appear only when needed"`

**C208** - Row copy per state: a `priced` row shows "faltam 3 · R$ 69,99 cada", the line total and the flags "só tem foil promo", "só tem foil" or "A loja tem 2. A 3ª está no pedido do grupo." when they apply, with "Já tenho…" and "Comprar" (external-link mark, `aria-label` naming the card with its pitch); a `looking_up` row shows "buscando preço…" and the summary adds "1 cartas ainda buscando preço" excluding it from the total; a `no_price` row shows "sem preço agora · ver na loja" with the product link; a `not_on_site` row shows "O app não achou esta carta no site da Cúpula DT · procurar lá" linking `<baseUrl>/?view=ecom/itens&busca=<card name>`; only a `store_lacks` row says the store does not have the card (AC 113, AC 114, AC 115, AC 118) · done
Proof: `web unit src/components/missing-list/__tests__/MissingListRow.spec.tsx -t "each store state has its own row copy"`

**C209** - The list prices `notOwned` copies: a 3-copy card with an unused stand-in covering 1 stays on the list priced for 3 and shows "Você tem 1 Bloodrush Bellow (Vermelho), que serve no lugar de 1 · economiza R$ 69,99 · Usar" (AC 127) · done
Proof: `api unit src/decks/__tests__/deck-missing.service.spec.ts -t "prices the copies not owned and offers the unused stand-in"`
Proof: `web unit src/components/missing-list/__tests__/MissingListRow.spec.tsx -t "an unused stand-in is offered inline"`

**C210** - Tapping "Usar" on a stand-in covering 2 of 3 copies posts `POST /api/decks/:deckId/replacements` with `quantity: 2`; afterwards the deck has 2 copies of the stand-in and 1 of the original, the list keeps 1 copy priced, and the row reads "Você vai usar 2 Awakening Bellow (Vermelho), que já tem, no lugar de 2 · economiza R$ 300,00 · Desfazer"; "Desfazer" calls the existing revert and the row returns to "Usar" (AC 128) · done
Proof: `api e2e src/replacements/__tests__/replacements.e2e-spec.ts -t "a pick with quantity 2 moves 2 copies and leaves the third on the list"`
Proof: `web unit src/components/missing-list/__tests__/MissingListRow.spec.tsx -t "Usar sends the copies the stand-in covers and Desfazer reverts"`

**C211** - Door 2 at the route: `POST /api/decks/:deckId/replacements` with `quantity` omitted and `side` omitted moves every missing copy from the deck as today and stores `side = 'deck'`; `side: 'inventory'` moves inventory copies and stores `inventory`; `quantity` 0, -1, 1.5 or `side: 'sideboard'` answer `400`; `quantity` above the copies still needed answers `409` and changes nothing; an unknown deck answers `404`; a valid pick answers `201` (door 2; route) · done
Proof: `api e2e src/replacements/__tests__/replacements.e2e-spec.ts -t "a pick takes a quantity and a side"`

**C212** - Door 2 in the rules: `decideAdoption({..., quantity?, side?})` returns today's decision when both are omitted, moves exactly `quantity` copies when given (1 of 3 → 1), and moves from the inventory when `side` is `inventory` (door 2) · done
Proof: `api unit src/replacements/__tests__/adoption-rules.spec.ts -t "moves the quantity the caller gives from the side it names"`

**C213** - Door 2 in the table: `card_replacement.side` is `varchar not null default 'deck'` with a check `IN ('deck', 'inventory')`; a row inserted before the migration reads `deck`; inserting `sideboard` fails with the check (door 2) · done
Proof: `api int src/database/migrations/__tests__/card-replacement-side.migration.int-spec.ts -t "adds side with deck as the default and refuses any other value"`

**C214** - "Já tenho…" opens "Quantas você já tem?" with options 0 to the deck's quantity of that card and the current total owned selected; picking 3 sends `PUT /api/collection/owned` `{ deckId, cardIdentifier, ownedTotal: 3 }` and shows the toast "Pack Hunt (Amarelo): você tem 3 · Desfazer"; "Desfazer" restores the manual source to the `previousManualQuantity` the response returned (AC 129) · done
Proof: `web unit src/components/missing-list/__tests__/OwnedStepper.spec.tsx -t "picking a number sets the owned total and Desfazer restores it"`

**C215** - `PUT /api/collection/owned` with the library holding 1 and `ownedTotal: 3` sets the manual source to 2 in one statement and answers `200` `{ ownedTotal: 3, previousManualQuantity: 0, snapshot }`; two concurrent PUTs of 2 and 3 leave the total at 2 or 3, never 5 (AC 129; route) · done
Proof: `api e2e src/collection/__tests__/set-owned.e2e-spec.ts -t "sets the owned total through the manual source in one statement"`
Proof: `api e2e src/collection/__tests__/set-owned.e2e-spec.ts -t "two concurrent sets end on one of the two values"`

**C216** - `PUT /api/collection/owned` answers `400` for an `ownedTotal` above the deck's quantity of that card (4 for a 3-copy card), for a negative or non-integer value and for a missing field, and answers `404` for another user's deck, an unknown deck and a card not in the deck; each refusal leaves every source unchanged (AC 131; route) · done
Proof: `api e2e src/collection/__tests__/set-owned.e2e-spec.ts -t "refuses a total above the deck's quantity and unknown targets"`

**C217** - With 2 copies in the library, the stepper's options 0 and 1 are disabled and the stepper shows "Você tem 2 na sua biblioteca" (AC 130) · done
Proof: `web unit src/components/missing-list/__tests__/OwnedStepper.spec.tsx -t "options below what other sources hold are disabled"`

**C218** - "Copiar lista de compras" writes to the clipboard the `priced` rows only, in the document's shape: first line "Lista de compras · [CC] Brute do Caio (Rhinar) · Cúpula DT", one line per row such as "3x Pack Hunt (Vermelho) · R$ 0,20 cada" and "1x Alpha Rampage (Vermelho) · R$ 150,00 cada · foil promo", last line "Total: 43 cópias · R$ 452,28"; the toast reads "Lista copiada" (AC 132) · done
Proof: `web unit src/components/missing-list/__tests__/shoppingListText.spec.ts -t "builds the shopping list from the priced rows"`
Proof: `web unit src/components/missing-list/__tests__/MissingListPage.spec.tsx -t "copying the shopping list toasts Lista copiada"`

**C219** - Phone arrangement of `r3-list-phone` and `r3-tenho-phone` at 390 px: summary at the top and sticky, then the chips, then the rows (image, name with pitch as a word, needed and unit price, line total, flags, stand-in line, "Já tenho…", "Comprar"), then a bottom bar with "Compartilhar a lista" as the primary action and "Copiar lista de compras" as the secondary; the "Já tenho…" stepper opens inside its row and the toast sits at the bottom; no horizontal scroll (AC 134) · done
Proof: `web e2e --project=mobile-390 tests/mobile/missing-list-layout.spec.ts -g "the phone list follows r3-list-phone"`

**C220** - Desktop arrangement of `r3-list-desktop` at 1440 px: a summary bar on top with "Copiar lista de compras" and "Compartilhar a lista", the chips, a table with the columns "Carta", "Faltam", "Já tenho", "No lugar", "Preço cada", "Total", "Link" (the "Já tenho" cell a 0 to N stepper), a footer "19 cartas na loja · 43 cópias a comprar · R$ 452,28", then the sections "A loja não tem agora · 14 cópias" and "Fora do site · 2 cópias" (AC 134) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/missing-list-flow.spec.ts -g "the desktop list follows r3-list-desktop"`

**C221** - A deck with inventory copies missing: each line carries `deckNeeded` and `inventoryNeeded` separately, the summary card and the list split the copies in words as S5's inventory copy defines, and inventory copies count in "Faltam" and in the shopping list (AC 134) · done
Proof: `api unit src/decks/__tests__/deck-missing.service.spec.ts -t "splits what is missing between the deck and the inventory"`
Proof: `web unit src/components/missing-list/__tests__/MissingListPage.spec.tsx -t "inventory copies are named apart"`

**C222** - The missing list for that deck reads "Faltam 7 cópias de 4 cartas · 4 do deck, 3 do inventário", a row reads "faltam 2 · 2 do inventário", the filters "Todas", "Do deck", "Do inventário" are shown with none but "Todas" active, "Do inventário" leaves only rows with inventory copies, and the header total stays 7 under every filter (AC 34, AC 35) · done
Proof: `web unit src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "the missing list splits and filters by side"`

**C223** - The shopping list for that deck shows the same split, "4 do deck, 3 do inventário" (AC 34; moved here from S5, because S17 rebuilds the shopping list) · done
Proof: `web unit src/components/deck-detail/__tests__/ShoppingPanel.spec.tsx -t "the shopping list splits deck and inventory"`

### S18 - The group ask · 35 files · 139 KB · ~51k

**C224** - The share sheet offers, in this order, "Mostrar o deck" with "Quem abrir vê todas as cartas do deck.", "Pedir as cartas que faltam" with "Para o grupo ou para amigos. Mostra o que falta, e quem tiver a carta te responde no WhatsApp." and "Pedir orçamento a uma loja" with "Só as cartas que faltam, sem preços. A loja marca quais tem e quanto custa, e te responde no WhatsApp."; nothing is preselected (AC 135) · done
Proof: `web unit src/components/deck-detail/__tests__/ShareDialog.spec.tsx -t "offers the three intents with their lines"`

**C225** - The group message for the binding deck reads "Procuro estas cartas para o meu deck [CC] Brute do Caio (Rhinar):", then one line per copy the store cannot supply ("3 Reckless Swing (Azul)" for a `store_lacks` card, "1 Bloodrush Bellow (Amarelo)" for the shortfall of a `priced` card the store has 2 of 3), then "Também procuro: 1 Snapdragon Scalers, 1 Crater Fist." for the `not_on_site` cards, then the closing line, then "Lista completa: <address>"; `priced`, `looking_up` and `no_price` copies the store can supply are absent; past 30 lines the message keeps 30 and adds "e mais N cartas no link" (AC 136) · done
Proof: `web unit src/components/share/__tests__/groupAskMessage.spec.ts -t "lists only what the store cannot supply"`

**C226** - "Incluir também as 43 que a loja tem" is off by default, with the line "Hoje a mensagem tem só as 16 que a loja não tem ou não achou."; turned on, the `priced`, `looking_up` and `no_price` cards are added under "Na Cúpula DT tem, mas também aceito:" (AC 137) · done
Proof: `web unit src/components/share/__tests__/groupAskMessage.spec.ts -t "the store-side cards are added only when asked"`

**C227** - With `user.shareClosingLine` "Pago no PIX ou troco. Estou em Pelotas." the closing line is prefilled with it and labelled "Da última vez · confira antes de enviar"; with it null the field is empty with the placeholder "Ex.: Pago no PIX ou troco. Estou em Pelotas."; "Abrir no WhatsApp" sends `PATCH /api/users/me/share-closing-line` with the edited text and then opens WhatsApp with the message (AC 138) · done
Proof: `web unit src/components/share/__tests__/GroupAskEditor.spec.tsx -t "prefills the last closing line and saves it on send"`

**C228** - `PATCH /api/users/me/share-closing-line` with 140 characters answers `200` with the text and stores it on the user; 141 characters, a number or a missing `text` answer `400` and leave the stored line unchanged (AC 138; route) · done
Proof: `api e2e src/users/__tests__/share-closing-line.e2e-spec.ts -t "stores the closing line up to 140 characters"`

**C229** - `GET /api/shared/decks/:token` for a `missing` address adds per card `state`, `unitPriceCents`, `lineCents`, `availableCopies`, `foilOnly`, `promoOnly`, `productUrl` and a `storeSummary` `{ copies: 43, cents: 45228 }`, read from the stored states (AC 139; route) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "the missing page carries the stored store states and the store summary"`

**C230** - The `missing` page, signed out, shows in this order: "Cartas que Caio procura" and the deck name; "Cada cor é uma carta diferente: confira a cor no nome."; the section "Quem tiver, fala com Caio" with "16 cópias que a loja não tem ou que o app não achou no site." and each card with its copy count ("3 cópias", "1 cópia") and "Oferecer"; a collapsed section "O resto dá para comprar na Cúpula DT · 43 cópias · R$ 452,28 · envia para todo o Brasil" holding the `priced` rows with flags and "Comprar" and the `looking_up` and `no_price` rows as "a loja tem · preço no site" outside the total; "Copiar lista em texto"; the LSS disclaimer and copyright line (AC 139) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedMissingPage.spec.tsx -t "the group page puts what people can give first and the store second"`

**C231** - A signed-in visitor sees on each row "Você tem 3 · 1 sobrando" from the spare function, the owned rows first in the first section, and one button "Oferecer as 2 cartas que você tem"; with `user.spareRule` null the spare-rule question is asked before the counts appear (AC 140) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedMissingPage.spec.tsx -t "a signed-in visitor sees what they have and what is spare"`
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "the missing page gives a signed-in visitor owned and spare per card"`

**C232** - "Oferecer" on a link that shows the sharer's number opens `https://wa.me/55<digits>?text=` with "Oi Caio, vi seu pedido no Rathe Arsenal. Tenho 3 Reckless Swing (Azul), edição __, condição __, R$ __ cada."; the combined button sends "Oi Caio, vi seu pedido no Rathe Arsenal. Tenho:" and one line per card ("3 Reckless Swing (Azul), edição __, condição __, R$ __ cada"); on a link with no number the same text goes to the clipboard with the toast "Texto copiado. Cole no grupo onde você viu o pedido."; each tap posts the `offer` event (AC 141) · done
Proof: `web unit src/components/shared-deck/__tests__/OfferButton.spec.tsx -t "opens WhatsApp to the sharer or copies the offer"`

**C233** - The owner opening their own `missing` page sees no "Oferecer" and no "Você tem", and the API answer to the owner carries no visitor counts (AC 142) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedMissingPage.spec.tsx -t "the owner sees no offer on their own page"`
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "the owner's own missing page carries no visitor counts"`

**C234** - The `missing` link preview has the title "Procuro cartas para [CC] Brute do Caio" and the description "Caio procura 16 cópias: 3 Reckless Swing (Azul), …", counting copies; neither the tags nor the image text contain "Cúpula DT" or a price (AC 143) · done
Proof: `api unit src/sharing/preview/__tests__/preview-missing.spec.ts -t "counts copies and never shows the store"`
Proof: `api unit src/sharing/preview/__tests__/share-meta-tags.spec.ts -t "the missing preview names no store"`

**C235** - `POST /api/shared/decks/:token/events` with `{ kind: 'offer' }` answers `204` and writes one `share_event` `offer` with the link's intent and the visitor's id when signed in, and null when signed out; from the owner it answers `204` and writes nothing; `{ kind: 'opened' }`, an unknown kind or an extra field answers `400`; a dead or unknown token answers `404` (AC 141; route) · done
Proof: `api e2e src/sharing/__tests__/share-events.e2e-spec.ts -t "records an offer for a visitor and nothing for the owner"`
Proof: `api e2e src/sharing/__tests__/share-events.e2e-spec.ts -t "refuses unknown kinds and dead tokens"`

**C236** - Arrangement of `r3-share-phone`, `r3-message-phone`, `r3-group-phone`, `r3-group-friend-phone` and `r3-offer-phone` at 390 px: the share sheet over the deck with the three options; the editor titled "Pedir as cartas que faltam", with no eyebrow above the title, and with "Mensagem para o WhatsApp", "Você pode editar antes de enviar.", the text, the highlighted closing line, "Lista completa", the switch and its line, and "Abrir no WhatsApp" last; the group page with the first section above the collapsed store section; the friend view with the summary above the first section and the combined button at its top; the offer sheet "Oferecer para Caio" with "Mensagem para o WhatsApp", "Preencha edição, condição e preço no WhatsApp antes de enviar.", the text and "Abrir no WhatsApp" (AC 144) · done · amended 2026-10-27 (delegation, D12)
Proof: `web e2e --project=mobile-390 tests/mobile/group-ask-layout.spec.ts -g "the group ask screens follow the r3 screens"`

### S19 - A store quote · 22 files · 42 KB · ~25k

**C237** - Picking "Pedir orçamento a uma loja" creates a `share_link` with intent `quote` the first time and returns the same address the second time, and offers it with "Oi! Pode me passar um orçamento destas cartas? <address>" (AC 145) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "creates or reuses one quote address per deck"`
Proof: `web unit src/components/deck-detail/__tests__/ShareDialog.spec.tsx -t "the quote intent offers its address with the request text"`

**C238** - Door 11: after the migration `share_link.intent` and `share_event.intent` accept `quote`, `share_event.kind` accepts `offer`, `quote_sent` and `buy`, `user.referredVia` accepts `quote`, all four still refuse `bogus`, and `down()` restores the previous lists (door 11) · done
Proof: `api int src/database/migrations/__tests__/quote-intent.migration.int-spec.ts -t "widens the four checks in one migration"`

**C239** - `GET /api/shared/decks/:token` for a `quote` address answers `200` with exactly the keys `intent`, `name`, `hero`, `sharerName`, `contactWhatsapp`, `needed`, each needed item with exactly `cardIdentifier`, `name`, `pitch`, `imageUrl`, `quantity`; the serialized body contains no "Cúpula", no `unitPriceCents`, no `productUrl` and no `storeSummary` (AC 147; door 11; route) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "the quote page carries the needed cards and nothing about stores"`

**C240** - The `quote` page shows "Caio pediu um orçamento para estas cartas. Marque o que você tem e o preço; a resposta vai pelo WhatsApp.", "Caio ainda precisa de 59 cópias (27 cartas menos as que ele já tem).", and every needed card with no "+ N cartas": the name with the pitch as a word, "precisa de 3", a "Tenho" stepper from 0 to 3, a price field in reais and "Observação (edição, condição)" with `maxLength` 60; it shows no sign-up prompt and no "Cúpula DT", store price, store link or store total (AC 146, AC 147) · done · amended 2026-10-27 (delegation, D13)
Proof: `web unit src/components/shared-deck/__tests__/SharedQuotePage.spec.tsx -t "lists every needed card with a stepper, a price and a note"`

**C241** - The `quote` link preview has the title "Orçamento: cartas para [CC] Brute do Caio", the description "Caio pede orçamento de 59 cópias.", the image's kind label "Orçamento", `noindex`, and no store name or price (AC 147) · done
Proof: `api unit src/sharing/preview/__tests__/share-meta-tags.spec.ts -t "the quote preview names no store"`

**C242** - While the store owner fills rows and sends, the page makes no request carrying a quantity, price or note: the only request is `POST /api/shared/decks/:token/events` with the body `{ "kind": "quote_sent" }`; the stored `share_event` row holds kind and intent only; a body with an extra field answers `400` (AC 148) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedQuotePage.spec.tsx -t "sends nothing typed and records only quote_sent"`
Proof: `api e2e src/sharing/__tests__/share-events.e2e-spec.ts -t "records quote_sent without content"`

**C243** - The draft is saved in local storage under a key holding the token and restored on the next visit to the same token; a different token starts empty; when `localStorage` throws on read or write the page starts empty and keeps working (AC 149) · done
Proof: `web unit src/components/shared-deck/__tests__/quoteDraft.spec.ts -t "restores the draft per token and starts empty without storage"`

**C244** - The sticky footer reads "Seu orçamento: 18 de 59 cópias · R$ 412,00"; the block "Prévia da mensagem" stands on the page while the store fills it in and reads "Marque as cartas que você tem para ver a mensagem." until a card is marked; once one is, it shows the preview "Oi Caio, orçamento para o seu deck [CC] Brute do Caio:", one line per row with a quantity above 0 ("1x Alpha Rampage (Vermelho) · R$ 120,00 cada · Edição promo, condição NM"), and "Total: 18 de 59 cópias · R$ 412,00"; "Ver mensagem e enviar" then opens WhatsApp to the sharer when the link shows a number, otherwise the text is copied with "Texto copiado. Cole na conversa com Caio." (AC 150) · done · amended 2026-10-27 (delegation, D14)
Proof: `web unit src/components/shared-deck/__tests__/quoteMessage.spec.ts -t "builds the quote message from the rows with a quantity"`
Proof: `web unit src/components/shared-deck/__tests__/SharedQuotePage.spec.tsx -t "sends the quote on WhatsApp or copies it"`

**C245** - "Copiar a lista para a sua planilha" copies one tab-separated line per needed card: quantity needed, card name, pitch ("3\tPack Hunt\tVermelho") (AC 146) · done
Proof: `web unit src/components/shared-deck/__tests__/quoteMessage.spec.ts -t "copies a tab-separated list for a spreadsheet"`

**C246** - Through a `quote` address, a signed-in visitor's `GET /coverage`, `GET /matches` and `POST /copy` answer `404` `SHARE_LINK_UNAVAILABLE`; a turned-off quote address, a deleted deck and an unknown token answer `404` `SHARE_LINK_UNAVAILABLE` on the page route (AC 151) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "a quote address answers nothing but the quote"`

**C247** - A sign-up carrying a live `quote` token stores `user.referredVia = 'quote'` and the sharer as `referredByUserId` (AC 152) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "stores quote as the channel for a sign-up from a quote link"`

**C248** - Arrangement of `r3-quote-phone` at 390 px: the title "Pedido de orçamento", the two header lines, the needed count, then one block per card (name, "precisa de N", "Tenho" stepper, "Preço por unidade" field with "R$", note), then the standing block "Prévia da mensagem" (with "Marque as cartas que você tem para ver a mensagem." until a card is marked), then "Copiar a lista para a sua planilha", the disclaimer, and the sticky footer with the running total and "Ver mensagem e enviar"; no horizontal scroll (AC 153) · done · amended 2026-10-27 (delegation, D14)
Proof: `web e2e --project=mobile-390 tests/mobile/quote-layout.spec.ts -g "the quote page follows r3-quote-phone"`

**C249** - The group ask text carries "4 do deck, 3 do inventário" next to the total of 7; the quote page shows the total only and no split, so C239 keeps its six keys (AC 34; moved here from S5, because the group ask is built in S18) · amended 2026-10-27 (delegation, D15)
Proof: `web unit src/components/shared-deck/__tests__/SharedMissingGallery.spec.tsx -t "the group ask splits deck and inventory"`

### S20 - Spare copies, one number everywhere · 22 files · 101 KB · ~41k

**C250** - With the shared scenario the spare count of Pack Hunt (Azul) is 1 under `within_format` (3 + 2 held), 3 under `any_deck` (3 held), and 0 under `per_deck` (7 held, never below 0) (AC 158) · done
Proof: `api unit src/collection/spare/__tests__/spare-copies.spec.ts -t "held copies follow each of the three rules"`

**C251** - Only decks at `building`, `ready` and `active` hold copies: with the shared scenario plus a `retired` deck using 4, the counts of C250 do not change, and moving `Dash ideia` to `building` makes the `any_deck` count 3 and the `within_format` count 1 (its format is Classic Constructed, max 3); one case per status, `idea`, `building`, `ready`, `active`, `retired` (AC 155) · done
Proof: `api unit src/collection/spare/__tests__/spare-copies.spec.ts -t "only building, ready and active decks hold copies"`

**C252** - A deck holds its deck and its inventory copies: `Rhinar CC` with 2 in the deck and 1 in the inventory holds 3, and the `per_deck` count of a card owned 6 and used only there is 3 (AC 155) · done
Proof: `api unit src/collection/spare/__tests__/spare-copies.spec.ts -t "a deck holds its inventory copies too"`

**C253** - The function stores nothing: after `GET /api/collection/spare`, no table gains a row and no column changes (row counts of `collection_card`, `tracked_deck`, `deck_card`, `user` equal before and after); after a deck moves from `building` to `retired`, the next `GET` reflects it with no other write (AC 154) · done
Proof: `api e2e src/__tests__/spare-copies.e2e-spec.ts -t "spare copies are computed on each read and never stored"`

**C254** - When the player owns 1 Cold Foil, 1 Rainbow Foil and 2 regular (`finish` `none`) copies of a card a holding deck uses 2 times, the deck holds the Cold and the Rainbow copy and the spare rows are the 2 regular copies; with the deck using 1, it holds the Cold copy and the spare rows are 1 Rainbow and 2 regular (AC 159) · done
Proof: `api unit src/collection/spare/__tests__/spare-copies.spec.ts -t "a deck holds the foil copies first, Cold before Rainbow"`

**C255** - With two holding decks sharing a card and `user.spareRule` null, `GET /api/collection/spare` answers `200` with `needsRule: true` and the count per rule `{ within_format, any_deck, per_deck }` and no spare rows; with no two holding decks sharing a card and the rule null it answers `needsRule: false` with rows (AC 156, AC 157) · done
Proof: `api e2e src/__tests__/spare-copies.e2e-spec.ts -t "asks for the rule only when two holding decks share a card"`

**C256** - `GET /api/collection/spare` answers `401` without a session, and its rows are one per card and version (`cardIdentifier`, `printingCode`, `edition`, `finish`, `condition`, `spare`) (AC 154) · done
Proof: `api e2e src/__tests__/spare-copies.e2e-spec.ts -t "answers 401 signed out and one row per card and version"`

**C257** - `PUT /api/users/me/spare-rule` with `within_format`, `any_deck` or `per_deck` answers `200` with the rule and stores it; with `"sometimes"`, an empty body or `null` it answers `400` and the stored value does not change (AC 156; door 12) · done
Proof: `api e2e src/__tests__/spare-copies.e2e-spec.ts -t "stores each of the three rules and refuses anything else"`

**C258** - Door 12 shape: the migration adds `user."spareRule" varchar(16) null` with a check accepting only `within_format`, `any_deck`, `per_deck` and null, `user."sellClosingLine" varchar(140) null` and `user."shareClosingLine" varchar(140) null`; an insert with `spareRule = 'other'` is rejected, a 141-character closing line is rejected, existing users read null in all three, and down removes the three columns (door 12) · done
Proof: `api e2e src/__tests__/spare-rule-migration.e2e-spec.ts -t "adds the spare rule and the two closing lines with their checks"`

**C259** - The rule question (`r3-spare-rule-phone`), top to bottom: "Antes de contar o que sobra", "Você passa cartas de um deck para outro?", three options in this order with their example and count, "Sim, entre decks do mesmo formato" / "Ex.: o mesmo Snatch vai do Kayo CC para o Rhinar CC, mas não para o Silver Age" / "Sobram 20 cópias", "Sim, entre quaisquer decks" / "Ex.: o mesmo Snatch vai para qualquer deck" / "Sobram 24 cópias", "Não, cada deck tem as próprias cartas" / "Ex.: cada deck fica montado na caixa dele" / "Sobram 19 cópias", then "Dá para mudar depois em Por que sobra? e nas configurações.", then "Continuar"; no option is checked and "Continuar" is disabled until one is picked, and picking one then "Continuar" calls `PUT /users/me/spare-rule` with its value (AC 156, AC 162) · done
Proof: `web unit src/components/spare/__tests__/SpareRuleSheet.spec.tsx -t "asks the rule with each count, nothing selected, Continuar disabled until a pick"`

**C260** - When `GET /collection/spare` answers `needsRule: false`, the "Sobrando" page renders rows and no rule question (AC 157) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "shows no rule question when the count does not depend on it"`

**C261** - The collection banner (`r3-library-banner-phone`) reads "Você tem cópias sobrando" with "Ver" linking to the "Sobrando" page, above the card grid, with no number, while the spare read answers `needsRule: true` or has at least one row; it is absent when there are no spare rows (AC 162) · done
Proof: `web unit src/components/library/__tests__/SpareBanner.spec.tsx -t "the banner names spare copies with no number and opens Sobrando"`

**C262** - "Por que sobra?" (`r3-why-spare-phone`) for the shared scenario under `within_format`, top to bottom: "Por que sobra?", "Pack Hunt (Azul)", "Você tem" 6, "Ficam nos decks Classic Constructed" with "o deck que mais usa: Kayo CC usa 3, Rhinar CC usa 2" 3, "Ficam no Rhinar SA (Silver Age)" 2, "Sobra" 1, "Dash ideia não conta: decks Ideia e Aposentado não prendem cartas.", "Sua regra: você passa cartas entre decks do mesmo formato" with "Mudar"; under `any_deck` one row with the deck that uses most; under `per_deck` one row per holding deck (AC 160, AC 162) · done
Proof: `web unit src/components/spare/__tests__/WhySpareSheet.spec.tsx -t "explains the count per format, per deck or once, by rule"`

**C263** - When a holding deck holds inventory copies, its row in "Por que sobra?" reads "Rhinar CC usa 3 no deck e 1 no inventário" (journey 3 note in `.design/sell-and-trade.md`) (AC 162) · done
Proof: `web unit src/components/spare/__tests__/WhySpareSheet.spec.tsx -t "names the inventory copies a deck holds"`

**C264** - "Mudar" in "Por que sobra?" opens the rule question with the stored rule checked, and the settings screen offers the same question (AC 160) · done
Proof: `web unit src/components/spare/__tests__/WhySpareSheet.spec.tsx -t "Mudar reopens the rule question"`
Proof: `web unit src/routes/_auth/__tests__/settings.spare-rule.spec.tsx -t "settings change the spare rule"`

**C265** - One function: the "Sobrando" read, the want-list trade view (`SharedListViewService`), the group page (`SharedDeckMissingService` or its journey 4 successor) and the Tutor's spare tool call the same spare service; for the shared scenario all four return 1 spare Pack Hunt (Azul) under `within_format` (AC 161) · done
Proof: `api unit src/collection/spare/__tests__/spare-consumers.spec.ts -t "every spare reader returns the same count from the one function"`

**C266** - A deck in "Excluídos recentemente" holds no copies: with the shared scenario, after `Kayo CC` is soft-deleted `GET /api/collection/spare` answers, under each of the three rules, the same Pack Hunt (Azul) count as the shared scenario without `Kayo CC`, and after it is restored the counts of C250 (AC 55; door 4; this reader case moved here from S8, because the route is built in S20) · done
Proof: `api e2e src/__tests__/spare-copies.e2e-spec.ts -t "a deleted deck holds no copies"`

### S21 - Selling spare copies · 24 files · 103 KB · ~42k

**C267** - The "Sobrando" page (`r3-spare-page-empty-phone`), top to bottom: "‹ Coleção", "Sobrando · 20 cópias", "Sua regra: você passa cartas entre decks do mesmo formato" with "Mudar", the Ideia notice "Dash ideia usa 3 Head Jab. Decks Ideia não prendem cartas, então elas aparecem aqui." with "Marcar Dash ideia como Montando", "Ordenar: maior preço", "Mostrar: todas / acima de R$ 5 / acima de R$ 20", then one row per version with name, version line ("Rainbow Foil · NM · 1 sobrando", "Versão não informada · 1 sobrando", "2 sobrando"), "Sugerido R$ X", the store line where it applies, "Por que sobra?", "Ver na LigaFAB" and a stepper, every stepper at 0 and its "−" disabled, then the bar "Escolha o que vender" (AC 163, AC 171) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "shows the spare rows with steppers at 0 and the empty bar"`

**C268** - Each stepper goes from 0 to that row's spare and no further ("+" disabled at the spare); after choosing 9 copies the bar reads "Você escolheu 9 cópias" and "9 cópias · R$ 186" with "Vender" (`r3-spare-page-phone`) (AC 163, AC 171) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "steppers stop at the spare and the bar sums the choice"`

**C269** - Sort "maior preço" orders rows by suggested price descending, "nome" by name; "acima de R$ 5" hides rows suggested at R$ 5 or less, "acima de R$ 20" at R$ 20 or less, "todas" shows all (AC 163) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "sorts by price or name and filters by price"`

**C270** - "Marcar Dash ideia como Montando" sets the deck's stage to `building` and the next spare read no longer counts its copies as spare (AC 155, AC 163) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "marking the Ideia deck as Montando updates the count"`

**C271** - The sell draft after "Vender" (`r3-sell-draft-phone`), top to bottom: "‹ Sobrando", "Nome da lista" editable with "Vendo - 21/10" for 21 October, the finish block, the lines with editable prices, "Ver na LigaFAB" per line, the price helper once, "Sua linha final", "Incluir o total" switched on, "Mensagem" with the live preview, "Ao enviar, a lista Vendo - 21/10 fica salva em Listas, com o link.", "Enviar no WhatsApp", "Copiar texto"; editing a price or the closing line updates the preview at once (AC 164, AC 171) · done
Proof: `web unit src/components/spare/__tests__/SellDraft.spec.tsx -t "the draft shows the name, prices, questions, closing line, total and the live message"`

**C272** - Finish questions: for each line whose card exists in foil and whose `finish` is `''`, the block "3 linhas sem versão informada. Elas existem em foil, e foil vale mais:" lists the card with "Sem foil", "Foil", "Não sei", none selected, and "Sim, todas sem foil"; a line whose card exists in no foil, or whose finish is known, gets no question; "Sim, todas sem foil" answers every open line "Sem foil" (`r3-sell-draft-answered-phone`: the lines then read "sem foil · preço aproximado") (AC 165, AC 171) · done
Proof: `web unit src/components/spare/__tests__/SellDraft.spec.tsx -t "asks the finish only of lines with no finish of cards that exist in foil"`

**C273** - Message line for each finish answer: "Sem foil" posts " · sem foil", "Não sei" and an unanswered question post " · foil não conferido", "Foil" posts the finish name; no line of a card that exists in foil leaves the draft with neither (AC 165) · done
Proof: `web unit src/components/spare/__tests__/sellMessage.spec.ts -t "every finish answer has its words in the message"`

**C274** - Closing line: with `user.sellClosingLine` null the field is empty with a grey placeholder example; with "Aceito PIX · retirada na loja do centro ou envio pelos Correios" stored, the field holds that text in full, editable, and the screen contains no "da última vez" (AC 166) · done
Proof: `web unit src/components/spare/__tests__/SellDraft.spec.tsx -t "the closing line is empty the first time, then the last one in full"`

**C275** - The message for Duda's draft equals `r3-message-phone` line for line: "VENDO", "2x Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45 cada", "1x Enlightened Strike (Vermelho) · Rainbow Foil · NM · R$ 60", "1x Enlightened Strike (Vermelho) · sem foil · R$ 12", "2x Snatch (Vermelho) · sem foil · R$ 6 cada", "3x Pummel (Vermelho) · sem foil · R$ 4 cada", "Total: R$ 186 (9 cartas)", a blank line, "Aceito PIX · retirada na loja do centro ou envio pelos Correios", the link (AC 167) · done
Proof: `web unit src/components/spare/__tests__/sellMessage.spec.ts -t "builds Duda's message exactly"`

**C276** - Message limits: with 35 lines the message shows 30 then "e mais 5 cartas no link", and "Total: R$ X (N cartas)" counts all 35 lines; with "Incluir o total" off no "Total:" line appears; one copy reads " · R$ X", more than one " · R$ X cada" (AC 167) · done
Proof: `web unit src/components/spare/__tests__/sellMessage.spec.ts -t "caps at 30 lines and the total counts every line"`

**C277** - "Enviar no WhatsApp" or "Copiar texto" creates a sell list named as the draft, with one line per chosen row carrying `printingCode`, `edition`, `finish`, `condition`, quantity and price, turns its share link on, saves the closing line with `PATCH /users/me/sell-closing-line`, then opens WhatsApp with the text or copies it; on a failed create no WhatsApp opens and the draft stays (AC 168) · done
Proof: `web unit src/components/spare/__tests__/SellDraft.spec.tsx -t "sending creates the sell list, shares it and saves the closing line"`

**C278** - `POST /api/lists/:listId/lines` takes the version as `printingCode`, `edition`, `finish`, `condition` and answers `201` with them; `400` on an unknown `finish` ("shiny"), an `edition` outside door 1's set, or the old `printing` field; `404` for another user's list (AC 168) · done
Proof: `api e2e src/__tests__/lists.e2e-spec.ts -t "sell lines take the version as four fields"`

**C279** - `PATCH /api/users/me/sell-closing-line` with "Aceito PIX" answers `200` with the text and stores it; with 141 characters it answers `400` and keeps the old text (AC 168; door 12) · done
Proof: `api e2e src/__tests__/spare-copies.e2e-spec.ts -t "saves the sell closing line up to 140 characters"`

**C280** - The store line "A Cúpula DT vende a versão mais barata por R$ 8,00" shows on a row with `finish` `''` or `none` and a Cúpula DT price, and never on a row with a foil finish or with no Cúpula DT price (AC 169) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "the store reference shows only next to unknown or regular versions with a price"`

**C281** - "Ver na LigaFAB" appears on the "Sobrando" rows and the draft lines, and the shared sell list page contains no "Ver na LigaFAB" (AC 169) · done
Proof: `web unit src/components/spare/__tests__/SparePage.spec.tsx -t "Ver na LigaFAB is on the seller's screens"`
Proof: `web unit src/components/shared-list/__tests__/SharedListPage.spec.tsx -t "a public sell list has no LigaFAB link"`

**C282** - The draft's price helper reads exactly "Sugerido: TCGplayer em dólar × 7. O 7 cobre o dólar e o custo de trazer a carta; mude se você cobra diferente." once (AC 170) · done
Proof: `web unit src/components/spare/__tests__/SellDraft.spec.tsx -t "the price helper explains the multiplier once"`

**C283** - The draft's lines whose version is not fully known read "preço aproximado" ("versão não informada · preço aproximado" before an answer, "sem foil · preço aproximado" after "Sem foil"), and the message never carries "preço aproximado" (AC 164, AC 171) · done
Proof: `web unit src/components/spare/__tests__/SellDraft.spec.tsx -t "marks approximate prices on the seller's screen only"`

### S22 - Marking a line sold · 10 files · 44 KB · ~13k

**C284** - `POST /api/lists/:listId/lines/:lineId/sold` on a line of 3 with `quantity: 1, removeFromCollection: false` answers `200` with two lines, one sold of 1 and one available of 2, and the collection unchanged; with `quantity: 3` the line is marked sold whole; `quantity` 0 or 4 answers `400`; another user's line `404`; an already-sold line `409` (AC 172) · done
Proof: `api e2e src/__tests__/lists.e2e-spec.ts -t "marks a line sold in part or whole"`

**C285** - With `removeFromCollection: true` the collection drops by the copies sold: copies of the same version first, then copies with no version (`''` fields), and the response's `removed` names each copy taken (AC 174) · done
Proof: `api unit src/lists/__tests__/sale-removal.spec.ts -t "takes the same version first, then copies with no version"`
Proof: `api e2e src/__tests__/lists.e2e-spec.ts -t "a sale with removal takes the copies out of the collection"`

**C286** - When the collection holds 1 copy and 2 were sold, the sale removes 1 and `removed` totals 1, and the sheet says how many it took out (AC 176) · done
Proof: `api unit src/lists/__tests__/sale-removal.spec.ts -t "removes only what the collection holds"`
Proof: `web unit src/components/lists/__tests__/SoldSheet.spec.tsx -t "says how many copies left the collection"`

**C287** - When the card sits in two imports and no `sourceId` is sent with `removeFromCollection: true`, the API answers `400` and removes nothing; with `sourceId` it removes from that import only (AC 177) · done
Proof: `api e2e src/__tests__/lists.e2e-spec.ts -t "asks which import when the card sits in more than one"`

**C288** - The sold sheet (`r3-sold-phone`): every unsold line of the owner's list shows "Vendida" and a sold line shows no such button; on a line of 2 it asks "Quantas você vendeu?" with the line's name and version and the choices 1 and 2; then "Tirar da sua coleção também?", "Você tem 4; ficam 2, as que o Kayo CC usa.", "Sim, tirar 2 da coleção", "Não, só marcar como vendida", "Escolha \"Não\" se essas cópias não estavam no app."; on a line of 1 it goes straight to the collection question (AC 172, AC 173, AC 178) · done · amended 2026-10-27 (delegation, D17)
Proof: `web unit src/components/lists/__tests__/SoldSheet.spec.tsx -t "asks how many, then about the collection"`

**C289** - When the removal would leave a holding deck short, the question reads "O Kayo CC vai ficar faltando 2." instead of the "ficam N" line (AC 175) · done
Proof: `web unit src/components/lists/__tests__/SoldSheet.spec.tsx -t "warns when the removal leaves a deck short"`

**C290** - When the card sits in more than one import the sheet lists the imports to pick from inside the same sheet at 390 px wide, with no second dialog (AC 177) · done
Proof: `web unit src/components/lists/__tests__/SoldSheet.spec.tsx -t "asks which import inside the sheet"`

**C291** - "Desfazer" after "Sim, tirar N da coleção" puts back exactly the copies in `removed`, same versions and import, and the collection count returns to its value before the sale (AC 174) · done
Proof: `web unit src/components/lists/__tests__/SoldSheet.spec.tsx -t "Desfazer puts the copies back"`
Proof: `api e2e src/__tests__/lists.e2e-spec.ts -t "undoing a sale restores the removed copies"`

### S23 - Buying and offering from a shared list · 14 files · 75 KB · ~23k

**C292** - A signed-in visitor on Duda's sell list (`r3-buyer-phone`), top to bottom: "Lista de venda", "Duda vende estas cartas", "3 cartas desta lista servem nos seus decks", rows with name, version and price ("History Pack 1 · NM · R$ 45", "sem foil · R$ 6 cada"), the deck hint ("Falta 1 no seu Rhinar CC", "Faltam 2 no seu Kayo CC") and a stepper at 0 (AC 179) · done
Proof: `web unit src/components/shared-list/__tests__/SharedListPage.spec.tsx -t "a buyer sees version, price, deck hint and a stepper at 0"`

**C293** - The deck hint names one deck with that deck's own missing count: with `Kayo CC` missing 2 Snatch and `Rhinar CC` missing 1, the API's per-line match carries both decks with their counts, not the sum 3 (AC 179) · done
Proof: `api unit src/sharing/__tests__/visitor-decks-missing.service.spec.ts -t "missing copies per deck, not summed"`

**C294** - Choosing copies shows the bar "Quero estas · R$ 57" with "Ver mensagem", which opens (`r3-buyer-message-phone`) "‹ Lista de Duda", "Mensagem para o WhatsApp", "Você pode editar antes de enviar.", an editable text equal to "Oi Duda, vi sua lista no Rathe Arsenal. Quero: 1x Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45, 2x Snatch (Vermelho) · sem foil · R$ 6 cada. Total R$ 57.", "Enviar no WhatsApp", "Copiar texto" (AC 180, AC 186) · done
Proof: `web unit src/components/shared-list/__tests__/BuyerMessage.spec.tsx -t "Quero estas opens the editable buy message"`

**C295** - `GET /api/shared/lists/:token` for a signed-in visitor on a want list adds per line `owned`, `spare` and `spareReason`; for an anonymous visitor and for the owner it adds none; with Marcos's list and Caio's collection, Pummel (Vermelho) reads `owned: 4, spare: 3` and Sink Below (Amarelo) `owned: 2, spare: 0, spareReason` naming "Rhinar SA" and 2 (AC 181) · done
Proof: `api e2e src/__tests__/shared-lists.e2e-spec.ts -t "a want list shows a signed-in visitor what they own and can spare"`

**C296** - `GET /api/shared/lists/:token` answers `200` for a live list and `404` for malformed, unknown, turned-off and deck tokens, as today (Surface) · done
Proof: `api e2e src/__tests__/shared-lists.e2e-spec.ts -t "answers 404 for malformed, unknown and deck tokens and once the owner is soft-deleted"`

**C297** - The trade view (`r3-trade-visitor-phone`), top to bottom: "Procuro - Kayo", "Cartas que Marcos procura", "Você tem sobrando 4 cópias de 2 cartas que Marcos procura.", rows "Marcos procura 3 · sugerido R$ 4" / "Você tem 4 · 3 sobrando" with a stepper, a row "Você tem 2 · nenhuma sobrando (o seu Rhinar SA usa as 2)" with no stepper, the collapsed line "2 cartas que você não tem: Pack Hunt (Azul), Bloodrush Bellow (Amarelo)", the switch "Incluir minha lista" off with "Procuro - Rhinar (3 cópias)", then "Ver mensagem"; nothing is selected; with no stored rule and two holding decks sharing a card the rule question comes first (AC 181, AC 156, AC 186) · done
Proof: `web unit src/components/shared-list/__tests__/TradeView.spec.tsx -t "a friend sees what they can spare, with the reason when none"`

**C298** - With "Incluir minha lista" on, the screen shows "Valor aproximado, pelo preço sugerido: você oferece R$ 57 · você procura R$ 21"; with it off the line is absent; in both cases the message contains no "R$" (AC 182) · done
Proof: `web unit src/components/shared-list/__tests__/TradeView.spec.tsx -t "the value of each side shows on screen and never in the message"`

**C299** - The offer message (`r3-offer-message-phone`) with the switch on equals "Oi Marcos, vi sua lista no Rathe Arsenal. Tenho sobrando para você: 3x Pummel (Vermelho) · sem foil, 1x Command and Conquer (Vermelho). Em troca procuro: 2x Wrecker Romp (Azul), 1x Savage Feast (Vermelho). Minha lista: <link>", with "‹ Lista de Marcos" (a copy rule, "de" before every name; the picked screen draws "do Marcos" and `r3-buyer-message-phone` draws "de Duda"), "Mensagem para o WhatsApp", "Você pode editar antes de enviar.", "Enviar no WhatsApp", "Copiar texto"; with the switch off it ends after the offered lines (AC 180, AC 182, AC 186) · amended 2026-10-27 (delegation, D18) · done
Proof: `web unit src/components/shared-list/__tests__/TradeView.spec.tsx -t "builds the offer message with and without the visitor's list"`

**C300** - When the sharer shows no number, "Enviar no WhatsApp" copies the text and shows "Texto copiado. Cole no grupo onde você viu a lista.", on both the buy and the offer message (AC 183) · done
Proof: `web unit src/components/shared-list/__tests__/BuyerMessage.spec.tsx -t "with no number the text is copied with the hint"`

**C301** - Sharing a list with no WhatsApp saved (`r3-share-contact-phone`) shows "Seu WhatsApp" with "+55 DDD e número", "Sem seu WhatsApp, quem abrir o link não tem como falar com você.", "Salvar e mostrar" with "Seu número aparece para quem abrir o link.", and "Compartilhar sem contato" below; with a number saved the warning is absent (AC 184, AC 186) · done
Proof: `web unit src/components/lists/__tests__/ListShareDialog.spec.tsx -t "warns before sharing with no WhatsApp saved"`

**C302** - The owner opening their own sell or want list sees no stepper, no "Quero estas", no "Ver mensagem" and no "Oferecer" (AC 185) · done
Proof: `web unit src/components/shared-list/__tests__/SharedListPage.spec.tsx -t "the owner gets no selection and no offer"`

### S24 - Saving a friend's deck with substitutions · 9 files · 25 KB · ~10k

**C303** - The shared deck view marks each row covered by an active `card_replacement` as "<card> · no lugar de <original>" ("Runner Runner (Vermelho)" with "no lugar de Swing Big" in `r3-saved-deck-phone`), and a deck with none marks nothing (AC 187) · done
Proof: `web unit src/components/shared-deck/__tests__/SharedDeckPage.spec.tsx -t "a replaced row names the card it replaces"`
Proof: `api unit src/sharing/__tests__/shared-deck-view.service.spec.ts -t "carries the original of each active replacement"`

**C304** - "Salvar nos meus decks" on such a deck asks "Qual lista você quer salvar?" with "A lista antes das trocas do Caio (com Swing Big)" and "Como o Caio montou (com Runner Runner)", none selected, "Salvar" disabled until one is picked; a pick sends `variant` `original` or `as_built`; a deck with no active replacement saves with no question, as today (AC 188, AC 191) · done
Proof: `web unit src/components/shared-deck/__tests__/SaveDeckChoice.spec.tsx -t "asks which list, nothing selected, Salvar disabled until a pick"`

**C305** - With `variant: original` the copy holds the sharer's original cards rebuilt from their active `card_replacement` rows with their quantities and sides: a replacement of 2 of 3 Swing Big in the deck gives the copy 3 Swing Big and no Runner Runner from that pick; a replacement on the `inventory` side restores the inventory quantity; with `as_built` the copy equals today's copy (AC 189) · done
Proof: `api unit src/sharing/__tests__/shared-deck-copy.service.spec.ts -t "the original variant rebuilds the cards before the replacements"`

**C306** - `POST /api/shared/decks/:token/copy` answers `201` with `deckId` for `variant` `original` or `as_built`; `400` with no `variant` on a deck with active replacements and with `variant: "other"`; `201` with no `variant` on a deck with none; `404` for a dead or unknown token, writing nothing (AC 190) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "copy asks for a variant when the deck has active replacements"`
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "answers coverage and copy only for the deck intent"`

### S25 - List and sharing fixes · 8 files · 31 KB · ~8k

**C307** - The multiplier field shows 5.5 as "5,5" after a save and a reload in pt-BR and "5.5" in en-US; "5,5" typed is accepted as 5.5; the error text names the range the field and `list-requests.dto.ts` accept (from 0,01), and no pt-BR value reads "entre 1 e 50" (AC 192) · done
Proof: `web unit src/components/lists/__tests__/ListPrices.spec.tsx -t "shows the multiplier with the locale's decimal comma"`
Proof: `web unit src/components/lists/__tests__/ListPrices.spec.tsx -t "the multiplier error text matches what the field accepts"`

**C308** - A sell line of 3 copies of a card the collection holds 1 of shows "Você tem 1 na coleção" in the muted text style and the line saves (`201`) (AC 193) · done
Proof: `web unit src/components/lists/__tests__/ListEditor.spec.tsx -t "a sell line over the collection says how many you have and is allowed"`

**C309** - "Nova lista" with "Vendo" (`r3-lists-new-phone`) offers, in this order, "Vender o que sobra na sua coleção" (opens "Sobrando"), "De um deck", "Do zero" with "Para cartas que não estão no app" (AC 194) · done
Proof: `web unit src/components/lists/__tests__/ListsIndex.spec.tsx -t "a new sell list starts from spare copies first"`

### S26 - The Tutor answers rules, copies and prices right · 14 files · 136 KB · ~34k

**C310** - `get_deck` on the fixture deck returns a `legality` equal to `computeDeckLegality` for that deck: category `illegal` and one copy problem for `pack-hunt-red` with count 4 and limit 3, and none for Pack Hunt (Amarelo) or (Azul). Each card row also carries `copyLimit`, which is 3 on the `pack-hunt-red` row and the engine's `getCopyLimit` on every other row (AC 195) · done
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_deck returns the engine's full legality and each card's copy limit"`
Proof: `api unit src/chat/__tests__/deck-facts.spec.ts -t "every card carries its copy limit from the engine"`

**C311** - The system instruction: · done
- Says that a card is its name and its pitch, naming Pack Hunt (Red) and Pack Hunt (Blue) as two cards with a limit each.
- Contains "Cúpula DT" as the store the prices come from.
- Tells the model to write `search_rules` queries in English.
- Asks that every proposal's reason say why the card fits, not only that it is legal.
- No longer contains "Legendary cards once" as the only copy statement.

All of this holds in both `pt-BR` and `en-US` (AC 196).
Proof: `api unit src/chat/__tests__/chat-prompt.spec.ts -t "the instruction states the copy rule per name and pitch, names Cúpula DT, searches rules in English and asks why a card fits"`

**C312** - `search_rules` falls back to an OR query ranked by relevance when the all-words match finds nothing. The tests seed `rules_entry` rows prefixed `tools-`, and the fixture has one entry whose text names the combat chain and the order of triggers. · done
- `"order of triggers when attacking"` returns `found: true` with that entry first.
- The audit's queries `"constructed deck maximum copies same name pitch"` and `"Classic Constructed deck equipment weapon requirements"` return `found: true`, ranked by relevance.
- A query that matches every word in one entry still returns that entry first.
- An exact rule number is still ranked first, as today (AC 197)

Proof: `api e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "a natural question with no all-words match falls back to an OR query ranked by relevance"`
Proof: `api e2e src/reference/__tests__/rules-import.e2e-spec.ts -t "search ranks an exact number first and caps the result"`

**C313** - `get_prices` answers `{deckId, cardIdentifiers: []}` with the same result as `{deckId}`, and never with `INVALID_ARGUMENTS`. · done
- On a deck with no stored readiness snapshot, `{deckId}` returns the missing cards priced, computed as the deck page computes them, and never `READINESS_NOT_COMPUTED`.
- `{}` and `{cardIdentifiers: []}` with no `deckId` still answer `INVALID_ARGUMENTS` (AC 198)

Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_prices with a deck and an empty list answers as for the deck alone"`
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_prices computes readiness for a deck with none stored"`

**C314** - `search_cards` matches the type line, class and talent as well as name and text: · done
- `{query: "Brute weapon"}` returns Romping Club.
- A table-driven case per field (type, class, talent) finds a catalog card picked in the test by that field's value, and that card's name does not contain the query (AC 199)

Proof: `api unit src/chat/__tests__/chat-tools.spec.ts -t "search_cards matches type, class and talent as well as name and text"`
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "search_cards finds Romping Club for Brute weapon"`

**C315** - `swapCandidates` computes `needed` from the call: · done
- `quantity: 1` gives `needed` 1.
- No `quantity` on a card over its limit gives the copies over the limit: Pack Hunt (Vermelho) at 4 in Classic Constructed gives 1.
- No `quantity` on a card within its limit gives every copy: 3 copies give 3.
- For Pack Hunt (Vermelho) at 4, the result has at least one group, where today it is `groups: []`.
- `get_swap_candidates` declares an optional integer `quantity` (AC 200)

Proof: `api unit src/chat/__tests__/swap-analysis.spec.ts -t "needed follows the quantity given, else the copies over the limit, else every copy"`
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_swap_candidates on a 4-copy Pack Hunt (Vermelho) returns candidates"`

**C316** - The fixture user owns 3 Pack Hunt (Vermelho) and has three decks: a `building` deck using 2, an `idea` deck using 3 and a `retired` deck using 3. · done
- `get_collection` reports `spare` 1 for that card.
- `get_swap_candidates` reports 1 free copy for it.
- Both equal what the S20 spare function returns for that user and card (AC 201)

Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "the Tutor's spare copies come from the spare function: Ideia and Aposentado decks hold none"`

**C317** - The empty chat's first ready question uses the hero of the deck the conversation or draft is bound to. · done
- With `?deck=7` (hero `Rhinar, Reckless Rampage`) and a more recently updated deck of another hero, it reads "Como outras pessoas montam o Rhinar, Reckless Rampage nos torneios?".
- With no bound deck, it uses the most recently updated deck's hero, as today (AC 202)

Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "the hero question uses the bound deck's hero"`
Proof: `web unit src/components/chat/__tests__/ChatScreen.new.spec.tsx -t "ready questions follow the latest deck"`

**C318** - `get_prices` with `{cardIdentifiers}` still gives the store price in reais and the TCGplayer price in dollars for the listed cards (AC 198) · done
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_prices gives the store price in reais and the TCGplayer price in dollars, for listed cards or a deck's missing cards"`

**C319** - `search_cards` still matches a card by its name and by its rules text (AC 199) · done
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "each read tool answers from the database"`

**C320** - When a rules search finds nothing at all, the instruction still tells the model what to do instead of answering from memory (AC 197) · done
Proof: `api unit src/chat/__tests__/chat-prompt.spec.ts -t "the instruction explains tournament sources and what to do when a search finds nothing"`

### S27 - A swap proposal says what moves · 15 files · 148 KB · ~37k

**C321** - The `propose_swap` declaration: · done
- Takes a required integer `quantity` (minimum 1) and a required `side` with enum `['deck', 'inventory']`.
- Its description no longer contains "every copy" and says it moves the given number of copies from the given side (AC 203; door 13)

Proof: `api unit src/chat/__tests__/chat-tools.spec.ts -t "propose_swap takes a quantity and a side and says what it moves"`

**C322** - On the fixture deck, `propose_swap` with `{quantity: 1, side: 'inventory'}` and a replacement the user does not own stores a `chat_proposal` of kind `swap`. Its `payload` holds `quantity` 1, `side` `'inventory'`, `missingBefore` and `missingAfter`. · done
- `missingBefore` equals the engine's missing copies for the deck before the move.
- `missingAfter` equals them after the move, computed at validation.
- In this fixture, `missingAfter` is `missingBefore + 1` (AC 203, AC 206; door 13)

Proof: `api e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "a swap proposal stores quantity, side and the missing count before and after"`

**C323** - Swap validation answers `ok: false`, and stores no proposal, in four cases: · done
- `quantity` 0;
- a `quantity` above the copies on the named side (2 from an inventory of 1);
- a `side` outside `deck` and `inventory`;
- a move that puts the replacement over its copy limit.

`{quantity: 1, side: 'deck'}` and `{quantity: 1, side: 'inventory'}` on the fixture both answer `ok: true`. One case per row (AC 203, AC 207; door 13)
Proof: `api unit src/chat/__tests__/proposal-validation.spec.ts -t "a swap's quantity and side are checked against the deck and the limits"`

**C324** - `GET /api/chat/conversations/:id` answers `200`, and its swap proposal carries `quantity`, `side`, `missingBefore` and `missingAfter` equal to the stored payload. After the user adds the incoming card to the collection, the same GET returns the same `missingBefore` and `missingAfter`, so they are not recomputed on read (AC 206; door 13; Surface) · done
Proof: `api e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "the conversation returns the stored swap effect, not a recomputed one"`

**C325** - `GET /api/chat/conversations/:id` for another user's conversation answers `404` (Surface) · done
Proof: `api e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "foreign and malformed conversations"`

**C326** - The pending swap card for `{quantity: 1, side: 'inventory'}` (Pack Hunt (Vermelho), 3 in the deck, 1 in the inventory) reads: · done
- "Sai: 1 Pack Hunt (Vermelho), a cópia do inventário. Ficam 3 no deck."
- "Entra: 1 Wounding Blow (Vermelho) no inventário"
- the button "Trocar 1 cópia" (AC 204)

With `side: 'deck'` on a short Blitz deck, the incoming line reads "Entra: 1 Wounding Blow (Vermelho) no deck".
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "a swap proposal says how many copies move and from which side"`

**C327** - The incoming card's line follows the free copies and the store price: · done
- Free copies 0 reads "você não tem nenhuma na coleção", and free copies 2 reads "você tem 2 livres".
- The card never shows "você não tem" on its own, nor today's "você não tem cópias livres".
- With a store price of 2.50, the line reads "R$ 2,50 na Cúpula DT"; with no price, "sem preço na Cúpula DT".
- One case per row (AC 205)

Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "the incoming card says its free copies and its Cúpula DT price"`

**C328** - The swap card shows "Por que esta carta:" followed by the catalog comparison (type, cost, power, defense, pitch of both cards). With `missingBefore` 7 and `missingAfter` 8, it shows "Depois da troca: faltam 8 cópias para fechar o deck (eram 7)." read from the payload, not computed in the browser (AC 206) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "the swap card shows why this card and the stored effect on the missing copies"`

**C329** - Applying the C322 proposal moves exactly one copy from the inventory: · done
- The `pack-hunt-red` row goes from quantity 3, inventory 1 to quantity 3, inventory 0.
- The replacement gains inventory 1.
- One `card_replacement` row is written with `quantity` 1, `side` `'inventory'` and `pickedFrom` `'chat'`.
- The deck's engine legality has no copy problem for `pack-hunt-red` afterwards.
- A deck-side proposal `{quantity: 1, side: 'deck'}` moves one copy of `quantity` instead (AC 207)

Proof: `api e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "applying a one-copy swap moves exactly one copy from the stated side"`
Proof: `api e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "concurrent applies create one effect"`

**C330** - After a successful apply, the card shows the status "Aplicada", "Troca feita no deck.", "Desfazer" and "Ver no deck". "Ver no deck" links to the deck page of the proposal's deck (AC 207) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "an applied swap reads Troca feita no deck. with Desfazer and Ver no deck"`

**C331** - The C322 proposal goes stale after its inventory copy has been removed from the deck. The apply then: · done
- answers with status `stale` and moves nothing;
- reads `stale` in `GET /api/chat/conversations/:id`;
- shows "Esta proposta não vale mais: o deck mudou desde a resposta." on the card (AC 208; door 13)

Proof: `api e2e src/chat/__tests__/chat-proposals.e2e-spec.ts -t "a proposal that no longer applies turns stale"`
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "each status shows its badge and actions"`

**C332** - The pending swap card follows `r2-proposal-desktop`, in this DOM order: · done
1. "Proposta de troca", "Pendente" and the deck chip "Rhinar CC";
2. the outgoing block: "Sai", "1", "Pack Hunt (Vermelho), a cópia do inventário", "Ficam 3 no deck.";
3. the incoming block: "Entra", "1", "Wounding Blow (Vermelho) no inventário", "você não tem nenhuma na coleção · R$ 2,50 na Cúpula DT";
4. the reason;
5. "Por que esta carta: ...";
6. "Depois da troca: faltam 8 cópias para fechar o deck (eram 7).";
7. the buttons "Trocar 1 cópia" then "Dispensar".

The applied card follows `r2-applied-desktop`: the same blocks with "Aplicada" in place of "Pendente", then "Troca feita no deck.", "Desfazer" and "Ver no deck", and no "Trocar 1 cópia" or "Dispensar" (AC 209)
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "the pending swap card follows r2-proposal-desktop"`
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "the applied swap card follows r2-applied-desktop"`

**C333** - A `dismissed` swap proposal still shows its badge and no apply action (AC 209) · done
Proof: `web unit src/components/chat/__tests__/ProposalCard.spec.tsx -t "each status shows its badge and actions"`

**C334** - `GET /api/chat/conversations/:id` with an id that is not a UUID answers `400` (Surface) · done
Proof: `api e2e src/chat/__tests__/chat-conversations.e2e-spec.ts -t "foreign and malformed conversations"`

### S28 - Asking the Tutor from the deck page · 7 files · 26 KB · ~11k

**C335** - The Tutor tile's first question follows the deck's state, one case per row: · done
- A Blitz deck with a rule problem reads "Como deixo este deck válido no Blitz?".
- A Blitz deck at 31 of 40 with no rule problem reads "Quais cartas coloco para chegar a 40?".
- A deck with neither reads "Como outros jogam o Rhinar, Reckless Rampage nos torneios?" (AC 210)

Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "the first question follows the deck's state"`

**C336** - The tile shows its questions only with chat access: with `chatAccess: false`, the deck page shows no Tutor tile (AC 210, AC 211) · done
Proof: `web unit src/components/deck-detail/__tests__/RecommendationsRail.spec.tsx -t "the Tutor tile follows chat access"`

**C337** - The tile's second and third questions read "Que carta deste deck vale trocar?" and "O que ainda impede este deck de ficar pronto?". "O que mais falta para ficar pronto?" appears in no pt-BR locale value (AC 213) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "the tile's other two questions"`

**C338** - The checklist sheet is drawn from the `a2-deck-ask-phone` deck: a Blitz deck at 31 of 40 with Pack Hunt (Vermelho) at 2. · done
- With `chatAccess: true`, the red copies line carries "Perguntar ao Tutor o que pôr no lugar", and the size line carries "Perguntar ao Tutor quais 10 cartas colocar", whose 10 is the number in the "Para fechar" line.
- With `chatAccess: false`, the sheet has no "Perguntar ao Tutor" button (AC 211)

Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "each red line carries its Tutor question and the size line counts as Para fechar"`

**C339** - Tapping a tile question or a checklist question makes two calls, the conversation start with `{ trackedDeckId: <deck id> }` and then the send of `{ text: <that question> }` to that conversation, then navigates to `/chat/<id>` (AC 212) · done · amended 2026-10-27 (delegation, D19)
Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "questions start a bound conversation"`
Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "a checklist question starts a bound conversation"`
Proof: `web e2e --project=e2e-chromium tests/e2e/chat-flow.spec.ts -g "a checklist question opens a bound chat with the question sent"` (`/api/chat/*` and `/api/auth/me` stubbed with `page.route`)

**C340** - The tile follows `b2-deck-ask-phone`, in DOM order: · done
1. "Pergunte ao Tutor";
2. "Como deixo este deck válido no Blitz?";
3. "Que carta deste deck vale trocar?";
4. "O que ainda impede este deck de ficar pronto?" (AC 213 supersedes the drawn third question, by the journey 7 rule);
5. "Conversar sobre este deck".

The checklist follows `a2-deck-ask-phone`, in DOM order:
1. "Herói: Rhinar joga Blitz";
2. "Todas as cartas são permitidas no Blitz";
3. "Cartas que você leva: 35 de 52";
4. "Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1", with "Ir para a carta" then "Perguntar ao Tutor o que pôr no lugar";
5. "Tamanho: 31 de 40 cartas · coloque mais 9", with "Perguntar ao Tutor quais 10 cartas colocar";
6. "Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 30, então coloque mais 10 cartas.";
7. "Fechar" (AC 214)

Proof: `web unit src/components/deck-detail/__tests__/DeckTutorTile.spec.tsx -t "the tile follows b2-deck-ask-phone"`
Proof: `web unit src/components/deck-detail/__tests__/RulesChecklistSheet.spec.tsx -t "the checklist with Tutor questions follows a2-deck-ask-phone"`

### S29 - The Tutor's tools are tested in CI, and the model is evaluated before a change ships · 7 files · 74 KB · ~21k

**C341** - The API e2e job (`pnpm --filter @rathe-arsenal/api test:e2e`, the `.e2e-spec.ts` regex, run in `ci.yml`) holds four cases: · done
- `get_prices` with `{deckId, cardIdentifiers: []}`;
- `get_deck` on the 4-copy Pack Hunt (Vermelho) deck;
- a one-copy `propose_swap` through `runChatTool`, answering `ok: true` with `quantity: 1`;
- `search_rules` with the English searches for the starter questions.

The last one runs `"order of triggers when attacking"` for "Explique a ordem dos gatilhos ao atacar" (AC 215)
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_prices with a deck and an empty list answers as for the deck alone"`
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "get_deck returns the engine's full legality and each card's copy limit"`
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "propose_swap proposes a one-copy swap"`
Proof: `api e2e src/chat/__tests__/chat-tools.e2e-spec.ts -t "search_rules finds rules for the starter questions' searches"`

**C342** - `EVAL_SCENARIOS` holds `copy-rule-pack-hunt`, `one-copy-swap`, `deck-price`, `ready-hero`, `ready-next-hero` and `ready-triggers`, each with a check function, and `ready-triggers` no longer checks nothing. Each check fails on the audit's recorded wrong answer and passes on a right trace, one case per scenario. The wrong answers are: · done
- copy rule: F29, "somando os pitches red, yellow e blue, são 10 Pack Hunt. Para ficar no limite pelo nome, deixe 3 no total";
- one-copy swap: F34, an answer with no `propose_swap` call;
- deck price: F30, every `get_prices` call answering `INVALID_ARGUMENTS`;
- `ready-triggers`: F33, `search_rules` answering `found: false`.

The ready questions are read exactly as the pt-BR screens show them (AC 216, AC 197)
Proof: `api unit src/chat/eval/__tests__/chat-eval-scenarios.spec.ts -t "each audit scenario fails on the audit's wrong answer and passes on a right one"`
Proof: `api unit src/chat/eval/__tests__/chat-eval-scenarios.spec.ts -t "ask the ready questions exactly as the pt-BR screens show them"`

**C343** - The eval runs by `chat:eval` with a cost cap: · done
- The options read `--max-usd` with a default of 3.
- The run stops once `chat_usage` for its turns reaches the cap.
- `.github/workflows/ci.yml` contains no `chat:eval` and no `chat-eval` step (AC 217)

Proof: `api unit src/chat/eval/__tests__/chat-eval.cli.spec.ts -t "the eval stops at its cost cap and is not a CI step"`

**C344** - `validateEnv` accepts an environment without `GEMINI_CHAT_THINKING_LEVEL`. With `GEMINI_CHAT_THINKING_LEVEL: 'low'`, the parsed config keeps `'low'`, and the property is declared on the environment DTO (AC 218) · done
Proof: `api unit src/config/__tests__/env.dto.spec.ts -t "GEMINI_CHAT_THINKING_LEVEL is declared and optional"`

### S30 - One field to start · 26 files · 96 KB · ~44k

**C345** - Signed out, `/` and `/entrar` render, top to bottom: the logo "Rathe Arsenal"; the headline "Monte seus decks de Flesh and Blood, veja quais cartas você já tem e quanto custa o que falta."; the three lines "Confere se o deck pode jogar no torneio", "Lista o que falta, com o preço na loja", "Manda a lista pronta no WhatsApp"; the field labelled "Seu e-mail", empty unless this device remembers an address; the button "Continuar"; the line "Se for sua primeira vez, a conta é criada na hora. Se você já tem conta, pedimos a senha ou mandamos um código."; then the LSS notice verbatim from `pt-BR/about.ts` with the link "Sobre" (screen `r3-arrive-phone`; copy rules 6 and 7) (AC 219, AC 227) · done
Proof: `web unit src/routes/__tests__/Entrar.spec.tsx -t "the start page shows the pitch, one field and what comes next"`

**C346** - At 390 x 844 and at 1440 x 900 the headline, the three pitch lines and "Seu e-mail" are all visible on the start page; today's side panel hidden below 720 px no longer hides the pitch (AC 219) · done
Proof: `web e2e --project=mobile-390 tests/mobile/account-start.spec.ts -g "the pitch is visible on a phone"`
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "the pitch is visible on a computer"`

**C347** - Submitting "bia@gmail" shows "Falta o final do e-mail, por exemplo bia@gmail.com" under the field, moves focus to the field, shows "Nada foi enviado ainda." under the button, and `fetch` is called 0 times (screen `r2-typo-phone`) (AC 220, AC 227, AC 253) · done
Proof: `web unit src/routes/__tests__/Entrar.spec.tsx -t "a malformed address is caught on the page and nothing is sent"`
Proof: `web e2e --project=mobile-390 tests/mobile/account-start.spec.ts -g "a typo sends no request"` (asserts no request to `/api/auth/*` with `page.on('request')`)

**C348** - Arriving from a shared deck link of "Rhinar - Blitz" by Bia, the start page shows no pitch, the card "Rhinar - Blitz · por Bia", the reason "Crie a conta para comparar o deck da Bia com as suas cartas.", "Seu e-mail", "Continuar" and "Depois, você volta para o deck da Bia."; from a missing-cards link the reason is "Crie a conta para ver quais destas cartas você já tem." (screen `r2-share-renata-phone`) (AC 221) · done
Proof: `web unit src/routes/__tests__/Entrar.spec.tsx -t "from a shared page the card and the reason replace the pitch"`

**C349** - `POST /api/auth/start` answers `200` with `next: "new"` for an address with no account, `next: "password"` for an account with a `passwordHash`, and `next: "code"` for an account without one; "BIA@Gmail.com " finds the account stored as "bia@gmail.com"; a body with `email: "bia@gmail"` answers `400` with a `code`; no response body carries a session token (AC 222, AC 226, AC 228) · done
Proof: `api e2e src/auth/__tests__/accounts.e2e-spec.ts -t "start says what comes next for each kind of address"`

**C350** - `POST /api/auth/start` answers `429` with a `Retry-After` header once one IP passes the route's per-IP limit, and the limit is the constant the controller declares for the route (AC 257) · done · proof extended 2026-10-27 (delegation)
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "start is throttled per IP"`
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "start is throttled per IP"`

**C351** - With `next: "new"` for "bia.souza@gmail.com" the page shows, in this order: the heading "Criar sua conta"; "Primeira vez aqui? Vamos criar sua conta com bia.souza@gmail.com." with "Errei o e-mail"; the one button "Criar conta e entrar"; the link "Prefiro criar uma senha"; and the staying-in line of C384; "Errei o e-mail" returns to the field with the address in it (screen `r3-new-account-phone`) (AC 222, AC 227) · done
Proof: `web unit src/components/auth/__tests__/NewAccountStep.spec.tsx -t "a new address offers one button and the password link"`

**C352** - "Criar conta e entrar" calls `POST /api/auth/sign-up` with no `password`; the API answers `201` with `user` and a `Set-Cookie` for `ra_session`, stores the user with `passwordHash` null and `emailVerifiedAt` null, and `GET /api/auth/me` with that cookie answers `200`; with no shared page the web then shows journey 2's "Como você quer começar?" and the toast "Conta criada. Toque no botão do e-mail que mandamos para bia.souza@gmail.com para confirmar." (screen `r3-home-unconfirmed-phone`) (AC 223) · done
Proof: `api e2e src/auth/__tests__/accounts.e2e-spec.ts -t "sign-up without a password creates a signed-in account"`
Proof: `web unit src/components/auth/__tests__/NewAccountStep.spec.tsx -t "creating the account signs in and opens the first-steps page"`

**C353** - "Prefiro criar uma senha" opens, in place: an empty, focused field "Senha"; "Pelo menos 10 caracteres."; "Com senha, você entra sem abrir o e-mail."; the button "Criar conta com senha e entrar"; and "Criar sem senha", which closes it; no rule message shows before a submit; submitting 9 characters marks the field `aria-invalid="true"` with a message under it and calls `fetch` 0 times; submitting 10 characters calls sign-up with that `password` (screen `r3-new-account-password-phone`) (AC 224, AC 227, AC 253) · done
Proof: `web unit src/components/auth/__tests__/NewAccountStep.spec.tsx -t "the password field opens in place and checks the rule only on submit"`

**C354** - Signing up from `/d/<token>` stores `signupReturnPath = "/d/<token>"`, and the web lands back on `/d/<token>` signed in with the toast "Conta criada. Você voltou para o deck da Bia."; from `/l/<token>` of Pedro's want list it lands on `/l/<token>` with "Conta criada. Você voltou para a lista do Pedro."; on the deck page with an empty collection it shows "Você ainda não tem cartas no Rathe Arsenal. Para comparar, coloque as suas cartas:" with "Colar uma lista" and "Enviar uma planilha (.csv)" (screens `r3-back-to-deck-phone`, `r3-back-to-list-phone`) (AC 225, AC 227) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "an account made from a shared deck comes back to it"`
Proof: `web unit src/components/shared-list/__tests__/SharedListPage.spec.tsx -t "a new account lands back on the list with its toast"`

**C355** - `returnPath` is stored only when it is a path inside the app: "/d/abc" and "/decks/12" are stored; "https://evil.example/x", "//evil.example" and a 201-character path are stored as null and sign-up still answers `201` (door 14) · done
Proof: `api unit src/auth/__tests__/auth.service.spec.ts -t "only an in-app return path is stored"`

**C356** - Sign-up with "Bia@Gmail.com " stores "bia@gmail.com"; a second sign-up with "bia@gmail.com" answers `409`; sign-in, start and code requests with "BIA@GMAIL.COM" reach the same user (AC 226) · done
Proof: `api e2e src/auth/__tests__/accounts.e2e-spec.ts -t "addresses are trimmed and lowercased on every auth route"`

**C357** - Schema: inserting a user with `passwordHash` null succeeds; inserting "ANA@x.com" when "ana@x.com" exists fails on the unique index over the lowercased address; `signupReturnPath` accepts 200 characters and rejects 201 (door 14; Relations `user.email`) · done
Proof: `api e2e src/auth/__tests__/accounts-schema.e2e-spec.ts -t "user columns enforce the account doors"`

**C358** - The lowercase migration, run on rows "Ana@x.com" and "ana@x.com", throws an error whose message lists both user ids and leaves both rows unchanged; run on "Bia@Gmail.com" alone it stores "bia@gmail.com" (door 14; assumption "a collision when e-mails are lowercased") · done
Proof: `api e2e src/auth/__tests__/accounts-schema.e2e-spec.ts -t "the lowercase migration aborts on a collision and lists the ids"`

**C359** - On a phone, a visitor types "Bia@Gmail.com ", creates the account, taps "Sair", types "bia@gmail.com", and the page offers the code screen for that account (S30 independent test) (AC 223, AC 226) · done
Proof: `web e2e --project=mobile-390 tests/mobile/account-start.spec.ts -g "an address typed two ways is one account"`

### S31 - Signing back in with a code or a password · 27 files · 87 KB · ~44k

**C360** - With `next: "password"` for "lucas.prado@hotmail.com" the page shows, in this order: the heading "Entrar"; "E-mail" with the address and "Não é você? Trocar"; "Da última vez você entrou com senha neste celular." only when this device stored a password sign-in for the address; "Senha"; the button "Entrar"; "Entrar com um código por e-mail"; and "Esqueceu a senha? Entre com um código e troque a senha em Configurações." (screen `r2-return-password-phone`) (AC 228, AC 235) · done
Proof: `web unit src/components/auth/__tests__/PasswordStep.spec.tsx -t "an account with a password offers the password and the code"`

**C361** - `POST /api/auth/codes` for a known address answers `202` with `expiresAt` 15 minutes after the request and `resendAfter`; it stores one `sign_in_code` row whose `codeHash` and `buttonTokenHash` differ from the code and the token, and sends one e-mail whose code matches `^\d{6}$` (AC 229; door 15) · done
Proof: `api e2e src/auth/__tests__/sign-in-codes.e2e-spec.ts -t "a code request stores a hashed code and sends one e-mail"`

**C362** - The code e-mail for code "482913" has the subject "482 913 é o seu código do Rathe Arsenal", shows "Seu código" and "482 913", a button "Entrar no Rathe Arsenal" whose link is under `APP_BASE_URL` and carries the button token, and the line "O código e o botão valem por 15 minutos. Se não foi você, ignore este e-mail."; the en-US version follows `Accept-Language` (screen `b4-email-phone`) (AC 229, AC 235) · done
Proof: `api unit src/email/__tests__/sign-in-code-email.template.spec.ts -t "the code e-mail carries the code, the button and the 15 minutes"`

**C363** - `POST /api/auth/codes/verify` with the right code answers `200` with `user`, `returnPath` and a `ra_session` cookie, and sets `consumedAt`; `POST /api/auth/codes/redeem` with the button token of a live code answers `200` the same way; redeeming the same token again answers `401`; redeeming after 15 minutes answers `410` with code `TOKEN_EXPIRED` (AC 229; Surface) · done
Proof: `api e2e src/auth/__tests__/sign-in-codes.e2e-spec.ts -t "the code and the button each sign in once"`

**C364** - After a second code request for the same address, verifying the first code answers `401` and verifying the second answers `200`; at every moment the table holds at most one row with `consumedAt` null for the address, and a direct insert of a second live row fails on the partial unique index (AC 230; door 15; Relations `sign_in_code`) · done
Proof: `api e2e src/auth/__tests__/sign-in-codes.e2e-spec.ts -t "a new code replaces the live one"`
Proof: `api e2e src/auth/__tests__/accounts-schema.e2e-spec.ts -t "one live sign-in code per address"`

**C365** - A wrong code answers `401`; a code that is not six digits answers `400`; a code past `expiresAt` answers `410` `TOKEN_EXPIRED`; after 5 wrong tries the right code answers `401` and creates no session (AC 231, AC 232; door 15) · done
Proof: `api e2e src/auth/__tests__/sign-in-codes.e2e-spec.ts -t "wrong, malformed, expired and exhausted codes are refused"`

**C366** - The code screen for "renata@cupuladt.com.br" shows "Digite o código", "Mandamos para renata@cupuladt.com.br. Ele vale 15 minutos.", six one-digit inputs, "No e-mail também tem um botão Entrar.", "Reenviar em 45 s" counting down, "Entrar com outro e-mail" and "Olhe também o spam."; for a Gmail address the last line is "Olhe também o spam e a aba Promoções." (screen `r2-return-code-phone`; copy rules 2 and 3) (AC 235) · done
Proof: `web unit src/components/auth/__tests__/CodeStep.spec.tsx -t "the code screen shows the address, six boxes and the spam line"`

**C367** - On a `401` the code screen shows "Este código não confere. Confira no e-mail."; on a `410` it shows "Este código venceu. Ele vale 15 minutos.", clears the six boxes and offers "Mandar um código novo", which requests a code for the same address (screen `r2-code-expired-phone`) (AC 231, AC 232, AC 235) · done
Proof: `web unit src/components/auth/__tests__/CodeStep.spec.tsx -t "a wrong code and an expired code say what to do"`

**C368** - `POST /api/auth/sign-in` answers `401` with code `INVALID_CREDENTIALS` and the same body for a wrong password, for an account with no password and for an account with `deletedAt` set, and sets no cookie; the password screen then shows "Senha incorreta." with "Entrar com um código" next to it (AC 233) · done
Proof: `api e2e src/auth/__tests__/accounts.e2e-spec.ts -t "sign-in refuses wrong, missing and deleted alike"`
Proof: `web unit src/components/auth/__tests__/PasswordStep.spec.tsx -t "a wrong password offers the code"`

**C369** - `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` answer `404`; the web route tree has no `/forgot-password` and no `/reset-password`, and opening them renders the not-found page; `password-reset-email.template.ts` no longer exists (AC 234; Surface) · done
Proof: `api e2e src/auth/__tests__/accounts.e2e-spec.ts -t "the reset routes are gone"`
Proof: `web unit src/routes/__tests__/Entrar.spec.tsx -t "the reset pages are not routes"`

**C370** - Requesting a code, requesting another, then entering the first shows "Este código não confere. Confira no e-mail." and entering the second signs in (S31 independent test, codes read from the stubbed API) (AC 230) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "the second code works and the first does not"`

### S32 - Staying in until "Sair" · 56 files · 316 KB · ~109k

**C371** - Every sign-in (sign-up, sign-in, codes verify, codes redeem) answers with exactly one `Set-Cookie` of `ra_session=<43-character base64url value>; Max-Age=34560000; Path=/api; HttpOnly; SameSite=Lax`, without `Secure` when `NODE_ENV` is not `production`; it stores a `user_session` row whose `tokenHash` is the SHA-256 of the token, not the token, with `revokedAt` null (AC 236; door 17) · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "each way in sets the session cookie and stores only its hash"`

**C372** - The cookie options built for `NODE_ENV=production` include `Secure`; for `development` and `test` they do not; both carry `httpOnly: true`, `sameSite: 'lax'`, `path: '/api'`, `maxAge` 34560000 seconds (AC 236; door 17) · done
Proof: `api unit src/auth/__tests__/session-cookie.spec.ts -t "the cookie is Secure only in production"`

**C373** - A session created 30 days ago and last seen yesterday still answers `200` on `GET /api/auth/me`; a request whose session was last seen more than one day ago gets the cookie again with `Max-Age=34560000` and `lastSeenAt` updated; a request whose session was seen less than one day ago gets no `Set-Cookie` (AC 236; door 17) · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "a session has no fixed expiry and is renewed once a day"`

**C374** - No response body of sign-up, sign-in, codes verify, codes redeem or `GET /api/auth/me` contains the cookie's token value, or a field named `jwt`, `token` or `session` (AC 242; door 17) · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "no response body carries the session token"`

**C375** - After a password sign-in in the browser, `document.cookie` does not contain `ra_session`, `localStorage` has no `rathe-arsenal:jwt` key, and the home loads its decks (AC 242; door 17) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "the session is invisible to page scripts"`

**C376** - `authFetch`, `useApiClient` and the request functions of `api/shared-decks.ts` send no `Authorization` header; `AuthProvider` removes a leftover `rathe-arsenal:jwt` key on load and reads the signed-in user from `GET /api/auth/me`, treating `401` as signed out (door 17) · done
Proof: `web unit src/lib/__tests__/auth-fetch.spec.ts -t "requests carry no Authorization header"`
Proof: `web unit src/lib/__tests__/api-client.spec.ts -t "requests carry no Authorization header"`
Proof: `web unit src/components/shared-deck/__tests__/SharedDeckPage.spec.tsx -t "shared requests carry no Authorization header"`
Proof: `web unit src/auth/__tests__/AuthProvider.session.spec.tsx -t "the provider drops the old key and asks me who is signed in"`

**C377** - A protected route called with a valid old-style `Authorization: Bearer <JWT>` and no cookie answers `401` (door 17; Impact "existing JWTs") · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "an old JWT is refused"`

**C378** - `POST /api/auth/sign-out` with a valid cookie answers `204`, sets `revokedAt`, and its `Set-Cookie` clears `ra_session` (`Max-Age=0`, `Path=/api`); `GET /api/auth/me` with the old token then answers `401`; `POST /api/auth/sign-out` with no cookie answers `401` (AC 237; Surface) · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "sign-out ends the session on the server and clears the cookie"`

**C379** - With two sessions of one account, signing out one leaves `GET /api/auth/me` with the other at `200` (S32 independent test) (AC 237) · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "signing out one device keeps the other"`

**C380** - Deleting the account answers as today and every session of that account then answers `401`; `PUT /api/users/me/password` answers `204`, every other session of that account then answers `401` and the session that sent it still answers `200` (AC 238, AC 260) · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "deleting the account ends every session and a new password ends the others"`

**C381** - `JwtAuthGuard` puts the user on the request for a cookie whose hash matches a live row, and answers `401` for no cookie, an unknown token, a revoked row and a user with `deletedAt` set; `OptionalJwtAuthGuard` puts the user on the request for a live session and leaves the request anonymous, with no error, in the other four cases (door 17) · done
Proof: `api unit src/auth/__tests__/jwt-auth.guard.spec.ts -t "the guard looks the session hash up"`
Proof: `api unit src/auth/guards/__tests__/optional-jwt-auth.guard.spec.ts -t "an unusable session leaves the visitor anonymous"`

**C382** - On a deck's edit page with a changed quantity, after the session is revoked from another context, saving opens a sign-in sheet (`role="dialog"`) over the page with the field "Seu e-mail"; after a password sign-in in the sheet the URL is the same edit page and the changed quantity is still in the draft (AC 239)
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "a session that ends mid-edit keeps the page and the draft"`
Proof: `web unit src/components/auth/__tests__/SignInSheet.spec.tsx -t "a 401 opens the sheet and a sign-in closes it on the same page"`

**C383** - Opening `/decks/<id>` signed out shows the start page; after signing in there the player lands on `/decks/<id>` (AC 240) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "a protected page opened signed out comes back after sign-in"`

**C384** - The new-account screens show, once, "A conta fica aberta neste celular até você tocar em Sair. Sem senha, mandamos um código só quando você entrar de novo." below 720 px wide and the same line with "neste computador" at 720 px and wider; no pt-BR or en-US locale value contains "Você continua conectada" (copy rule 5) (AC 241) · done
Proof: `web unit src/components/auth/__tests__/NewAccountStep.spec.tsx -t "the staying-in line is said once, for a phone or a computer"`

**C385** - Schema: a second `user_session` row with the same `tokenHash` fails; deleting a user deletes its sessions (door 17; Relations `user_session`) · done
Proof: `api e2e src/auth/__tests__/accounts-schema.e2e-spec.ts -t "session token hashes are unique"`

**C386** - A `POST`, `PUT`, `PATCH` and `DELETE` to owner routes with a valid cookie and `Origin: https://evil.example` each answer `403` with code `ORIGIN_REJECTED`, change no row, and log the rejected origin; the same four with `Origin` equal to the origin of `APP_BASE_URL` succeed; the same four with no `Origin` header and a valid cookie succeed, and with no cookie answer `401`; a `GET` with `Origin: https://evil.example` answers `200` (AC 243; door 17; assumption "the address the origin check accepts") · done
Proof: `api e2e src/auth/__tests__/sessions.e2e-spec.ts -t "writes from another origin are refused and change nothing"`
Proof: `api unit src/http/__tests__/origin-check.middleware.spec.ts -t "the origin check decides by method and Origin header"`

**C387** - `configureHttpApp` mounts `cookie-parser` and the origin check: an app built only through it reads `ra_session` from a `Cookie` header and refuses a foreign-origin `POST` with `403`; every `*.e2e-spec.ts`, `*.int-spec.ts` and e2e fixture under `apps/api/src` that calls `createNestApplication` also calls `configureHttpApp` or boots through `bootFixture` (door 17; startup config) · done
Proof: `api unit src/http/__tests__/configure-http-app.spec.ts -t "the shared setup parses the session cookie and checks the origin"`
Proof: `api unit src/http/__tests__/bootstraps-share-http-setup.spec.ts -t "every test bootstrap goes through configureHttpApp"`

**C388** - The Playwright global setup writes a storage state whose `cookies` hold `ra_session` for the base URL with `httpOnly: true`, and whose `localStorage` holds no `rathe-arsenal:jwt`; `scripts/fixture/fixture-seed.ts` sends the session as a `Cookie` header and never as `Authorization` (door 17) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "the fixture session is a cookie"`

### S33 - Confirming the e-mail, and what an unconfirmed account can do · 30 files · 119 KB · ~42k

**C389** - For a user with `emailVerifiedAt` null: sign-in answers `200`; `GET /api/decks` answers `200`; `POST /api/decks` answers `201`; `POST /api/decks/:deckId/share` and `POST /api/lists/:listId/share` answer `403` with code `EMAIL_NOT_CONFIRMED` and create no `share_link`; after `emailVerifiedAt` is set the same two answer `201` (AC 244, AC 245) · done
Proof: `api e2e src/auth/__tests__/unconfirmed-account.e2e-spec.ts -t "an unconfirmed account can do everything but create a share link"`

**C390** - For a confirmed owner, `POST /api/decks/:deckId/share` answers `201` for each intent including `quote`; an unknown intent answers `400`; a list share with `intent: "quote"` answers `400`; a deck or list of another user answers `404` (Surface) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "share creation answers 201, 400 and 404 by intent and owner"`

**C391** - On `403` `EMAIL_NOT_CONFIRMED` from either share dialog, the sheet "Falta confirmar o seu e-mail" opens with "Para criar um link, confirme o e-mail que mandamos para bia.souza@gmail.com. O link vale 7 dias.", "Olhe também o spam e a aba Promoções.", "Mandar o link de novo", "Errei o e-mail" and "Agora não"; "Mandar o link de novo" calls `POST /api/auth/resend-verification`, and "Agora não" closes the sheet (screen `r2-share-blocked-phone`) (AC 245, AC 252) · done
Proof: `web unit src/components/deck-detail/__tests__/ShareDialog.spec.tsx -t "an unconfirmed owner gets the confirm sheet"`
Proof: `web unit src/components/lists/__tests__/ListShareDialog.spec.tsx -t "an unconfirmed owner gets the confirm sheet"`

**C392** - While `emailVerifiedAt` is null the home shows "Confirme bia.souza@gmail.com para criar links de compartilhar · Reenviar · Errei o e-mail" with "Reenviar" and "Errei o e-mail" as buttons; with it set, the line is absent (screen `r3-home-unconfirmed-phone`) (AC 246, AC 252) · done
Proof: `web unit src/routes/_auth/__tests__/-home.spec.tsx -t "an unconfirmed account sees the confirm line"`

**C393** - A confirmation token issued at sign-up expires 7 days (604800 seconds) after issue: `POST /api/auth/verify-email` answers `200` with `verified: true` at 6 days and 23 hours, and `410` `TOKEN_EXPIRED` at 7 days and 1 second, with the user row and its decks still present (AC 247, AC 251; Surface) · done
Proof: `api e2e src/auth/__tests__/unconfirmed-account.e2e-spec.ts -t "the confirmation lasts 7 days and an old one deletes nothing"`

**C394** - `POST /api/auth/verify-email` answers with `returnPath` equal to the account's `signupReturnPath` ("/d/<token>"), whichever device sends it; signed in, the web goes to that path with the toast "E-mail confirmado. Agora você pode criar links de compartilhar."; signed out, it shows "E-mail confirmado." and an "Entrar" that opens the code sign-in for the account's address and lands on `returnPath` after it (screen `r2-confirmed-phone`) (AC 248, AC 252) · done
Proof: `api e2e src/auth/__tests__/unconfirmed-account.e2e-spec.ts -t "confirming returns the page stored at sign-up"`
Proof: `web unit src/routes/__tests__/VerifyEmail.spec.tsx -t "a confirmation goes to the stored page, signed in or not"`

**C395** - `PATCH /api/auth/me/email` on an unconfirmed account with "Bia.Nova@gmail.com" answers `200` with `user.email` "bia.nova@gmail.com", keeps the account's deck and collection counts, sends one confirmation to the new address and makes the old confirmation token answer `410`; on a confirmed account it answers `400`; with an address of another account `409`; malformed `400`; with no cookie `401` (AC 249; Surface) · done
Proof: `api e2e src/auth/__tests__/unconfirmed-account.e2e-spec.ts -t "fixing the address keeps the account and sends a new confirmation"`

**C396** - When `EmailService` throws at sign-up, the API still answers `201` with the cookie and the user exists; `POST /api/auth/resend-verification` with that cookie then answers `202` and sends one confirmation; without a cookie it answers `401`; past the route's limit it answers `429` (AC 250; Surface) · done
Proof: `api e2e src/auth/__tests__/unconfirmed-account.e2e-spec.ts -t "a failed confirmation e-mail does not block the account"`
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "resend-verification is throttled per IP"`

**C397** - The verify page for a `410` shows "Este link venceu." and, for the signed-in owner, "Mandar um novo", which calls resend; signed out it shows no "Mandar um novo"; it never shows "Criar conta de novo" (AC 251) · done
Proof: `web unit src/routes/__tests__/VerifyEmail.spec.tsx -t "an expired confirmation offers a new one to the owner"`

**C398** - Sign up, try to share and see the sheet, confirm with the captured token in a second browser context, then share and get a link (S33 independent test) (AC 245, AC 248) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "share waits for the confirmation and works after it"`

### S34 - Auth forms say what is wrong, and the limits are fair · 20 files · 65 KB · ~30k

**C399** - Each auth form with client checks - the start field, the new-account password, the sign-in password, the six code boxes, the settings password and the address fix - refuses its invalid input ("bia@gmail", a 9-character password, a 5-digit code) under the field with `aria-invalid="true"` and calls `fetch` 0 times (AC 253)
Proof: `web unit src/components/auth/__tests__/auth-form-validation.spec.tsx -t "every auth form stops a bad field before the server"`

**C400** - A sign-up body with `email: "bia@gmail"` and one with a 9-character password each answer `400` with a non-empty `code`; the web localizes the e-mail code as "E-mail inválido" and the password code as "A senha precisa ter pelo menos 10 caracteres", and `localizeAuthError` returns "Algo deu errado. Tente novamente." for neither (AC 254) · done
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "field errors carry a code"`
Proof: `web unit src/auth/__tests__/localize-auth-error.spec.ts -t "field codes have their own message"`

**C401** - From one IP, 25 sign-up requests that fail validation answer `400` each, and the next valid one answers `201`, not `429`; the same holds for code requests (AC 255) · done · proof extended 2026-10-27 (delegation)
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "invalid requests do not use up the limit"`
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "invalid requests do not use up the limit"`

**C402** - With `TURNSTILE_SECRET_KEY` set and siteverify stubbed to `success: false`, sign-up and code requests answer `400` `CAPTCHA_FAILED`, create no user and no `sign_in_code`; stubbed to `success: true` they answer `201` and `202`; the stub received a `POST` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret and the request's token (AC 256; door 16) · done
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "Turnstile decides sign-up and code requests when the secret is set"`
Proof: `api unit src/auth/__tests__/turnstile.service.spec.ts -t "siteverify is called with the secret and the token"`

**C403** - With `TURNSTILE_SECRET_KEY` absent the environment validates, sign-up answers `201` without calling siteverify, and one warning is logged per hour however many requests arrive; with `VITE_TURNSTILE_SITE_KEY` absent the web renders no widget and sends no `turnstileToken` (door 16; assumption "Turnstile when the secret is absent") · done
Proof: `api unit src/auth/__tests__/turnstile.service.spec.ts -t "an absent secret skips the check and warns once an hour"`
Proof: `api unit src/config/__tests__/env.dto.spec.ts -t "the Turnstile secret is optional"`
Proof: `web unit src/components/auth/__tests__/TurnstileWidget.spec.tsx -t "no site key, no widget"`

**C404** - A code request for one address answers `429` with `Retry-After` and adds no row once that address has 5 codes asked and never tried within the last hour, or 10 failed tries within the last hour counted across all of its codes, whichever comes first; with 4 such codes, or 9 failed tries, the next request still answers `202`; a code that has had a try does not count toward the 5; the counts come from that address's `sign_in_code` rows of the last hour, and another address from the same IP still answers `202`; the 21st sign-up from one IP within an hour answers `429`, the 20th `201` (AC 257; assumption "the per-address code limit") · amended 2026-10-27 (delegation, D59) · done
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "five codes per address and twenty sign-ups per IP per hour"`
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "ten failed tries per address per hour across codes"`

**C405** - On a `429` with `Retry-After: 300` the password screen shows "Muitas tentativas. Aguarde 5 minutos e tente novamente." and "Entre com um código por e-mail"; on the code screen it shows the wait and the password way in when the account has a password; `POST /api/auth/sign-in` answers `429` once one IP passes its per-minute limit (AC 258; Surface) · done · proof extended 2026-10-27 (delegation)
Proof: `web unit src/components/auth/__tests__/PasswordStep.spec.tsx -t "too many tries says the wait and the other way in"`
Proof: `web unit src/components/auth/__tests__/CodeStep.spec.tsx -t "too many tries says the wait and the other way in"`
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "returns 200 for the first 5 requests and 429 on the 6th"`
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "sign-in answers 401 for a wrong password and 429 once the IP passes its per-minute limit"`

**C406** - `POST /api/auth/codes/verify` answers `429` once one IP passes the route's per-IP limit, the constant the controller declares (Surface) · done · proof extended 2026-10-27 (delegation)
Proof: `api e2e src/auth/__tests__/auth.controller.e2e-spec.ts -t "code verification is throttled per IP"`
Proof: `api e2e src/auth/__tests__/auth-limits.e2e-spec.ts -t "code verification is throttled per IP"`

**C407** - WHERE `TURNSTILE_SECRET_KEY` is set and the siteverify call fails with a network error or a timeout, the Turnstile check lets the request through, as when the secret is absent, and logs one warning naming the failure (plan Assumptions, siteverify unreachable; door 16) · done
Proof: `api unit src/auth/__tests__/turnstile.service.spec.ts -t "an unreachable siteverify lets the request through and warns"`

### S35 - Settings: create or change a password · 12 files · 45 KB · ~19k

**C408** - `GET /api/auth/me` carries `hasPassword`; the Settings page's "Conta" section shows "E-mail" with the address, then "Senha: você tem uma senha" with "Mudar a senha" when `hasPassword` is true or "Senha: nenhuma" with "Criar uma senha" when false, then "Você também pode entrar com um código por e-mail, sem senha." (screen `r2-settings-password-phone`) (AC 259, AC 262) · done
Proof: `web unit src/routes/_auth/__tests__/-settings.spec.tsx -t "the password row follows hasPassword"`

**C409** - "Mudar a senha" and "Criar uma senha" each open a form with exactly one password input and no current-password input; submitting 10 characters calls `PUT /api/users/me/password` with `{ password }` and shows the row as "Senha: você tem uma senha" (AC 260)
Proof: `web unit src/routes/_auth/__tests__/-settings.spec.tsx -t "a new password asks only the new password"`

**C410** - `PUT /api/users/me/password` answers `204` and sign-in with the new password then answers `200`; a 9-character or empty password answers `400`; no cookie answers `401` (AC 260, AC 261; Surface) · done
Proof: `api e2e src/users/__tests__/password.e2e-spec.ts -t "setting a password answers 204, 400 and 401"`

**C411** - The Settings page has no control whose name matches `/remover|apagar|tirar/i` next to the password row, and the API has no route that sets `passwordHash` back to null (AC 261) · done
Proof: `web unit src/routes/_auth/__tests__/-settings.spec.tsx -t "a password cannot be removed"`
Proof: `api e2e src/users/__tests__/password.e2e-spec.ts -t "no route clears a password"`

**C412** - On a code-only account, creating a password in Settings and signing out, then signing in with that password, reaches the home (S35 independent test) (AC 259, AC 260)
Proof: `web e2e --project=e2e-chromium tests/e2e/account-flow.spec.ts -g "a code-only account creates a password and signs in with it"`

### S36 - Words that mean one thing, and one landmark · 32 files · 168 KB · ~48k

**C413** - The engine's rationale detail carries, per candidate, the pitch relation (`same` or `different` with both pitches), the classes the two cards share, and whether the candidate is Generic, decided by one case per row: same pitch red; different pitch, candidate blue for a red original; shared class Brute; Generic candidate; classed original and a candidate with no shared class (AC 263) · done
Proof: `engine unit __tests__/rationale.spec.ts -t "states the real relation between the two cards"`

**C414** - `formatSwapRationale` writes, in pt-BR: "mesmo pitch (vermelho)" for the same pitch; "pitch diferente: azul em vez de vermelho" for a blue candidate of a red original; "mesma classe (Brute)" for a shared Brute class; "carta genérica" for a Generic candidate; and no class phrase when the cards share no class; the outputs never contain "mesma classe (Generic)", "nenhuma das duas tem classe" or "Mesmo pitch" next to "pitch diferente" (AC 263) · done
Proof: `web unit src/i18n/__tests__/format-reasons.spec.ts -t "the reason states the real relation"`

**C415** - The alternatives sheet of a Generic original shows each candidate's reason once, from `formatSwapRationale`, and does not append "O pitch é diferente" or "fora da classe da original" (AC 263) · done
Proof: `web unit src/components/deck-detail/__tests__/AlternativesSheet.spec.tsx -t "a Generic original reads one honest reason"`

**C416** - `GET` alternatives for a missing card whose catalog classes are `['Brute']` returns the original card's classes `['Brute']` in the payload, and `api/deck-detail.ts` types the field (AC 264) · done
Proof: `api e2e src/replacements/__tests__/alternatives.e2e-spec.ts -t "the payload carries the original card's classes"`

**C417** - One grouping function returns the same ordered headings for the same cards; the deck page, the Library and the shared deck page render that same sequence of headings for one fixture deck; every heading is the pt-BR value of an i18n key, and none is "Attack Actions", "Defense Reactions", "Non-attack Actions", "Hero · Weapon · Equipment" or a raw catalog type in capitals ("ATTACK ACTION") (AC 265) · done
Proof: `web unit src/lib/__tests__/card-groups.spec.ts -t "one grouping rule for every card list"`
Proof: `web unit src/components/shared-deck/__tests__/SharedDeckPage.spec.tsx -t "headings follow the shared grouping"`
Proof: `web unit src/components/library/__tests__/LibraryGrid.test.tsx -t "headings follow the shared grouping"`

**C418** - `home.emptyLead` contains "quais cartas da sua coleção podem substituir as que faltam", and every value that C3 rewrote uses "substituir" or no verb of replacement, never "troca" (AC 266) · done
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "outside a deck the app says substituir"`

**C419** - The deck page inside `AppShell` has exactly one element with role `main`; the deck canvas has role `region` and an accessible name; `/library-csv-sources` has exactly one `main` (AC 267) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckDetailLayout.spec.tsx -t "the canvas is a labelled region, not a second main"`
Proof: `web unit src/routes/_auth/__tests__/-library-csv-sources.test.tsx -t "the page has one main"`

**C420** - In pt-BR `alternatives.free` gives "nenhuma livre" for count 0, "1 livre" for 1 and "2 livres" for 2 (AC 268) · done
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "zero free copies read nenhuma livre"`

**C421** - No JSX element under `apps/web/src` (tests excluded, SVG `<title>` children excluded) carries a `title=` attribute; `ShoppingLine.tsx`, `MissingStoreSummary.tsx` and `LibraryStatsBar.tsx` show the estimated-price explanation as visible text, and `LibraryStatsBar`'s pitch dots carry the "?" of "Vermelho, Amarelo, Azul" (AC 269) · done
Proof: `web unit src/i18n/__tests__/component-literals.spec.ts -t "no native title tooltip"`
Proof: `web unit src/components/library/__tests__/LibraryStatsBar.test.tsx -t "the estimated price is explained in visible text"`

**C422** - No pt-BR value and no e-mail template string contains a gendered word about the player from the banned list: "bem-vindo", "bem-vinda", "conectado", "conectada", "logado", "logada" (AC 270) · done
Proof: `web unit src/i18n/__tests__/locale-copy-rules.spec.ts -t "no value gives the player a gender"`
Proof: `api unit src/email/__tests__/email-templates.spec.ts -t "no template gives the player a gender"`

### S37 - Every game word one tap from an explanation · 24 files · 76 KB · ~39k

**C423** - On the deck analysis block, "Pitch" and "Curva de custo" are each followed by one button named "O que é Pitch?" and "O que é Curva de custo?"; a second "Pitch" on the same screen has no button (AC 271) · done
Proof: `web unit src/components/glossary/__tests__/GlossaryTerm.spec.tsx -t "only the first appearance on a screen gets a question mark"`

**C424** - On a 390 px phone the "?" after "Pitch" draws a 20 px circle and its tap target's bounding box is at least 44 by 44 px (AC 271) · done
Proof: `web e2e --project=mobile-390 tests/mobile/glossary.spec.ts -g "the question mark is 20 px drawn and 44 px to tap"`

**C425** - Clicking the "?", Enter on it, and Space on it each open a dialog whose title is "Pitch", with the sentence of `.design/copy-and-access.md` for Pitch, the line "No seu deck: 14 vermelhas, 9 amarelas, 8 azuis." for a deck of 14 red, 9 yellow and 8 blue, then "Ver todos os termos" and "Fechar"; with a phone viewport it is a bottom sheet, with a computer viewport a popover anchored to the word (AC 272) · done
Proof: `web unit src/components/glossary/__tests__/GlossaryTerm.spec.tsx -t "opens by click, Enter and Space with the player's own line"`
Proof: `web e2e --project=mobile-390 tests/mobile/glossary.spec.ts -g "a bottom sheet on the phone"`
Proof: `web e2e --project=e2e-chromium tests/e2e/termos.spec.ts -g "a popover on a computer"`

**C426** - The player's own line follows the data: "Seu deck Rhinar Blitz v2 continua salvo com as 12 cartas." for "Aposentado" on a 12-card deck named "Rhinar Blitz v2"; "Este deck do Pedro é de Classic Constructed." for "Classic Constructed" on a shared deck by Pedro; and the sentence alone when the page has no data for the word (AC 272) · done
Proof: `web unit src/components/glossary/__tests__/GlossaryTerm.spec.tsx -t "the own-data line follows the page"`

**C427** - Closing by Escape, by a tap outside and by "Fechar" each return focus to the "?" that opened it (AC 273) · done
Proof: `web unit src/components/glossary/__tests__/GlossaryTerm.spec.tsx -t "focus returns to the question mark on every close"`

**C428** - In the stage menu the "?" after "Aposentado" is a separate button; clicking it opens the "Aposentado" sheet and the deck's stage stays unchanged (the change handler is not called); clicking the option text still picks "Aposentado" (AC 274) · done
Proof: `web unit src/components/deck-detail/__tests__/StatusDropdown.spec.tsx -t "the question mark never picks the option"`

**C429** - The pt-BR glossary namespace has exactly the 31 words of `.design/copy-and-access.md` "The explanations", each sentence equal to the table cell character for character (AC 275) · done
Proof: `web unit src/i18n/__tests__/glossary-catalog.spec.ts -t "the 31 explanations match the design document word for word"`

**C430** - `/termos` opened signed out answers `200`, stays on `/termos` (no redirect to sign-in) and shows the LSS notice at the foot (AC 275; Surface `/termos`) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/termos.spec.ts -g "the glossary is public"`

**C431** - The page shows, in order: the title "Termos do jogo", the line "O que querem dizer as palavras do jogo.", a search field labelled "Procurar uma palavra", then the 31 words in the order of `localeCompare(..., 'pt-BR')`, first "Ação" and last "Vermelho, Amarelo, Azul", each with its sentence (AC 275, AC 279; screen `r2-glossary-phone`) · done
Proof: `web unit src/routes/__tests__/termos.spec.tsx -t "lists every word in Portuguese alphabetical order"`

**C432** - Opened by "Ver todos os termos" from the deck page `/decks/<id>`, the page's back control returns to `/decks/<id>`; opened from Pedro's shared list it reads "Voltar para a lista do Pedro" and returns to that list (AC 275, AC 279) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/termos.spec.ts -g "the back control returns to where the player came from"`

**C433** - Searching "xyz" shows "Nenhuma palavra com \"xyz\". Veja a lista completa abaixo." above the full list; `/termos?q=Blitz` opens with "Blitz" in the field and the entry "Blitz" listed (AC 276; Surface `q?`) · done
Proof: `web unit src/routes/__tests__/termos.spec.tsx -t "a search with no match says so and keeps the list"`
Proof: `web unit src/routes/__tests__/termos.spec.tsx -t "the q parameter fills the search"`

**C434** - `/termos#pitch`, as "Ver todos os termos" opens it from the "Pitch" sheet, loads with the "Pitch" entry inside the viewport (AC 277; Surface `#word`) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/termos.spec.ts -g "opened from a question mark it scrolls to the word"`

**C435** - In the missing list, "Pack Hunt (Vermelho)", "(Amarelo)" and "(Azul)" are followed by no button named "O que é Vermelho?", "O que é Amarelo?" or "O que é Azul?" (AC 278) · done
Proof: `web unit src/components/deck-detail/__tests__/MissingPanel.spec.tsx -t "no question mark on the pitch word of a card name"`

**C436** - Screen `r2-pitch-sheet-phone`: the deck header "Rhinar - Blitz" with "Blitz" and "Montando", the line "31 de 40 cartas no deck · coloque mais 9", then "Pitch ?" with "Vermelho 14 · Amarelo 9 · Azul 8", then "Curva de custo ?" with the bars 0, 1, 2, 3, 4+; the open sheet reads, in order, "Pitch", the Pitch sentence, "No seu deck: 14 vermelhas, 9 amarelas, 8 azuis.", "Ver todos os termos", "Fechar" (AC 279) · done
Proof: `web unit src/components/deck-detail/__tests__/DeckAnalysisRow.spec.tsx -t "matches r2-pitch-sheet-phone"`

**C437** - Screen `b2-stage-retire-phone`: the stage menu lists, in order, "Ideia", "Montando", "Pronto", "Jogando", "Aposentado" followed by its "?"; the open sheet reads, in order, "Aposentado", the table's sentence ("Etapa de um deck que você não usa mais. Ele fica no grupo Aposentados, salvo com as cartas, e volta a ser usado quando você quiser."), "Seu deck Rhinar Blitz v2 continua salvo com as 12 cartas.", "Ver todos os termos", "Fechar" (AC 272, AC 279) · done
Proof: `web unit src/components/deck-detail/__tests__/StatusDropdown.spec.tsx -t "matches b2-stage-retire-phone"`

**C438** - Screen `r2-glossary-phone` signed out: the top bar has "Entrar"; below it "‹ Voltar", "Termos do jogo", "O que querem dizer as palavras do jogo.", "Procurar uma palavra", "Voltar para a lista do Pedro", the 31 entries, then the LSS notice and "Sobre", in that order (AC 279) · done
Proof: `web unit src/routes/__tests__/termos.spec.tsx -t "matches r2-glossary-phone"`

**C439** - The menu offers "Termos do jogo" linking to `/termos`, and the shared pages' foot offers "O que querem dizer estas palavras?" linking to `/termos` (AC 275) · done
Proof: `web unit src/components/shell/__tests__/TopBar.spec.tsx -t "the menu links Termos do jogo"`
Proof: `web unit src/components/shared-deck/__tests__/SharedDeckPage.spec.tsx -t "the foot links the glossary"`

**C440** - The axe scan list gains `/termos` and a deck page with the "Pitch" sheet open, and both have zero `serious` or `critical` issues (AC 3, AC 279) · done
Proof: `web e2e --project=e2e-chromium tests/e2e/accessibility.spec.ts -g "no serious or critical axe issue on the glossary"`

### S38 - Housekeeping on a schedule kept in the repository · 7 files · 31 KB · ~14k

**C441** - The worker's main passes `runWorkerLoops` a step list that includes the housekeeping step and the availability-pass step, next to today's variant, recommendation, chat and reference steps (AC 280; door 5) · done
Proof: `api unit src/stores/__tests__/variant-queue-worker.main.spec.ts -t "registers the housekeeping and availability-pass steps"`

**C442** - One housekeeping tick deletes: a user with `deletedAt` 31 days ago with its imports, pending lines, copies, lists and lines, decks and deck lines, sessions and sign-in codes; a deck with `deletedAt` 31 days ago with its cascades; consumed sign-in codes; codes past `expiresAt`; sessions with `revokedAt` set. The same tick keeps a user and a deck deleted 29 days ago, a live code and a live session (AC 281; door 5) · done
Proof: `api e2e src/housekeeping/__tests__/housekeeping.e2e-spec.ts -t "one tick removes what is 30 days gone and what has ended"`

**C443** - Two housekeeping ticks started at once delete each row once: the logged deleted counts of both ticks sum to the rows seeded, and the tick that does not get the lock deletes nothing and throws nothing (AC 282; door 5) · done
Proof: `api e2e src/housekeeping/__tests__/housekeeping.e2e-spec.ts -t "two workers at once delete each row once"`

**C444** - A tick whose delete throws logs one error with the step name and leaves the loop running; the next tick deletes the rows (Observable "scheduled housekeeping step") · done
Proof: `api unit src/housekeeping/__tests__/housekeeping.step.spec.ts -t "a failed tick logs and the next tick retries"`

**C445** - Setting a deck's `deletedAt` to 31 days ago and running one tick leaves no `tracked_deck` row with that id (S38 independent test) (AC 281) · done
Proof: `api e2e src/housekeeping/__tests__/housekeeping.e2e-spec.ts -t "a deck deleted 31 days ago is gone after one tick"`

**C446** - A deck deleted 30 days and 1 minute ago is removed for good by the housekeeping step with its cascades, and a deck deleted 29 days ago stays (AC 54; door 4; moved here from S8, because the housekeeping step is built in S38) · done
Proof: `api e2e src/housekeeping/__tests__/housekeeping.e2e-spec.ts -t "deletes decks soft-deleted 30 days ago"`

### S39 - The counts the reviews need · 9 files · 52 KB · ~19k

**C447** - When an import finishes, one log entry with `event: "import.finished"` carries `kind`, `linesRead`, `ready`, `asked` and `kept`; for a `paste` of 5 lines with 3 ready, 1 asked and 1 kept the values are `paste`, 5, 3, 1, 1; a `product` import adds `productKey`; a `fabrary` import adds `ownership` with the answer given (AC 283) · done
Proof: `api e2e src/__tests__/review-counts.e2e-spec.ts -t "each import kind logs what it read"`

**C448** - Resolving and deleting a "Para resolver" line each log one entry with `event: "import.pending_line"`, the `sourceId`, and `action` `resolved` or `deleted` (AC 284) · done
Proof: `api e2e src/__tests__/review-counts.e2e-spec.ts -t "a resolved or deleted pending line is logged"`

**C449** - Serving `GET /api/decks/:deckId/missing` to the owner logs one entry with `event: "missing.served"`, the `deckId`, and the copies per store state with the keys `priced`, `store_lacks`, `not_on_site`, `looking_up`, `no_price` (AC 285) · done
Proof: `api e2e src/__tests__/review-counts.e2e-spec.ts -t "the owner's missing list logs copies per store state"`

**C450** - "Oferecer", "Ver mensagem e enviar" on a quote and "Quero estas" record one `share_event` each with `kind` `offer`, `quote_sent` and `buy`, the link's `intent`, and `actorUserId` set for a signed-in visitor and null for an anonymous one; the owner of the link doing the same records nothing (AC 286) · done
Proof: `api e2e src/__tests__/sharing.e2e-spec.ts -t "offer, quote_sent and buy are recorded with intent and visitor, never for the owner"`

**C451** - Creating a sell list from "Sobrando" logs `origin: "spare"`; marking a line sold logs the collection answer given; setting the spare rule logs the rule and `firstAnswer: true`, and changing it logs `firstAnswer: false` (AC 287) · done
Proof: `api e2e src/__tests__/review-counts.e2e-spec.ts -t "spare lists, sold lines and the spare rule are logged"`

**C452** - The share report's query, run on 1 `offer` and 1 `buy` for a `want` list and 1 `quote_sent` for a deck `quote` link, returns the rows `offer` 1, `buy` 1 and `quote_sent` 1 under their intent and list kind, and `scripts/share-report.ts` prints them through that same query (AC 288) · done
Proof: `api e2e src/sharing/__tests__/share-report-queries.e2e-spec.ts -t "the report counts offer, quote_sent and buy by intent and list kind"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| dashes banned in pt-BR values (2) | U+2014 C1 · U+2013 C1 | - |
| banned words and literals (5) | `troca` C2 · `trocas` C2 · `trocar` C2 · "Manual entries" C2, C4 · "Attack Actions" C2 | - |
| namespaces where "troca" is banned (3) | `home` C2 · `auth` C2 · `onboarding` C2 | - |
| values S1 rewrites (10) | `home.emptyLead` C3 · `home.step2Body` C3 · `auth.decorationCopy` C3 · `onboarding.step2BodySingle` C3 · `onboarding.step2BodyMultiple` C3 · `onboarding.congratsBody` C3 · `deckDetail.groupAttack` C3 · `deckDetail.groupNonAttack` C3 · `decks.partialUpdateMsg` C3 · `lists` "R$ —" (2 keys) C3 | - |
| axe impacts (4) | `minor` dropped C6 · `moderate` dropped C6 · `serious` kept C6 · `critical` kept C6 | - |
| S1's scan list (5) | home C7 · deck page C7 · Library C7 · shared deck page C7 · sign-in C7 | - |
| scan list pages added by S1, S2, S36 and S37's slices (2) | `/termos` C440 · deck page with the "Pitch" sheet open C440 | - |
| door 18 `@axe-core/playwright` (2 facts) | in `devDependencies` C8 · run inside the Playwright suite C7 | - |
| door 19 `web-e2e` job (5 facts) | job exists C9 · `postgres:16` C9 · `playwright install --with-deps chromium` C9 · `playwright test --project=e2e-chromium` C9 · not `continue-on-error` C9 | - |
| pitch values to names (5) | 1 C10 · 2 C10 · 3 C10 · `null` C10, C11 · 0 C10 | - |
| surfaces naming a card (12) | deck page tile C15 · editor C15 · missing list C12 · "Já tenho" C13 · shopping list C14 · Library C15 · shared deck C15 · shared missing C15 · shared list C15 · lists C15 · Tutor proposal C15 · swap toast C16 | - |
| files holding a pitch map today (4) | `CardFace.tsx` C17 · `AlternativesSheet.tsx` C17 · `DeckAnalysisRow.tsx` C17 · `card-naming.ts` C17 | - |
| reason relations (5) | same pitch C413, C414 · different pitch C413, C414 · shared class C413, C414 · Generic candidate C413, C414 · no shared class C413, C414 | - |
| card lists sharing one grouping (3) | deck page C417 · Library C417 · shared deck page C417 | - |
| pages with one `main` (2) | deck page C419 · `/library-csv-sources` C419 | - |
| free-copy counts (3 edges) | 0 C420 · 1 C420 · 2 C420 | - |
| native `title=` tooltips today (5) | `ShoppingLine.tsx:234` C421 · `ShoppingLine.tsx:250` C421 · `MissingStoreSummary.tsx:58` C421 · `MissingStoreSummary.tsx:78` C421 · `LibraryStatsBar.tsx:69,91` C421 | - |
| "?" open triggers (3) | click C425 · Enter C425 · Space C425 | - |
| sheet close ways (3) | Escape C427 · tap outside C427 · "Fechar" C427 | - |
| sheet presentation (2) | phone bottom sheet C425 · computer popover C425 | - |
| own-data lines (4) | Pitch counts C425 · Aposentado C426 · Classic Constructed C426 · none C426 | - |
| glossary words (31) | C429, table-driven over all 31 against the design document | - |
| ways into `/termos` (4) | "Ver todos os termos" C432, C434 · menu "Termos do jogo" C439 · shared pages' foot C439 · direct address C430 | - |
| `/termos` statuses (1) | `200` C430 | - |
| `/termos` inputs (2) | `q?` C433 · `#word` C434 | - |
| pitch words with no "?" (3) | "(Vermelho)" C435 · "(Amarelo)" C435 · "(Azul)" C435 | - |
| binding screens (3) | `r2-pitch-sheet-phone` C436 · `b2-stage-retire-phone` C437 · `r2-glossary-phone` C431, C438 | - |
| `PUT /api/decks/:deckId` statuses (3) | `200` C52 · `400` C53, C54 · `404` C55 | - |
| `DELETE /api/decks/:deckId` statuses (2) | `200` C86 · `404` C87 | - |
| `GET /api/decks/deleted` statuses (2) | `200` C88 · `401` C88 | - |
| `POST /api/decks/:deckId/restore` statuses (2) | `200` C89 · `404` C90 | - |
| `DELETE /api/decks/:deckId/permanent` statuses (2) | `204` C91 · `404` C91 | - |
| `POST /api/decks/:deckId/duplicate` statuses (2) | `201` C79 · `404` C80 | - |
| door 3 literal shape (4) | column `int not null default 0` C50 · check constraint C50, C51 · Fabrary `sideboardQuantity` stored there C60 · readers count it (readiness) C61 | - |
| door 4 literal shape (4) | `deletedAt timestamptz null` C85 · every deck read filters it C86, C92 · `SharedDeckLookup.findLive` C93 · hard delete after 30 days C446 | - |
| door 9 literal shape (5) | `format` C110 · `effectiveDate 'YYYY-MM-DD'` C110 · `summaryKey` C111 · `sourceUrl` C110, C111 · nothing else prints a date C112, C113 | - |
| Relations constraints owned (2) | `deck_card` one row per deck, card and slot C54, C42 · `deck_card` deck plus inventory above 0 C51 | - |
| copy limit per format (4) | Classic Constructed C19 · Living Legend C19 · Silver Age C19 · Blitz C19 (table-driven over 4) | - |
| copy limit special cases (2) | Legendary C21 · restricted in Living Legend C21 | - |
| slots counted for copies (4) | `mainboard` C19 · inventory C19 · `weapon` C19 · `equipment` C19 | - |
| pool limit per format, 2 edges each (8) | CC 80, 81 C22 · LL 80, 81 C22 · Blitz 52, 53 C22 · SA 55, 56 C22 (table-driven over 8) | - |
| `category` values (4) | `legal` C24 · `incomplete` C24 · `illegal` C24, C31 · `unchecked` C28, C29, C30 | - |
| per-card checks per slot (3) | ban C25 · format C25, C26 · hero scope C25 | - |
| "+" disabled reasons (3) | "Máximo 1 no Blitz" C33 · "Máximo 1: carta lendária" C33 · "Máximo 1 em Living Legend: carta restrita" C33 | - |
| checklist line kinds (3) | green C37 · red with "Ir para a carta" C37, C39 · neutral size C37 | - |
| sheet close ways (3) | handle C40 · "Fechar" C40 · scroll does not close C40 | - |
| inventory row menu moves (4) | 1 to inventory C59 · all to inventory C59 · 1 to deck C59 · all to deck C59 | - |
| missing split surfaces (5) | deck page C62 · missing list C222 · shopping list C223 · group ask C249 · quote page, total only C240 | - |
| missing filters (3) | "Todas" C222 · "Do deck" C222 · "Do inventário" C222 | - |
| home card states (4) | no problem full C65 · no problem short C65 · rule problem C66 · format outside the four C72 | - |
| cause line rows (7) | copies same count C67 · copies mixed C67 · banned C67 · out of format C67 · hero C67 · more than two kinds C67 · singular C67 (table-driven over 7) | - |
| stage values (5) | Ideia C69 · Montando C69 · Pronto C69 · Jogando C69 · Aposentado C69 | - |
| copy list tabs (2) | "Para o grupo" C74, C76 · "Para Fabrary ou Talishar" C74, C77 | - |
| group text sections (5) | Herói C76 · Arma C76 · Equipamentos C76 · "Deck (60 cartas)" C76 · "Inventário (15 cartas, fora do deck)" C76 | - |
| Fabrary text headings (5) | Hero C77 · Weapon C77 · Equipment C77 · Deck C77 · Inventory C77 | - |
| restore brings back (5) | cards C89 · inventory C89 · replacements C89 · tags C89 · share links C89, C93 | - |
| deleted-deck readers (7) | readiness C92 · home counts C92 · spare copies C266 · Tutor C92 · recommendations C92 · job drains C92 · share addresses C93 | - |
| delete entry points (2) | home trash C94 · "Excluir deck" in "⋯" C95 | - |
| new deck starts (3) | "Comprei um deck pronto" C101 · "Tenho um link do Fabrary" C101 · "Começar do zero" C101 | - |
| hero outside the format outcomes (3) | another format valid C105, C106 · no format valid C107 · undo C106 | - |
| rule-change notice states (4) | curated entry C111 · no entry C116 · fixed in one tap C114 · fixed by hand C115 | - |
| journey 3 binding screens (18) | `r3-editor-phone` C48 · `r3-checklist-phone` C37 · `r3-inventory-desktop` C56 · `r2-missing-desktop` C222 · `r3-stage-a-phone` C71 · `r3-deck-actions-desktop` C84 · `r2-export-desktop` C77 · `r3-export-group-desktop` C76 · `r2-list-view-desktop` C82 · `r2-delete-toast-phone` C100 · `r2-deleted-list-phone` C98 · `r2-new-deck-hero-phone` C102 · `r2-new-deck-format-phone` C103 · `r2-retired-hero-desktop` C105 · `r3-retired-hero-switched-desktop` C106 · `r3-shared-phone` C108 · `r3-rule-changed-deck-phone` C118 · `r2-one-each-phone` C118 | - |
| `POST /api/collection/imports/read` statuses (3) | 200 C146 · 400 C146 · 413 C146 | - |
| `POST /api/collection/imports` statuses (3) | 201 C148 · 400 C148 · 409 C148 | - |
| `GET /api/collection/pending` statuses (2) | 200 C151 · 401 C151 | - |
| `PATCH /api/collection/pending/:id` statuses (3) | 200 C151 · 400 C151, C133 · 404 C151 | - |
| `DELETE /api/collection/pending/:id` statuses (2) | 204 C151 · 404 C151 | - |
| `GET /api/products` statuses (1) | 200 C159 | - |
| `POST /api/products/:productKey/import` statuses (3) | 201 C162 · 404 C163 · 409 C163 | - |
| `POST /api/decks/import` statuses (4) | 201 C169 · 400 C170 · 404 C171 · 502 C171 | - |
| `PATCH /api/collection/sources/:id/versions` statuses (3) | 200 C126 · 400 C127 · 404 C127 | - |
| `PATCH /api/collection/cards/:cardIdentifier/versions` statuses (3) | 200 C132 · 400 C132, C133 · 404 C132 | - |
| `POST /api/collection/cards/batch` statuses (2) | 201 C134 · 400 C134, C133 | - |
| `POST /api/collection/cards/decrement` statuses (3) | 201 C136 · 400 C136 · 404 C136 | - |
| door 1 version columns (8) | `collection_card.printingCode` C119 · `collection_card.edition` C119 · `collection_card.finish` C119 · `collection_card.condition` C119 · `card_list_line.printingCode` C119 · `card_list_line.edition` C119 · `card_list_line.finish` C119 · `card_list_line.condition` C119 | - |
| door 1 `finish` values (5) | `''` C120 · `none` C120 · `rainbow` C120 · `cold` C120 · `gold` C120 | - |
| door 1 `edition` values (4) | `''` C120 · `first` C120 · `unlimited` C120 · `alpha` C120 | - |
| door 1 `condition` values (6) | `''` C120 · `NM` C120 · `LP` C120 · `MP` C120 · `HP` C120 · `DMG` C120 | - |
| door 1 unique key and increment (3) | seven-column unique C121 · `ON CONFLICT` on `''` C122 · 20-copy cap C122 | - |
| door 1 `card_list_line.printing` split (2) | readable key C123 · unreadable key kept and logged C123 | - |
| door 6 import kinds (5) | `csv` C185 · `paste` C185 · `product` C185, C162 · `fabrary` C185, C169 · `manual` C185 | - |
| door 6 other (2) | `productKey` nullable C167 · existing Fabrary rows become `fabrary` C185 | - |
| door 7 `import_pending_line` (2) | shape C152 · cascade from its import C152 | - |
| door 8 product file (3) | shape and kinds `armory`, `blitz`, `silver_age` C158 · written by `products:import` C166 · no tokens C158, C165 | - |
| Relations `collection_card` -> `csv_source` (1) | holds copies, unique per version C121 | - |
| Relations `csv_source` -> `import_pending_line` (1) | cascade C152 | - |
| Relations `card_list` -> `card_list_line` versions (1) | four fields C119, C123 | - |
| reader line outcomes (5) | `ready` C140, C153 · `asks_color` C140 · `suggestion` C141 · `not_found` C141, C143 · `bad_quantity` C154 | - |
| pitch tokens (10) | `(Red)` · `red` · `(Yellow)` · `(Blue)` · `vermelho` · `Amarelo` · `azul` · `(1)` · `(2)` · `(3)`: C139, table-driven over all 10 | - |
| CSV headers (12) | `nome` · `quantidade` · `cor` · `versão` · `estado` · `name` · `card name` · `quantity` · `qty` · `count` · `set` · `set code`: C144, table-driven over all 12 | - |
| quantity bound (3 edges) | 20 C153 · 21 or above C153 (25) · word up to twenty C154 | - |
| Fabrary link forms (8) | C168, table-driven over all 8 | - |
| ownership answer (3) | `true` C169 · `false` C169 · missing or not boolean C170 | - |
| product switches (3 combinations) | both on C162 · cards only C162 · deck only C162 | - |
| version writes that refuse an unknown printing (3 routes) | card versions C133 · batch C133 · pending resolve C133 | - |
| scanner questions (2) | edition when more than one C135 · "É foil?" when a foil finish exists C135 | - |
| plural forms (9) | cartas importadas, cópias, linhas para resolver at 0, 1, 2: C184, table-driven over all 9 | - |
| screens of journey 2 (12) | `r3-version-bulk-phone` C129 · `r3-version-card-phone` C131 · `r3-imports-phone` C181, C138 · `r3-list-phone` C155 · `r3-report-phone` C156 · `r3-pending-phone` C157 · `r3-first-run-phone` C178 · `r3-product-search-phone` C160 · `r3-product-confirm-phone` C161 · `r3-add-phone` C180, C177 · `r3-fabrary-found-phone` C173 · `r4-resolve-b-phone` C453 | - |
| states drawn nowhere, from `.design/collection-in.md` (7) | "É foil?" C135 · "Você já adicionou <product>" C164 · Fabrary not found and unreachable C175 · "−" picker inside the screen C137 · skipped cards list C128 · unreadable CSV C147 · 20-copy cap note C153 | - |
| store states (5) | `priced` C186 · `store_lacks` C186 · `not_on_site` C186 · `looking_up` C186 · `no_price` C186 | - |
| Store answers decision rows (9) | pass-listed stocked C186 · newer zero-stock lookup C186 · absent from latest pass C186 · newer stocked lookup over absence C186 · no row C186 · no product URL C186 · pending lookup C186 · budget stopped C186 · lookup failed C186 | - |
| row copy per state (5) | `priced` C208 · `store_lacks` C208 · `not_on_site` C208 · `looking_up` C208 · `no_price` C208 | - |
| `STORE_PRICE_VALID_DAYS` edges (3) | 29 days C188 · 31 days C188 · env override C188 | - |
| `STORE_AVAILABILITY_PASS_DAYS` edges (4) | null C193 · 6 days C193 · 8 days C193 · env override C193 | - |
| budget remainder edges (2) | 150 left C195 · 149 left C195 | - |
| budget warning per month (3) | first open C195 · second open same month C195 · next month C195 | - |
| credits per call kind (4) | product page C197 · listing page C197 · env override C197 · `direct` provider C197 | - |
| retry cooldown edges (2) | 59 minutes C198, C194 · 61 minutes C198, C194 | - |
| public pages that never queue (2) | `missing` C199 · `quote` C199 | - |
| missing-list chips (7) | "Comprar na loja" C207 · "A loja não tem" C207 · "Fora do site" C207 · "Já tenho" C207 · "No lugar" C207 · "Sem preço" C207 · "Buscando" C207 | - |
| chip sum decks (7) | all priced C205 · all owned C205 · shortfall C205 · stand-in C205 · `looking_up` C205 · `no_price` C205 · inventory only C205 | - |
| r3 screens of journey 4 (11) | `r3-deck-phone` C203 · `r3-list-phone` C219 · `r3-list-desktop` C220 · `r3-tenho-phone` C219, C214 · `r3-copy-phone` C218 · `r3-share-phone` C236, C224 · `r3-message-phone` C236 · `r3-group-phone` C236, C230 · `r3-group-friend-phone` C236, C231 · `r3-offer-phone` C236, C232 · `r3-quote-phone` C248, C240 | - |
| r5 screens of journey 4 (1) | `r5-credits-b-phone` C454 | - |
| share sheet intents (3) | `deck` C224 · `missing` C224 · `quote` C224, C237 | - |
| group message blocks (5) | store-cannot-supply lines C225 · "Também procuro" C225 · closing line C225, C227 · "Lista completa" C225 · 30-line cut C225 | - |
| copies the store cannot supply (3) | `store_lacks` C225 · shortfall of `priced` C225 · `not_on_site` C225 | - |
| store-side states in the optional block (3) | `priced` C226 · `looking_up` C226 · `no_price` C226 | - |
| group page viewers (3) | signed out C230 · signed-in visitor C231 · owner C233 | - |
| offer delivery (3) | single to WhatsApp C232 · combined to WhatsApp C232 · no number, copied C232 | - |
| quote delivery (2) | WhatsApp C244 · copied C244 | - |
| quote draft storage (3) | same token restored C243 · other token empty C243 · storage throws C243 | - |
| refused through a `quote` address (3) | `/coverage` C246 · `/matches` C246 · `/copy` C246 | - |
| `PUT /api/collection/owned` statuses (3) | 200 C215 · 400 C216 · 404 C216 | - |
| `GET /api/decks/:deckId/missing` statuses (2) | 200 C204 · 404 C204 | - |
| `POST /api/decks/:deckId/fetch-variants` statuses (1) | 404 C202 | - |
| `POST /api/decks/:deckId/replacements` statuses (4) | 201 C211 · 400 C211 · 404 C211 · 409 C211 | - |
| `GET /api/shared/decks/:token` statuses (2) | 200 C229, C239 · 404 C246 | - |
| `GET /api/shared/decks/:token` intents (3) | `deck` C64 · `missing` C229 · `quote` C239 | - |
| `POST /api/shared/:kind/:token/events` statuses (3) | 204 C235, C242 · 400 C235, C242 · 404 C235 | - |
| event kinds on that route (3) | `offer` C235 · `quote_sent` C242 · `buy` C450 | - |
| `PATCH /api/users/me/share-closing-line` statuses (2) | 200 C228 · 400 C228 | - |
| `GET /api/admin/stores/:slug/credits` statuses (2) | 200 C200 · 403 C200 | - |
| door 2 shape (5) | `quantity` set by caller C211, C212 · `side` column and default C213 · `side` check C213 · `decideAdoption({quantity?, side?})` C212 · omitted means today C211, C212 | - |
| door 10 shape (6) | `store_stock.listedInStockAt` C191 · `store.lastAvailabilityPassAt` C191 · `firecrawl_usage` primary key C192 · atomic `ON CONFLICT` increment C192 · `variant_fetch_job.cardIdentifier` C190 · partial unique pending index C190, C189 | - |
| door 11 shape (4 checks) | `CHK_share_link_intent_valid` C238 · `CHK_share_event_intent_valid` C238 · `CHK_share_event_kind_valid` C238 · `CHK_user_referred_via_valid` C238 | - |
| Relations constraints owned (3) | `variant_fetch_job` one pending per card C190 · `firecrawl_usage` one row per month C192 · `card_replacement.side` C213 | - |
| spare rule -> held copies (4) | `within_format` C250 · `any_deck` C250 · `per_deck` C250 · null C255 | - |
| deck status -> holds copies (5) | `idea` C251 · `building` C251 · `ready` C251 · `active` C251 · `retired` C251 | - |
| what a deck holds (2 sides) | deck C250 · inventory C252 | - |
| foil order a deck holds first (3 finishes drawn) | `cold` C254 · `rainbow` C254 · regular `none` C254 | - |
| when the rule is asked (2) | two holding decks share a card C255, C259 · none share C255, C260 | - |
| spare readers (4) | "Sobrando" C265 · want-list trade view C265, C295 · group page C265 · Tutor C265 | - |
| finish answers (4) | "Sem foil" C273 · "Foil" C273 · "Não sei" C273 · unanswered C273 | - |
| finish question applies (3) | card in foil, finish unknown C272 · card in no foil C272 · finish known C272 | - |
| closing line states (2) | never set C274 · last line stored C274 | - |
| message line price form (2) | one copy C276 · more than one C276 | - |
| message length (2 edges) | 30 lines C276 · 35 lines C276 | - |
| "Incluir o total" (2) | on C275 · off C276 | - |
| store reference by finish (4) | `''` C280 · `none` C280 · foil C280 · no Cúpula DT price C280 | - |
| "Ver na LigaFAB" places (3) | "Sobrando" C281 · draft C281 · public sell list (absent) C281 | - |
| price filter (3) | todas C269 · acima de R$ 5 C269 · acima de R$ 20 C269 | - |
| sort (2) | maior preço C269 · nome C269 | - |
| sale quantity (4 edges) | 0 C284 · 1 of 3 C284 · 3 of 3 C284 · 4 of 3 C284 | - |
| removal order (2) | same version C285 · no version C285 | - |
| collection answer (2) | "Sim, tirar N" C285, C291 · "Não, só marcar" C284 | - |
| removal edge cases (3) | holding deck left short C289 · fewer held than sold C286 · more than one import C287, C290 | - |
| visitor kinds on a shared list (3) | anonymous C295 · signed-in C292, C295 · owner C295, C302 | - |
| shared list kinds (2) | sell C292 · want C297 | - |
| "Incluir minha lista" (2) | on C298, C299 · off C298, C299 | - |
| sharer contact on a visitor message (2) | number shown C294 · no number C300 | - |
| contact saved when sharing (2) | none C301 · saved C301 | - |
| copy variant (3) | `original` C305 · `as_built` C305 · absent C306 | - |
| replacement side rebuilt (2) | `deck` C305 · `inventory` C305 | - |
| multiplier locale (2) | pt-BR C307 · en-US C307 | - |
| "Nova lista" Vendo starts (3) in order | spare C309 · De um deck C309 · Do zero C309 | - |
| door 12 columns (3) | `spareRule` C258, C257 · `sellClosingLine` C258, C279 · `shareClosingLine` C258 | - |
| `GET /api/collection/spare` statuses (2) | 200 C255, C256 · 401 C256 | - |
| `PUT /api/users/me/spare-rule` statuses (2) | 200 C257 · 400 C257 | - |
| `PATCH /api/users/me/sell-closing-line` statuses (2) | 200 C279 · 400 C279 | - |
| `POST /api/lists/:listId/lines` statuses (3) | 201 C278 · 400 C278 · 404 C278 | - |
| `POST /api/lists/:listId/lines/:lineId/sold` statuses (4) | 200 C284 · 400 C284, C287 · 404 C284 · 409 C284 | - |
| `GET /api/shared/lists/:token` statuses (2) | 200 C295 · 404 C296 | - |
| `POST /api/shared/decks/:token/copy` statuses (3) | 201 C306 · 400 C306 · 404 C306 | - |
| binding screens of journey 5 (17) | `r3-library-banner-phone` C261 · `r3-spare-rule-phone` C259 · `r3-why-spare-phone` C262 · `r3-spare-page-empty-phone` C267 · `r3-spare-page-phone` C268 · `r3-sell-draft-phone` C271 · `r3-sell-draft-answered-phone` C272 · `r3-message-phone` C275 · `r3-lists-new-phone` C309 · `r3-sold-phone` C288 · `r3-buyer-phone` C292 · `r3-buyer-message-phone` C294 · `r3-trade-visitor-phone` C297 · `r3-offer-message-phone` C299 · `r3-share-contact-phone` C301 · `r3-saved-deck-phone` C303, C304 · journey 3 note (inventory in "Por que sobra?") C263 | - |
| `GET /api/chat/conversations/:id` statuses (3) | `200` C324 · `400` C334 · `404` C325 | - |
| door 13 payload fields (4) | `quantity` C322 · `side` C322 · `missingBefore` C322 · `missingAfter` C322 | - |
| door 13 behaviour (2) | computed at validation, not on read C324 · stale when the deck no longer allows it C331 | - |
| swap `side` values (2) | `deck` C323, C326, C329 · `inventory` C322, C323, C329 | - |
| swap validation refusals (4) | quantity 0 C323 · quantity above the side C323 · side outside the enum C323 · replacement over its limit C323 | - |
| `get_swap_candidates` needed rule (3) | quantity given C315 · none, over the limit C315 · none, within the limit C315 | - |
| `get_prices` argument shapes (5) | `{cardIdentifiers}` C318 · `{deckId}` C313 · `{deckId, cardIdentifiers: []}` C313 · `{}` C313 · deck with no stored readiness C313 | - |
| `search_cards` fields (5) | name C319 · text C319 · type C314 · class C314 · talent C314 | - |
| `search_rules` match paths (4) | exact number C312 · all words C312 · OR fallback C312 · nothing found at all C320 | - |
| prompt statements (4) | name and pitch C311 · Cúpula DT C311 · rules in English C311 · why the card fits C311 | - |
| deck stages holding spare copies, as the Tutor reads them (5) | `idea` C316 · `retired` C316 · `building` C316 · `ready` C251 · `active` C251 | - |
| ready-question hero source (2) | bound deck C317 · latest deck C317 | - |
| incoming card's free copies (2) | 0 C327 · 2 C327 | - |
| incoming card's price (2) | priced C327 · no price C327 | - |
| proposal card statuses (4) | `pending` C332 · `applied` C330, C332 · `dismissed` C333 · `stale` C331 | - |
| tile first question by deck state (3) | rule problem C335 · short only C335 · neither C335 | - |
| Tutor flag on the deck page (2) | with C338, C335 · without C336, C338 | - |
| eval scenarios (6) | `copy-rule-pack-hunt` C342 · `one-copy-swap` C342 · `deck-price` C342 · `ready-hero` C342 · `ready-next-hero` C342 · `ready-triggers` C342 | - |
| binding screens of journey 6 (4) | `r2-proposal-desktop` C332 · `r2-applied-desktop` C332 · `b2-deck-ask-phone` C340 · `a2-deck-ask-phone` C340 | - |
| `POST /api/auth/start` statuses (3) | 200 C349 · 400 C349 · 429 C350 | - |
| `POST /api/auth/sign-up` statuses (4) | 201 C352 · 400 C400 · 409 C356 · 429 C404 | - |
| `POST /api/auth/sign-in` statuses (3) | 200 C371 · 401 C368 · 429 C405 | - |
| `POST /api/auth/codes` statuses (3) | 202 C361 · 400 C402 · 429 C404 | - |
| `POST /api/auth/codes/verify` statuses (5) | 200 C363 · 400 C365 · 401 C365 · 410 C365 · 429 C406 | - |
| `POST /api/auth/codes/redeem` statuses (3) | 200 C363 · 401 C363 · 410 C363 | - |
| `POST /api/auth/sign-out` statuses (2) | 204 C378 · 401 C378 | - |
| `POST /api/auth/verify-email` statuses (2) | 200 C393 · 410 C393 | - |
| `POST /api/auth/resend-verification` statuses (3) | 202 C396 · 401 C396 · 429 C396 | - |
| `PATCH /api/auth/me/email` statuses (4) | 200 C395 · 400 C395 · 401 C395 · 409 C395 | - |
| `PUT /api/users/me/password` statuses (3) | 204 C410 · 400 C410 · 401 C410 | - |
| `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` statuses (1) | 404 C369 | - |
| `POST /api/decks/:deckId/share`, `POST /api/lists/:listId/share` statuses (4) | 201 C390 · 400 C390 · 403 C389 · 404 C390 | - |
| `start` answers (3) | `new` C349 · `password` C349 · `code` C349 | - |
| ways in that set the session (4) | sign-up C371 · sign-in C371 · codes verify C371 · codes redeem C371 | - |
| door 14 parts (5) | e-mail lowercased with abort on collision C356, C358 · `passwordHash` nullable C357 · unconfirmed blocks only share links C389 · `signupReturnPath` in-app and at most 200 C355, C357 · unique on the lowercased value C357 | - |
| door 15 parts (6) | six digits C361 · 15 minutes C361, C363, C365 · 5 tries C365 · one live per address C364 · hashed code and button token C361 · per-address limit from the rows C404 | - |
| door 16 cases (6) | secret set and siteverify fails C402 · siteverify unreachable C407 · secret set and siteverify passes C402 · the siteverify request C402 · secret absent C403 · site key absent C403 | - |
| door 17 parts (14) | `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Max-Age` C371, C372 · `Secure` in production C372 · renewal after one day C373 · no token in a body C374, C375 · `Authorization` not read C377 · origin check C386 · `cookie-parser` and the check in `configureHttpApp` C387 · guards look the hash up C381 · revoked by sign-out C378 · revoked by account deletion C380 · revoked by a password change C380 · old key removed and wrappers send no header C376 · Playwright storage state C388 · fixture seed sends a `Cookie` C388 | - |
| origin check by method (6) | `POST` C386 · `PUT` C386 · `PATCH` C386 · `DELETE` C386 · `GET` passes C386 · no `Origin` header C386 | - |
| guard inputs (10) | `JwtAuthGuard` live session C381 · `JwtAuthGuard` no cookie C381 · `JwtAuthGuard` unknown token C381 · `JwtAuthGuard` revoked C381 · `JwtAuthGuard` deleted user C381 · `OptionalJwtAuthGuard` live session C381 · `OptionalJwtAuthGuard` no cookie C381 · `OptionalJwtAuthGuard` unknown token C381 · `OptionalJwtAuthGuard` revoked C381 · `OptionalJwtAuthGuard` deleted user C381 (table-driven) | - |
| sign-in refusals answered alike (3) | wrong password C368 · no password C368 · deleted account C368 | - |
| code refusals (4) | wrong C365 · malformed C365 · expired C365 · exhausted after 5 tries C365 | - |
| auth forms with client checks (6) | start field C399, C347 · new-account password C399, C353 · sign-in password C399 · code boxes C399 · settings password C399 · address fix C399 | - |
| confirmation token edges (2) | 6 days 23 hours C393 · 7 days and 1 second C393 | - |
| limits (6) | 4 untried codes, next request `202` C404 · 5 untried codes, next request `429` C404 · 9 failed tries, next request `202` C404 · 10 failed tries, next request `429` C404 · 20th sign-up per IP `201` C404 · 21st sign-up per IP `429` C404 | - |
| screens of `.design/account.md` (14) | `r3-arrive-phone` C345 · `r2-typo-phone` C347 · `r2-share-renata-phone` C348 · `r3-new-account-phone` C351 · `r3-new-account-password-phone` C353 · `r3-back-to-deck-phone` C354 · `r3-back-to-list-phone` C354 · `r2-return-password-phone` C360 · `r2-return-code-phone` C366 · `r2-code-expired-phone` C367 · `b4-email-phone` C362 · `r3-home-unconfirmed-phone` C352, C392 · `r2-share-blocked-phone` C391 · `r2-confirmed-phone` C394 | - |
| screen `r2-settings-password-phone` (1) | C408 | - |
| housekeeping deletes (8) | user 30 days gone with its tables C442 · deck 30 days gone C442, C445 · consumed code C442 · expired code C442 · revoked session C442 · kept: user and deck 29 days C442 · kept: live code C442 · kept: live session C442 | - |
| door 5 parts (3) | steps registered in `runWorkerLoops` C441 · one lock per tick C443 · a failed tick retries C444 | - |
| `share_event` new kinds x visitor (9) | `offer`, `quote_sent`, `buy` each for signed-in, anonymous and owner C450, table-driven over all 9 | - |
| report counts (3) | `offer` C452 · `quote_sent` C452 · `buy` C452 | - |
| import kinds logged (5) | `csv` C447 · `paste` C447 · `product` C447 · `fabrary` C447 · `manual` C447, table-driven over all 5 | - |
| missing-list store states logged (5) | `priced` C449 · `store_lacks` C449 · `not_on_site` C449 · `looking_up` C449 · `no_price` C449 (keys of one logged object) | - |
| Relations constraints (3) | `user_session` token hash unique C385 · `sign_in_code` one live per address C364 · `user.email` unique lowercased C357 | - |
| startup config: cookie parser and origin check (2) places, one shared assembly | `main.ts` through `configureHttpApp` C387 · every API e2e and int bootstrap through `configureHttpApp` or `bootFixture` C387 | - |

- Door 19's "blocks a merge" is GitHub branch protection, outside the repository: no test settles it, and the owner marks `web-e2e` as a required check once (Handoff).
- Claims naming a route status: C430, proven by a Playwright test that loads the address.
- Claims naming a payload field: C416, proven by an API e2e test over HTTP.
- Claims naming a status code or a response shape (C29, C31, C45, C52 to C55, C68, C79, C80, C86 to C93) are proven by an `api e2e` or `api int` test that crosses the HTTP boundary or the database.
- Decision tables (copy limits, pool edges, category, cause line, "+" reasons) are proven table-driven at their own layer, the engine or the web model.
- Claims naming a status code, route or response shape: C200, C202, C204, C211, C215, C216, C228, C229, C235, C239, C242, C246 - each has an `api e2e` proof that crosses the HTTP boundary.
- Decision tables are proven at their own layer: store state (C186, C187), queueing (C188, C198), budget (C195), credits (C197), pass timing (C193, C194, C196), chip sums (C205), adoption (C212); the e2e proofs add the boundary.
- Claims naming a status code, route or response shape: C253, C255, C256, C257, C278, C279, C284, C287, C291, C295, C296, C306 - each has an api e2e proof that crosses the HTTP boundary.
- Decision tables proven at their own layer: the spare rules, statuses, sides and foil order (C250 to C254, api unit); the removal order (C285, C286, api unit); the message builder (C273, C275, C276, web unit); the original rebuild (C305, api unit).
- Claims naming a status code, route or response shape: C349, C350, C352, C356, C361, C363, C364, C365, C368, C369, C371, C373, C374, C377, C378, C379, C380, C386, C389, C390, C393, C394, C395, C396, C400, C401, C402, C404, C405, C406, C410, C411, C449, C450: each has an `api e2e` proof that crosses the HTTP boundary
- Decision tables proven at their own layer as well: the origin check (C386 `origin-check.middleware.spec.ts`), the guards (C381), the cookie options (C372), Turnstile (C402, C403), the in-app return path (C355)

## Test policy

The repository says where tests live and how they are named, not which level proves which code; these rows answer that for this feature, with `.specs/features/ai-chat-screens/checks.md` as the precedent.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (route statuses, the origin check, guards, migrations and constraints) | one at the boundary (api e2e, or api int against Postgres) **and** one at its own layer when it holds a decision table | the status or constraint at the boundary; one asserted case per row at its own layer |
| Decides, pure (the rules engine, the reader, the spare function, store states, the pitch-name helper, copy rules) | one at its own layer (engine unit, api unit, web unit) | one asserted case per row of the decision table or per member of the set |
| Screen copy and arrangement (profile `ui`) | one component test per binding screen, in pt-BR | every string the screen shows and the order of its blocks |
| Layout only CSS decides (sheet height, phone or computer) | one Playwright run at the widths it names | the measured box |
| Instrumentation (query hooks, DTO mapping with no branch) | none of its own | covered by its consumer's proof |

Evidence:

- `packages/engine` legality rules: per-format limits and checks over four formats -> decides; analogue `packages/engine/__tests__`, one case per format
- the list and spreadsheet reader: one outcome per line over pitch spellings and headers -> decides; analogue the CSV upload specs in `apps/api/src/collection/__tests__`
- the spare function: three rules over five deck stages -> decides; pure, at its own layer
- the origin check and the session guards: five guard inputs over two guards, six methods -> decides, reached across a boundary
- closest analogue for screens: `AlternativesSheet.spec.tsx` and `SharedDeckPage.spec.tsx`, component tests over a mocked `useApiClient`, one case per state

Cost: two proofs for every decision table reached across a boundary; without these rows a route's statuses would be proven only by a path that happens to cross them.

## Swept

- validation: gates and words: C433 (a search with no match, the `q` parameter) · building a deck: C53, C54 (inventory quantities and repeated rows), C51 (database check) · getting cards in: C120, C127, C132, C133, C134, C146, C148, C151, C170 · closing the deck: C211, C216, C228, C235, C242 (extra fields refused by `forbidNonWhitelisted`) · selling and trading: C257, C278, C279, C284, C287, C306, C307 · the Tutor: C323 (quantity, side, limits); C313 (`get_prices` argument shapes) · accounts, housekeeping, counts: C347, C349, C353, C355, C365, C399, C400, C410
- failure modes: gates and words: C1, C2, C6, C7 (the gates fail with the offending key, rule id and selector) · building a deck: C28, C29 (a format outside the four never crashes), C78 (a rule warning never blocks copying) · getting cards in: C147 (unreadable file), C171, C175 (Fabrary missing or unreachable), C166 (failed fetch exits non-zero) · closing the deck: C194 (pass fails partway), C198 (lookup fails), C243 (storage unavailable) · selling and trading: C277 (a failed create opens no WhatsApp and keeps the draft), C286 · the Tutor: C312 (empty rules search no longer a dead end), C313 (`READINESS_NOT_COMPUTED` gone), C331 (stale proposal) · accounts, housekeeping, counts: C365, C367, C368, C396, C397, C405, C444
- idempotency: gates and words: n/a - no write in these slices · building a deck: C87, C90 (deleting a deleted deck and restoring a live one answer `404` and change nothing) · getting cards in: C122 (two increments, one row), C163 (a repeated product asks before writing), C148 (`409` on the same file); the file duplicate strategies stay as today (existing - `auto`, `separate`, `replace`, `update`) · closing the deck: C189 (one pending lookup per card), C237 (quote address reused), C235 (owner taps record nothing) · selling and trading: C284 (a second sold on a sold line answers `409` and changes nothing); n/a for the reads - `GET` spare and shared list write nothing (C253) · the Tutor: existing - "only a pending proposal applies" (`chat-proposals.e2e-spec.ts`); C329 keeps "concurrent applies create one effect" · accounts, housekeeping, counts: C363 (a button token signs in once), C378 (sign-out ends the row; a second call answers 401), C443
- authorization: gates and words: C430 (`/termos` is public); the rest of S1, S2, S36 and S37's screens keep today's guards (existing - `_auth` layout) · building a deck: C55, C80, C87, C88, C90, C91 (another player's deck answers `404`); existing - `OwnsTrackedDeckGuard` on owner routes · getting cards in: existing - `JwtAuthGuard` on every collection, products-import and decks-import route; C127 and C151 assert `404` for another user's import and pending line, C151 asserts `401` with no session · closing the deck: C200 (admin only, `AdminGuard`), C204 and C216 (another user's deck answers `404`), C233 (owner sees no offer); existing - `JwtAuthGuard` and `OwnsTrackedDeckGuard` on owner routes, `OptionalJwtAuthGuard` on `/api/shared/*` · selling and trading: C256, C284 (another user's line `404`), C295 (spare fields only for a signed-in visitor), C302; existing - `JwtAuthGuard` on owner routes and `OptionalJwtAuthGuard` on `/api/shared/*` · the Tutor: existing - `ChatAccessGuard` and the owner checks in "tools only see the message owner's data"; C325; C336 and C338 for the flag on the deck page · accounts, housekeeping, counts: C377, C381, C386, C389, C390; existing - `JwtAuthGuard` as the global guard in `app.module.ts`, `OwnsTrackedDeckGuard` on deck routes
- concurrency: gates and words: n/a - no shared state written · building a deck: C41 (server data arriving under a pristine draft); existing - one `PUT` replaces the composition in one transaction · getting cards in: C122 (the seven-column `ON CONFLICT` keeps AD-008's atomic increment); existing - `manual-source-concurrency.e2e-spec.ts` for the hand-entry source · closing the deck: C189 (two owners, one job), C192 (concurrent credit increments), C215 (concurrent owned sets); existing - `replacements.e2e-spec.ts` "serializes two concurrent picks for one card" · selling and trading: existing - `lists.e2e-spec.ts` "keeps two concurrent adds of the same card as one line"; the sale's removal runs in one transaction with the split (C285 e2e asserts the collection and lines together) · the Tutor: C329 (concurrent applies create one effect, with a quantity) · accounts, housekeeping, counts: C364 (one live code under a second request), C443 (two workers)
- data lifecycle: gates and words: n/a - no stored data; the glossary is static i18n · building a deck: C85 to C93 (soft delete, restore, permanent delete, 30-day purge) · getting cards in: C152 (pending lines go with their import), C119 and C123 (existing rows migrated); account purge of `import_pending_line` is S38's (another part) · closing the deck: C191 (existing rows read null), C213 (existing replacements read `deck`), C238 (`down()` restores), C243 (draft only on the device) · selling and trading: C253 (nothing stored), C258 (columns and their down), C291 (undo restores); deleting an account already removes its lists and lines (existing - `lists.e2e-spec.ts` "deletes a list with its lines, and removes lists and lines when the account goes") · the Tutor: C324 (the stored effect is kept and not recomputed); existing - "deleting a conversation keeps usage and applied effects" · accounts, housekeeping, counts: C358, C380, C385, C393 (an expired confirmation deletes nothing), C442, C445
- dependency failure: gates and words: C9 (the CI job's Postgres and Chromium are declared in the workflow) · building a deck: n/a - journey 3 adds no outside call; "ver o anúncio" is a plain link · getting cards in: C171 (Fabrary down answers `502`, writes nothing), C166 (official decklist fetch fails) · closing the deck: C194 and C198 (Firecrawl failure), C195 and C196 (budget exhausted), C243 (`localStorage` throws) · selling and trading: existing - `SharedListPage.spec.tsx` "keeps the page whole when the matches cannot be loaded"; n/a otherwise - journey 5 calls no outside service (LigaFAB is a link only) · the Tutor: n/a - no proof calls the model; the model's own failure paths are covered today by `chat-worker.e2e-spec.ts` · accounts, housekeeping, counts: C396 (e-mail provider fails), C402 (siteverify refuses), C403 (no Turnstile secret)
- state transitions: gates and words: C425, C427, C428 (sheet closed, open, closed with focus back; the stage stays unchanged) · building a deck: C86, C89, C91, C446 (live, deleted, restored, gone); C68 (the verdict never moves the stage); C106 (format switch and undo) · getting cards in: C150, C151 (pending -> resolved or deleted), C126 (unversioned -> marked, marked copies unchanged), C142 (suggestion -> accepted -> undone) · closing the deck: C186 and C187 (store states), C210 (stand-in unused → used → reverted), C214 (owned total and undo) · selling and trading: C251, C270 (deck stage changes the count), C284 (available -> sold, with split), C291 (sold removal undone) · the Tutor: C329 to C331 (pending to applied, pending to stale); existing - "dismiss closes a pending proposal" · accounts, housekeeping, counts: C364 (live -> replaced), C363 (live -> consumed), C365 (live -> exhausted, expired), C378 (session live -> revoked), C393 (unconfirmed -> confirmed), C395 (address fixed while unconfirmed)
- observability: gates and words: n/a - no log or event in these slices · building a deck: n/a - journey 3 adds no log line or event; S39 owns the counts · getting cards in: n/a here - the import log line with kind, counts, product and ownership answer is S39 (AC 283, AC 284), in another part; C123 asserts the migration's log line for an unreadable printing key · closing the deck: C195 (budget warning once per month), C200 and C201 (credits shown to the admin); the owner-list log line with copies per state and the `offer` and `quote_sent` counts in `pnpm share:report` are S39's (S30 to S35, S38 and S39) · selling and trading: n/a here - AC 287 (logs for origin `spare`, the collection answer and the rule) and AC 286 (`buy`, `offer` events) sit in S39, owned by another fork · the Tutor: existing - "logs apply, dismiss and stale" (`chat-proposals.e2e-spec.ts`); C343 (the eval's cost log when it stops) · accounts, housekeeping, counts: C386 (rejected origin logged), C403 (warning once an hour), C443, C444, C447, C448, C449, C450, C451, C452

## Derivation notes

What the derivation could not settle from the plan, and the default each check took. The notes are grouped by the slices they were derived for.

Settled when the parts were merged:

- Screen copy against a document's state table: the document's words, the screen's arrangement (plan Assumptions).
- Reversible defaults now recorded in plan Assumptions: `DMG` in the card picker only; `400` for an owned total below the other imports; the `409` of the sold route means already sold; one `deck_card` row per deck, card and slot validated in the API with no index; finish order Cold, Rainbow, Gold, regular, unknown; `401` after 5 wrong code tries; `turnstileToken` on start not verified; siteverify unreachable lets the request through with a warning (its own check in S34); under 720 px is a phone; the pitch after every pitched name.
- `GET /api/chat/conversations/:id` gains `400` in Surface, proven in S27.
- The Blitz change-log URL is the one `.design/deck-building.md` records, and the rule-change check asserts it.
- Five coverage members proven by tests that exist today got their own checks, so the Verifier re-runs those tests at HEAD.
- Still open for the owner: how a code-only account confirms deleting itself (plan open question 7, needs mockups); marking `web-e2e` as a required check in GitHub.

### Gates and words

- Door 19 "it blocks a merge like the other jobs": the other jobs block merges through GitHub branch protection, which is configured outside the repository; no repo test can settle it. C9 proves the job exists and does not tolerate failure. The owner checks the required checks list in GitHub once after the job lands.
- Door 19 precedent: no test in the repository reads `.github/workflows/ci.yml` today. The closest precedent for a test that reads a source file is `apps/web/src/i18n/__tests__/component-literals.spec.ts` and `HeroDropdown.spec.tsx` (`fs.readFileSync`). C9 uses plain-text assertions on the job block, because no YAML parser is a dependency of `apps/web` (only the root `package.json` lists `yaml`).
- AC 2 "Manual entries": the literal is not in any pt-BR locale value; it comes from the API (`library.service.ts:229`, `sources.service.ts:263`) and is shown as is. The locale scan alone cannot catch it, so C4 adds a Library render check. The pt-BR label for a manual source is not quoted in plan.md; S11 to S15's binding document (journey 2) may name it, and C4 should then assert that exact string.
- AC 4 also covers `onboarding.congratsBody` ("sem nenhuma troca"), which the design document's list of four strings did not name; C3 includes it because AC 2 bans "troca" in the whole `onboarding` namespace.
- AC 6's condition "WHERE the same card name exists in more than one pitch": C10 names the pitch of every pitched card, which satisfies the criterion without the catalog lookup the condition implies. If the owner wants a pitched card with a unique name shown bare, C10 changes.
- AC 265 names no heading list: plan.md and the design document fix "Portuguese, from i18n keys, one grouping rule" but not which groups or their words. C417 proves one rule and no English heading; the exact group words are the builder's, reviewed in the diff.
- AC 267 "a labelled region": the label text is not given; C419 asserts an accessible name exists.
- AC 270: a word list cannot prove the absence of gender in general. C422 bans the forms seen in journey 1; other gendered forms remain a review item.
- AC 269: C421 bans every non-SVG `title=` in `apps/web/src`, including the two timestamp tooltips (`ShoppingLine.tsx:234`, `MissingStoreSummary.tsx:78`) that are not glossary words; they become visible text per the design document's row "A native `title=` tooltip".
- AC 275 "return to where the player came from": only the shared-list label ("Voltar para a lista do Pedro") is drawn. The label for other origins is not specified; C432 asserts the destination for the deck page and the label only for the shared list.
- `b2-stage-retire-phone` (round 1) draws the Aposentado sentence as "Deck que você não usa mais. ..." and its sheet without "Ver todos os termos"; the table (rewritten after round 1) says "Etapa de um deck que você não usa mais. ..." and AC 272 requires "Ver todos os termos". C437 follows the table and AC 272.
- C429 reads `.design/copy-and-access.md` at test time, so `.design/` must be committed before the build (the merge's open ask).
- The `/termos` search matching rule (word only, or the sentence too; accents) is not specified; C433 asserts only the drawn behaviours.
- AC 1-3 "WHEN CI runs": the locale test and component tests run in the existing web unit CI job (`pnpm --filter @rathe-arsenal/web test`); the axe scan runs only once door 19's job exists.

### Building a deck

1. AC 34 names the group ask and the quote, which S18 and S19 build after S5. C249's proof files (`SharedMissingGallery.spec.tsx`, `SharedQuotePage.spec.tsx`) belong to S16 to S19's slices; the merge should either move C249 into S18 and S19 or make S16 to S19's checks for those screens assert the split. Also `GET /api/decks/:deckId/missing` (`deckNeeded`, `inventoryNeeded`) is S16 to S19's route; C61 proves the engine side only.
2. Relations says `deck_card` holds at most one row per deck, card and slot, but door 3's literal shape names only the check constraint, and no unique index on `deck_card` exists in today's migrations. C54 reads it as "a `PUT` with a repeated card and slot answers `400`", the conservative reading. Whether a database unique index is intended is a parent or owner call; adding one needs a dedupe step for existing rows.
3. AC 25 says "discarded" without naming the route. C43 assumes `DELETE /api/decks/:deckId/permanent`, so an empty deck just created never lands in "Excluídos recentemente". That makes `permanent` accept a live, owned deck (C91 asserts only `204` and `404`).
4. AC 44 vs `r2-export-desktop`:
   - AC 44 names the heading "Weapon"; the screen prints "Weapons:" and puts each equipment group on one comma-separated line.
   - C77 follows AC 44: one line per card, headings Hero, Weapon, Equipment, Deck, Inventory.
   - The tab label "Para Fabrary ou Talishar" follows AC 44 and open question 3. Both screens draw "Para Fabrary, GEM ou Talishar".
5. AC 47 orders the groups Herói, Arma, Equipamentos, Deck, Inventário; `r2-list-view-desktop` draws Inventário before Deck. C82 follows AC 47.
6. `r3-checklist-phone` draws the card pool line without "o inventário". C37 asserts the line of copy rule 6, which always names the inventory.
7. AC 22 says "about 45%". C40 uses 40% to 50% as its tolerance; this number is mine, not the plan's.
8. AC 66 and door 9:
   - Resolved at merge: `.design/deck-building.md` line 22 records the change log `https://fabtcg.com/rules-and-policy-center/change-log-tournament-rules-and-policy/` (read 2026-10-22), and C110 asserts it. Today's `FORMAT_RULES.Blitz.source` (`https://fabtcg.com/articles/official-blitz-update/`) is a different page.
9. Resolved at merge: the 30-day deck purge check moved to S38.
10. Resolved at merge: the spare reader of a deleted deck is C266.
11. The plan has no criterion for the toast copy of a duplicated deck or of a format-outside-four notice choice ("with a choice of the four" in the design's engine table). `C30` and `C72` assert only "Formato não conferido".

### Getting cards in

1. `r3-version-card-phone` draws the card picker's "Estado" with NM, LP, MP, HP only, while `.design/collection-in.md` Versions says "condition `DMG` exists in the vocabulary but is offered only in the card picker". C131 does not assert either; the merge should pick one (the document's text is the later decision in that file, the drawn screen is round 3) before the builder writes the test.
2. `r3-imports-phone` reads "Armory Deck: Kayo · 66 cartas" while every other row reads "N cópias" and AC 109 says "copies". C181 asserts "cópias" for every row; the mockup's "cartas" on that one row reads as a drawing slip.
3. `r3-fabrary-found-phone` draws "Você tem 0 de 66 cartas deste deck" and "Colar a lista do que eu tenho" before the import, while `.design/collection-in.md` puts them after a "Não" import. C173 follows the drawn screen (both visible on the found card); C174 asserts the after-"Não" offer. No contradiction for the tests, but the builder should know both are on screen.
4. AC 85 says "Portuguese and English headers" but neither the plan nor the document names the English headers for color, version and condition. C144 covers today's English headers and the five Portuguese ones; English `color`/`pitch`, `version`, `condition` are not asserted until someone names them.
5. The product files' folder: door 8 says "under the repository's catalog data", and no such folder exists today (the catalog is the `@flesh-and-blood/cards` package). The plan says the folder is settled in the diff; C158 reads "the product folder" so it holds wherever it lands.
6. The `products:import` command shape (root script building the API and running an API CLI, like `prices:sync`) is my reading of the repository's precedent, not a plan decision; C166 asserts it.
7. The `outcome` names (`ready`, `asks_color`, `suggestion`, `not_found`, `bad_quantity`) and the error code `IMPORT_UNREADABLE` are names I chose for the tests to assert; the plan names the outcomes in words only.
8. AC 89's cascade is also implied for the account purge (S38); not asserted here.

### Closing the deck

1. **Document and r3 screens disagree on copy; the checks follow the document's state tables.** `r3-copy-phone` shows "Lista de compras do deck [CC] Brute (Rhinar), Cúpula DT:", lines "1 Alpha Rampage (Vermelho) · R$ 150,00 cada · R$ 150,00" and the toast "Lista de compras copiada"; the document (and AC 132) has "Lista de compras · <deck> (<hero>) · Cúpula DT", "3x … · R$ 0,20 cada" and "Lista copiada". `r3-quote-phone` shows "+ 22 cartas" and the preview "Oi Caio! Respondendo ao seu pedido de orçamento. Tenho 18 de 59 cópias, total R$ 412,00:"; the document (and AC 146, AC 150) lists every card and "Oi <sharer>, orçamento para o seu deck <deck>:" with "Total: Q de N cópias · R$ T". `r3-group-phone` adds "Esta página não aparece em buscas." and the flag "só tem a versão especial, mais cara" for visitors; the document says the quote page drops that line and does not give a visitor flag wording. `r3-list-phone` still shows "Ver as 66 sem descontar", which the document dropped. The plan's precedence rules do not cover a document against its own screen; the merge should add "the document's state table beats its screen for copy" to the plan's "How to read", or ask.
2. **The article before the sharer's name.** The screens write "Cartas que o Caio procura", "fala com o Caio", "O Caio pediu"; the document writes "<sharer>" with no article. The checks use no article, since an article guesses the sharer's gender.
3. **The inventory wording on the missing list.** Journey 3's note says "Faltam 7 cartas (4 do deck, 3 do inventário)" while AC 124 and journey 3's copy rule 1 count copies ("Faltam N cópias (M cartas)"). C221 asserts the split exists and defers the exact string to S5's inventory copy (S3 to S10); S3 to S10 and S16 to S19 must use the same string.
4. **An `ownedTotal` below what other sources hold.** The document says the write never goes below other sources and AC 130 disables those options; neither says whether the API refuses (`400`) or clamps such a value. C216 does not assert it; the builder should refuse with `400` (the conservative choice, inside the route's listed statuses) and the merge may add it to C216.
5. **No pt-BR copy for the admin credits line (AC 122).** The document gives only its content; C201 asserts the numbers and the stopped flag, not a string. The plan says copy beyond the quoted strings is derivable, so this is not a blocker.
6. **`STORE_PRICE_VALID_DAYS` and the related variables are not in `env.dto.ts` yet.** They are new optional variables with the defaults in AC 115, AC 116, AC 118, AC 119 (`FIRECRAWL_CREDITS_PER_DETAIL`, `FIRECRAWL_CREDITS_PER_LISTING_PAGE` are named only in the document, not in plan AC 119).
7. **The event route's path segment `:kind`** in `POST /api/shared/:kind/:token/events` is the target kind (`decks` or `lists`), while the body's `kind` is the event kind; C235 and C242 use `/api/shared/decks/:token/events`, and the `lists` path with `buy` belongs to S20 to S25 (S23).
8. **The owner-list log line** ("the owner's list is served" → a structured log with copies per state, document "Measuring it") has no AC in S16 to S19; it is presumably in S39 (S30 to S35, S38 and S39). If it is not, it is an uncovered row of the document.

### Selling and trading

- AC 159 names the order Cold before Rainbow only. Door 1 also has `gold`, and the plan does not say where Gold or the unknown finish `''` falls against `none` in what a deck holds first. C254 asserts only Cold, Rainbow, then regular; the builder needs the owner's order for Gold, or a stated default, before writing that case.
- The plan's `409` on `POST /api/lists/:listId/lines/:lineId/sold` names no cause and no error code. C284 takes "the line is already sold" as the cause; confirm or replace it.
- AC 177 says the sheet asks which import, but the route's `sourceId?` does not say what the API does without it when the card sits in two imports. C287 takes `400`. That status is in the Surface row; its cause is my reading.
- The plan's Surface row for `POST /api/lists/:listId/lines` keeps `400` for the old `printing` field (C278). If the builder keeps accepting `printing` during migration, that member changes.
- AC 175 and AC 176 are checked at the screen layer plus the removal unit (`removed`); the plan names no response field for "the deck left short". C289 lets the web compute it from the spare and readiness reads it already has. If the API should say it, a field must be added to the Surface row.
- `r3-sell-draft-phone`'s preview shows "foil não conferido" for unanswered questions, while AC 165 ties the words to "Não sei". C273 follows the screen, unanswered posts "foil não conferido". This is consistent with Key decision 4 (no unknown version posted as known).
- `apps/web/src/components/settings/ContactSetting.tsx` was not measured with `wc -c`; it is small and counted in the S23 header's file count only.
- The AC 162 screen arrangement for `r3-library-banner-phone` shows the banner above the grid; the exact component placement on the Library page with its current filter rail is the diff's call.

### The tutor

1. **AC 197, the pt-BR question.**
   - The rules index is English, and the prompt now tells the model to search in English (AC 196).
   - So "Explique a ordem dos gatilhos ao atacar" cannot itself match the index in a deterministic test.
   - The CI proof runs the English search the model is told to send (C312, C341). That the model sends it is proven only by the eval's `ready-triggers` check (C342), and the eval is by hand by design (AC 217).
2. **AC 215, the "three starter questions against `search_rules`".**
   - Only "Explique a ordem dos gatilhos ao atacar" is a rules question.
   - The two hero questions are answered by tournament tools, not by `search_rules`.
   - C341 runs the triggers search plus the audit's two rules queries from F29 and F33. The hero questions are covered by their eval scenarios (C342).
   - The merge may want the plan's wording narrowed.
3. **AC 216, the hero questions.** The audit recorded no wrong answer for `ready-hero` and `ready-next-hero` (F33 covers the triggers question only). For those two, C342 asserts that the check fails on a trace with no tool call, which is the closest thing the audit gives.
4. **AC 210, the format and size in the tile's text.** The format name and the size are drawn only for Blitz ("no Blitz", "chegar a 40"). Whether they follow the deck's format, for example "no Classic Constructed" and "chegar a 60", is not stated. C335 asserts the Blitz strings only.
5. **AC 204, the outgoing line for `side: 'deck'`.** The binding documents give the outgoing line only for the inventory side ("a cópia do inventário"), and the incoming line for the deck side ("Entra: 1 <card> no deck"). The outgoing text for a deck-side swap is not specified, and C326 asserts only the incoming line for it.
6. **The plural button.** Only "Trocar 1 cópia" is specified; a proposal moving two copies has no drawn button text.
7. **C338 and C340 name `RulesChecklistSheet.spec.tsx`.**
   - The checklist sheet is created by S4 (S3 to S10), and its file name is S3 to S10's.
   - The merge should align the two at merge.
   - The "Para fechar" number comes from S4's computation: C338 asserts that the Tutor question's number equals the number on the "Para fechar" line, not a second count.
8. **Surface row for `GET /api/chat/conversations/:id`.** The row lists `200` and `404`. Today the route also answers `400` for an id that is not a UUID (`chat-conversations.e2e-spec.ts`, "foreign and malformed conversations"), and the row does not list it.
9. **Card identifiers.**
   - Not verified in the catalog from here: Romping Club, Wounding Blow (Vermelho), and the "Rhinar, Reckless Rampage" hero name.
   - `pack-hunt-red` is used by existing tests.
   - Tests must resolve the other cards by name in the catalog. If the hero's full name differs, the strings in C317 and C335 take the catalog name.
10. **C322, the fixture's `missingBefore`.** The values 7 and 8 come from the mockup's deck, not from a fixture. The e2e asserts `missingBefore` against the engine, with `missingAfter = missingBefore + 1`. The literal 7 and 8 appear only in the web screen checks (C328, C332).

### Accounts, housekeeping, counts

1. **Bootstraps that skip `configureHttpApp`.** 12 API test bootstraps call `createNestApplication` without `configureHttpApp`: `__tests__/plan-b-full-flow.e2e-spec.ts`, `__tests__/theme-persistence.e2e-spec.ts`, `auth/__tests__/auth.controller.e2e-spec.ts`, `catalog/__tests__/catalog-collector-codes.controller.int-spec.ts`, `collection/__tests__/manual-source-concurrency.e2e-spec.ts`, `decks/__tests__/decks.controller.patch.int-spec.ts`, `decks.controller.post.int-spec.ts`, `decks.controller.put.int-spec.ts`, `decks/__tests__/decks.meta.e2e-spec.ts`, `decks/re-solve/__tests__/re-solve.controller.e2e-spec.ts`, `stores/__tests__/admin-stores.controller.e2e-spec.ts`, `tags/__tests__/tags.controller.int-spec.ts`. Of these, `plan-b-full-flow`, `theme-persistence`, `decks.meta` and `tags.controller.int-spec` sign in with a Bearer token today and will get `401` until they boot through `configureHttpApp`; `auth.controller.e2e-spec.ts` is where the auth throttle proofs above live. C387's second proof makes this a test. The chat and recommendations fixtures reuse `bootFixture`, which already calls it. Five unit controller specs (`csv.controller.spec.ts`, `variant-fetch.controller.spec.ts`, `variant-jobs.controller.spec.ts`, `decisions.controller.spec.ts`, `reviews.controller.spec.ts`) also call `createNestApplication`; C387 scopes the hygiene test to e2e and int files and fixtures, and those five are left out on purpose. The merge decides if they should be in it.
2. **Deleting an account with no password.** `DELETE /api/auth/me` takes `DeleteAccountDto` with a `password` (`auth.controller.ts:117-121`), and `delete-account-modal.tsx` asks for one. A code-only account (C352) cannot delete itself. The plan's Surface does not list this route. It needs a door or a criterion (for example, confirming with a fresh code). No check is written for it.
3. **`turnstileToken` on `/api/auth/start`.** Surface lists it as an input; AC 256 and door 16 name only sign-up and code requests. The checks follow AC 256, so `start`'s `400` is for a malformed address only (C349).
4. **The numbers behind `429` on `start` and `codes/verify`.** The plan states no number. C350 and C406 assert the constant the controller declares, whatever value the builder picks.
5. **The status after 5 wrong tries.** AC 231 says "the code SHALL stop working" with no status. C365 picks `401` with no session, and the screen says "Este código não confere. Confira no e-mail." The owner may want the "venceu" copy instead.
6. **Siteverify unreachable** (a network error or a timeout, as opposed to `success: false`). Neither the plan nor the binding documents say whether this fails closed or open. No check is written. It needs an assumption row.
7. **Phone or computer for the staying-in line.** The documents do not say how the app tells them apart. C384 uses the 720 px width where `AuthLayout` already switches. This is an assumption the merge should record.
8. **A confirmation with no stored page, on the same device.** AC 248 covers a stored page. With `signupReturnPath` null, "the page they were on" has no rule: the confirmation opens in a new tab from the mail app. C394 asserts only the stored-path case and the other-device case.
9. **The `purge:deleted-users` script after S38.** The plan moves the purge into the worker. It does not say whether `scripts/purge-deleted-users.ts` stays as a manual tool or goes. No check is written.
10. **Log field names in S39.** The ACs name what is logged, not the keys. C447, C448, C449 and C451 fix the keys (`event`, `kind`, `linesRead`, `ready`, `asked`, `kept`, `productKey`, `ownership`, `action`, `origin`, `firstAnswer`) so the claims carry concrete values.
11. **Size of S32.** S32's existing files alone are 316 KB, about 79k tokens, and most of it is test files that switch from a Bearer header to a cookie. With the new files it comes to about 109k. That fits a 150k budget, but it is the largest slice here.

## Handoff

Size per slice, from the slice headings above: `wc -c` of the existing files each slice touches, divided by 4, plus 2k per new file. The slices add up to about 1486k against the default budget of 150k (the repository declares no `## tlc-spec-lean` block), so the work does not fit one builder.

What every builder also reads, added to each batch below:

- `plan.md` whole, about 26k
- this file's header, conventions, Test policy and Swept, about 4k, plus the checks of its own slices and the coverage rows that name them
- the binding document of each journey in the batch, by `wc -c`
- 2k per binding screen its checks name, read as the PNG next to the HTML (the HTML files carry inline assets, and the checks already quote every string)
- of the diff that landed before it, only the files its own slices touch, which the slice sizes already count at today's size; a file earlier batches grew is read at its new size, which this estimate does not count

Build order: S1 and S2 first, then the accounts slices S30 to S35, then S3 to S29 in plan order, then S36 to S39.
The accounts slices move the session to the `ra_session` cookie (door 17); built early, every API e2e and Playwright test the later batches write signs in with the cookie from the start, and S32 rewrites only the tests that exist today, which is what its size measures.
S30 to S35 use no code from S3 to S29: share links, the share pages and the auth routes they change exist today.

Proposed batches, whole slices, each under 150k with the reading above, run one after the other and handed on only on green:

- Batch 1: S1, S2 = 137k: slices 101k (S1 41k + S2 60k) + reading 36k (0 screens, `.design/copy-and-access.md`) - gates and names; checks C1 to C17
- Batch 2: S30, S31 = 150k: slices 88k (S30 44k + S31 44k) + reading 62k (12 screens, `.design/account.md`) - journey 1; checks C345 to C370
- Batch 3: S32 = 145k: slices 109k (S32 109k) + reading 36k (0 screens, `.design/account.md`) - journey 1; checks C371 to C388
- Batch 4: S33, S34, S35 = 136k: slices 91k (S33 42k + S34 30k + S35 19k) + reading 45k (4 screens, `.design/account.md`) - journey 1; checks C389 to C412
- Batch 5: S3, S4 = 119k: slices 76k (S3 33k + S4 43k) + reading 43k (2 screens, `.design/deck-building.md`) - journey 3; checks C18 to C49
- Batch 6: S5, S6 = 113k: slices 71k (S5 57k + S6 14k) + reading 42k (2 screens, `.design/deck-building.md`) - journey 3; checks C50 to C72
- Batch 7: S7, S8 = 141k: slices 94k (S7 38k + S8 56k) + reading 47k (4 screens, `.design/deck-building.md`) - journey 3; checks C73 to C100
- Batch 8: S9, S10 = 102k: slices 50k (S9 36k + S10 14k) + reading 52k (7 screens, `.design/deck-building.md`) - journey 3; checks C101 to C118
- Batch 9: S11 = 98k: slices 54k (S11 54k) + reading 44k (3 screens, `.design/collection-in.md`) - journey 2; checks C119 to C138
- Batch 10: S12, S13 = 132k: slices 83k (S12 51k + S13 32k) + reading 49k (5 screens, `.design/collection-in.md`) - journey 2; checks C139 to C167
- Batch 11: S14, S15 = 105k: slices 58k (S14 37k + S15 21k) + reading 47k (5 screens, `.design/collection-in.md`) - journey 2; checks C168 to C185
- Batch 12: S16 = 120k: slices 80k (S16 80k) + reading 40k (0 screens, `.design/close-the-deck.md`) - journey 4; checks C186 to C202
- Batch 13: S17 = 142k: slices 95k (S17 95k) + reading 47k (3 screens, `.design/close-the-deck.md`) - journey 4; checks C203 to C223
- Batch 14: S18, S19 = 130k: slices 76k (S18 51k + S19 25k) + reading 54k (6 screens, `.design/close-the-deck.md`) - journey 4; checks C224 to C249
- Batch 15: S20, S21 = 139k: slices 83k (S20 41k + S21 42k) + reading 56k (8 screens, `.design/sell-and-trade.md`) - journey 5; checks C250 to C283
- Batch 16: S22, S23, S24, S25, S26 = 148k: slices 88k (S22 13k + S23 23k + S24 10k + S25 8k + S26 34k) + reading 60k (8 screens, `.design/sell-and-trade.md`, `.design/tutor.md`) - journey 5, journey 6; checks C284 to C320
- Batch 17: S27, S28, S29 = 114k: slices 69k (S27 37k + S28 11k + S29 21k) + reading 45k (4 screens, `.design/tutor.md`) - journey 6; checks C321 to C344
- Batch 18: S36, S37, S38 = 145k: slices 101k (S36 48k + S37 39k + S38 14k) + reading 44k (3 screens, `.design/copy-and-access.md`) - journey 7, housekeeping; checks C413 to C446
- Batch 19: S39 = 49k: slices 19k (S39 19k) + reading 30k (0 screens) - counts; checks C447 to C452

A check whose proof needs code from a later slice was moved into that slice before numbering: the group-ask and quote split to S19, the missing-list and shopping-list split to S17, the 30-day deck purge to S38, and the spare reader of a deleted deck to S20. A scan of every proof file against the files each slice creates found no other case.

- Feature base: `f7ec475` (the commit of the plan and these checks); the Verifier runs over `f7ec475..HEAD` with every check
- Deviations: every builder appends its deviations from the plan to `.specs/features/persona-rethink/implementation-notes.md` under `## Deviations`, in the commit of the slice that deviates
- Mechanism: handoff - chosen by the owner on 2026-10-24: the 19 batches above run one after the other, each by a fresh sub-agent builder, and a batch is handed on only when every proof in it is green; the main session only dispatches builders, checks each result and dispatches the Verifier after the last batch
- Batch 1 boundary: 04294eb - S1, S2 (C1 to C17)
- Batch 1 settled mid-build: none
- Batch 1 abandoned: none
- Batch 2 boundary: dc65387 - S30, S31 (C345 to C351, C353 to C370)
- Batch 2 settled mid-build: the session cookie `ra_session` carries today's JWT until S32 (Bearer is tried first, then the cookie; "Sair" does not clear the cookie, so C378 must, and batch 2 must not ship without S32); C352 stays unmarked until journey 2's first-run screen exists, so the S15 builder repoints `FIRST_STEPS_PATH` in `apps/web/src/components/auth/NewAccountStep.tsx` and marks C352; the S32 builder extends the existing test "the staying-in line is said once, for a phone or a computer" in `NewAccountStep.spec.tsx` with the "Você continua conectada" scan for C384 instead of writing a second test of that name; C354's list proof "a new account lands back on the list with its toast" runs from `NewAccountStep.spec.tsx`, so the named `SharedListPage.spec.tsx -t` command matches no test; unconfirmed accounts can create share links until S33; `GET /api/shared/decks/:token/coverage` gained `collectionEmpty` (Surface row added); `/entrar` and the sign-in and sign-up redirects are in Surface
- Batch 2 abandoned: none
- Batch 3 boundary: 94b56ce - S32 (C371 to C381, C383 to C388)
- Batch 3 settled mid-build: the session is the `ra_session` cookie over a `user_session` row (door 17) and no JWT exists; `PUT /api/users/me/password` exists and revokes the other sessions (S35 extends it with `hasPassword` and its screens); `AuthContext` has no `token`, signed in means `user !== null`, and `restoredSession` is set when `GET /api/auth/me` answers on load; `POST /api/auth/verify-email` still opens a session cookie (S33 reworks it, security review item (a)); API e2e and int tests sign in with `sessionTokenOf(response)` and `sessionCookieHeader(token)` from `apps/api/src/auth/__tests__/session-test-helpers.ts`, and the Playwright fixture carries `sessionToken`; `/entrar?next=<page>` returns to a protected page after sign-in (Surface row added); C382 is built and both proofs are green but stays unmarked because the session-ended sign-in sheet is not drawn by any mockup (the owner marks it ` · done` if the sheet is accepted as built); security review items (b) and (d) are resolved
- Batch 3 abandoned: none
- Batch 4 boundary: fc01752 - S33, S34, S35 (C389, C391 to C398, C400 to C408, C410, C411)
- Batch 4 settled mid-build: `POST /api/auth/verify-email` opens no session and answers 410 for every dead token; share creation answers 201 behind `EmailConfirmedGuard`; the auth answers and `GET /api/auth/me` carry `emailConfirmed` and `hasPassword`; `ValidRequestsThrottlerGuard` replaces the stock guard (marked controllers count only valid bodies); `/entrar?email=` opens the code sign-in; five codes per address are counted from `sign_in_code` rows under an advisory lock, so S38's purge must keep those rows an hour; security items (c) and (e) resolved
- Batch 4 abandoned: C390 stays unmarked until S19 adds the `quote` intent and writes its proof; C399, C409 and C412 are built and green but unmarked until the owner accepts the not-drawn forms

- Batch 5 boundary: 6f88816 - S3, S4 (C18 to C32, C34 to C49)
- Batch 5 settled mid-build: the browser runs the engine's legality source through the `@rathe-arsenal/engine/legality` alias (`apps/web/engine-legality-alias.ts`) and reads the card facts `restrictedFormats`, `legalOverrides`, `specializations`, `legendary` from the API; the stage labels read Montando and Jogando; Cancel on a new empty deck calls `DELETE /api/decks/:id/permanent`, which S8 builds (until then it answers 404 and the empty deck stays); C36 and C40 live in `tests/mobile/deck-edit-rules-bar.spec.ts`
- Batch 5 abandoned: C33 stays unmarked until S5 adds the inventory row (a card at 2 in the deck and 1 in the inventory) to its proof
- Batch 6 boundary: a025ba4 - S5, S6 (C33, C50 to C54, C56 to C70, C72)
- Batch 6 settled mid-build: a deck line holds deck and inventory copies (`deck_card.inventoryQuantity`, check `CHK_deck_card_quantities`); readiness entries count both in `quantity` and carry `inventoryQuantity`, the engine returns `missingCopies`; `GET` and `PUT /api/decks/:deckId` return `cards`; `GET /api/decks` returns `deckSize`; the C59 move menu opens from the quantity number; S8 must add the deleted-deck case to the test "put answers 404 for a deck the player cannot edit" (`decks.controller.put.int-spec.ts`) and then mark C55; S17 must repoint the "Ver o que falta" link of the status strip to `/decks/:deckId/missing`; the Tutor, `list-from-deck` and spare copies do not count the inventory yet
- Batch 6 abandoned: C55 (deleted-deck half waits for S8) and C71 (the stage grouping of the home contradicts the order the check lists) stay unmarked
- Batch 7 boundary: d4c3399 - S7, S8 (C73 to C100, C55)
- Batch 7 settled mid-build: `DELETE /api/decks/:deckId` is a soft delete answering `{deletedAt}`, `DELETE /api/decks/:deckId/permanent` is the old hard delete (it also drops a live deck with no cards, so C43's "Cancelar" works); `AuthzService.assertOwnsTrackedDeck` answers 404 for a deleted deck and the restore and permanent routes use `@IncludesDeletedDeck()`; every deck reader filters `deletedAt IS NULL`; the toast has `persistent` and `dismissOnNextAction`; `DeckTile` and the deck page menu delete through `useDeleteDeckWithUndo`; the deck page's "Lista" view is the text view and the deck header is a grid (breadcrumb, title, verdict, actions); the day-30 purge is still S38's
- Batch 7 abandoned: none
- Batch 8 boundary: d24bce1 - S9, S10 (C101 to C118)
- Batch 8 settled mid-build: `/decks/new` is three rows plus a hero search and a format step (the row "Comprei um deck pronto" links to `/add-cards` and the S13 builder must repoint it; "Tenho um link do Fabrary" opens the existing import card, S15 may repoint it); `GET /api/shared/decks/:token` carries `legality` for the deck intent (Surface row added); the deck page mounts `HeroOutsideFormatPanel` and `RuleChangedNotice` in view mode, reads `RULE_CHANGES` through the engine's browser entry and maps each `summaryKey` to its problem in `ruleChangedModel.ts`; a short deck with no rule problem shows the chip "Jogando · N de M cartas" in its header; the deck-detail visual baseline can differ by 22px when the hero list loads late (seen once, passed on rerun)
- Batch 8 abandoned: none

- Batch 9 boundary: 2b6e81f - S11 (C119 to C132, C134 to C138)
- Batch 9 settled mid-build: the collection key is the seven columns and `collection_card` rows differ by version; `GET /api/catalog/cards/:cardIdentifier/versions`, `GET` and `PATCH /api/collection/sources/:id/...` (`copies`, `versions`) and `PATCH /api/collection/cards/:cardIdentifier/versions` exist, `decrement` takes an optional import and version, and `POST cards/batch` takes `printingCode`, `edition`, `finish` (both batch and decrement still answer `201`, as before); `assertVersionBelongsToCard` in `collection-versions.service.ts` is what S12's `PATCH /api/collection/pending/:id` calls; `card_list_line` has the four fields and still its `printing` column (S21 stops writing it; the entity maps `condition` `''` to null for the lists code); the S15 builder rebuilds the rows of `r3-imports-phone` (S11 added only the link), and the card sheet opens from the card name in the Library grid
- Batch 9 abandoned: C133 stays unmarked until S12 adds the `PATCH /api/collection/pending/:id` case to the test "a version the card does not have is refused on every write"
- Batch 10 boundary: 5b0c45a - S12, S13 (C139 to C167, and C133 from batch 9)
- Batch 10 settled mid-build: the reader is one `LineReader` over a catalog lookup (`apps/api/src/collection/reader`), pasted text and files go through `CsvParserService.readText` and `readBuffer`, and the old upload route and its parser stay for re-upload; `POST /api/collection/imports` stores ready lines (copies that differ only by version stay apart) and keeps the rest in `import_pending_line`; `PATCH` and `DELETE` of a source accept every kind but `manual`; product files sit in `apps/api/src/products/data` and `pnpm products:import <url>` writes them; the dev database's kind check is replaced by the database module when it lacks `paste`; the pages are `/add-cards/list`, `/add-cards/sheet`, `/add-cards/product`, `/add-cards/product/:productKey` and `/library-pending`; the collection page is headed "Coleção" with the pending banner on top
- Batch 10 abandoned: none
- Batch 11 boundary: d1e8186 - S14, S15 (C168 to C185), C352 from batch 2, and the Resolver page rebuilt as `r4-resolve-b-phone` (04a37e9)
- Batch 11 settled mid-build: `POST /api/decks/import` takes `text` and a required `ownsCards` and answers `deckId` (+ `source` on yes), `POST /api/decks/import/preview` tells how many of the deck's cards are held; the old `/add-cards/fabrary` tab is gone; `/onboarding` is the first-run chooser (`OnboardingWizard` is unmounted); `/add-cards` is the paste box and four rows; `GET /api/collection/sources` carries `copies` and the manual label by language; the migration moves old Fabrary imports to kind `fabrary`; `UploadCsvButton` and `SumExplainer` are unmounted
- Batch 11 abandoned: none
- Batch 12 boundary: fd8e3de - S16 (C186 to C198, C200, C202)
- Batch 12 settled mid-build: a lookup job is per card (`variant_fetch_job` has `cardIdentifier`, no `userId` or `deckId`, one pending row per card); a lookup is a finished job row; `StoreAnswersService.read` reads the stored states and never queues (S18 and S19 call it), `openForOwner` queues (only the owner's list calls it); `GET /api/decks/:deckId/missing` answers `lines` only (`cardIdentifier`, `deckNeeded`, `inventoryNeeded`, `state`) and S17 adds `summary` and the price fields; the worker has an availability step next to the variant step; `GET /api/admin/stores/:slug/credits` exists; the old fetch route, the queue pill and drawer, and the jobs list are gone
- Batch 12 abandoned: C199 waits for S18 (store states on the group page) and S19 (the `quote` address); C201 is not built because no picked mockup draws the admin credits line, it needs the owner's pick
- Batch 13 boundary: b288d30 - S17 (C203 to C223)
- Batch 13 settled mid-build: a pick takes `quantity` and `side` (`card_replacement.side`, migration `1778533610000`); `PUT /api/collection/owned` answers `400` below what other imports hold and sets the manual source in one statement; `GET /api/decks/:deckId/missing` carries `summary` and the priced lines (it also queues lookups when the deck page's card reads it); the list page is `/decks/:deckId/missing`, the old missing panel, shopping panels and group callout are off the deck page (their components stay unmounted), the status strip's link goes to the list, and the Toast sits at the bottom under 720 px; `deckDetail.missingSplit` is the one fragment of the inventory wording
- Batch 13 abandoned: none (the alternatives sheet has no entry point left and `card-alternatives-flow.spec.ts` was deleted; both are under Needs the owner)
- Batch 14 boundary: e74fce6 - S18, S19 (C224 to C249 except C231 and C249; C199 and C390); the stand-in size fix is 85c66dd
- Batch 14 settled mid-build: the `missing` page and the `quote` page read `DeckMissingService.missingFor(..., 'read')`, which never queues a lookup (`SharedGroupAskService`); `missing[]` cards carry `state`, the priced facts and `owned`, the answer carries `storeSummary`; `/api/auth/me` carries `shareClosingLine`; `POST /api/shared/decks/:token/events` takes `offer` and `quote_sent`; `quote` is in `DECK_SHARE_INTENTS` and `GET /api/decks/:deckId/share` still answers only `deck` and `missing`; one migration (`1778533611000`) widens the four checks and adds `user.shareClosingLine`, and `DatabaseModule` swaps stale checks on a synchronized database; the share sheet is `ShareIntentStep` (three options), `GroupAskStep` and `QuoteLinkStep`; the group step draws no address row, contact switch, image download or turn-off
- Batch 14 abandoned: C231 (needs the spare count of S20) and C249 (its quote half conflicts with C239's exact keys) stay unmarked
- Batch 15 boundary: 42640cc - S20, S21 (C250 to C283, and C231 from batch 14)
- Batch 15 settled mid-build: the spare function is `collection/spare` (pure function, `SpareCopiesService` reader, `GET /api/collection/spare`) and every reader calls it (the Tutor now counts live building, ready and active decks only, hero included, with `per_deck` while no rule is stored and nothing is shared); the rule question and "Por que sobra?" are full pages inside `/spare`, the group page asks the question inline; sell lines carry `printingCode`, `edition`, `finish` and `condition` and the old `printing` input is refused (answers keep the derived `printing` key and label); the draft creates the list, lines, link and closing line and remembers the steps done; `GET /api/auth/me` carries `sellClosingLine`; the want-list view gives a signed-in visitor `owned` and `spare` per line (`spareReason` and the screens are S23's)
- Batch 15 abandoned: none (the LigaFAB address is a guess kept in `apps/web/src/lib/ligafab-link.ts`, and the "Vender o que sobra" row of `r3-lists-new-phone` waits for S25)
- Batch 16 boundary: 0ae4deb - S22, S23, S24, S25, S26 (C284 to C320)
- Batch 16 settled mid-build: the sold route answers the list plus `soldLineId` and `removed`, and a second route `POST /api/lists/:listId/lines/:lineId/unsold` puts a sale back (it refuses a version the card lacks or the line never held); the signed-in visitor of a shared list gets the buyer view (sell) or the trade view (want) only when the answer carries `spareNeedsRule`, which the API always sends, so the four older "logged-in visitor" tests of `SharedListPage.spec.tsx` pass through the old gallery only because their fixtures lack it (they prove `.specs/features/shared-lists/contract.md`, no numbered check) and the owner decides whether they go; `GET /api/shared/lists/:token` gives a want-list visitor `owned`, `spare`, `spareReason`, `spareVersion`, `suggestedCents` and `visitorList`, and a sell line its version; `matches` lines carry `decks`; `POST /api/shared/decks/:token/copy` needs `variant` when a pick is active; sell lines carry `owned`; `get_deck` carries `legality` and `copyLimit`, `swapCandidates` answers `needed`
- Batch 16 abandoned: none (the events `buy` and `offer` are not sent, no check proves them; C313 prices a fresh readiness without stand-in cards, see Needs the owner)
- Batch 17 boundary: cdc914f - S27, S28, S29 (C321 to C344)
- Batch 17 settled mid-build: a swap proposal stores `quantity`, `side`, `missingBefore` and `missingAfter` on its payload (a call that omits `quantity` or `side` still works, as every copy from the deck, and a wrong one answers `ok: false`); `GET /api/chat/conversations/:id` swap displays carry `facts`, `copiesLeft`, `freeCopies` (from the spare function) and `storePriceCents` (stored rows, never a queued lookup); the deck page passes the saved verdict to the Tutor tile and `tutorDeckId` to the checklist sheet for a player with chat access, and `useAskTutor` starts the bound conversation; `IEvalOutcome` carries tool answers and swap quantities, and `--max-usd` refuses a value that is not a positive number
- Batch 17 abandoned: none (C21 of `ai-chat-screens` and the swap card's price line contradict each other, see Needs the owner)
- Batch 18 boundary: 1fa8806 - S36, S37, S38 (C413 to C420, C421 to C446)
- Batch 18 settled mid-build: headings of every card list come from one rule over the slot and first type (`lib/card-groups.ts`, so attack and non-attack actions share "Ações"); `IRationaleDetail` carries `pitchRelation`, `originalClasses` and `candidateGeneric`; a game word's "?" is `GlossaryTerm` inside a `GlossaryScope` that `AppShell` remounts per path, and `/termos` (public) keeps its way back in the navigation state `glossaryFrom`; the housekeeping tick (`apps/api/src/housekeeping`) runs under advisory lock 7201038, keeps sign-in code rows an hour, and the worker registers it
- Batch 18 abandoned: none
- Batch 19 boundary: 68cc87f - S39 (C447 to C452)
- Batch 19 settled mid-build: `import.finished`, `import.pending_line`, `missing.served` and `lists.created` (origin `spare`) are log entries (the older `collection.import` and `collection.pending.*` entries are gone); lists have their own visitor events route `POST /api/shared/lists/:token/events` (`offer` on a want list, `buy` on a sell list) that the message view sends on "Enviar no WhatsApp" and "Copiar texto"; the share report's visitor-action query is `apps/api/src/sharing/share-report-queries.ts`; the owner-list log line is C449, so it is built
- Batch 19 abandoned: none
- Batch X1 boundary: 00fc093 - the visible-UI items of the 2026-10-27 delegation (D2, D3 with D42, D10, D18, D21, D26, D31, D36, D40, D43, D49, D50, D57); C56, C179 and C299 marked
- Batch X1 settled mid-build: the deck list header keeps the plain count ("60 cartas") because the test of `r3-deck-actions-desktop` asserts it, and only the short-deck sentence moved above Pitch; the first-run page reads `GET /api/collection/sources` to count an import with no card; the toast area lifts above the editor's rules bar through a `data-bottom-bar` marker
- Batch X1 abandoned: D44 (the "Escolher por linha" chip stays: `r3-list-phone` draws it and C155 names it, so removing it needs the owner to amend C155); the "Qual cor?" step of the Resolver page stays (no picked screen draws it)
- Batch X2 boundary: 0afb04b - D59 (C404) and D51 (no check; Surface row added); D56 is not built (see abandoned)
- Batch X2 settled mid-build: the per-address code limit counts rows of the last hour with `attempts = 0` (5) and the sum of `attempts` (10), and Retry-After is the longer of the two waits; the deck page card reads `GET /api/decks/:deckId/missing?lookups=read` under its own query key; the test "asking for a new code does not give a guesser more than five tries per code" became "...ten tries per hour" (two rounds of five, then 429)
- Batch X2 abandoned: D56 (account hijack by pre-registration): its finished code contradicts C398, whose proof confirms in a second browser with no session and then shares from the first; the owner amends C398 or narrows D56, patch kept in the scratchpad (`x2-d56.patch`)
- Batch X3 boundary: 363108f - suite stability, C453 and C454 proofs, C404 successful-try fix, C240 count line, test-policy gaps, followups entry AU1
- Batch X3 settled mid-build: a successful code sign-in stores `attempts = -1` so it counts as neither a failed try nor an untried code; the quote's count line now reads "(N cartas menos as que ele já tem)" because the built page still read "(N cartas)"; the real-service 429 proofs sit in `auth-limits.e2e-spec.ts` beside the mocked ones
- Batch X3 abandoned: none
