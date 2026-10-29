# Getting cards in: round 2 brief (the combined design)

Round 1 (`BRIEF.md`, `panel-round-1.md`) compared A, B and C per part. This brief draws one combined design from the parts the panel kept, plus the owner decision below. Every shared rule and the scenario in `BRIEF.md` still hold, with the changes listed here.

Owner decision (2026-10-21): when a deck is imported from a Fabrary link, the app always asks "Essas cartas são suas?" with no answer pre-selected ("Sim, colocar na minha coleção" / "Não, é só a lista do deck"). A ready-made deck from a box does not ask: whoever bought the box has the cards.

## Copy rules added in round 2

- Never "fonte". Where the origin of cards shows, the heading is "De onde vieram as cartas" and each item is named after what it was ("Armory Deck: Kayo", "colecao-lucas.csv", "Lista colada em 21/10").
- "Versão não informada" is shown quietly (grey text), never as a badge, count of pending items or call to action.
- Nothing is pre-selected in a version picker except what the app knows (the box's own version). The neutral choice for a whole import is "Não informar".
- Explain on first use, in one line each: "Versão: a coleção e a arte da carta (o código no rodapé, como WTR023)", "Edição: 1ª edição, Alpha ou Unlimited, escrito na carta", "Foil: o acabamento brilhante", "Estado: NM quase nova, LP pouco usada, MP usada, HP muito usada".
- Buttons say what happens to what is not done: "Adicionar as 6 prontas (12 cópias)" with, under it, "As 2 que faltam ficam em 'Para resolver' na sua coleção."
- A beginner never sees "Fabrary" as the first word of a screen; it appears inside the paste box's hint.

## Screens

Phone frames 390 px. Same build rules as round 1 (tokens, no captions outside frames, no dashes, arithmetic checks that throw).

1. **r2-first-run-phone**: a new account. Title "Como você quer começar?". First, a large card "Comprei um deck pronto" ("Armory Deck, Blitz Deck ou Silver Age, na caixa"). Then a paste box with the hint "Cole um link de deck (do Fabrary, por exemplo) ou uma lista de cartas". Then two smaller rows: "Enviar uma planilha (.csv)" and "Fotografar ou digitar as cartas". At the bottom, small: "Pular por agora".
2. **r2-add-phone**: an existing account, "Adicionar cartas". The paste box first (same hint), then the rows "Comprei um deck pronto", "Enviar uma planilha (.csv)", "Fotografar as cartas", "Digitar o nome".
3. **r2-product-search-phone**: "Qual deck você comprou?", search "kayo", the three results (Armory Deck: Kayo · Classic Constructed; Silver Age Chapter 1: Kayo · Silver Age; Blitz Deck: Kayo · Blitz), each with the hero image or a tile, tap to continue.
4. **r2-product-confirm-phone**: "Armory Deck: Kayo · 66 cartas". Two switches, both on, each with its reason in one line:
   - "Colocar as 66 cartas na minha coleção": "Você comprou a caixa, então essas cartas são suas."
   - "Criar um deck com elas": "Para ver se o deck está completo e o que vale comprar depois."
   A collapsed "Ver as 66 cartas". One quiet note: "As cartas entram com a versão que vem na caixa. Agility e Might são marcadores do jogo, não cartas de deck, e ficam de fora." Button "Adicionar".
5. **r2-fabrary-found-phone**: Caio's sentence pasted ("olha meu deck https://fabrary.net/decks/01J0Z8K4M2 valeu"). Under the box: "Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas". Then the question "Essas cartas são suas?" with two options as radio rows, none selected: "Sim, colocar na minha coleção" / "Não, é só a lista do deck". The button "Importar o deck" is disabled with "Responda acima para continuar". Below, a link: "Quer dizer quais cartas você tem? Cole a sua lista aqui."
6. **r2-list-phone**: Duda's 8 lines pasted (same text as round 1). Above the reading, one row "Versão das cartas desta lista" with three chips: "Não informar" (selected), "Sem foil · NM", "Escolher por linha". The reading line by line on the same screen:
   - 1 "3 Snatch (Vermelho)" ok.
   - 2 "2 Command and Conquer (Vermelho)" ok.
   - 3 "1 Enlightened Strike (Vermelho)" ok, with "foil · escolha a versão (2 têm foil)" as a chip; the word "foil" from the text is shown as read.
   - 4 "Você quis dizer Command and Conquer (Vermelho)?" with the card thumbnail, "Usar esta" / "Corrigir", quantity 1. Not counted until "Usar esta" is tapped.
   - 5 "4 Pummel · Qual cor?" with three color buttons.
   - 6 "2 Sink Below (Amarelo)" ok.
   - 7 "3 Pack Hunt (Azul)" ok, with a small note "'(3)' lido como Azul".
   - 8 "Não achamos 'Mistery Card'" with an edit field and a "Procurar" button.
   Draw the state after Duda tapped "Usar esta" on line 4 (so the count is 6 lines, 12 cópias) and before line 5. Button "Adicionar as 6 prontas (12 cópias)" and under it "As 2 que faltam ficam em 'Para resolver' na sua coleção."
7. **r2-report-phone**: Lucas's CSV. Top: "colecao-lucas.csv · 289 linhas prontas · 612 cópias (241 cartas)". A line "Lemos as colunas nome, quantidade e cor." A line "Esta planilha não tem coluna de versão: as cartas entram sem versão informada." Then "11 para resolver", grouped (Sem cor 7, Nome parecido 3, Quantidade 1). Each row shows the line number and the original text of the line ("Linha 23 · Snatch,2,"), and the fix: color buttons plus "Não sei" (keeps it in Para resolver); for a typo, the suggestion with thumbnail and "Usar esta"; for line 141 a number field prefilled 3 with "Usar 3". Line 8 appears once, quietly, among the ready ones: "Linha 8: lemos 'Rhinar, Reckless Rampage' certo." Button "Adicionar as 289 prontas" and under it "As 11 que faltam ficam em 'Para resolver' na sua coleção."
8. **r2-pending-phone**: the collection page after Lucas added the 289. A banner at the top: "11 linhas de colecao-lucas.csv para resolver · Resolver". Below, the normal collection; a "De onde vieram as cartas" link in the header.
9. **r2-version-bulk-phone**: from "De onde vieram as cartas", tapping "Lista colada em 21/10 · 12 cópias" opens "Versões desta lista". One block "Marcar todas de uma vez": Foil (Sem foil / Rainbow Foil / Cold Foil / Não sei), Estado (NM / LP / MP / HP / Não sei), nothing selected, and "Aplicar às 12 cópias". Below, the cards of the list, each with its current version in grey and "Mudar" for the exceptions. Show Duda's state after applying "Sem foil · NM" to all, with Enlightened Strike changed to "Rainbow Foil · NM".
10. **r2-version-card-phone**: the collection card sheet for Snatch (Vermelho), "3 cópias", the versions in grey text: "2 sem versão informada", "1 Welcome to Rathe · Unlimited · Rainbow Foil · NM". A plain button "Mudar versão". Below it, the picker open for the 2 copies: "Versão" as a list of printings with the collection name and a thumbnail (no code shown if unsure), "Edição", "Foil", "Estado", each with its one-line explanation, nothing pre-selected, and "Quantas das 2 cópias são desta versão? 1 2". Button "Salvar".

## Arithmetic

Same as round 1: Kayo 66 = 1 + 5 + 60; Duda 6 lines ready, 12 cópias (3 + 2 + 1 + 1 + 2 + 3), 2 to resolve; Lucas 289 + 11 = 300, 11 = 7 + 3 + 1.
