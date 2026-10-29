# Getting cards in: ready-made decks, lists, spreadsheets, Fabrary links, and the version of each copy

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-21. Implementation waits for the combined spec. Direction from two persona rounds and the owner's answers the same day; screens are the round-3 mockups in `.design/mockups/collection-in/index-r3.html`.
> Implementation waits for the one spec that covers every journey of the 2026-10-21 audit (owner, 2026-10-21). This document is journey 2's input to that spec.

## Situation

- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`), journey 2 of 7: putting the cards a player owns into the collection.
- How the design was reached: three structural alternatives (chooser, one smart box, deck-first) reviewed per part by five simulated personas (`.design/mockups/collection-in/panel-round-1.md`), a combined design re-run by the same personas (`panel-round-2.md`), and the fixes drawn as round 3. Simulation built from research, not user evidence.
- Decided by the owner in this session: the collection may record the version of each copy, optional, with the sell lists' vocabulary; "Comprei um deck pronto" for Armory Decks, Blitz Decks and Silver Age decks from the official decklists; importing a Fabrary deck always asks whose cards they are, with no answer pre-selected.
- Related: journey 4 (`.design/close-the-deck.md`) reads the collection through readiness, which keeps matching by name and pitch; the "preferred version" it parked depends on this document's version model.

## Problem

- A beginner who just bought an Armory Deck has no way in except a Fabrary link or adding about 25 distinct cards one by one, about 100 taps on a phone (F50). The onboarding and `/decks/new` both start from a Fabrary link.
- A player with a list cannot paste it: there is no text import, a typo or "Snatch red" finds nothing, and "Snatch (Vermelho)", the format the app itself writes in its WhatsApp texts, is not read (F15, F37).
- A spreadsheet import hides which rows were skipped and why (F35), one unquoted comma rejects the whole file with raw JSON on screen (F36), Portuguese headers and a pitch column silently produce an empty import (F37), and each failed try leaves an empty source behind.
- Fabrary links as players paste them (without `https://`, `fabrary.com`, inside a WhatsApp sentence) are rejected, and a missing deck is blamed on the catalog (F28).
- Importing a friend's Fabrary deck puts its cards in the importer's collection: the add-cards "Deck do Fabrary" tab writes the deck's cards to the collection by design, and the onboarding import seeds the collection by default (`seedInventory`, `apps/api/src/decks/import/decks-import.service.ts:101`). Readiness then reports a deck as owned that the player does not own (found in persona round 1, not in the audit).
- The collection records no version, edition, finish or condition (F47): value is approximate, the Set filter lists sets the player never owned, and a Cold Foil counts like a common. The scanner reads the collector code and throws it away (`apps/web/src/components/card-scanner/CardScanner.tsx:253-255`).
- Source names are cut to "0…" on a phone, "0 cartas importada" has a plural bug (F38); the "Remover 1 de" picker opens off-screen and names the manual source "Manual entries" (F44).

## Success

- Worked if, 30 days after the release to the Pelotas group:
  - no import ends with a line that is neither added nor kept in "Para resolver" (checked by the import log, every import);
  - at least 5 accounts start with a ready-made deck;
  - at least half of the "Para resolver" lines created are resolved or deleted by their owners;
  - Fabrary imports record the owner's answer to "Essas cartas são suas?", so the share answered "não" says how often the old default was wrong.
- Going wrong: imports with many "Para resolver" lines that nobody resolves, or players who abandon the ownership question (imports started, never confirmed).
- Review: 30 days after the release - Rodrigo, from [Measuring it](#measuring-it).

## Boundary

In: a ready-made deck chooser backed by stored official decklists; one reader for pasted text and CSV files with a line-by-line report, partial import and a persistent "Para resolver" list; Fabrary link extraction from any pasted text and an explicit ownership answer; an optional version per copy (printing, edition, finish, condition), set per import in bulk, per card, read from pasted text where unambiguous, and from the scanner's collector code; the sources list renamed "Importações" with its layout and copy fixed.

Out: price per copy and "à venda" in the collection (journey 5).
Out: importing the Fabrary collection itself (the app's client reads one deck by link, `apps/api/src/fabrary/queries/get-deck.query.ts`).
Out: matching readiness by version (readiness keeps name and pitch; journey 4's "preferred version" builds on this model later).
Out: ready-made products other than Armory, Blitz and Silver Age decks.

Unchanged: readiness and AD-012; the 20-copy cap per card (AD-008's `LEAST(..., 20)`); sources summing across active imports; the manual source being always active.

## Prior art

- Fabrary and FaB Bazaar text exports ("3x Snatch (Red)") are what players paste - we read that format and its Portuguese and numeric variants.
- The app's own sell lists already store a version as `identifier[.edition][.foil]` with a condition (`apps/api/src/lists/printing-key.ts:31-50`) - we reuse that vocabulary, so a copy can move from the collection to a sell line without translation.
- The official decklists on fabtcg.com (for example `https://fabtcg.com/decklists/kayo-armory-deck/`) list each card with quantity and pitch in plain HTML - we store them instead of depending on Fabrary at onboarding; Fabrary also flags precon decks, kept as a fallback for products without an official list.

## Shape

An import is a named, removable record that holds the copies it brought in, each copy optionally carrying a version; the collection is the sum of active imports, as today.
Pasted text and CSV files go through one reader that turns each line into a card, a question, or a "Para resolver" item; nothing else can happen to a line.
A ready-made deck is a stored decklist with the printing of each card; importing it creates an import of that name and, if asked, a deck.

The door is the collection row's identity: once copies carry versions, a card can hold several rows in one import, and every reader of `collection_card` sums across them.

## Key decisions

1. **The version of a copy is optional and never guessed.** It is four separate optional fields: printing code (the collector code, such as WTR167), edition (First, Alpha, Unlimited), finish (Rainbow, Cold, Gold) and condition (NM, LP, MP, HP, DMG), with the sell lists' vocabulary; the sell lists' key (`identifier[.edition][.foil]`) is built from them only when the printing is fully known, for example when a copy moves to a sell line. The app fills it only when it knows: a ready-made deck's printings, the scanner's collector code, or pasted words that leave one candidate. A pasted "foil" for a card with two foil printings stays "foil · escolha a versão"; nothing in a picker is pre-selected. "Não sei" is the one word for an unknown, and an unknown version is shown in grey, never as a pending task.
2. **Readiness ignores versions.** A copy counts for a deck by name and pitch, as today.
3. **Nothing is dropped silently.** Every line of a paste or file ends as added, as a question answered on the spot, or as a "Para resolver" item stored in the collection with its import, line number and original text, until the player resolves or deletes it.
4. **Pasted text and CSV share one reader.** Pitch is read in English, Portuguese or as a number ("(Red)", "vermelho", "(3)"); a card printed in one color needs none; one typo yields a suggestion with the card's image, counted only after the player accepts it; Portuguese headers (`nome`, `quantidade`, `cor`, `versão`, `estado`) are read; a comma inside a known card name without quotes is read and noted; the report says which columns it read.
5. **Every import is named and removable**, and the list of imports is called "Importações". Kinds: a file, a paste, a ready-made deck, a Fabrary deck, and the always-on hand entries ("Entradas à mão").
6. **A Fabrary deck never fills the collection without an answer.** "Essas cartas são suas?" has no default; "Não, só quero comparar com o que eu tenho" imports only the deck and offers to paste the player's own list next to it. A ready-made deck from a box does not ask.
7. **Ready-made decks come from stored official decklists**, refreshed by a script that reads an official decklist page, records each card's printing from the catalog's printings tagged with that product, leaves tokens out, and prints any difference between the official list and the catalog's cards for that product.
8. **Bulk marking applies only to copies with no version yet**, and shows the result before it is applied.

## Work

| Slice | Delivers | Status |
|---|---|---|
| [Reader and report](#reader-and-report) | Paste or upload a list, see every line's outcome, add what is ready, keep the rest in "Para resolver" | open - 3 defaults taken |
| [Ready-made decks](#ready-made-decks) | Pick the product you bought and get its deck and cards in one step | open - 2 defaults taken |
| [Fabrary deck import](#fabrary-deck-import) | Any pasted text with a Fabrary deck link imports the deck, asking whose cards they are | clear |
| [Versions](#versions) | Each copy may carry its version, set in bulk per import, per card, from the pasted text or the scanner | open - 2 defaults taken |
| [Entry and imports list](#entry-and-imports-list) | One add-cards entry and first-run screen; the "Importações" list with fixed layout and copy | clear |
| [Measuring it](#measuring-it) | The counts the review needs | clear |

Order: Versions' data model first (the door), then Reader and report, Ready-made decks, Fabrary deck import, Entry and imports list.

### Reader and report

**Delivers** one reader for pasted text and CSV files, a line-by-line report on the same screen, partial import, and a persistent "Para resolver" list. Screens: `r3-list-phone`, `r3-report-phone`, `r3-pending-phone`.

| State | What should happen |
|---|---|
| A line names a card with its pitch, in any accepted spelling | Added with its quantity; the reading shows how ambiguous tokens were read ("'(3)' lido como Azul") |
| A line names a card printed in one color only, with no color | Added |
| A line names a card printed in several colors, with no color, and no color column | The line asks "Qual cor?" with the three colors and "Não sei"; "Não sei" keeps it in "Para resolver" |
| A line is one typo away from exactly one card | "Você quis dizer <card>?" with its image, "Usar esta" / "Corrigir"; counted only after "Usar esta"; "Desfazer" after |
| A line matches no card | "Não achamos '<text>'" with an edit field and "Procurar" |
| A quantity is not a number | The field is offered prefilled with the number the word names when it can tell ("três" → 3), with "Usar 3" |
| A quantity above 20 for one card | Capped at 20 with a note, as today's cap |
| A CSV with Portuguese or English headers, in any order, with or without a pitch or version column | Read; the report says "Lemos as colunas <names>" and, without a version column, that copies enter with no version |
| A CSV name with a comma and no quotes that matches a known card name | Read, with a note on that line |
| A CSV that cannot be read at all (not text, empty) | A localized error with what to check; no import is created |
| The player taps "Adicionar as N prontas" | The ready lines are added as one import; the unresolved ones are stored in "Para resolver" with the import, line number and original text; the note under the button said so |
| The collection has "Para resolver" items | A banner at its top: "N linhas de <import> para resolver · Resolver" |
| The player resolves or deletes an item | It is added to that import, or removed; the banner counts down and disappears at zero |
| The import is removed | Its "Para resolver" items go with it |
| The same file is uploaded again | Today's duplicate handling (`auto / separate / replace / update`) applies to the ready lines; it never creates an empty import |

Defaults taken: "Para resolver" is a stored list (a new table), not a browser draft; a word quantity is read only for numbers up to twenty; a CSV over today's limit (2 MB, 5,000 lines) is refused as today.

### Ready-made decks

**Delivers** "Comprei um deck pronto": search by product or hero, confirm, and get the cards and, if wanted, the deck. Screens: `r3-first-run-phone`, `r3-product-search-phone`, `r3-product-confirm-phone`.

| State | What should happen |
|---|---|
| The player searches ("kayo") | Matching Armory, Blitz and Silver Age products with hero image, product name and one format label (Classic Constructed, Blitz, Silver Age); no "Deck pronto" label, since every result is one and the name already says which line it is |
| The player picks a product | "<Product> · N cartas", two switches on, each with its reason ("Você comprou a caixa, então essas cartas são suas." / "Para ver se o deck está completo e o que vale comprar depois."), the collapsed card list, and "As cartas entram com a versão que vem na caixa, inclusive as foil. <Tokens> são marcadores do jogo, não cartas de deck, e ficam de fora." |
| The player taps "Adicionar" with both on | An import named after the product with each card's printing, and a deck with the product's name, hero and format |
| One switch off | Only the import, or only the deck |
| The player already imported the same product | "Você já adicionou <product> em <date>. Adicionar outra caixa?"; a second import of the same name gets "#2" |
| A product has no stored decklist | It is not offered |

The decklist store: one record per product (name, product kind, format, hero, cards with quantity and printing code), kept in the repository and loaded with the catalog. `pnpm products:import <official decklist url>` writes or updates one record and prints the difference against the catalog's printings tagged with that product; tokens (cards whose type is token) are left out. Defaults taken: a card the product has both regular and foil comes in as regular; products are added by the script one at a time, starting with those sold in Brazil today.

### Fabrary deck import

**Delivers** a Fabrary deck import from any pasted text, with an explicit ownership answer. Screens: `r3-add-phone`, `r3-fabrary-found-phone`.

| State | What should happen |
|---|---|
| Pasted text contains `fabrary.net/decks/<id>` or `fabrary.com/decks/<id>`, with or without scheme, `www`, trailing slash or words around it | The first such link is used; "Deck do Fabrary encontrado: <name> · N cartas" |
| The deck does not exist or is private | "Esse deck não existe ou é privado no Fabrary." |
| Fabrary is unreachable | "Não conseguimos falar com o Fabrary agora. Tente de novo em alguns minutos." |
| Deck found | "Essas cartas são suas?" with "Sim, colocar na minha coleção" / "Não, só quero comparar com o que eu tenho", none selected; "Importar o deck" disabled until answered |
| "Sim" and import | The deck, and an import named "Fabrary: <deck name>" with its cards |
| "Não" and import | The deck only; the card shows "Você tem X de N cartas deste deck" and "Colar a lista do que eu tenho", which opens the reader |
| The onboarding import | The same question; `seedInventory` no longer defaults to true |

### Versions

**Delivers** an optional version per copy. Screens: `r3-version-bulk-phone`, `r3-version-card-phone`, `r3-imports-phone`.

| State | What should happen |
|---|---|
| A copy has no version | Shown in grey as "sem versão informada"; no badge, count or call to action anywhere |
| The player opens "Versões desta importação" | "Marcar de uma vez": Edição (1ª edição / Alpha / Unlimited / Não sei), Foil (Sem foil / Rainbow Foil / Cold Foil / Não sei), Estado (NM / LP / MP / HP / Não sei), each explained in one line, nothing selected; below, every card of the import with its current version |
| The player picks values | The rows preview the result; the button reads "Aplicar às N cópias sem versão" with "As que você já marcou não mudam." |
| A card has no printing with the chosen finish or edition | That card is skipped and listed as skipped after applying |
| The player opens one card in the collection | Its copies grouped by version in grey, a plain "Mudar versão", and the picker: printings with image and footer code (a search field when there are many: Snatch (Vermelho) has 10 printing codes across Welcome to Rathe, History Pack 1, three Armory Decks, three Silver Age decks and two promos), only the editions and finishes that exist for that card (for WTR167: Alpha or Unlimited, regular or Rainbow Foil), condition, and "Isso vale para: as N cópias / só k" |
| Pasted text carries version words ("foil", "cold foil", "1ª", "NM", "LP", a set code) | Pre-select what they settle; when one printing remains, the version is recorded; otherwise the line shows "<what was read> · escolha a versão" |
| The scanner reads a collector code | The copy is recorded with that printing code; edition is asked only when the code exists in more than one edition (WTR167: Alpha or Unlimited), and "É foil?" only when it exists in a foil finish |
| A copy with a version is removed with "−" | The picker asks which version to remove from, opened inside the screen |

The version model: a collection row is identified by user, card, import and the four version fields, each optional; quantities still sum per card for readiness and the Library. Bulk marking stores edition, finish and condition and leaves the printing code empty, so a card with several printings can read "Sem foil · NM" without a printing; it keeps "escolha a versão" only where the player asked for a finish the card has in more than one printing. Defaults taken: condition `DMG` exists in the vocabulary but is offered only in the card picker; a row whose fields do not match any printing of the card is refused.

### Entry and imports list

**Delivers** one add-cards entry and first-run screen, and the "Importações" list. Screens: `r3-first-run-phone`, `r3-add-phone`, `r3-imports-phone`.

| State | What should happen |
|---|---|
| A new account opens the app | "Como você quer começar?": "Comprei um deck pronto" first and large; then one-line rows "Tem um link ou uma lista? Colar aqui", "Enviar uma planilha (.csv)", "Fotografar ou digitar as cartas"; "Pular por agora" |
| An existing account opens "Adicionar cartas" | The paste box first, then "Comprei um deck pronto", "Enviar uma planilha (.csv)", "Fotografar as cartas", "Digitar o nome" |
| The player opens "Importações" | Each import with its name, copies and "para resolver" count; the summing note once; full names wrap on a phone (F38) |
| Hand entries | Named "Entradas à mão" in every language surface, including the API label (F44) |
| "−" on a card with copies from several imports | The picker opens inside the screen on a phone (F44) |
| Counts | Plural rules everywhere ("0 cartas importadas") (F38) |

### Measuring it

| State | What should happen |
|---|---|
| Any import finishes | A structured log line: kind, lines read, ready, asked, kept in "Para resolver"; the sum must equal the lines read |
| A ready-made deck is imported | The log line names the product |
| A Fabrary import is confirmed | The log line records the ownership answer |
| A "Para resolver" item is resolved or deleted | Counted in the same log stream |

## States specified but not drawn

The scanner's "É foil?" question; "Você já adicionou <product>"; the Fabrary not-found and unreachable messages; the "−" picker inside the screen; the list of cards skipped by bulk marking; the CSV that cannot be read at all; the 20-copy cap note. They follow the drawn screens' components and copy rules.

## Changed by a later journey

- Journey 5 (`.design/sell-and-trade.md`, notes for the combined spec): sell lines stop using the `identifier[.edition][.foil]` key and carry the same four optional version fields as the collection, so a copy moves to a sell line field by field (Key decision 1's "the key is built when a copy moves to a sell line" no longer applies).

## Notes for the combined spec (from reading the code, 2026-10-21)

- `collection_card` is unique on `(userId, cardIdentifier, sourceId)` (`apps/api/src/database/entities/collection-card.entity.ts:24`); adding printing and condition changes that key and every query that assumes one row per card and source (readiness load, Library, mark-owned, decrement, AD-008's upsert).
- `csv_source.kind` is `'csv' | 'manual'` with a check constraint; Fabrary imports are stored as `kind = 'csv'` with a `sourceUrl` today. New kinds are a constraint change.
- Journey 4's `PUT /api/collection/owned` writes the manual source; with versions, it writes rows with no version.
- The CSV parser reads `name`/`card name`, `quantity`/`qty`/`count`, `set`/`set code`, with pitch only from a name suffix (`apps/api/src/collection/csv/csv-parser.service.ts:24-40`).
- The scanner index maps each collector code to `{cardIdentifier, name, pitch, image}` (`apps/api/src/catalog/catalog.service.ts:96-104`); recording the printing needs the code to travel with the commit.
- The catalog (`@flesh-and-blood/cards` 5.3.0) tags printings with product sets ("Armory Deck: Kayo", "X Blitz Deck", "X Silver Age Deck") but has no quantities; Armory Deck: Kayo has 28 distinct cards there, the official list 26 (the 2 extra are the tokens Agility and Might); some product cards exist in both regular and Rainbow Foil printings.
- Editions in the catalog are First, Unlimited and Alpha (`edition` absent on about 12.4k printings); Welcome to Rathe printings are Alpha or Unlimited, never First, so edition options must come from the card's printings.
- Official decklist pages answer a browser user agent with `200` and plain HTML ("1x Kayo, Armed and Dangerous", "3x Bare Fangs (red)"); a default fetcher got `403`. Fetching fabtcg.com with a browser user agent has precedent in `docs/research/ip-posture.md` (the LSS policy page was retrieved that way on 2026-10-18), and the script runs by hand, once per product, not on a schedule. Default taken: that user agent; fallback if LSS blocks it, Fabrary's precon decks.
- The new unique key covers nullable columns. In Postgres NULLs are distinct in a unique index, so `ON CONFLICT` would never fire for copies with no version: AD-008's increment, the scanner batch and journey 4's `PUT /api/collection/owned` would insert duplicates. Use `NULLS NOT DISTINCT` (Postgres 15 or later; check the version) or non-null sentinels.
