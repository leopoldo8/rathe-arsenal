# Deck building: round 2 brief (the combined design)

Round 1 (`BRIEF.md`, `panel-round-1.md`) compared A, B and C per part.
This brief draws one combined design, approved by the owner as a direction on 2026-10-22.
The rules table, the shared rules and the scenario in `BRIEF.md` still hold, with the changes listed here.

## Owner decisions (2026-10-22)

- The direction in `panel-round-1.md`: B's problems on the card with A's checklist behind a bar, B's two counts per row for the inventory, B's visible "Copiar lista" and "Duplicar" opening C's export sheet, B's "Excluídos recentemente", A's verdict on the shared page with B's format chips under it, hero first for a new deck.
- Inventory copies count in the missing cards, the shopping list and the copies a deck holds (so they are not spare in journey 5), always split in words: "4 do deck, 3 do inventário".

## Copy rules for every screen (new in round 2)

1. **"Faltam" means copies the player does not own, nothing else.** The deck size never uses "Faltam" or "falta". It reads "31 de 40 cartas no deck · coloque mais 9". Grep every screen: each "Faltam" or "faltam" must be about owning.
2. **A "problema" is a rule problem.** The deck size is never counted as a problem; it is shown next to the count. Bia's bar reads "31 de 40 cartas · 1 problema", and the same definition holds on the checklist, the shared page, the home card and the export warning.
3. **Say what to do, with the arithmetic done.** Removing the extra Pack Hunt (Vermelho) leaves 30, so Bia's line is "Para fechar: tire 1 Pack Hunt (Vermelho) e coloque mais 10 cartas." Every red line ends with the fix ("tire 1").
4. **Dates come only from the rules entry.** The Blitz change is dated because the rules carry a curated entry with the official source (9 March 2026, tournament rules change log, 7.3 Blitz Format). Hero retirement still claims no history and no date: "É permitido em Living Legend" only.
5. **The deck stage never contradicts the verdict.** When a deck has a rule problem, its stage and the verdict share one line, and the verdict sets the color: "Jogando · não pode jogar no Blitz". "Pronto" is never shown alone, or in green, next to a rule problem.
6. **Unknown words get one plain line where they first appear on the screen:**
   - "Card pool": "deck, inventário, arma e equipamentos; o herói não conta".
   - "Inventário": "cartas do card pool fora do deck do jogo 1; dá para trocar entre os jogos de uma partida".
   - "jovem": "herói jovem: versão para Blitz e Silver Age, decks de 40 cartas".
7. **"As substituições"**, never "as trocas de cartas", for a deck's replacements.
8. The export to GEM stays illustrative. The exact text GEM reads is a hand check before building, so no screen claims "funciona no GEM".
9. As in round 1: pt-BR, no em dashes or en dashes, card names in English with the pitch as a word, no raw codes, nothing pre-selected that the persona did not choose, and any screen drawn after taps says so in its own words.

## Arithmetic the generator must throw on

- Bia: 31 cards in the deck (29 at 1 + Pack Hunt (Vermelho) at 2), pool 35 of 52; after removing the extra copy 30, so "coloque mais 10"; before it "coloque mais 9".
- Marcos: 1 weapon + 4 equipment + 60 deck + 15 inventory = 80 of 80; Pack Hunt (Vermelho) 3 + 1 = 4; "Faltam 7 cópias (4 do deck, 3 do inventário)", and the missing list rows add up to the same 4 + 3.
- Caio: 24 × 1 + 8 × 2 = 40; after "Deixar 1 de cada", 24 + 8 = 32 of 40, "coloque mais 8".
- Lucas: before printing "Em Living Legend: válido", check in the catalog that Kayo, Armed and Dangerous is legal in Living Legend (it is, in cards 5.3.0), that Mandible Claw is legal there and not restricted (it is), and that every card of his 60 is legal in Living Legend, not banned there, and not on its restricted list with more than 1 copy. If a card fails, change the deck list and report it.

## Screens

Same build rules as round 1 (tokens, frames, nothing outside the frame, verified card codes only, touch targets 44 px). Files `r2-<id>.html` and `.png`, plus `index-r2.html`, in journey order:

1. **r2-editor-phone** (Bia): B's rows with art. The Pack Hunt (Vermelho) row: red line "2 cópias · o Blitz permite 1 · tire 1", its "+" disabled with "Máximo 1 no Blitz". A fixed bar at the bottom, above the tab bar: "31 de 40 cartas · 1 problema" with a chevron.
2. **r2-checklist-phone** (Bia): the bar tapped. A sheet at about 45% of the height, the card list still visible above it. Lines: green "Herói: Rhinar joga Blitz"; green "Todas as cartas são permitidas no Blitz"; green "Card pool: 35 de 52" with its plain line; red "Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1 · Ir para a carta"; neutral "Tamanho: 31 de 40 cartas · coloque mais 9". At the bottom: "Para fechar: tire 1 Pack Hunt (Vermelho) e coloque mais 10 cartas." The sheet closes only by its own handle or "Fechar", never by scrolling.
3. **r2-inventory-desktop** (Marcos): each row has two steppers, "No deck" and "No inventário". Header: "Deck 60 · Inventário 15 · Card pool 80 de 80", each term with its plain line once (tooltip-style text under the header is fine). The Pack Hunt (Vermelho) row is red: "3 no deck e 1 no inventário, 4 no total. O Classic Constructed permite 3 · tire 1". A row menu open on another card showing "Mover 1 para o inventário" and "Mover todas (3) para o inventário". Top: "Faltam 7 cópias (4 do deck, 3 do inventário) · Ver o que falta".
4. **r2-missing-desktop** (Marcos): journey 4's missing list (`.design/mockups/close-the-deck/r3-list-desktop.html`, same layout and components) for "Rhinar CC", now with the inventory: the header "Faltam 7 cópias de N cartas · 4 do deck, 3 do inventário", and each row saying where its copies go ("faltam 2 · 1 do deck, 1 do inventário"). Prices as journey 4; the total counts all 7.
5. **r2-deck-actions-desktop** (Marcos): the deck page header with visible buttons "Copiar lista" and "Duplicar", and "Excluir deck" only inside the "⋯" menu, drawn closed. The stage line follows copy rule 5: "Pronto · 1 problema".
6. **r2-export-desktop** (Marcos): "Copiar lista" tapped, then the tab "Para Fabrary, GEM ou Talishar" chosen ("Você escolheu: Para Fabrary, GEM ou Talishar"). The other tab "Para o grupo" next to it. Above the preview, a warning that does not block: "Esta lista não vale no Classic Constructed: Pack Hunt (Red) aparece 4 vezes (3 no deck, 1 no inventário), o limite é 3. Dá para copiar mesmo assim." The full English text in the preview, with the Inventory section, and "Copiar".
7. **r2-delete-toast-phone** (Caio): the home after tapping the trash on "Rhinar Blitz v2": the deck is gone from the grid, and a toast that stays until the next action: "Rhinar Blitz v2 foi para Excluídos recentemente · Desfazer". Under the decks, the row "Excluídos recentemente (1) · ficam 30 dias".
8. **r2-deleted-list-phone** (Caio): "Excluídos recentemente": "Rhinar Blitz v2 · Ideia · 12 cartas · excluído hoje · some de vez em 30 dias" with "Restaurar". One line on top: "Um deck excluído volta com as cartas, as substituições e o histórico." and "Excluir de vez" as a plain link per row.
9. **r2-shared-phone** (Renata, not logged in): Bia's shared "Rhinar - Blitz". Under the title, the verdict block for the deck's own format, fixed: "Blitz · ainda não pode jogar" with two lines: "O deck tem 31 de 40 cartas." and "Pack Hunt (Vermelho) tem 2 cópias; o Blitz permite 1.", then "Para jogar no Blitz: tirar 1 Pack Hunt (Vermelho) e colocar mais 10 cartas." Under it, a separate row "Conferir em outro formato:" with chips Classic Constructed, Living Legend and Silver Age, none chosen (the Blitz verdict above never changes with a chip). Then "Copiar lista" and the deck. No sign-in prompt above the verdict.
10. **r2-new-deck-hero-phone** (Bia): "Novo deck" with the three starts ("Comprei um deck pronto", "Tenho um link do Fabrary", "Começar do zero", the last open). Hero search "rhinar": two results with art, none highlighted: "Rhinar · jovem · Blitz · Silver Age" and "Rhinar, Reckless Rampage · Classic Constructed · Living Legend". The "jovem" plain line once under the results.
11. **r2-new-deck-format-phone** (Bia): after picking young Rhinar ("Você escolheu Rhinar"): only Blitz and Silver Age, none selected, each with one line ("Blitz: 40 cartas, 1 cópia de cada" / "Silver Age: 40 cartas, até 2 cópias, só cartas que já saíram como comum ou rara"). "Começar a montar" disabled until one is chosen.
12. **r2-retired-hero-desktop** (Lucas): "Kayo CC": both problems in plain words ("Kayo, Armed and Dangerous não é permitido em Classic Constructed. É permitido em Living Legend." and "Mandible Claw está banida no Classic Constructed."), then, before any tap, the result: "Em Living Legend este deck é válido: o herói e a Mandible Claw são permitidos lá." The button "Mudar para Living Legend" and the line "As cartas do deck não mudam, só o formato em que ele é conferido."
13. **r2-rule-changed-home-phone** (Caio): the home card for "Rhinar Blitz": "Jogando · não pode jogar no Blitz" with "ver por quê".
14. **r2-rule-changed-deck-phone** (Caio): the deck page opened from it: "Desde 9 de março de 2026, o Blitz permite 1 cópia de cada carta (antes eram 2). 8 cartas deste deck têm 2." The 8 cards listed. The button "Deixar 1 de cada" with its line "Tira 1 cópia de cada uma das 8 cartas. O deck fica com 32 de 40 e você coloca mais 8. As cartas continuam na sua coleção."
15. **r2-one-each-phone** (Caio): after "Deixar 1 de cada": the bar "32 de 40 cartas · nenhum problema", the stage "Jogando · coloque mais 8 cartas", and the toast "8 cópias tiradas do deck · Desfazer".
16. **r2-list-view-desktop** (Marcos): the "Lista" view as text, grouped Herói, Arma, Equipamentos, Deck (60), Inventário (15), each line "3x Pack Hunt (Vermelho) · custo 2 · Ação", the Pack Hunt (Vermelho) lines marked with the problem, lines with copies he does not own marked "faltam N", and "Copiar lista" at the top. The deck fits one screen.

## Report back

The final card lists for every deck that changed, the missing list rows (card, copies, deck or inventory), the export text as drawn, and the result of the catalog checks for Lucas's deck.
