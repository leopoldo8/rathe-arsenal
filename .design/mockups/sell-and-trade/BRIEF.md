# Sell and trade: mockup brief (three structural alternatives)

Journey 5 of the 2026-10-21 persona audit: selling the copies a player does not need, buying from someone's list, and trading with a friend.
Personas: P4 Duda (trader, sells singles in WhatsApp groups), P7 Renata (LGS owner, buys and answers WhatsApp all day), P2 Caio (casual, trades with friends), P3 Marcos (competitive, netdecks from friends), P5 Lucas (returning player, an old box of 612 copies he mostly will not play).
Findings this journey answers: F45 (a sell list cannot start from the collection or the spare copies; listing more than owned gives no warning), F46 (the sell message lacks version, total, payment and pickup; the "× 7" is unexplained), F55 (the multiplier redisplays "5,5" as "5.5"), F56 (a sharer with no saved WhatsApp number shares with no warning that buyers cannot reach them), F48 (saving a friend's shared deck copies the friend's substitutions as if they were the list), plus Duda's round-2 ask from journey 2 (price and "à venda" per copy).

## Owner decisions (2026-10-21)

- **Spare copies ("sobrando")**: copies a player owns beyond what their decks hold. Decks of the same format share cards, so within one format only the deck that uses the most copies of a card holds them; decks of different formats hold their own copies, and the formats add up. Only decks marked "Montando", "Pronto" or "Jogando" hold copies; "Ideia" and "Aposentado" hold none.
- **Selling a line asks about the collection**: marking a line sold asks "Tirar da sua coleção também?". This replaces `.design/sharing.md`'s "selling never changes the collection".
- **Trade is in**: a logged-in player who opens a friend's "Procuro" list sees which of those cards they have spare and can offer them, with an optional "Em troca procuro" line linking their own list. The offer is a WhatsApp text, never a stored proposal (no accept or reject screens).
- LigaFAB prices cannot be fetched automatically (its `robots.txt` asks every crawler to wait 360 seconds between requests, and its card page answers a script with a Cloudflare challenge). The price help stays TCGplayer × multiplier, explained in plain words, plus a link per card for the seller to check LigaFAB by hand.

## Rules every alternative shares (not up for comparison)

- Spare is always explained on request: a "Por que sobra?" detail names the decks that hold copies and why the others do not.
- Versions come from the collection (journey 2): a sell line made from copies with a known version carries it; copies with no version stay "versão não informada" in grey, and the price suggestion then uses the cheapest regular printing and says "preço aproximado".
- The sell message carries what buyers ask first: version or finish when known, condition when known, price each, a total, and the seller's closing line ("Aceito PIX · retirada na Cúpula DT ou envio pelos Correios"), remembered from the last time.
- The price helper reads "Preço sugerido: TCGplayer em dólar × 7" with one line "O 7 cobre o dólar e o custo de trazer a carta. Mude se você cobra diferente." The multiplier shows a comma ("5,5").
- Listing more copies than owned is allowed (sellers list cards they have outside the app) but the line says "Você tem 1 na coleção" in grey.
- Sold lines ask "Tirar da sua coleção também?" with the copies named; "Tirar" removes the same version first, else a copy with no version; if the card comes from more than one import, the sheet asks which one, as "Remover 1 de" does today. "Manter" leaves the collection as it is. Both offer "Desfazer" afterwards.
- Sharing a list with no WhatsApp number saved says, next to the number field: "Sem seu WhatsApp, quem abrir o link não tem como falar com você."
- All copy pt-BR, no em dashes or en dashes, no raw error codes. Card names in English with the pitch as a word.

## Scenario (illustrative values, consistent across mockups)

**Duda's decks**: "Kayo CC" (Classic Constructed, Jogando), "Rhinar CC" (Classic Constructed, Montando), "Rhinar SA" (Silver Age, Pronto), "Dash ideia" (Classic Constructed, Ideia).

**Duda's spare copies** (7 cards, 20 copies):

| Card | Owns | Held by decks | Spare |
|---|---|---|---|
| Wounding Blow (Vermelho) | 9 | 3 (Kayo CC) | 6 |
| Head Jab (Vermelho) | 4 | 0 (only "Dash ideia" uses it, an Ideia deck holds nothing) | 4 |
| Pummel (Vermelho) | 6 | 3 (Kayo CC) | 3 |
| Snatch (Vermelho) | 7 | 5 (Kayo CC 3 + Rhinar SA 2) | 2 |
| Command and Conquer (Vermelho) | 4 | 2 (Kayo CC) | 2 |
| Enlightened Strike (Vermelho) | 2 | 0 | 2 (1 Rainbow Foil · NM, 1 versão não informada) |
| Pack Hunt (Azul) | 6 | 5 (Classic Constructed: Kayo CC 3, Rhinar CC 2, counts 3; plus Rhinar SA 2) | 1 |

Check: 6 + 4 + 3 + 2 + 2 + 2 + 1 = 20. Sink Below (Amarelo): owns 3, Rhinar SA uses 3, spare 0, so it is not on the list.

**Suggested prices** (TCGplayer × 7, whole reais): Command and Conquer R$ 45 (History Pack 1, NM), Enlightened Strike R$ 12 regular and R$ 60 Rainbow Foil, Snatch R$ 6, Pummel R$ 4, Head Jab R$ 2, Pack Hunt R$ 2, Wounding Blow R$ 1.

**Duda's sell list** "Vendo - sobras" (9 copies): 2 Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45 cada; 1 Enlightened Strike (Vermelho) · Rainbow Foil · NM · R$ 60; 1 Enlightened Strike (Vermelho) · R$ 12 (versão não informada, preço aproximado); 2 Snatch (Vermelho) · R$ 6 cada; 3 Pummel (Vermelho) · R$ 4 cada. Total: 90 + 60 + 12 + 12 + 12 = R$ 186.

**The message** (exactly):
```
VENDO
2x Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45 cada
1x Enlightened Strike (Vermelho) · Rainbow Foil · NM · R$ 60
1x Enlightened Strike (Vermelho) · R$ 12
2x Snatch (Vermelho) · R$ 6 cada
3x Pummel (Vermelho) · R$ 4 cada
Total: R$ 186 (9 cartas)

Aceito PIX · retirada na Cúpula DT ou envio pelos Correios
<link>
```

**Sold**: Duda marks the 2 Command and Conquer sold. Sheet: "Tirar da sua coleção também? 2 Command and Conquer (Vermelho) · History Pack 1 · NM. Você tem 4; ficam 2, as que o Kayo CC usa." Buttons "Tirar da coleção" / "Manter na coleção".

**Caio buys from Duda's list** (logged in): "3 cartas desta lista servem nos seus decks": Command and Conquer "Falta 1 no seu Rhinar CC", Snatch "Faltam 2 no seu Kayo CC", Pummel "Falta 1 no seu Rhinar CC". He selects Command and Conquer ×1 and Snatch ×2 ("Quero estas"), and "Falar com Duda" opens WhatsApp: "Oi Duda, vi sua lista no Rathe Arsenal. Quero: 1x Command and Conquer (Vermelho) · R$ 45, 2x Snatch (Vermelho) · R$ 6 cada. Total R$ 57."

**Caio trades with Marcos**: Marcos shared "Procuro - Kayo" (want list): 3 Pummel (Vermelho), 2 Pack Hunt (Azul), 1 Command and Conquer (Vermelho), 2 Sink Below (Amarelo), 2 Bloodrush Bellow (Amarelo). Caio's view: Pummel "Você tem 4 · 3 sobrando"; Command and Conquer "Você tem 2 · 1 sobrando"; Sink Below "Você tem 2 · nenhuma sobrando (o seu Rhinar SA usa as 2)"; Pack Hunt and Bloodrush Bellow "Você não tem". Summary "Você tem sobrando 4 cópias de 2 cartas que Marcos procura." Button "Oferecer as 4 cópias". Option row "Em troca procuro" with Caio's list "Procuro - Rhinar" (on by default when he has one list; a picker when more). Message: "Oi Marcos, vi sua lista no Rathe Arsenal. Tenho sobrando para você: 3x Pummel (Vermelho), 1x Command and Conquer (Vermelho). Em troca procuro estas: <link of Procuro - Rhinar>"

**Marcos saves Caio's deck** (F48): Caio's shared deck "Rhinar CC" shows "Runner Runner ×3 · no lugar de Swing Big" (Caio replaced it with what he owns). "Salvar nos meus decks" asks "Qual lista você quer salvar?": "A lista original (com Swing Big)" / "Como o Caio montou (com Runner Runner)". Nothing pre-selected.

**Lucas** (for the persona panel, not drawn): 612 copies of 241 cards, one deck "Rhinar CC" (Montando, 60 cards), so about 550 copies are spare. He needs to find the few worth selling.

## Alternative A: lists, now starting from what is spare

The Lists tab stays. "Nova lista" gains a third start.

1. **a1-new-list-phone**: Lists page with the "Nova lista" sheet open, kind "Vendo" selected, three starts: "Das cópias que sobram" ("20 cópias que nenhum deck seu usa"), "De um deck" ("O deck inteiro"), "Do zero". "Das cópias que sobram" selected.
2. **a2-spare-picker-phone**: "Escolha o que vender": the 7 spare cards with image, "6 sobrando de 9", a quantity stepper (0 to spare) and the suggested price; sort "Maior preço primeiro" (default) or "Nome"; a "Por que sobra?" link per row. Duda's 9 copies selected. Button "Criar a lista (9 cópias · R$ 186)".
3. **a3-list-phone**: the sell list editor: lines with version in grey, price, "Você tem N na coleção" where it applies, "Ver na LigaFAB" per line; the price helper and multiplier (shows "7"); total R$ 186; share and copy buttons.
4. **a4-message-phone**: the message preview exactly as the scenario, with the closing line editable above "Enviar no WhatsApp" and "Copiar texto".
5. **a5-sold-phone**: the list with Command and Conquer just marked "Vendida" and the sheet "Tirar da sua coleção também?".

## Alternative B: "à venda" lives in the collection

The Library gets a "Sobrando" filter, and each copy can be marked "À venda" with a price. The sell link is one standing page, "Minha vitrine", showing every copy marked for sale. Lists stay for "Procuro".

1. **b1-library-spare-phone**: Library with filter chips "Todas", "Sobrando · 20", "À venda · 0"; "Sobrando" selected, the 7 cards with "6 sobrando" ribbons and a checkbox mode "Marcar à venda".
2. **b2-card-sale-phone**: card sheet for Enlightened Strike (Vermelho): "2 cópias · 2 sobrando", one row per version (1 Rainbow Foil · NM, 1 versão não informada), each with a switch "À venda" and a price field (R$ 60, R$ 12 prefilled from the suggestion), "Por que sobra?".
3. **b3-showcase-phone**: "Minha vitrine": the 9 copies marked for sale, total R$ 186, the price helper once at the top, share and copy buttons, "Vendida" action per line.
4. **b4-message-phone**: as A4.
5. **b5-sold-phone**: in the vitrine, Command and Conquer swiped "Vendi 2", the sheet "Tirar da sua coleção também?".

## Alternative C: a "Sobrando" page as the hub for selling and trading

The Library header says "20 cópias sobrando · Ver". That page groups spare copies and an action bar turns a selection into a sale or a trade offer. A list is created behind the message so the link works.

1. **c1-library-banner-phone**: Library with the banner "Você tem 20 cópias sobrando · Ver" under the stats.
2. **c2-spare-page-phone**: "Sobrando": a header explaining once "Cópias que nenhum deck seu está usando. Decks Ideia e Aposentado não seguram cartas." then the 7 cards, sorted by price, each with a checkbox and a stepper; 9 copies selected; a bottom bar "9 cópias · R$ 186" with "Vender" and "Oferecer para troca".
3. **c3-sell-draft-phone**: after "Vender": a one-screen draft with the lines, editable prices and versions, the price helper, the closing line, and the message preview below; "Enviar no WhatsApp" creates the list "Vendo - 21/10" and its link.
4. **c4-trade-draft-phone**: after "Oferecer para troca": the same selection as "Tenho para troca" with no prices, plus "Em troca procuro" picking one of Duda's "Procuro" lists; message preview.
5. **c5-sold-phone**: the list "Vendo - 21/10" opened from Lists, Command and Conquer marked "Vendida", the sheet "Tirar da sua coleção também?".

## Shared screens (drawn once, same in every alternative)

1. **s1-why-spare-phone**: "Por que sobra?" for Pack Hunt (Azul): "Você tem 6. Seguram 5: Classic Constructed 3 (Kayo CC usa 3, Rhinar CC usa 2; você passa as cartas de um deck para o outro, então conta o que mais usa) e Silver Age 2 (Rhinar SA). Sobra 1." Under it: "Dash ideia não segura cartas: está como Ideia." and a setting row "Cada deck tem as próprias cartas" (off) with one line "Ligue se você não passa cartas entre decks do mesmo formato."
2. **s2-share-no-contact-phone**: the share sheet for "Vendo - sobras" with no WhatsApp saved: the number field, "Sem seu WhatsApp, quem abrir o link não tem como falar com você.", "Salvar e mostrar", and "Compartilhar sem contato" as a plain link.
3. **s3-buyer-phone**: Duda's list opened by Caio (logged in): header "Duda vende estas cartas", the summary "3 cartas desta lista servem nos seus decks", rows with version, price and the deck hints, checkboxes, Command and Conquer ×1 and Snatch ×2 selected, bottom bar "Quero estas · R$ 57" with "Falar com Duda".
4. **s4-trade-visitor-phone**: Marcos's "Procuro - Kayo" opened by Caio, as in the scenario: spare first, "Você não tem" last, the summary, "Oferecer as 4 cópias", the "Em troca procuro: Procuro - Rhinar" row.
5. **s5-offer-message-phone**: the WhatsApp offer text from s4, exactly as the scenario.
6. **s6-saved-deck-choice-phone**: Caio's shared deck with the Runner Runner row marked "no lugar de Swing Big" and the sheet "Qual lista você quer salvar?" with the two options, none selected, and "Salvar" disabled until one is picked.

## How to build

- One HTML file per screen at `.design/mockups/sell-and-trade/<id>.html`, plus `index-a.html`, `index-b.html`, `index-c.html`, `index-shared.html`.
- Copy the `:root` tokens and base classes verbatim from `.design/mockups/sharing/contact/shared-deck-a-phone.html` (dark theme, Hanken Grotesk, Newsreader, brass accent). Phone frame 390 px wide, `<html lang="pt-BR">`.
- NO caption, label or note outside the phone frame. The file name is the only label.
- Card images from `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/<CODE>.webp` only for codes verified in the catalog (`@flesh-and-blood/cards` in the repo's `node_modules`); otherwise the neutral placeholder tile.
- Low-to-mid fidelity: structure, copy and numbers matter; use the scenario numbers exactly, and make the generator throw if a total does not add up (20 spare, 9 copies, R$ 186, R$ 57). No em dashes or en dashes in UI copy. Touch targets at least 44 px.
