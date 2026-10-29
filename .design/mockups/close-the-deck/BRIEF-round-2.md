# Close the deck: round 2 brief (the combined design)

Round 1 (`BRIEF.md`, `panel-round-1.md`) compared three structures; no structure won, the parts did.
This brief draws one combined design built from the parts the panel kept, plus the owner decisions recorded at the end of `panel-round-1.md`.
Everything in "Rules every alternative shares" in `BRIEF.md` still holds. The scenario numbers in `BRIEF.md` still hold, with the changes below.

## What changed in the scenario

Prices are looked up automatically now, so the "não consultadas" bucket mostly disappears:

- The 10 cards that were "not looked up" split into two:
  - 8 cards, 20 cópias, now have a looked-up answer: 6 are in stock with prices Enlightened Strike (Vermelho) ×3 R$ 1,50, Sink Below (Vermelho) ×3 R$ 3,90, Command and Conquer (Vermelho) ×3 R$ 2,50, Pummel (Vermelho) ×3 R$ 0,90, Tenacity (Azul) ×3 R$ 0,50, Sigil of Solace (Vermelho) ×3 R$ 0,30 (18 cópias, R$ 28,80 total); 2 are not in stock ("a loja não tem agora"): Fyendal's Spring Tunic ×1 and Nullrune Hood ×1.
  - 2 cards, 2 cópias, were never found on the store site: Snapdragon Scalers ×1 and Crater Fist ×1. They say "não achamos no site da Cúpula DT" with a link "procurar lá".
- Every card is already looked up on every screen. The loading state ("buscando preço…") is specified in the spec, not drawn here, so the totals stay identical across screens.

New totals (before "Tenho" and swaps):

| Bucket | Cartas | Cópias | Total |
|---|---|---|---|
| Na Cúpula DT, com preço | 19 | 50 | R$ 753,28 |
| A loja não tem agora | 6 (+ the missing Bloodrush copy) | 14 | |
| Não achamos no site | 2 | 2 | |

Check: 50 + 14 + 2 = 66 cópias. 19 + 6 + 2 = 27 cartas (Bloodrush counted once, in "na loja").
"A loja não tem agora" list: Reckless Swing (Azul) ×3, Sand Sketched Plan (Azul) ×3, Bone Head Barrier (Amarelo) ×3, Primeval Bellow (Vermelho) ×2, Fyendal's Spring Tunic ×1, Nullrune Hood ×1, plus 1 Bloodrush Bellow (Amarelo).

Caio's state on the owner screens: he marked "Tenho 3" on Pack Hunt (Amarelo) and "Tenho 2" on Savage Swing (Vermelho), and accepted the swap Awakening Bellow (Vermelho) for 2 Alpha Rampage.
After that: **43 cópias por R$ 452,28 na Cúpula DT** (50 − 3 − 2 − 2 = 43; R$ 753,28 − 0,60 − 0,40 − 300,00 = R$ 452,28).

Every price line carries its date in small text: "preço de 12/10". Availability is checked weekly; the list shows "estoque conferido em 19/10" once, in the summary.

## Screens

Phone frames 390 px unless stated. Build tokens, fonts and base classes exactly as round 1 (copied from `.design/mockups/sharing/contact/shared-deck-a-phone.html`). No caption text on the page outside the frame: no "Alternativa", no screen number, no design name. The file name is the only label.

1. **r2-deck-phone**: deck page top (banner, hero, readiness 0%). One summary card: "Faltam 66 cópias (27 cartas)". Below it, one line "Na Cúpula DT: 50 cópias por R$ 753,28 · 14 a loja não tem · 2 não achamos". One button "Ver o que falta". No buy button on this screen.

2. **r2-list-phone**: the missing list, owner view, after Caio's marks.
   - Top, sticky: the live summary. Big: "Falta comprar: 43 cópias · R$ 452,28 na Cúpula DT". Small: "Já descontei 5 cópias que você tem e 1 troca. Estoque conferido em 19/10." A secondary link "Ver as 66 sem descontar".
   - Filter chips with counts: "Comprar na loja 43 · A loja não tem 14 · Não achamos 2 · Já tenho 5 · Troca 2" (sums to 66).
   - Rows (show about 7, then "+ 12 cartas"): thumbnail, name with pitch word, "faltam 3", price each and line total, "preço de 12/10", flags "só tem foil promo" / "a loja tem 2 de 3". Row actions as plain words: "Já tenho…", "Comprar" (opens the card on the store site, shows an external-link mark).
   - Alpha Rampage row shows the accepted swap inline: "Você vai usar 2 Awakening Bellow (Vermelho), que já tem, no lugar de 2 · economiza R$ 300,00 · Desfazer". It now shows "falta 1 · R$ 150,00".
   - A row with a swap available but not accepted (Bloodrush Bellow (Amarelo)): "Você tem uma carta que serve no lugar · Ver".
   - Bottom bar: "Compartilhar a lista". No "comprar tudo" button anywhere.

3. **r2-tenho-phone**: "Já tenho…" open on Pack Hunt (Amarelo): "Quantas você já tem? 0 1 2 3" with 3 selected, and a toast "Pack Hunt (Amarelo): você tem 3 · Desfazer". The summary on top already shows the new number.

4. **r2-share-a-phone** and **r2-share-b-phone**: the share sheet, two wordings of the same three options. These two screens are a comprehension test: draw them with the option titles only, no explanation line under each title. Each sheet starts with the title "Compartilhar".
   - a: "Mostrar o deck" / "Pedir as cartas que faltam" / "Pedir orçamento a uma loja".
   - b: "Mostrar o deck" / "Lista para quem vai comprar para mim" / "Pedir orçamento a uma loja" (same three link types as a, only the middle label changes).
   Then **r2-share-full-phone**: four options, each with one explanation line (result of the label test):
   - "Mostrar o deck": "Quem abrir vê todas as cartas do deck."
   - "Pedir as cartas que faltam": "Para o grupo ou para amigos. Mostra o que falta, e quem tiver a carta te responde no WhatsApp." (sends r2-message-phone)
   - "Lista para quem vai comprar para mim": "Para quem vai pagar ou te dar as cartas. Mostra o preço e o link de cada carta na Cúpula DT, e a pessoa marca o que já comprou." (opens r2-public-parent-phone; same page as option 2 opened logged out, only the WhatsApp message text differs)
   - "Pedir orçamento a uma loja": "Só as cartas que faltam, sem preços. A loja marca quais tem e quanto custa, e te responde no WhatsApp." (opens r2-quote-phone)

5. **r2-message-phone**: what "Pedir as cartas que faltam" sends to WhatsApp, editable before sending. Text:
   "Procuro estas cartas para meu deck de Rhinar (a Cúpula DT não tem agora):
   3 Reckless Swing (Azul)
   3 Sand Sketched Plan (Azul)
   3 Bone Head Barrier (Amarelo)
   2 Primeval Bellow (Vermelho)
   1 Bloodrush Bellow (Amarelo)
   1 Fyendal's Spring Tunic
   1 Nullrune Hood
   Também procuro (não achei no site da loja): 1 Snapdragon Scalers, 1 Crater Fist.
   Pago no PIX ou troco. Estou em Pelotas.
   Lista completa: <link>"
   The last line before the link ("Pago no PIX ou troco. Estou em Pelotas.") is an editable field, marked as such, prefilled from last time. A toggle "Incluir também as 43 que a loja tem".

6. **r2-public-parent-phone**: the "Pedir as cartas que faltam" link opened logged out (Dona Marta).
   - Header: "O Caio precisa destas cartas para o deck dele." Under it: "Dá para comprar todas que têm preço na Cúpula DT, uma loja de cartas que envia para todo o Brasil."
   - Total: "43 cópias · R$ 452,28 na Cúpula DT". Small: "preços de 12/10, confira no site antes de pagar".
   - A plain hint once: "Cada cor é uma carta diferente. Confira a cor no nome antes de pôr no carrinho."
   - Rows: thumbnail, name with pitch word, "3 cópias", price, "Comprar" (opens the store). Flags in plain words: "só tem a versão especial, mais cara" for the promo foil; "a loja tem 2, o Caio precisa de 3".
   - Alpha Rampage: "1 cópia (o Caio já tem outras cartas para o lugar das outras 2)".
   - A separate section, collapsed by default: "Cartas que a loja não tem agora (16 cópias)". Inside: "O Caio está procurando com outros jogadores. Não precisa comprar."
   - Each row has "Comprei" kept on her phone, with the note once: "Fica salvo só neste celular. Avise o Caio pelo WhatsApp quando terminar." and a button "Avisar o Caio no WhatsApp" that sends the list of what she marked.
   - Footer disclaimer as round 1.

7. **r2-public-friend-phone**: the same link opened logged in by Duda. Same page; rows of cards Duda owns show "Você tem 3 · Oferecer para o Caio" (opens WhatsApp with a short text). A summary on top: "Você tem 4 das cartas que o Caio procura." The "a loja não tem" section is expanded and first for him.

8. **r2-quote-phone**: the "Pedir orçamento a uma loja" link opened by Renata. No Cúpula DT name, price, link or total anywhere.
   - Header: "O Caio pediu um orçamento para estas cartas. Marque o que você tem e o preço; a resposta vai pelo WhatsApp."
   - Rows: name with pitch word, "precisa de 3", a "Tenho" stepper (0 to 3) and a price field per unit. Show 4 rows filled.
   - Sticky footer: "Seu orçamento: 18 de 59 cópias · R$ 412,00" (59 = 66 minus the 5 Caio has and the 2 covered by his swap; the quote list shows only what he still needs) and button "Enviar para o Caio no WhatsApp". A secondary "Copiar a lista em texto" (for her spreadsheet).
   - Footer disclaimer.

9. **r2-list-desktop** (1440 px wide): the owner list on desktop for Marcos. Same content as r2-list-phone, as a table: card (thumb, name, pitch), faltam, já tenho (inline stepper), troca, preço cada, total, preço de, link. Summary bar on top, filter chips on the left or top. Show all 19 "na loja" rows.

## Copy rules for round 2

- Never use "consultar", "coleção cobre", "orçamento" for the payer, "foil" for the payer. For the owner "foil promo" is fine.
- Plain words for actions: "Já tenho…", "Comprar", "Desfazer", "Ver".
- No em dashes in UI copy.
