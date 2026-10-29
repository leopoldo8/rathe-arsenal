# Close the deck: round 3 brief (fixes on top of round 2)

Start from `BRIEF-round-2.md` and the generator `gen-r2.mjs` (scratchpad). Copy it to `gen-r3.mjs`, output `r3-*.html/.png` and `index-r3.html`. Keep the r2 files untouched.
Inputs: `panel-round-2.md` ("Problems found in round 2" and "Owner decisions after round 2").

## Screens in round 3

- r3-deck-phone: as r2.
- r3-list-phone and r3-list-desktop: owner list with fixes 1-4. Bottom bar on phone: "Compartilhar a lista" (primary) and "Copiar lista de compras" (secondary). Desktop: same two actions in the summary bar.
- r3-tenho-phone: as r2, summary numbers consistent.
- r3-share-phone: three options with explanation lines:
  - "Mostrar o deck": "Quem abrir vê todas as cartas do deck."
  - "Pedir as cartas que faltam": "Para o grupo ou para amigos. Mostra o que falta, e quem tiver a carta te responde no WhatsApp."
  - "Pedir orçamento a uma loja": "Só as cartas que faltam, sem preços. A loja marca quais tem e quanto custa, e te responde no WhatsApp."
- r3-message-phone: group message with fixes 7 and 8.
- r3-group-phone: the "Pedir as cartas que faltam" link opened logged out (a group member without an account). Replaces r2-public-parent.
- r3-group-friend-phone: same link, logged in as Duda, with fixes 9 and 10.
- r3-offer-phone: the WhatsApp text "Oferecer para o Caio" opens (fix 10).
- r3-quote-phone: fix 12.
- r3-copy-phone: what "Copiar lista de compras" copies (a toast plus the text shown).

## Fixes (numbers from panel-round-2.md)

1. Dates. Remove the per-row "preço de 12/10". The summary says once: "Preços conferidos nos últimos 30 dias. Estoque conferido em 19/10. O preço final aparece no site da loja."
2. Units. Summary: "Já descontei 5 cópias que você tem e 2 que você troca por cartas suas." Chip: "No lugar 2" (not "Troca 2"). Chips still sum to 66.
3. "Não achamos" chip becomes "Fora do site 2"; rows say "O app não achou esta carta no site da Cúpula DT · procurar lá".
4. Bloodrush Bellow row: name the stand-in inline, like the accepted swap, with a button "Usar": "Você tem 1 Bloodrush Bellow (Vermelho), que serve no lugar de 1 · economiza R$ 69,99 · Usar". Totals stay unchanged since it is not accepted.
5. Store-has-2-of-3 copy (owner list and group page): "A loja tem 2. A 3ª está no pedido do grupo."
7. Message: first line "Procuro estas cartas para o meu deck [CC] Brute (Rhinar):" with no store name; the second block just "Também procuro: 1 Snapdragon Scalers, 1 Crater Fist."
8. Closing line field: highlighted, label "Da última vez · confira antes de enviar".
9. Group page (both variants):
   - Header: "Cartas que o Caio procura" and the deck name "[CC] Brute (Rhinar)". No "precisa", no store in the header.
   - First section, expanded: "Quem tiver, fala com o Caio" with the 16 copies (14 the store lacks + 2 outside the site). Each row: name with pitch word, quantity, "Oferecer" (opens WhatsApp, fix 10). Logged in, rows the visitor owns are first and say "Você tem 3".
   - Logged-in summary: "Você tem 4 cópias de 2 cartas que o Caio procura."
   - Second section, collapsed: "O resto dá para comprar na Cúpula DT · 43 cópias · R$ 452,28 · envia para todo o Brasil". Inside: rows with price and "Comprar", the "só tem a versão especial" and "a loja tem 2" flags. No "Comprei" anywhere. Draw it collapsed on r3-group-friend-phone and expanded on r3-group-phone.
   - "Copiar lista em texto" at the bottom.
   - The pitch hint "Cada cor é uma carta diferente: confira a cor no nome" once on the logged-out page.
10. "Oferecer" opens WhatsApp to Caio with: "Oi Caio, vi seu pedido no Rathe Arsenal. Tenho 3 Reckless Swing (Azul), edição __, condição __, R$ __ cada." For a logged-in visitor, all owned rows in one text.
12. Quote page: under the header, "O Caio ainda precisa de 59 cópias (27 cartas menos as que ele já tem)". Each row gets an optional one-line note field "Observação (edição, condição)". Before sending, a preview of the WhatsApp text (draw the footer button as "Ver mensagem e enviar"). Remove "Esta página não aparece em buscas" from this page only. "Copiar a lista em texto" becomes "Copiar a lista para a sua planilha".

Keep every shared rule from `BRIEF.md` and the arithmetic of `BRIEF-round-2.md`. Use card images for every card that has a code; for cards without a code use the neutral tile, and in the report list which cards lack images.
