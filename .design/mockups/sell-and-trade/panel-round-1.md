# Sell and trade: persona panel, round 1 (2026-10-21)

Five simulated personas compared alternatives A (lists, starting from what is spare), B ("à venda" in the collection, with a standing showcase) and C (a "Sobrando" page as the hub), shuffled per persona, no captions, plus six shared screens.
Each persona picked per part. Picks below are mapped from what they described, not from the proposal number they wrote (keys in the session scratchpad, `j5/keys.json`).
These are simulations built from research, not user evidence.

## Picks per part

| Part | Duda (P4) | Caio (P2) | Marcos (P3) | Lucas (P5) | Renata (P7) |
|---|---|---|---|---|---|
| A. Where selling starts | C | C | C | C | A (keeps "Do zero" for a store) |
| B. Choosing what and the price | C, plus B's price per version | C | B (price per version) | A (sort by price) | C |
| C. The message | C (on the same page as prices) | C | C | A ("Copiar texto") | C |
| D. Marking sold | B | B | B | B | B |

D is partly a drawing artifact: B was the only alternative that drew the "Vendida" button on each line; A and C drew only the label after the tap. The reason every persona gave is "I can see where to tap".

## Direction from round 1 (proposed, not yet approved by the owner)

C's "Sobrando" page, reached from the collection banner, with: B's row per version (each version its own quantity and price), A's sort by price, a minimum price filter (Lucas), the message on the same page with both "Enviar no WhatsApp" and "Copiar texto", and a visible "Vendida" on each line of the list afterwards. Lists keep "Do zero" and "De um deck" for selling what is not in the collection (Renata).

## Where they agree

1. **An unknown version must not post a low price silently** (Duda's top change, Marcos, Lucas): "1x Enlightened Strike (Vermelho) · R$ 12" reads as a known regular copy. Before sending, a line with no version asks the one thing that changes the price ("É foil?" with the finishes that card has), and the message never presents an unconfirmed version as known.
2. **The closing line "da última vez" is dangerous** (Duda, Caio, Lucas, Renata): it can post someone else's pickup place, and on the first sale there is no last time. Also "retirada na Cúpula DT" makes no sense: Cúpula DT is an online store.
3. **Selling part of a line** (Marcos, Duda, Lucas): "Vendida" on a 2-copy line must ask how many ("Vendi 1 de 2").
4. **Trade shows no value** (Renata, Duda, Marcos): Pummel (R$ 4) next to Command and Conquer (R$ 45) with no sense of whether it is fair. "Em troca procuro" pre-switched on breaks the nothing-pre-selected rule (Marcos, Duda), and the offer cannot pick which copies (Caio).
5. **"Por que sobra?" is hard to read** (all five): "seguram" is the app's word, not theirs ("ficam nos decks", "usam"); parentheses inside parentheses; Renata misread 3 + 2. The default "you move cards between decks" is wrong for Duda, who keeps two decks built at once.
6. **Mockup artifacts, not design**: `<link>` and `<link of Procuro - Rhinar>` read as literal text; the picker's pre-selected rows looked like an unexplained rule (Duda, Lucas, Marcos).

## Problems found by one persona, worth keeping

- **The app has BRL store prices and does not show them** (Marcos): the suggestion says Pummel R$ 4 while the store sells it at R$ 0,90. The price helper can show the Cúpula DT price next to the TCGplayer suggestion, from `store_stock`, which the collection value already uses.
- **Buying must show the message before WhatsApp opens** (Caio), as the trade offer already does.
- **A deck in testing marked "Ideia" frees its cards** (Marcos): the "Sobrando" page should say which Ideia decks use cards it counts as spare, before "Vender".
- **"Manter na coleção" needs its reason** (Duda, Lucas): "Vendi uma cópia que não estava no app".
- **"A lista original" of whom?** (Marcos): "A lista antes das trocas do Caio"; and show the whole deck behind the sheet.
- **"Salvar e mostrar" should say what is shown and to whom** (Duda, Marcos, Caio): "Seu número aparece para quem abrir o link."

## Asked for, outside this journey

- A store's own stock (Renata): importing a store spreadsheet with price and lowering stock on sale. Not served by spare copies; parked.
- An 80-card CC inventory (sideboard) that holds copies (Marcos): decks have no sideboard slot today (`deck_card.slot` is mainboard, equipment, weapon, hero). Belongs to journey 3 (building); when it exists, those cards hold copies like the deck's.
- Holding cards for a buyer (Duda: two buyers asking for the same cards): a reservation is in-site negotiation, out by `.design/sharing.md`.
- Recording the sale price and the buyer (Duda): parked.

## Prompt-shaped caveats

- Marcos's preference for LigaFAB over TCGplayer and the store-price comparison came from the persona, drawing on journey 4's screens.
- Duda's "two decks built at once" was invented by the persona; it matches the owner's own remark that players treat this differently.
- Renata's store use was asked in her prompt (task 3).

## Owner decisions after round 1 (2026-10-21)

- The direction above is approved.
- What counts as spare is the player's choice, asked once before any spare number is shown ("Você passa cartas de um deck para outro?": "Sim, entre decks do mesmo formato" / "Sim, entre quaisquer decks" / "Não, cada deck tem as próprias cartas"), nothing pre-selected, stored on the account and changeable from "Por que sobra?" and the settings. A per-deck "este deck fica montado" mark is left for later. This replaces the single "Cada deck tem as próprias cartas" switch drawn in round 1.
