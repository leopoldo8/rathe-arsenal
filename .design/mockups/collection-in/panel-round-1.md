# Getting cards in: persona panel, round 1 (2026-10-21)

Five simulated personas compared alternatives A (chooser), B (one box that detects) and C (deck-first, add from the Library), shuffled per persona, no captions on the screens.
Unlike journey 4, each persona picked per part, not a whole alternative. Some personas mixed up proposal numbers in their text; picks below are mapped from what they described, not from the number they wrote.
These are simulations built from research, not user evidence.

## Picks per part

| Part | Bia (P1) | Caio (P2) | Marcos (P3) | Duda (P4) | Lucas (P5) |
|---|---|---|---|---|---|
| Entry | A | B | B | B | A |
| Ready-made deck | A (two screens) | n/a | n/a | B (inline) | n/a |
| Pasted list | A | B | A or C | B | A |
| Spreadsheet report | (C banner) | n/a | B "resolver depois" + C banner | C banner | C (by a hair) |
| Version of a copy | none needed: the product fills it | per line, optional (B) | per line at paste + bulk default | per line (B) + A's library summary | A sheet, but needs "não sei" and bulk |

The entry splits by who is arriving: the beginner and the spreadsheet owner want to be told the choices in plain words (A); the three who already have a link or a text want one box that understands it (B). Both are right for their case.

## Where they agree

1. **"Adicionar 6 linhas (12 cópias)" next to "2 linhas para resolver" is ambiguous** (Caio, Duda, Marcos, Lucas): do the two lines get lost? Does the highlighted suggestion enter by itself? The button must say what happens to the rest.
2. **A version picker with values already selected records a guess as if it were the player's** (Marcos, Duda). Nothing is pre-selected unless the app knows it (the ready-made deck does).
3. **Recording versions one card at a time does not scale** (Marcos ~80 cards, Lucas 241, Duda a whole box): a default for the whole import ("Sem foil · NM", or "não sei") with exceptions, and reading "foil", "cold foil", "1ª", "NM", "LP" straight from the pasted text, asking only what is left.
4. **"Versão não informada" must not look like a pending task** (Caio). It is the normal state.
5. **The report must let you add what is ready and resolve the rest later, and the rest must stay visible** in the collection ("11 linhas de colecao-lucas.csv para resolver") (Lucas, Duda, Marcos, Bia).
6. **"3x Pack Hunt (3)": the reading must show how "(3)" was read** (Caio, Duda): "(3) = Azul".
7. **Jargon**: "fonte" (Bia, Duda), "foil", "fichas", NM/LP/MP/HP, "versão" vs "edição" (Duda, Bia), "Lemos 8 linhas: 5 certas..." (Bia), "Fabrary" unexplained for a beginner (Bia).

## New finding, not in the 2026-10-21 audit

- **A friend's Fabrary deck is not my collection** (Caio). Importing a deck from someone else's link must not put its cards in the collection, or readiness becomes false. Today two paths do exactly that: the "Deck do Fabrary" tab of add-cards writes the deck's cards into the collection by design, and the onboarding import seeds the collection by default (`seedInventory` true, `apps/api/src/decks/import/decks-import.service.ts:101`). Caio's fix: on "deck encontrado", ask whose cards these are, and offer "Cole a lista do que eu tenho" right there.

## Per part, what to keep

- **Entry**: B's box on top (paste a link or a list, it detects), with A's plain choices below it ("Um deck pronto, na caixa", "Enviar planilha", "Fotografar", "Digitar o nome"). For a new account the first-run screen leads with "Um deck pronto, na caixa" and does not open with a Fabrary sentence (Bia's top change).
- **Ready-made deck**: A's two short screens (search, then confirm); explain both switches in plain words and drop "fonte".
- **Pasted list**: reading on the same screen as the text, file upload next to it (A and B), undo after a color pick (Marcos), a thumbnail next to a suggested name (Lucas), and a confirm button on a corrected name (Duda).
- **Report**: "Adicionar as N prontas" plus "Resolver depois", the unresolved lines kept as a banner in the collection (C), "289 prontas" instead of "289 entraram" before the button (Duda), and the original text of each line next to its number.
- **Version**: per line at paste or import, with a bulk default and nothing pre-selected; in the collection, the per-version summary of A shown quietly, not as a task.

## Asked for, outside this journey

- Price per version and "à venda" in the collection (Duda): journey 5.
- Importing the Fabrary collection itself, not only decks (Marcos): the app's Fabrary client reads one deck by link (`apps/api/src/fabrary/queries/get-deck.query.ts`); a collection import would need another Fabrary query.
- "Não sei a cor" for a name-only spreadsheet line (Lucas): what the app should do with it is open; the safe answer is keeping it in "Para resolver".

## Prompt-shaped caveats

- Marcos's "Cold Foil só de coleção" and Duda's "abriu caixas" came from their prompts and shaped how much they cared about versions.
- Lucas's "não sei a cor" was invented by the persona (his file has names only); it is plausible for an old spreadsheet.

## Owner decision after round 1 (2026-10-21)

- Importing a deck from a Fabrary link always asks "Essas cartas são suas?", with no answer pre-selected: "Sim, colocar na minha coleção" / "Não, é só a lista do deck", and offers "Cole a lista do que você tem" next to it. A ready-made deck from a box does not ask. This replaces today's two silent writes: the add-cards "Deck do Fabrary" tab (collection only, by design) and the onboarding import's default `seedInventory: true` (`apps/api/src/decks/import/decks-import.service.ts:101`).
