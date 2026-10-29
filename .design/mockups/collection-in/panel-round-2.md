# Getting cards in: persona round 2 (2026-10-21)

Screens: `BRIEF-round-2.md`, `index-r2.html`. The same five simulated personas re-ran their own job on the combined design, counting steps against today and their round-1 picks. Simulation, not user evidence.

## Outcome per persona

| Persona | Job | Steps now | Today | Would use it? |
|---|---|---|---|---|
| P1 Bia | put the Armory Deck: Kayo in | 4 taps + 2 reads | no path (Fabrary link or ~100 taps) | Yes |
| P2 Caio | import a friend's deck, record what he owns | ~9 for both halves | >15 for one half, and the friend's cards land in his collection | Yes |
| P3 Marcos | bring his list, record versions | ~8 taps for all-regular + 5 per Cold Foil card | versions impossible; round 1 was 6-7 taps per card | Yes for collection and versions; Fabrary stays for building |
| P4 Duda | paste his list, record versions | 5-6 for the list, 3 to mark everything, 7-8 for the one valuable card | ~30 for 8 cards, no versions | Yes for entering lists; his spreadsheet stays for selling (price, for sale) |
| P5 Lucas | load a 300-line spreadsheet without losing cards | ~5 (add 289, keep 11 for later) or ~15 resolving all | 8+ and no idea what entered | Yes |

Round-1 complaints reported solved: Fabrary no longer first for a beginner; both switches explained; "fonte" gone; tokens and NM/LP/MP/HP explained; explicit "Essas cartas são suas?"; "Cole a sua lista aqui" next to it; "'(3)' lido como Azul"; where the unresolved lines go; undo on an accepted suggestion; nothing pre-selected in the card picker; "Não informar" default; bulk marking; "Não sei" on color-less lines; Portuguese headers read and said so; original line text next to the number.

## Problems found in round 2 (design and copy, no owner decision needed)

1. **The paste box pulls a beginner away from "Comprei um deck pronto"** on the first-run screen (Bia). Fix: on first run the box is a small row below the product card, not a large field.
2. **Version options show no picture or code** (Bia, Duda): cannot compare with the card in hand. Fix: each printing option shows its image and footer code (the catalog has both).
3. **The bulk screen shows "Rainbow Foil · NM" for Enlightened Strike** as if "foil" had been turned into Rainbow (Marcos, Duda). Fix: a pasted "foil" stays "foil · escolha a versão" until the player picks; the bulk screen shows it as pending. "(2 têm foil)" becomes "existe em 2 versões foil".
4. **"Não sei" and "Não informar" look like the same thing** (Marcos, Duda). Fix: one word, "Não sei", everywhere.
5. **"Aplicar às 12 cópias": does it overwrite rows already set?** (Marcos). Fix: it applies only to copies with no version yet, says so ("Aplica às 11 cópias sem versão; as que você já marcou não mudam"), and the rows show the result before confirming.
6. **Bulk marking has no edition** (Lucas). Fix: add "Edição: 1ª edição / Unlimited / Não sei".
7. **Bulk marking must work for any import**, including a spreadsheet (Lucas). Fix: every import in the list of imports opens the same "Versões desta importação" screen.
8. **"Não, é só a lista do deck": a list for what?** (Caio). Fix: "Não, só quero comparar com o que eu tenho"; after it, the same card shows "Você tem 0 de 66 cartas deste deck" and the button "Colar a lista do que eu tenho", not a link at the foot.
9. **"De onde vieram as cartas" is not a name anyone looks for** (Lucas, Duda). Fix: "Importações".
10. **Where "Para resolver" lives** (Caio). Fix: the sentence names it: "ficam em 'Para resolver', no topo da sua coleção".
11. **Does the box's version cover foil?** (Bia). Fix: "As cartas entram com a versão que vem na caixa, inclusive as foil."
12. **"Quantas das 2 cópias são desta versão?" is hard when they look the same** (Bia, Marcos). Fix: "Isso vale para: as 2 cópias / só 1".
13. **Cold Foil offered on a card that has none** (Marcos). Fix: the card picker offers only finishes and editions that exist for that card; the bulk block, which spans many cards, skips a finish a card does not have.
14. **"Sugestão aceita" looked automatic** (Marcos), because the screen showed the state after the tap. Fix: "Você aceitou: Command and Conquer (Vermelho) · Desfazer".
15. **Mockup artifacts, not design**: empty image tiles (the app has images for every printing with art), the collection showing every card ×3, and a box card shown with an unknown version.

## Asked for, outside this journey

- Price per copy and "à venda" in the version form (Duda): journey 5 (selling and trading).
- Importing the Fabrary collection, not only decks (Marcos): parked, needs another Fabrary query.
- Pasting twice (deck link, then own list) (Caio): accepted; one paste cannot be both.
