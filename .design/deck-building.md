# Deck building and legality: starting a deck, building it with every rule in view, the inventory, getting the list out, and not losing a deck

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-22. Persona rounds 1 and 2 done (`.design/mockups/deck-building/panel-round-1.md`, `panel-round-2.md`); direction approved by the owner on 2026-10-22; round 3 fixes drawn and the stage pick made by the owner (way A plus the cause line).
> Implementation waits for the one spec that covers every journey of the 2026-10-21 audit (owner, 2026-10-21). This document is journey 3's input to that spec.

## Situation

- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`), journey 3 of 7: building a deck and knowing whether it can play.
- Findings answered: F07, F20, F21, F22, F23, F24, F25, F39, F40, F41, F51, F54, F57, plus two requests parked by journey 5 (`.design/sell-and-trade.md`): an inventory that holds copies (Marcos) and a list export for GEM.
- Rules checked on fabtcg.com on 2026-10-22 (the four format pages `https://fabtcg.com/gameplay-formats/<format>/` and the Card Legality Policy `https://fabtcg.com/rules-and-policy-center/card-legality-policy/`):

| Format | Hero | Card pool (hero not counted) | Deck | Copies of each card (name and color), whole pool |
|---|---|---|---|---|
| Classic Constructed | not young | 80 | at least 60 | up to 3 |
| Living Legend | not young | 80 | at least 60 | up to 3; a restricted card up to 1 |
| Blitz | young | 52 | exactly 40 | up to 1, weapons and equipment included; no banned list since 1 January 2026 |
| Silver Age | young | 55 | exactly 40 | up to 2; only cards ever printed as common, rare or basic |

  A Legendary card is limited to 1 everywhere. "A card is unique if it has a different name AND color."
- Correction to the audit: F21 and F41 assumed Blitz allowed 2 copies (the code's rule); the current rule is 1.
- The Blitz change is dated in the official tournament rules change log: "9 March 2026 ... 7.3 Blitz Format: Updated to remove living legend rule and reduce max copies of each card to 1" (`https://fabtcg.com/rules-and-policy-center/change-log-tournament-rules-and-policy/`, read 2026-10-22).
- Decided by the owner (2026-10-22): the direction from persona round 1; the stage and the verdict shown as way A plus the cause line; and inventory copies count in the missing cards, the shopping list and the copies a deck holds against spare (journey 5), always split in words as deck and inventory.

## Problem

- **The rules in the code are out of date and incomplete** (`packages/engine/src/legality/rules.ts:22-61`, `compute.ts`, `card-legality.ts`):
  - Blitz allows 2 copies in the code (`rules.ts:35`), and the rule is 1. Saved Blitz decks with 2-ofs read as legal and are not.
  - The Silver Age pool is 52 in the code (`rules.ts:52`), and the rule is 55.
  - Copies are counted per mainboard row (`compute.ts:124-141`), not per card across the pool; weapons and equipment are never checked for copies, bans, format, hero or rarity (steps 6 to 8 read the mainboard only).
  - The pool total sums every row, the hero row included (`compute.ts:89`); only Fabrary imports store a hero row (`apps/api/src/decks/import/decks-import.service.ts:129-133`), so the same list counts one more when imported, and the Tutor's `cardPool` (`apps/api/src/chat/deck-facts.ts:57`) leaves the hero out.
  - Living Legend's restricted list (20 cards in cards 5.3.0) is loaded (`catalog/catalog.ts:185-186`) and never read.
  - The Silver Age rarity check rejects one card the catalog says is legal there (Blade Dance, printed only as Marvel in the data); `legalFormats` already encodes "ever printed as common, rare or basic".
  - An imported deck whose Fabrary format is outside the four (Open, Golden Age, Ultimate Pit Fight) reaches `FORMAT_RULES[format]` undefined (`decks-import.service.ts:122`, `decks.service.ts:248`; inference from the code, not run).
- **Legality stops at the first problem** (F41): `computeDeckLegality` returns at the first failing step (`compute.ts:182-188`), and the size check runs before copies and cards, so "Incompleto · 31/40" hides a card with too many copies or one not allowed in the format.
- **The editor shows the saved verdict, not the draft** (F21, F40): `decks.$deckId.tsx:503` passes `deck.legality`; only the format label comes from the draft. The "Cartas ilegais" panel next to it is a separate client check (`hooks/useCascadeCheck.ts:75-99`) with English labels (`:42-54`) that checks only bans, format and `legalHeroes`. The per-row warning component exists and is never given its props (`DeckCanvas.tsx:225-242`).
- **"+" has no limit** (F21): no cap per format or for Legendary cards (`EditableCardRow.tsx:90-101`); at 5 copies the API rejects the row (`deck-card-input.dto.ts:14-17`) and the save fails with a generic message, and the stored draft fails its schema and is dropped without a word (inference).
- **A hero outside the format says nothing useful** (F07): "não é permitido em Classic Constructed. Troque o herói ou o formato.", with no word on where it is allowed and no switch. The hero picker shows names only, no art and no formats (F51, `HeroDropdown.tsx:305-308`); on the phone it opens under the tab bar; the format list always offers all four (F22, `FormatDropdown.tsx:16-21`).
- **A phantom draft can revert a deck** (F39): the composition draft is built once from the first server data (`useCompositionDraft.ts:409-411`); when the server data changes (a format change, a recompute), the old state differs from it, `isDirty` turns true, and the stale state is written to `localStorage` as a draft that "Recuperar" restores.
- **Cancel and delete lose or keep the wrong thing**: "Cancelar" on a just-created deck keeps an empty deck (F25, the row exists from "Começar a montar", `StartScratchCard.tsx:60-72`); the home trash deletes after 4.8 seconds with a 5-second toast (F57, `DeckTile.tsx:10,72-93`), and leaving the home inside that window cancels the delete although the toast said "excluído" (inference from `:66-70`).
- **Nothing gets the list out** (F23, F20): the "⋯" menu has only "Excluir deck"; no duplicate, no copy as text, no export for Fabrary, GEM or Talishar; the shared deck page has no copy either. The "Lista" view is the same art grid sorted by name (F24).
- **No inventory** (F54): `deck_card.slot` is mainboard, weapon, equipment or hero (`deck-card-input.dto.ts:19`); a Fabrary import receives `sideboardQuantity` ("Inventory" in Fabrary) and drops it (`apps/api/src/fabrary/fabrary.service.ts:116-176`, `decks-import.service.ts:125-144`).
- Smaller defects found while reading:
  - With more than 5 cascade-illegal cards, the save warning says "Ao salvar, elas são removidas" and nothing is removed (`pt-BR/decks.ts:102-103`, `DeckDetailHeader.tsx:125-152`).
  - A partly owned card becomes two draft rows with the same card and slot (`routes/_auth/-deck-detail-draft.ts:11`; inference).
  - "Ver no Fabrary" links to `fabrary.com` while the parser accepts `fabrary.net` only (`DeckDetailSidebar.tsx:154`, `DeckStatusStrip.tsx:99`, `apps/api/src/fabrary/parse-url.ts`).
  - `variant_fetch_job.deckId` has no foreign key and no cleanup when a deck is deleted.
  - The auto name stays "Rhinar — Blitz" after the format changes (F41, also).

## Clear slices (no design pick needed)

### Legality engine

| State | What should happen |
|---|---|
| Any deck | Every check runs and every problem is returned, size and rule problems together; the category is `illegal` when any rule fails, else `incomplete` when only the size fails, else `legal` |
| Copies | Counted per card (name and color) across deck, inventory, weapons and equipment; limit 3 in Classic Constructed and Living Legend, 2 in Silver Age, 1 in Blitz, 1 for a Legendary card, 1 for a card restricted in Living Legend |
| Pool | Deck + inventory + weapons + equipment, hero not counted; 80, 80, 52, 55 |
| Per card | Bans, format and hero scope run on every slot, not only the deck; `legalFormats` decides Silver Age rarity (the separate rarity check goes) |
| Hero outside the format | The reason carries the formats where the hero is allowed, from `legalFormats` (no history claimed) |
| Imported deck with a format outside the four | No crash; the deck is stored with that format and the page says it is not checked, with a choice of the four |
| A saved deck whose verdict changed with a rule (Blitz 2-ofs) | Recomputed on read as today; the deck page and the home card show the new verdict with the reason |

### Editor and draft fixes

| State | What should happen |
|---|---|
| Editing | The verdict shown is computed from the draft with the engine in the browser (the engine package is shared) |
| The server data changes while the player has not edited | The draft resets to it; nothing is written to `localStorage` (F39) |
| A partly owned card | One draft row per card and slot |
| "+" at the limit | Disabled with the reason ("Máximo 1 no Blitz"); the limit counts the inventory |
| Save with problems | Saves as is; no copy promises a removal |
| "Cancelar" on a just-created deck with no cards | The deck is discarded and the player returns to where they came from (F25) |
| Leaving the home while a delete is pending | The delete happens or is undone as the toast said, never silently skipped |
| A deck is deleted | Its `variant_fetch_job` rows go too |
| "Ver no Fabrary" | Links to the address the parser accepts |
| The format changes on a deck whose name is still the automatic one | The name follows ("Rhinar - Silver Age") |

## Designed slices (owner picks of 2026-10-22)

Screens: `.design/mockups/deck-building/index-r2.html` (the combined design) and `index-r3.html` (the fixes, which win where both draw the same thing).
Persona rounds: `panel-round-1.md`, `panel-round-2.md`; round 3 was an owner pick, not a persona round.
The screens carry the exact copy; the tables below carry the states and the rules, and name a screen only where it holds copy not repeated here.

### Copy rules (every screen of this journey)

1. "Faltam" means copies the player does not own, nothing else. The deck size reads "31 de 40 cartas no deck · coloque mais 9".
2. A "problema" is a rule problem. The deck size is never counted as one; it is shown next to the count ("31 de 40 cartas · 1 problema").
3. Every red line says what to do, with the arithmetic done, written in steps when one step changes the next: "Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 30, então coloque mais 10 cartas."
4. Dates come only from the curated rule-change entry (see the one-way doors). A hero outside a format claims no history and no date.
5. The stage never shares a colored chip with a rule problem (the stage rule below).
6. Words a new player does not know get one plain line where they first appear on the screen:
   - card pool: "Cartas que você leva: 35 de 52", with "o deck, o inventário, a arma e os equipamentos; o herói não conta. No torneio isto se chama card pool." (`r3-checklist-phone` drew it without "o inventário" for a deck with none; the line always names the inventory). Marcos's desktop header keeps "Card pool 80 de 80" with the same plain line.
   - inventário: "Inventário: cartas que você leva ao torneio além do deck. Entre um jogo e outro da mesma partida, dá para trocar cartas do deck por elas." This replaces the round-2 line with "jogo 1" on every screen that shows it (`r2-list-view-desktop`, `r2-missing-desktop`).
   - jovem: "Herói jovem: versão para Blitz e Silver Age, decks de 40 cartas."
7. "as substituições", never "as trocas de cartas", for a deck's replacements.
8. No screen claims that an export works in GEM until the text GEM reads is checked by hand.
9. pt-BR; card names in English with the pitch as a word ("Pack Hunt (Vermelho)"); no em or en dashes; no raw codes; nothing pre-selected that the player did not choose.

### The stage and the verdict (owner pick, 2026-10-22: way A plus the cause line)

The stage (Ideia, Montando, Pronto, Jogando, Aposentado) stays the player's own label and stays editable; journey 5 reads it to decide which decks hold copies.
Screen: `r3-stage-a-phone` (chosen); `r3-stage-b-phone` is the rejected way.

| State | Home card, top to bottom | Deck page header |
|---|---|---|
| No problem, full size | the stage chip as today ("Pronto"); "60 cartas" | the stage chip |
| No rule problem, short of cards | the stage chip with the size: "Montando · 31 de 40 cartas" | the stage chip; the size lives in the bar |
| Any rule problem | red chip with the verdict only, "Não vale no Blitz"; red cause line, "8 cartas com 2 cópias"; grey line "Etapa: Jogando · 40 cartas" (the size as "31 de 40 cartas" when short) | red chip "Não vale no Blitz"; grey "Etapa: Jogando"; the causes in the body |
| A format outside the four (import) | grey chip "Formato não conferido"; grey line with the stage | the notice from the legality-engine slice |

Cause line, specified and not drawn beyond the copies case:

- one item per kind of problem, joined by " · ", at most two, then "e mais N";
- copies: "N cartas com X cópias" when every card over the limit has the same count, else "N cartas acima do limite de cópias";
- banned: "N cartas banidas"; not allowed in the format: "N cartas fora do formato"; hero: "herói fora do formato";
- singular when N is 1 ("1 carta com 4 cópias").

The words "jogar" and "pronto" never appear in the verdict or the cause line.

### Editor and the rules checklist (Bia)

Screens: `r3-editor-phone`, `r3-checklist-phone`.

| State | What the player sees |
|---|---|
| Header | deck name, format chip, "Compartilhar" (opens today's share dialog), the stage and verdict as above |
| A row over the limit | red line on the card "2 cópias · o Blitz permite 1 · tire 1"; "+" disabled, the reason shown once ("Máximo 1 no Blitz") |
| "+" at the limit, no problem | disabled with the same reason; the limit counts deck + inventory |
| A Legendary card, or a card restricted in Living Legend | "+" disabled at 1 with "Máximo 1: carta lendária" or "Máximo 1 em Living Legend: carta restrita" (not drawn) |
| Bottom bar, always visible while scrolling | "31 de 40 cartas · 1 problema" with a chevron; "32 de 40 cartas · nenhum problema" when only the size is left |
| Bar tapped | a sheet at about 45% of the height, the list still visible above it; green lines for what is right, red for what is wrong with "Ir para a carta", neutral for the size, then "Para fechar: ..."; it closes only by its handle or "Fechar", never by scrolling |
| Every check runs | the sheet lists every problem at once (the engine slice), never only the first |

### Inventory (Marcos)

Screen: `r3-inventory-desktop`.

| State | What the player sees |
|---|---|
| Rows | two steppers per card, "No deck" and "No inventário" |
| Header | "Deck 60 · Inventário 15 · Card pool 80 de 80", with the plain lines once |
| Over the limit across both | red: "3 no deck e 1 no inventário, 4 no total. O Classic Constructed permite 3 · tire 1"; both "+" disabled with "Máximo 3 no Classic Constructed, contando o inventário" |
| Row menu | "Mover 1 para o inventário" and "Mover todas (3) para o inventário" (and the reverse, "para o deck") |
| Missing copies | "Faltam 7 cópias (4 do deck, 3 do inventário) · Ver o que falta" |
| Phone | the two steppers stack under the card name (not drawn) |
| Blitz and Silver Age | the inventory exists in every format; the pool limit (52, 55) counts it |

### Missing cards with the inventory (journey 4's list)

Screen: `r2-missing-desktop` (the inventory line replaced as in copy rule 6).
Header "Faltam 7 cópias de 4 cartas · 4 do deck, 3 do inventário"; each row says where its copies go ("faltam 2 · 2 do inventário"); the filters "Todas", "Do deck", "Do inventário"; the total counts all 7.
The same split holds in the shopping list, the group ask and the quote (`.design/close-the-deck.md`, "Changed by a later journey").

### Getting the list out (Marcos, Lucas, Renata)

Screens: `r3-deck-actions-desktop`, `r2-export-desktop`, `r3-export-group-desktop`, `r2-list-view-desktop`.

| State | What the player sees |
|---|---|
| Deck page header | visible "Copiar lista" ("texto para o grupo ou para o Fabrary") and "Duplicar" ("cria uma cópia para testar mudanças sem mexer neste"); "Excluir deck" only inside "⋯" |
| "Copiar lista" | a sheet with two tabs, "Para o grupo" and "Para Fabrary, GEM ou Talishar", none chosen until tapped, the full text previewed before "Copiar" |
| "Para o grupo" | Portuguese text with headed sections: Herói, Arma, Equipamentos, "Deck (60 cartas)", "Inventário (15 cartas, fora do deck)" |
| "Para Fabrary, GEM ou Talishar" | English card names, with an Inventory section; the exact text is a hand check before building |
| The pool breaks a rule | a warning above the preview that does not block: "Esta lista não vale no Classic Constructed: ... Dá para copiar mesmo assim." |
| Copied | toast "Lista copiada" (not drawn) |
| "Duplicar" | a new deck "Rhinar CC (cópia)" with the same cards, inventory, stage Ideia, opened (not drawn) |
| "Lista" view | text grouped Herói, Arma, Equipamentos, Deck, Inventário, one line per card "3x Pack Hunt (Vermelho) · custo 2 · Ação", the problem and "faltam N" on the line, "Copiar lista" at the top |
| Shared deck page | "Copiar lista" with the same sheet, no account needed |

### Delete safety (Caio)

Screens: `r2-delete-toast-phone`, `r2-deleted-list-phone`.

| State | What the player sees |
|---|---|
| Trash on a home card or "Excluir deck" | the deck leaves the list at once; toast "Rhinar Blitz v2 foi para Excluídos recentemente · Desfazer", which stays until the next action |
| Home with deleted decks | row "Excluídos recentemente (1) · ficam 30 dias" under the decks |
| The list | per deck: name, stage, card count, when deleted, "some de vez em 30 dias", "Restaurar", and "Excluir de vez" as a plain link; one line on top: "Um deck excluído volta com as cartas, as substituições e o histórico." |
| "Excluir de vez" | asks once, then the hard delete of today |
| Day 30 | removed for good by a scheduled job |
| A deleted deck's share link | answers as a deck that no longer exists; "Restaurar" brings the link back (not drawn) |
| Deleted decks in other journeys | not counted in readiness, home counts, spare copies (journey 5) or the Tutor |

### Legality on the shared deck page (Renata, not logged in)

Screen: `r3-shared-phone`.
Under the title, the verdict block for the deck's own format, fixed ("Blitz · ainda não pode jogar", each problem in plain words, "Para jogar no Blitz: ..."); under it, "Conferir em outro formato:" with chips, none chosen.
A tapped chip shows its result under the chips and never changes the block above ("Em Living Legend: não vale. O Rhinar jovem joga só Blitz e Silver Age.").
A legal deck reads "Blitz · pode jogar" in green (not drawn).

### New deck: hero first (Bia)

Screens: `r2-new-deck-hero-phone`, `r2-new-deck-format-phone`.
The three starts ("Comprei um deck pronto", "Tenho um link do Fabrary", "Começar do zero"); the hero search shows art and the formats of each result, none highlighted, the "jovem" line once; after the pick, only the hero's formats, each with one line, none selected, and "Começar a montar" disabled until one is chosen.
A hero with one format still shows it, not pre-selected (not drawn).

### Hero outside the format (Lucas)

Screens: `r2-retired-hero-desktop`, `r3-retired-hero-switched-desktop`.
Each problem in plain words with the formats where the hero is allowed; before any tap, the result in the other format ("Em Living Legend este deck é válido: ...", or the problems left there); "Mudar para Living Legend" with "As cartas do deck não mudam, só o formato em que ele é conferido."
After the switch, the format chip changes, a green block says "Este deck vale em Living Legend.", and the toast reads "Formato mudado para Living Legend · Desfazer".
When no format makes the deck valid, no switch button; the problems per format are listed (not drawn).

### A rule changed under a saved deck (Caio)

Screens: `r3-rule-changed-deck-phone`, `r2-one-each-phone`; the home card follows the stage rule (`r3-stage-a-phone`).

| State | What the player sees |
|---|---|
| Deck page | "Desde 9 de março de 2026, o Blitz permite 1 cópia de cada carta (antes eram 2). 8 cartas deste deck têm 2." with "ver o anúncio" (the official change log, opens outside); the 8 cards listed with their red line |
| One tap | "Deixar 1 de cada" with "Tira 1 cópia de cada uma das 8 cartas. O deck fica com 32 de 40 e você coloca mais 8. As cartas continuam na sua coleção." |
| By hand | "Prefiro escolher carta por carta" closes the notice and keeps the "-" on each row |
| After "Deixar 1 de cada" | bar "32 de 40 cartas · nenhum problema", the stage chip "Jogando · 32 de 40 cartas", toast "8 cópias tiradas do deck · Desfazer" |
| A rule change with no curated entry (a ban) | the verdict and the cause, no date and no "antes eram" |
| The notice | shown until the deck has no problem from that change; no notification outside the app (out of every journey) |

`r2-one-each-phone` drew the stage as "Jogando · coloque mais 8 cartas"; under the stage rule it is the chip with the size, and "coloque mais 8" lives in the bar and the deck count.

### One-way doors for the combined spec

- **An inventory quantity per deck line.** `deck_card` gains an inventory quantity next to the deck quantity, as Fabrary's `sideboardQuantity` and our `tournament_deck_card` already do; rejected: a new `inventory` value of `slot`, which would give one card two rows and needs every reader to merge them. Every reader listed in "Notes for the combined spec" decides once whether it counts the inventory; the Fabrary import stops dropping `sideboardQuantity`.
- **Soft delete, kept 30 days.** A deleted-at time on the deck; every read of decks skips deleted ones; a scheduled job deletes them for good on day 30 with today's cascades; rejected: today's hard delete with an undo timer, which loses the deck when the page closes (F57).
- **A curated rule-change entry in the rules.** Each entry carries the format, the date, what changed in one line, and the official source link; the rule-changed notice reads from it, and nothing else may print a date; rejected: inferring the date from the card data, which holds none.
- **The stage stays player-editable.** The verdict never writes it; journey 5 reads it to decide which decks hold copies.

### States specified but not drawn

- The cause line for kinds other than copies, and for more than two kinds.
- "+" disabled for a Legendary card and for a card restricted in Living Legend.
- The inventory on the phone.
- "Lista copiada", the result of "Duplicar", the share link of a deleted deck.
- A legal shared deck; a hero with one format; a hero valid in no format.
- A rule change with no curated entry.
- The home card for a format outside the four.

## Notes for the combined spec (from reading the code, 2026-10-22)

- Legality is not stored; it is recomputed on every read and write (`decks.service.ts:235-256`, `:585-601`, `:683-693`, `:1084-1109`). Changing the rules changes every saved deck's verdict on the next read, with no migration.
- Readers of `deck_card` that count every slot today and would count an inventory unless told otherwise: readiness (`packages/engine/src/readiness/compute.ts:136-160`), and from it the missing list, shopping list, home counts, decklist and pitch and cost charts; the shared missing link and want lists from a deck (`sharing/shared-deck-missing.service.ts:13-17`, `lists/list-from-deck.service.ts:24-31`); the shared deck view and copy (`sharing/shared-deck-copy.service.ts:29,46-51`); the Tutor (`chat.service.ts:252`, `chat-runner.service.ts:145-149`, `chat-tools.service.ts:128,141`, `deck-facts.ts:45-57`); spare copies (`chat-tools.service.ts:348-360`, replaced by journey 5's spare function); collection affected-deck lookups (`collection/collection.service.ts:486-500`); recommendations and replacements.
- The web editor maps an unknown slot to `'other'` and saves it as `'mainboard'` (`useCompositionDraft.ts:208-228`, `decks.$deckId.tsx:407`); both the DTO `IsIn` (`deck-card-input.dto.ts:19`) and the Zod slot list (`useCompositionDraft.schema.ts:17-23`) need any new value.
- Fabrary sends `deckCards[{cardIdentifier, quantity, sideboardQuantity}]`; `tournament_deck_card` already stores `quantity` and `sideboardQuantity` (`database/entities/tournament-deck-card.entity.ts:16-20`).
- The exact text GEM reads on paste was not verified (fabtcg.com's GEM article blocks scripts; GEM needs a login). Check by hand before building; Fabrary has an "Import to GEM" export.
- Delete is hard: `deck_card`, readiness snapshots, tags, replacements, review aggregates, recommendation runs and rejected substitutes cascade; chat conversations and proposals set null; `share_event` stays on purpose; share links are deleted by raw SQL (`decks.service.ts:1138-1143`).
