# Close the deck: mockup brief (three structural alternatives)

Journey: "fechar o deck", from "what is missing" to "how much, where, and what I do about each card", for the deck owner and for whoever opens the owner's link (a parent paying, a store owner quoting, a friend).
Personas served: P1 Bia (beginner), P2 Caio (casual), P3 Marcos (competitive), P6 Dona Marta (parent, logged out), P7 Renata (store owner, logged out or not); P4 Duda receives the "ask the group" message.
Owner decisions so far (2026-10-21): the audience is the whole Brazilian market; Cúpula DT stays the only priced store and ships to all of Brazil; the public missing page shows Cúpula DT price, stock and "Comprar", and must also work as a neutral list a different store owner can answer.

## Rules every alternative shares (not up for comparison)

- Every price shown is the store's real current price for a version in stock. No "~" estimate is shown as if it were a price; an estimate says "estimado" in words.
- A card the app never looked up is "ainda não consultada", never "indisponível". "A loja não tem agora" only for a looked-up card with zero stock.
- A collection suggestion never removes the card from the shopping list; it is an option on the row.
- One counting unit per screen: copies ("cópias"), with distinct cards as the secondary figure, written the same way everywhere: "66 cópias (27 cartas)".
- Wherever the same card name can appear twice, the pitch is written as a word next to the name ("Pack Hunt (Vermelho)"), not only a color bar.
- "Já tenho" sets a quantity (stepper or "tenho todas"), never one copy per tap, and always offers undo.
- When the only stocked version is foil or promo, the row says so ("só tem foil promo").
- Owner-made replacements are visible on public pages ("no lugar de X").
- The Cúpula DT ships to all of Brazil; say it once where a non-player decides to buy ("envia para todo o Brasil").

## Scenario (illustrative values, consistent across all mockups)

Deck: "[CC] Brute do Caio", hero Rhinar, Classic Constructed, owner display name "Caio". Readiness 0%.
Missing: **66 cópias (27 cartas)**. Do not show legality; it is another journey.

Card images: `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/<CODE>.webp`. Use thumbnails only for the codes below; cards without a code get a neutral placeholder tile.

**At Cúpula DT, in stock, exact price — 13 cartas, 32 cópias, R$ 724,48**

| Card | Code | Missing | Store | Price each | Line |
|---|---|---|---|---|---|
| Pack Hunt (Vermelho) | WTR023 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Pack Hunt (Amarelo) | WTR024 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Smash Instinct (Vermelho) | WTR026 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Wrecker Romp (Azul) | WTR031 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Savage Feast (Amarelo) | WTR015 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Breakneck Battery (Vermelho) | WTR011 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Barraging Beatdown (Azul) | WTR019 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Savage Swing (Vermelho) | WTR020 | 3 | 3+ | R$ 0,20 | R$ 0,60 |
| Alpha Rampage (Vermelho) | WTR006 | 3 | 3, **só foil promo** | R$ 150,00 | R$ 450,00 |
| Bloodrush Bellow (Amarelo) | WTR007 | 3 | **2** | R$ 69,99 | R$ 139,98 (2 de 3) |
| Barkbone Strapping (equipamento) | WTR005 | 1 | 1, **só foil** | R$ 44,90 | R$ 44,90 |
| Scabskin Leathers (equipamento) | WTR004 | 1 | 1 | R$ 59,90 | R$ 59,90 |
| Romping Club (arma) | WTR003 | 1 | 1 | R$ 24,90 | R$ 24,90 |

Collection suggestion: **Awakening Bellow (Vermelho)** (WTR032), from Caio's collection, can stand in for **2 of the 3** Alpha Rampage. Using it on 2 copies saves R$ 300,00 (the remaining copy still costs R$ 150,00).

**Store has none right now (looked up) — 12 cópias**

Reckless Swing (Azul) WTR008 ×3, Sand Sketched Plan (Azul) WTR009 ×3, Bone Head Barrier (Amarelo) WTR010 ×3, Primeval Bellow (Vermelho) WTR035 ×2, plus the 1 Bloodrush Bellow (Amarelo) copy the store lacks.

**Not looked up yet — 10 cartas, 22 cópias** (no thumbnail codes)

Enlightened Strike (Vermelho) ×3, Sink Below (Vermelho) ×3, Command and Conquer (Vermelho) ×3, Pummel (Vermelho) ×3, Tenacity (Azul) ×3, Sigil of Solace (Vermelho) ×3, and one each of Snapdragon Scalers, Fyendal's Spring Tunic, Nullrune Hood, Crater Fist.
Looking them up is a background job of about 1.5 s per card ("uns 15 segundos").

Check: 32 + 12 + 22 = 66 copies; 13 + 4 (+ the partial Bloodrush) + 10 = 27 cards.

## Alternative A: rebuild the panel on the deck page, grouped by what to do

The job stays on the deck page. The "O que falta" panel is rebuilt around decisions instead of a flat list.

Screens (phone, 390 px wide):
1. **a1-deck-phone**: deck page top (banner, readiness 0%), then one summary block: "Faltam 66 cópias (27 cartas)", a stacked bar in three parts with labels (Na Cúpula DT 32 · R$ 724,48 / A loja não tem 12 / Ainda não consultadas 22), and a sticky bottom bar "Comprar na Cúpula DT · R$ 724,48".
2. **a2-panel-phone**: the panel expanded, three sections, each with its count and its one action:
   - "Comprar na Cúpula DT — 13 cartas · 32 cópias · R$ 724,48": rows with thumbnail, name with pitch word, "faltam 3", price each and line total, flags ("só foil promo", "2 de 3 na loja"), a "Tenho…" control, a "Comprar" link. The Alpha Rampage row carries the inline suggestion "Awakening Bellow (Vermelho) da sua coleção cobre 2 de 3 · Usar em 2 · economiza R$ 300,00". Show about 6 rows, then "+7 cartas".
   - "A loja não tem agora — 12 cópias": compact rows; action "Pedir no grupo (12 cópias)"; each row also has "Alternativas".
   - "Ainda não consultadas — 22 cópias": compact rows; action "Consultar preços (uns 15 s)", progress shown inline, not in a drawer.
3. **a3-tenho-phone**: the "Tenho…" control open on a row: "Quantas você tem? 0 1 2 3 · Tenho todas", and a toast "Pack Hunt (Amarelo): 3 marcadas · Desfazer".
4. **a4-public-phone**: the public "Procuro cartas" page, logged out: header (deck name, "por Caio"), a total box "Na Cúpula DT: R$ 724,48 por 32 das 66 cópias · envia para todo o Brasil", rows with thumbnail, name with pitch word, quantity, price, "Comprar"; a section "Ainda procurando (34 cópias)"; buttons "Copiar lista em texto" and "Tem loja? Copiar lista para orçamento". Disclaimer footer.
5. **a5-message-phone**: the WhatsApp text "Pedir no grupo" produces: only the 12 copies the store lacks, plus a link; a toggle "incluir todas as 66".

## Alternative B: a dedicated "Fechar o deck" screen, three steps, ending in a plan

The deck page keeps only a summary and one button. Closing the deck is its own guided screen that ends in a plan with three buckets.

Screens (phone):
1. **b1-deck-phone**: deck page top; summary card "Faltam 66 cópias (27 cartas)" with one primary button "Fechar o deck".
2. **b2-step1-phone**: "Passo 1 de 3 · Quais você já tem?" A compact list of all missing cards, each with a 0–3 stepper and "tenho todas"; "Pular" and "Continuar". Show Caio marking Pack Hunt (Amarelo) 3 and Savage Swing (Vermelho) 2; a counter "Você marcou 5 cópias · faltam 61".
3. **b3-step2-phone**: "Passo 2 de 3 · Dá para trocar por algo seu?" Only cards with a suggestion or good alternatives. Alpha Rampage: "Awakening Bellow (Vermelho) da sua coleção cobre 2 de 3 · economiza R$ 300,00 · [Usar em 2] [Manter Alpha Rampage]"; one more row with "Ver alternativas".
4. **b4-plan-phone**: "Passo 3 de 3 · Seu plano". Three buckets with totals after steps 1–2:
   - "Comprar na Cúpula DT": **25 cópias, R$ 423,48** (32 copies minus 3 Pack Hunt (Amarelo), 2 Savage Swing and 2 Alpha Rampage; R$ 724,48 minus R$ 0,60, R$ 0,40 and R$ 300,00). Actions: "Abrir as cartas na loja" and "Mandar o pedido no WhatsApp da Cúpula DT".
   - "Pedir no grupo": 12 cópias. Action "Pedir no grupo".
   - "Consultar o preço": 22 cópias. Action "Consultar (uns 15 s)".
   - Below: "Mandar para alguém comprar" (share link).
5. **b5-public-phone**: the public page is the plan, read-only: "O que comprar na Cúpula DT (25 cópias · R$ 423,48 · envia para todo o Brasil)" with rows and "Comprar"; "O que o Caio ainda procura (34 cópias)"; "Copiar lista em texto"; "Tem loja? Copiar lista para orçamento".

## Alternative C: the missing list is one page for everybody, with a role on top

The priced missing list is its own page (`/decks/:id/falta`, the same content at the public link). Owner, parent, friend and store owner see the same list; only the controls on each row change with who is looking. The deck page shows a summary that opens this page.

Screens (phone):
1. **c1-owner-phone**: owner view of the list page. Top: "Faltam 66 cópias (27 cartas)", total "R$ 724,48 na Cúpula DT por 32 cópias". Filter chips with counts: "Todas 66 · Na loja 32 · A loja não tem 12 · Não consultadas 22". Rows with larger thumbnails, name with pitch word, quantity, price; owner controls per row: "Tenho…", "Trocar" (opens the collection suggestion and alternatives), "Comprar". Alpha Rampage shows "Awakening Bellow da sua coleção cobre 2 de 3". A share button "Mandar esta lista" with three intents: "Para alguém comprar", "Para o grupo", "Para uma loja".
2. **c2-parent-phone**: the same page logged out, as Dona Marta: no owner controls; each row has "Comprar" and a checkbox "Comprei" kept on her phone; a sticky footer "Faltam comprar: 32 cópias · R$ 724,48 · envia para todo o Brasil"; a plain-language hint "Cada cor é uma carta diferente: confira a cor no nome".
3. **c3-store-phone**: the same page after the visitor taps "Sou lojista: responder com orçamento": each row gets "Tenho [n]" and a price field; a sticky footer "Seu orçamento: 18 de 66 cópias · R$ 412,00 · Enviar para o Caio no WhatsApp". A note that the Cúpula DT prices stay visible as reference.
4. **c4-friend-phone**: the same page logged in as a friend: rows the friend owns show "Você tem 2 · Oferecer para o Caio" (opens WhatsApp with a short text).
5. **c5-message-phone**: what "Para o grupo" sends: a short text ("Procuro 34 cópias que a Cúpula DT não tem: ...") and the link.

## How to build

- One HTML file per screen at `.design/mockups/close-the-deck/<id>.html` (ids above), plus `index-<a|b|c>.html` linking that alternative's screens.
- Copy the `:root` tokens and base classes verbatim from `.design/mockups/sharing/contact/shared-deck-a-phone.html` (dark theme, Hanken Grotesk, Newsreader, brass accent). Phone frame 390 px wide, `<html lang="pt-BR">`. The page wrapper may show a one-line caption above the frame ("Alternativa A · tela 2 · painel aberto").
- All UI copy in pt-BR, natural for a Brazilian player; card names in English. No em dashes in UI copy. Touch targets at least 44 px.
- Low-to-mid fidelity: structure, copy and numbers matter; polish does not. Use the scenario numbers exactly.
- Public pages carry the footer disclaimer used in the sharing mockups.
