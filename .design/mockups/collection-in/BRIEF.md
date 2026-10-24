# Getting cards in: mockup brief (three structural alternatives)

Journey 2 of the 2026-10-21 persona audit: putting the cards a player owns into the collection.
Personas: P1 Bia (beginner, just bought an Armory Deck), P5 Lucas (returning player, a 300-line spreadsheet of an old box), P4 Duda (trader, pastes text lists, cares about the version of each copy), P2 Caio and P3 Marcos (import from Fabrary links).
Findings this journey answers: F50 (sealed product), F15 (no paste-a-list, no typo tolerance, no "Snatch red"), F35-F38 (CSV hides skipped rows, one comma rejects the file, Portuguese headers and "(Vermelho)" not understood, truncated source names), F28 (Fabrary links players actually paste are rejected), F47 (no version in the collection), F44 (source picker off-screen, "Manual entries" in English).

Owner decisions (2026-10-21):
- The collection may record the version of each copy (printing, edition, finish, condition), optional, same vocabulary as sell lists. Deck readiness keeps matching by name and pitch only. "Versão não informada" is a normal state, never an error.
- "Comprei um deck pronto": Armory Decks, Blitz Decks and Silver Age decks, from the official decklists (fabtcg.com/decklists), stored in the app.

## Rules every alternative shares (not up for comparison)

- Nothing is dropped silently. Every import ends on a report: what came in (copies and cards), and every line not recognized, with its line number, the reason in plain Portuguese, and a fix in place (pick the color, accept the suggested name, correct the quantity). Good lines are imported even when others fail.
- Pitch is accepted in English and Portuguese and as a number: "(Red)", "red", "vermelho", "(1)"; same for yellow/amarelo/2 and blue/azul/3. A card printed in one color only needs no color. One typo is tolerated with a suggestion ("Você quis dizer Command and Conquer (Vermelho)?").
- A name that exists in more than one color with no color given is never guessed: the line asks "Qual cor?" with the three options as buttons.
- Pasted text and a CSV file go through the same reader and the same report.
- A Fabrary deck link is found inside whatever is pasted (with or without https, fabrary.net or fabrary.com, inside a WhatsApp sentence).
- Each import becomes a named source the player can see and remove later ("Armory Deck: Kayo", "colecao-lucas.csv", "Lista colada em 21/10"); the source list says once that the same card in two sources is summed, and offers to turn a source off.
- Version is optional everywhere. Words: "versão" (the printing: collection and art), "edição" (1ª edição, Unlimited), "foil" (Rainbow Foil, Cold Foil), "estado" (NM, LP...). Each term has a one-line hint the first time.
- All copy pt-BR, no em dashes, no raw error codes or JSON. Card names in English with the pitch as a word.

## Scenario (illustrative values, consistent across mockups)

**Bia: Armory Deck: Kayo** (official list, fabtcg.com/decklists/kayo-armory-deck): hero Kayo, Armed and Dangerous; Beaten Trackers, Hide Tanner, Knucklehead, Mandible Claw, Savage Sash (1 each); ×3 each: Bare Fangs (Vermelho), Clash of Agility (Vermelho), Humble (Vermelho), Pulping (Vermelho), Rally the Rearguard (Vermelho), Savage Beatdown (Vermelho), Strength Rules All (Vermelho), Wild Ride (Vermelho), Wreck Havoc (Vermelho), Bare Fangs (Amarelo), Agile Windup (Azul), Assault and Battery (Azul), Battlefront Bastion (Azul), Mighty Windup (Azul), Pound Town (Azul), Reincarnate (Azul), Riled Up (Azul), Run Roughshod (Azul), Smash Instinct (Azul), Wrecker Romp (Azul). Total: 66 cartas (60 no deck + herói + 5 equipamentos e armas). Format Classic Constructed.
Searching "kayo" among products returns: "Armory Deck: Kayo" (Classic Constructed), "Silver Age Chapter 1: Kayo" (Silver Age), "Blitz Deck: Kayo" (Blitz).

**Duda: pasted list** (8 lines, exactly):
```
3x Snatch (Red)
2 Command and Conquer vermelho
1 Enlightened Strike foil
comand and conquer
4 Pummel
Sink Below (Amarelo) x2
3x Pack Hunt (3)
Mistery Card
```
Expected reading: line 1 ok (3 Snatch (Vermelho)); line 2 ok; line 3 ok as "Enlightened Strike (Vermelho) · foil · qual versão?": the card is recognized and counts, and "foil" only pre-selects the finish once the player picks the printing (the card exists in more than one foil, so the app does not guess); line 4 one typo, suggestion "Command and Conquer (Vermelho)", quantity 1; line 5 needs a color ("Qual cor?"); line 6 ok (2 Sink Below (Amarelo)); line 7 ok (3 Pack Hunt (Azul)); line 8 not found, "Não achamos essa carta. Confira o nome" with an edit field.

**Lucas: CSV** `colecao-lucas.csv`, 300 lines, Portuguese headers `nome,quantidade,cor`:
- 289 lines read, 612 cópias (241 cartas), including line 8, read with a note: "Rhinar, Reckless Rampage" had a comma without quotes; read anyway.
- 11 to resolve: 7 "sem cor" (Snatch, Pummel, Sink Below, Pack Hunt, Wounding Blow, Head Jab, Scar for a Scar), 3 "nome não encontrado" each with a suggestion, 1 "quantidade não é um número" (line 141: "três").
- Check: 289 + 11 = 300. Duda's paste: 5 lines ok (3+2+1+2+3 = 11 cópias) + 1 suggestion (1) = 6 lines, 12 cópias; 2 to resolve.

**Caio: Fabrary** pasted text: `olha meu deck https://fabrary.net/decks/01J0Z8K4M2 valeu` → "Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas".

**Duda: versions in the library**: Snatch (Vermelho), 3 cópias: 2 "versão não informada", 1 "Welcome to Rathe · Unlimited · Rainbow Foil · NM".

## Alternative A: "O que você tem em mãos?" (a chooser, then one screen per path)

The add-cards entry asks what the player is holding, in plain words, and each answer opens its own screen. Paste and file share one screen. Tabs are removed.

1. **a1-entry-phone**: title "Adicionar cartas". Four large choices with one line each: "Um deck pronto, na caixa" ("Armory Deck, Blitz Deck ou Silver Age"), "Um link do Fabrary", "Uma lista ou planilha" ("Cole o texto ou envie um arquivo"), "Cartas soltas" ("Fotografe ou digite o nome"). The same screen is the first-run screen after sign-up, with the title "Como você quer começar?".
2. **a2-product-phone**: product search, "kayo" typed, the three results with the hero image, product type and format; Armory Deck: Kayo selected.
3. **a3-product-confirm-phone**: "Armory Deck: Kayo · 66 cartas". Two switches, both on: "Criar o deck Armory Deck: Kayo" and "Colocar as 66 cartas na minha coleção". A collapsed list of the cards. Button "Adicionar". Note: "As cartas entram com a versão do Armory Deck: Kayo." (the catalog tags each printing with its product: AKO001 to AKO026; Hide Tanner and Savage Sash exist only in Rainbow Foil there, so they come in as foil; cards that exist in both come in as the regular version). The 2 tokens in the box (Agility, Might) are not added.
4. **a4-list-phone**: "Uma lista ou planilha": a text area with Duda's 8 lines pasted, and "ou enviar arquivo (.csv)". Below, live, the reading line by line: 5 ok, 1 suggestion, 1 "Qual cor?" with three buttons, 1 not found. Button "Adicionar 6 linhas (12 cópias)" plus "2 linhas para resolver".
5. **a5-report-phone**: Lucas's CSV report: "289 de 300 linhas entraram · 612 cópias (241 cartas)", a note "1 linha lida com observação" (line 8), then "11 para resolver" grouped by reason (Sem cor 7, Nome não encontrado 3, Quantidade 1), each row with its line number and the fix in place. Button "Adicionar as resolvidas".
6. **a6-version-phone**: Library card sheet for Snatch (Vermelho): "3 cópias", one row per version group ("2 · versão não informada · Informar versão", "1 · Welcome to Rathe · Unlimited · Rainbow Foil · NM"). "Informar versão" opens pickers: Versão (list of printings with collection name and code), Edição, Foil, Estado, and "Quantas cópias são dessa versão? 1 2".

## Alternative B: one box that understands what you paste

One input on the add-cards page: "Cole aqui um link do Fabrary ou uma lista de cartas", plus "Enviar planilha" and two big buttons: "Fotografar cartas" and "Comprei um deck pronto". The box detects what was pasted.

1. **b1-entry-phone**: the box (empty, with the placeholder showing both examples), "Enviar planilha (.csv)" link under it, then the two big buttons. First-run version: title "Como você quer começar?" and "Comprei um deck pronto" first.
2. **b2-detect-link-phone**: Caio's WhatsApp sentence pasted; under the box: "Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas" with "Importar o deck" and a switch "Colocar as cartas na minha coleção".
3. **b3-detect-list-phone**: Duda's 8 lines pasted; the box shows the reading line by line inline (same outcomes as A4), line 3 shows "foil · qual versão?" as in A4; button "Adicionar 6 linhas (12 cópias)".
4. **b4-product-phone**: "Comprei um deck pronto": search "kayo", results, and selecting one expands inline to the confirm content of A3 (switches, card list, "Adicionar"), one screen instead of two.
5. **b5-report-phone**: Lucas's report, as A5 but as a sheet over the page, with "Resolver depois" that keeps the 11 lines in a "Para resolver" badge on the Library.
6. **b6-version-phone**: versions set during import: on b3, each recognized line has a small "versão" chip; tapping it opens the same pickers as A6 for that line. In the Library, the card sheet shows the version groups read-only with "Editar".

## Alternative C: start from the deck, add loose cards from the Library

The first run is deck-centric: "Qual deck você tem?" finds both products and Fabrary decks. Adding loose cards lives in the Library, as one "+ Adicionar" sheet. There is no add-cards page.

1. **c1-first-run-phone**: "Qual deck você tem?" with one search field: typing "kayo" lists products (the three) and, below, "Tem um link do Fabrary? Cole aqui". A small "Não tenho deck ainda, quero só guardar cartas" link goes to the Library.
2. **c2-product-confirm-phone**: as A3, reached in one tap from c1.
3. **c3-library-add-phone**: Library with a "+ Adicionar" button open as a bottom sheet: "Colar uma lista", "Enviar planilha", "Fotografar", "Digitar o nome", "Comprei um deck pronto".
4. **c4-list-phone**: "Colar uma lista" inside the sheet, with Duda's lines and the same reading as A4.
5. **c5-report-phone**: Lucas's report as a full page, as A5, and afterwards a Library banner "11 linhas de colecao-lucas.csv para resolver".
6. **c6-version-phone**: versions from the scanner: after a photo, "Snatch (Vermelho) · WTR... lida pela foto" with "É foil?" Sim/Não and "Estado" chips, then the Library card sheet with version groups as in A6.

## How to build

- One HTML file per screen at `.design/mockups/collection-in/<id>.html`, plus `index-a.html`, `index-b.html`, `index-c.html`.
- Copy the `:root` tokens and base classes verbatim from `.design/mockups/sharing/contact/shared-deck-a-phone.html` (dark theme, Hanken Grotesk, Newsreader, brass accent). Phone frame 390 px wide, `<html lang="pt-BR">`.
- NO caption, label or note outside the phone frame. The file name is the only label.
- Card images from `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/<CODE>.webp` only for codes you are sure of; otherwise the neutral placeholder tile. Hero image for Kayo may use a placeholder.
- Low-to-mid fidelity: structure, copy and numbers matter; use the scenario numbers exactly. No em dashes or en dashes in UI copy. Touch targets at least 44 px.

## Notes for the combined spec (journey 2)

- A pasted or CSV "foil" without a printing cannot be stored: the version vocabulary (sell lists' `identifier[.edition][.foil]`) needs a collector code. "foil" only pre-selects the finish once a printing is picked.
- The product import records each card's printing from the catalog's product-tagged printings (`set` = "Armory Deck: Kayo" → AKO codes). Where a card exists in the product both regular and foil, copies come in as regular; where only foil exists, as foil. Tokens (Agility, Might) are left out.
- The import script for official decklists must compare each official list against the catalog's cards for that product and print the differences (Armory Deck: Kayo: official 26 distinct cards, catalog 28 = the 26 + 2 tokens).
- "Each import becomes a named source" changes onboarding: today `POST /decks/import` seeds the manual source with the highest quantity across decks (`apps/api/src/decks/import/decks-import.service.ts:245-260`). A named source per product makes it removable as a unit.
- The collection's unique key `(userId, cardIdentifier, sourceId)` must grow to hold more than one version of the same card in one source.
