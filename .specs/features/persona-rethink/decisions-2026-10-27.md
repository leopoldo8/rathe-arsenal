# Decisions taken under the owner's delegation, 2026-10-27

The owner delegated the open decisions of the "close the deck" branch in these words (2026-10-27, verbatim):

> "muita decisão para eu tomar / tome as decisões por conta propria com ajuda do advisor e subagentes para pesquisa e adversarial / deixe para mim somente as extremamente necessárias"

Every row below was decided by the orchestrator under that delegation, with an adversarial review (`screen-A`) and a research pass (`research-B`) as input.
None of them was picked by the owner.
The owner keeps D23, D27, D29 and D53, and the question of whether to pursue arrangement checks for every journey to reach a PASS verdict.
D53 waits for the round 6 mockups.

Check text changed by these decisions carries the suffix "amended 2026-10-27 (delegation, D<n>)" on its claim line.
The decisions that need code or tests are handed to the builders as a separate list.
The plan files are not edited: `plan.md` of this feature still lists `200` for the batch and decrement routes in its Surface, and the amended checks and Coverage rows say `201`.

| D | Title | Choice | Kind | Reason | Source |
| --- | --- | --- | --- | --- | --- |
| D1 | Home deck order | a: keep the grouping by stage; C71 rewritten, proof points at the two existing home tests | spec-text-fix | grouping predates the feature and is tested; the picked flat list is not built | screen-A D1 |
| D2 | Where "31 de 40 cartas no deck" sits on the deck page | a: move the sentence under the header, above Pitch | build-as-drawn | check and picked screen agree; the editor list header keeps its own copy | screen-A D2 |
| D3 | Card pool line | a: the longer copy-rule-6 line sits in the checklist row (C37) and in the editor header only when the header shows; C56 amended | build-as-drawn | resolves the clash with D42, because the common deck has no header | screen-A D3 vs D42 |
| D4 | "GEM" in the copy-list tab name | a: keep it out | game-fact | whether GEM reads the text could not be confirmed (site returned 403) | research-B D4 |
| D5 | Group order in the Lista view | a: Deck before Inventário, as built | accept-as-built | a test asserts it and it costs nothing | page |
| D6 | Replacement re-solve drain in C92 | a: dropped from the claim; the 410 stub test of the re-solve routes is now a Proof line of C92 | spec-text-fix | the routes no longer drain anything; the stub assertion must not lose its last proof | screen-A D6 |
| D7 | Status of scanner batch and decrement | a: C134 and C136 say 201 | spec-text-fix | Nest POST default and the pre-feature routes answer 201 | screen-A D7 |
| D8 | Banner and tabs on the pending-lines screen | a: C157 says the banner, the heading "Coleção" with one link "Importações", no tabs | spec-text-fix | the picked screen is the design | screen-A D8 |
| D9 | Token names on the ready-made confirm screen | a, scoped: the C161 sentence holds for Armory Deck: Kayo only | game-fact | the repo has one product file and no other box is known | screen-A D9 |
| D10 | First-run for an import with zero cards | a: any import counts as data, even all-unresolved; C179 keeps its claim | build-as-drawn | otherwise the player never sees the lines just uploaded | screen-A D10 |
| D11 | Empty account that signs in later | b: only the sign-up path goes to first-run; C179 says so | spec-text-fix | the home empty state already offers import | screen-A D11 |
| D12 | Title or eyebrow on the group-ask editor | a: title "Pedir as cartas que faltam", no eyebrow; C236 | spec-text-fix | fewer words on a phone sheet | screen-A D12 |
| D13 | Count line on the quote page | a: "(27 cartas menos as que ele já tem)"; C240 | spec-text-fix | tells the store why the number is smaller | screen-A D13 |
| D14 | Message preview on the quote page | a: the standing "Prévia da mensagem" block with its placeholder is part of C244 and C248 | spec-text-fix | the picked screen draws it standing | screen-A D14 |
| D15 | Deck/inventory split on the quote page | b: drop the quote half of C249; C239 stays at six keys | spec-text-fix | a store needs the total; the split is private detail | screen-A D15 |
| D16 | Number on the "cópias sobrando" banner | a: no number, as built | accept-as-built | matches check and picked screen | page |
| D17 | "Vendida" on sold lines | a: shown on every unsold line only; C288 | spec-text-fix | a button that does nothing confuses; a deliberate narrowing of "always" in the document | screen-A D17 |
| D18 | "Lista do Marcos" or "Lista de Marcos" | a: "de" before every name; C299 example changes | build-as-drawn | a copy rule, not a literal drawing: the pictures show "do Marcos" and "de Duda" | screen-A D18 |
| D19 | One call or two for a Tutor question | a: C339 says two calls | spec-text-fix | code and three proofs agree | screen-A D19 |
| D20 | Sign-in sheet when a session ends mid-edit | a: accept as built | accept-as-built | reuses picked screens; cheap to change | page |
| D21 | Unconfirmed e-mail line placement | c: on the home and on the first-run chooser | build-as-drawn | a new account lands on the chooser; the picked home screen carries the line above the chooser | screen-A D21 |
| D22 | Where the code messages sit | b: the expired and wrong-code messages stay above the boxes; no text change | accept-as-built | the only picked screen for an expired code draws it above; "Faltam números" stays under as built | screen-A D22 |
| D23 | Password change needs only a session | left to the owner | new-ui | needs a screen nobody drew | page |
| D24 | Create/change password form | a: accept as built | accept-as-built | flow works and reuses Settings style | page |
| D25 | Accessibility scan pages | b: C7 covers six pages, adding the shopping list | test-only | most new interface; the scan is automatic | screen-A D25 |
| D26 | Name the Resolver page and the credits bar | a: new checks C453 and C454 | test-only | without a check a later change breaks either screen with suites green | screen-A D26 |
| D27 | Alternatives sheet entry point | left to the owner | new-ui | retiring deletes a feature | page |
| D28 | Price on the Tutor swap card | a: ai-chat-screens C21 and AC 24 say "no spend figure"; a store price is allowed | spec-text-fix | a store price is not the budget C21 meant to hide; a priced-card test is added | screen-A D28 |
| D29 | "Enviar CSV" on Importações | left to the owner | new-ui | needs two mockups | page |
| D30 | The "•••" menu on import rows | a: keep | accept-as-built | no other place for rename and delete | page |
| D31 | Toasts at the bottom under 720 px | a: accept; the toast must sit above the editor bottom bar | accept-as-built | the top is where the sticky summary lives | screen-A D31 |
| D32 | "Pedir orçamento a uma loja" step | a: accept | accept-as-built | small and reuses the deck step parts | page |
| D33 | Settings panel "Cartas sobrando" | a: accept | accept-as-built | a single row in Settings | page |
| D34 | Landing after sending a sell list | a: open the new list | accept-as-built | the list is saved and seeing it confirms it | page |
| D35 | Galleries vs rows on sell, buy and trade | a: keep galleries and the dialog | accept-as-built | rows would be a rewrite | page |
| D36 | Old "Marcar como vendida" button | a: remove it; rewrite the ListEditor test, do not delete it | build-as-drawn | every sale asks about the collection; a test is rewritten, not dropped | screen-A D36 |
| D37 | Width of the Tutor tile | a: keep the rail tile | accept-as-built | consistent with the rail | page |
| D38 | One "Ações" heading | a: accept | accept-as-built | nothing depends on the split | page |
| D39 | Glossary translation drift | no drift: pt-BR is the original and the 31 sentences equal the document | game-fact | checked entry by entry | research-B D39 |
| D40 | "?" on the shared format chip | a: add it | build-as-drawn | copy-and-access rule puts a "?" on every explained word at first use | screen-A D40 |
| D41 | Lista toggle keeps three buttons | a: keep | accept-as-built | the two grouping modes already existed | page |
| D42 | Editor header and second stepper with no inventory | a: hide both | build-as-drawn | matches the drawn phone editor for the common case | screen-A D42 |
| D43 | "Stage" line on the retire sheet | a: add the line | build-as-drawn | drawn in b2-stage-retire-phone | screen-A D43 |
| D44 | "Escolher por linha" chip | a: remove it | other | a chip that does nothing is worse than none | screen-A D44 |
| D45 | Condition choices NM/LP/MP/HP | a: as drawn, without DMG | game-fact | add DMG only if known to be used | page |
| D46 | Order of printings in the card sheet | a: catalog order | game-fact | no rule is recorded | page |
| D47 | Where a card opens in the Library | a: from its name | accept-as-built | rows would be a rewrite | page |
| D48 | Opener of the "Mover 1 para o inventário" menu | a: accept the tap on the quantity | accept-as-built | reversible | page |
| D49 | Cause line wording for three problems | a: leave blank; builders check the chip renders no empty line | game-fact | the red verdict chip and the checklist still show the problem | screen-A D49 |
| D50 | Delete on the edit page | b: call the deck page soft delete with the undo toast; the "Não dá para desfazer" text goes and its test is updated | build-as-drawn | one delete behaviour, no new copy; the drawn flow has no confirm dialog | screen-A D50 |
| D51 | Deck page spending price-lookup credits | a: the deck page reads stored prices only | cost-or-prod | AC 115 and the design say only the owner list triggers a lookup | screen-A D51 |
| D52 | LigaFAB link | keep the link; its landing is unconfirmed (site returned 403); listed under Optional owner checks | game-fact | costs one click to confirm | research-B D52 |
| D53 | Missing-link share step cannot turn the link off | left to the owner (round 6 mockups being made) | new-ui | needs drawing | page |
| D54 | Four dead tests for the signed-in visitor | keep the four tests | test-only | conservative: they prove shared-lists/contract.md | screen-A D54 |
| D55 | "Não é você? Trocar" | a: name the exception in check C2, the rule that bans "trocar" | spec-text-fix | the picked screen draws it and the string is in the account namespace | screen-A D55 |
| D56 | Confirming by link keeps a password someone else set | b+: when the e-mail is confirmed from a browser that is not signed in, end every other session and clear the password, so the account signs in by code until a password is set again | other | ending sessions alone leaves the attacker with the password | screen-A D56 |
| D57 | E-mailed button used twice or after 15 minutes | a: one line "Este link já foi usado ou venceu. Peça um código novo." | build-as-drawn | new copy no picked screen draws; listed under Needs the owner as undrawn copy | screen-A D57 |
| D58 | Deleted account at the start step | b: leave as is | other | sign-up rejects deleted rows, so the change would create a dead end | screen-A D58 |
| D59 | Stranger can lock an owner out of code sign-in | a with a floor: C404 counts codes asked and never tried (5 an hour) and 10 failed tries per address per hour across codes | other | removes the lock-out by burnt tries without removing the guessing limit | screen-A D59 |
| D60 | Fresh-database run | a: approved, a throwaway Postgres container with its own name and port, never rathe-arsenal-pg | other | only a fresh database shows what CI sees | screen-A D60 |
| D61 | Two unused routes | keep both | other | the main branch still calls them | research-B D61 |
| D62 | Tutor model eval | deferred | cost-or-prod | needs a model key and money | screen-A D62 |
| D63 | product-add-flow.spec.ts named by no check | a: named in the Proof of C161 and also run at phone width | test-only | an unnamed test can be deleted unnoticed and the product is used on phones | screen-A D63 |
| D64 | "Deck pronto" eyebrow on the confirm screen | b: accept as built, no eyebrow | accept-as-built | fewer words on a phone screen | screen-A D64 |

## Test-policy gaps the verifier listed

No new check is needed for these: an existing check already states each one, and the missing part is in the tests.

- C22 (weapons and equipment in the pool): C22 already says "deck + inventory + weapons + equipment and never the hero"; the builders add rows with a weapon and equipment to the table-driven test.
- The 12 reader header and spelling members: C144 and its Coverage row ("CSV headers (12)") already name all twelve; the builders make the test assert each of the twelve members.
- The 429 proofs run with real auth: C350, C401, C404, C405 and C406 already claim the statuses; the builders run their api e2e proofs with the real `AuthService`, not a mock.
