# Deck building: round 3 brief (fixes from the round-2 panel)

Round 2 (`BRIEF-round-2.md`, `panel-round-2.md`) drew the combined design; all five personas would use it.
Round 3 redraws only what the panel found, plus one owner pick. Everything in `BRIEF.md` and `BRIEF-round-2.md` still holds unless changed here, including the copy rules and the arithmetic checks.

## The owner pick: stage and verdict

All five personas read "Pronto · 1 problema" and "Jogando · não pode jogar no Blitz" as a contradiction.
The stage (Ideia, Montando, Pronto, Jogando, Aposentado) is the player's own label and stays editable: journey 5 reads it to decide which decks hold copies.
Two ways, each drawn on the same screen:

- **Way A, the verdict takes the chip's place.** While the deck has a rule problem, the colored chip shows only the verdict ("Não vale no Blitz"), and the stage moves to a grey line under the deck name ("Etapa: Jogando"). With no rule problem, the chip shows the stage as today. A deck that is only short of cards keeps its stage in the chip, with the size next to it ("Montando · 31 de 40 cartas").
- **Way B, the two stay apart and their words do not clash.** The stage chip stays, always grey ("Jogando"). The verdict is its own red line, under the name, without the words "jogar" or "pronto": "Não vale no Blitz · 8 cartas com 2 cópias".

Screens:
1. **r3-stage-a-phone**: the home "Meus decks" with three cards: "Rhinar Blitz" (Caio's stage Jogando, 8 cards with 2 copies), "Rhinar - Blitz" (Bia's, Montando, 31 of 40, 1 problem) and "Rhinar CC" (Marcos's, Pronto, 1 problem), drawn in way A.
2. **r3-stage-b-phone**: the same three cards in way B.

Every other round-3 screen uses way A until the owner picks; the pick changes only this chip.

## Fixes (drawn once)

3. **r3-editor-phone** (Bia): as `r2-editor-phone`, plus a visible "Compartilhar" in the deck header (sharing shipped on 2026-10-18; it opens today's share dialog). The bar reads "31 de 40 cartas · 1 problema".
4. **r3-checklist-phone** (Bia): as `r2-checklist-phone` with two wording changes:
   - "Cartas que você leva: 35 de 52" with the line "o deck, a arma e os equipamentos; o herói não conta. No torneio isto se chama card pool."
   - The fix written in steps: "Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 30, então coloque mais 10 cartas."
5. **r3-inventory-desktop** (Marcos): as `r2-inventory-desktop`, with the inventory line reworded: "Inventário: cartas que você leva ao torneio além do deck. Entre um jogo e outro da mesma partida, dá para trocar cartas do deck por elas." No "jogo 1" anywhere.
6. **r3-export-group-desktop** (Marcos): the "Copiar lista" sheet with the tab "Para o grupo" chosen ("Você escolheu: Para o grupo"). The Portuguese text in full, with separate headed sections: "Herói", "Arma", "Equipamentos", "Deck (60 cartas)" and "Inventário (15 cartas, fora do deck)". It carries the same non-blocking warning, in Portuguese card names: "Esta lista não vale no Classic Constructed: Pack Hunt (Vermelho) aparece 4 vezes (3 no deck, 1 no inventário), o limite é 3. Dá para copiar mesmo assim."
7. **r3-deck-actions-desktop** (Marcos): as `r2-deck-actions-desktop`, with one muted line under each button: "Copiar lista: texto para o grupo ou para o Fabrary" and "Duplicar: cria uma cópia para testar mudanças sem mexer neste".
8. **r3-shared-phone** (Renata, not logged in): as `r2-shared-phone`, with two changes:
   - The button reads "Copiar lista" with the line "texto para o grupo ou para o Fabrary".
   - Drawn after one tap on the chip "Living Legend" ("Você tocou em Living Legend"). Under the chips: "Em Living Legend: não vale. O Rhinar jovem joga só Blitz e Silver Age." The Blitz block above stays as it is.
9. **r3-rule-changed-deck-phone** (Caio): as `r2-rule-changed-deck-phone`, with two additions:
   - Under "Deixar 1 de cada", a plain link "Prefiro escolher carta por carta". It closes the notice and keeps the "-" on each row.
   - After the date, "ver o anúncio" linking the official change log (`https://fabtcg.com/rules-and-policy-center/change-log-tournament-rules-and-policy/`, opens outside, with the external-link mark).
10. **r3-retired-hero-switched-desktop** (Lucas): "Kayo CC" after "Mudar para Living Legend". The format chip reads "Living Legend", and a green block says "Este deck vale em Living Legend." The toast reads "Formato mudado para Living Legend · Desfazer". The cards are unchanged.

## Not changed, by decision

- No date or history for a hero outside a format (copy rule 4).
- No suggestion of which 8 cards to add after "Deixar 1 de cada": that belongs to the Tutor (journey 6).
- The English export stays illustrative until the GEM format is checked by hand.

## Report back

The two stage screens' exact copy, the full "Para o grupo" text as drawn, and the grep results (each "Faltam" about owning; no "jogo 1"; no em or en dashes; no "trocas de cartas"; outside `r3-stage-b-phone`, no stage chip shown next to a rule problem).
Files are `r3-<id>.html` and `.png`, plus `index-r3.html`, with the two stage screens first.
