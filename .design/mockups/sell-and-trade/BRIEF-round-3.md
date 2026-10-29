# Sell and trade: round 3 brief (fixes from round 2)

Redraw the round-2 screens with the twelve fixes in `panel-round-2.md`. Everything else in `BRIEF.md` and `BRIEF-round-2.md` holds. Screens not listed are copied from round 2 as `r3-*` unchanged, so `index-r3.html` shows the whole journey.

## Rule question (fix 3)

Asked only when two decks that hold copies use the same card; Duda has two (Snatch in Kayo CC and Rhinar SA; Pack Hunt in three decks), so she is asked. Each option shows its result for her collection:
- "Sim, entre decks do mesmo formato" · "Sobram 20 cópias"
- "Sim, entre quaisquer decks" · "Sobram 24 cópias" (Snatch 4 and Pack Hunt 3 instead of 2 and 1)
- "Não, cada deck tem as próprias cartas" · "Sobram 19 cópias" (Pack Hunt 0 instead of 1)

Check: 20 + 2 + 2 = 24; 20 - 1 = 19.

## Screens

1. **r3-spare-rule-phone**: the question with the three options and their counts, none selected, "Continuar" disabled.
2. **r3-spare-page-empty-phone** (fix 6): the Sobrando page in its first state, every stepper at 0, bar "Escolha o que vender". The Ideia notice (fix 10): "Dash ideia usa 3 Head Jab. Decks Ideia não prendem cartas, então elas aparecem aqui." with the button "Marcar Dash ideia como Montando". Store price (fix 1) only on the rows with no version or a regular version, worded "A Cúpula DT vende a versão mais barata por R$ X"; the Enlightened Strike Rainbow Foil row and the Command and Conquer History Pack 1 row show no store price. "Ver na LigaFAB" (fix 2) as a small link on each row.
3. **r3-spare-page-phone**: the same page after Duda's taps, the line "Você escolheu 9 cópias", bar "9 cópias · R$ 186" with "Vender" and "Oferecer para troca".
4. **r3-sell-draft-phone** (fix 4, 5, 12): the draft before the finish answer. A block "3 linhas sem versão informada. Elas existem em foil, e foil vale mais:" with one row per card (Enlightened Strike, Snatch, Pummel), each with "Sem foil / Foil / Não sei", nothing selected, and under the rows "Sim, todas sem foil" as a plain shortcut. Lines whose version is not fully known show "preço aproximado" in grey. The list name "Vendo - 21/10" is an editable field at the top. Message preview below, built from what is answered so far ("· foil não conferido" for unanswered lines).
5. **r3-sell-draft-answered-phone**: the same draft after Duda answers all three "Sem foil" one by one; the message preview equals round 2's final text.
6. **r3-sold-phone** (fix 7): "Quantas você vendeu? 1 / 2" ("2" chosen), then "Tirar da sua coleção também? Você tem 4; ficam 2, as que o Kayo CC usa." with "Sim, tirar 2 da coleção" and "Não, só marcar como vendida", and under them "Escolha não se essas cópias não estavam no app."
7. **r3-trade-visitor-phone** (fix 8): the value line reads "Valor aproximado, pelo preço sugerido: você oferece R$ 57 · você procura R$ 21". The "Você não tem" rows collapse into one line "2 cartas que você não tem: Pack Hunt (Azul), Bloodrush Bellow (Amarelo)".
8. **r3-offer-message-phone** (fix 9, 11): back link "‹ Lista do Marcos"; the text: "Oi Marcos, vi sua lista no Rathe Arsenal. Tenho sobrando para você: 3x Pummel (Vermelho) · sem foil, 1x Command and Conquer (Vermelho). Em troca procuro: 2x Wrecker Romp (Azul), 1x Savage Feast (Vermelho). Minha lista: https://rathearsenal.app/l/p3Rv8n" (Caio's Pummel copies are recorded as regular; his Command and Conquer has no version, so nothing is said about it).

Copy the other round-2 screens as `r3-library-banner-phone`, `r3-why-spare-phone`, `r3-message-phone`, `r3-share-contact-phone`, `r3-buyer-phone`, `r3-buyer-message-phone`, `r3-saved-deck-phone`, `r3-lists-new-phone`.
