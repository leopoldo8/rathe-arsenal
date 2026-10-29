# Deck building and legality: mockup brief (three structural alternatives)

Journey 3 of the 2026-10-21 persona audit: starting a deck, building it while the app says what is wrong, keeping a Classic Constructed inventory, getting the list out (copy, export, duplicate), and not losing a deck by accident.
Personas: P1 Bia (beginner, phone, young Rhinar in Blitz), P3 Marcos (competitive, desktop, 80-card Classic Constructed pool), P5 Lucas (returning, an imported deck whose hero left Classic Constructed), P2 Caio (casual, phone, an old Blitz deck and a delete by accident), P7 Renata (store owner, opens a customer's shared deck to say whether it can play tonight).
Findings this journey answers: F07, F21, F22, F23, F24, F25, F39, F40, F41, F51, F54, F57, and F20 (the shared deck page has no way to copy the list).

## Rules checked on fabtcg.com (2026-10-22), not up for comparison

The official format pages (`https://fabtcg.com/gameplay-formats/<format>/`) and the Card Legality Policy say:

| Format | Hero | Card pool (hero not counted) | Deck | Copies of each card (name and color) |
|---|---|---|---|---|
| Classic Constructed | not young | 80, counting weapons, equipment and the deck | at least 60 | up to 3 |
| Living Legend | not young | 80 | at least 60 | up to 3; a restricted card up to 1 |
| Blitz | young | 52 | exactly 40 | up to 1, weapons and equipment included; no banned list since 1 January 2026 |
| Silver Age | young | 55 | exactly 40 | up to 2; only cards ever printed as common, rare or basic |

- The copy limit counts the whole card pool: deck, inventory, weapons and equipment together. Three Pack Hunt (Vermelho) in the deck plus one in the inventory is four.
- A Legendary card is limited to 1 in every format.
- The audit's F21 and F41 assumed Blitz allowed 2 copies; the current rule is 1. Every Blitz deck in these mockups follows the current rule.
- "Inventário" is the cards in the card pool that are not in the starting deck (the pool limit minus the deck, the weapons and the equipment: in Classic Constructed 80 minus those; in Blitz at most 12 and in Silver Age at most 15, less the weapons and equipment).

## Rules every alternative shares (not up for comparison)

- Legality is computed on what is on screen while editing, never the last saved state.
- Every problem shows at once: a deck with 31 of 40 cards and a card with too many copies shows both, never only "Incompleto".
- Reasons are in Portuguese and name the card and the number: "Pack Hunt (Vermelho) tem 2 cópias. O Blitz permite 1 de cada carta."
- A hero that is not allowed in the chosen format says where it is allowed, from the card data only, and offers the switch: "Kayo, Armed and Dangerous não é permitido em Classic Constructed. É permitido em Living Legend." with "Mudar para Living Legend". Never claim history the data does not hold (no "virou Living Legend", no date).
- "+" stops at the format's limit and says why ("Máximo 1 no Blitz"); the limit counts the copies in the inventory too.
- The hero picker shows each hero's art and the formats it can play ("Blitz · Silver Age" or "Classic Constructed · Living Legend"); the format list offers only the formats the chosen hero can play.
- "Cancelar" on a deck that was just created and has no cards discards it and goes back to where the player came from.
- The export has two outputs, never mixed: "Para o grupo" (Portuguese, the app's WhatsApp style, "3x Pack Hunt (Vermelho)") and "Para Fabrary, GEM ou Talishar" (English card names and colors, "3x Pack Hunt (Red)", with the inventory as its own section). The English sample below is illustrative; the exact format GEM reads is checked by hand before building.
- "Duplicar deck" makes "<name> (cópia)" with status Ideia, same hero, format, cards, inventory and replacements, and opens it.
- All copy pt-BR, no em dashes or en dashes, no raw error codes. Card names in English with the pitch as a word (Vermelho, Amarelo, Azul).

## Scenario (illustrative values, consistent across mockups)

Verify every card name, pitch, rarity and format in the catalog (`@flesh-and-blood/cards` 5.3.0 in `/Users/rodrigohaertel/workspace/personal/rathe-arsenal/node_modules/.pnpm/@flesh-and-blood+cards@5.3.0/node_modules/@flesh-and-blood/cards`; the worktree has no `node_modules`). Use only Brute or Generic cards for Rhinar decks; `pitch` 1/2/3 is Vermelho/Amarelo/Azul. Report the final card lists.

**Bia's deck "Rhinar - Blitz"** (phone, Montando): hero Rhinar (young). Weapon Romping Club. Equipment 3 (Nullrune Hood, Scabskin Leathers, Fyendal's Spring Tunic). Deck 31 cards: 30 different cards at 1 copy plus Pack Hunt (Vermelho) at 2. Card pool 4 + 31 = 35 of 52. Problems shown together: "Faltam 9 cartas no deck (31 de 40)" and "Pack Hunt (Vermelho) tem 2 cópias. O Blitz permite 1 de cada carta." The "+" on Pack Hunt (Vermelho) is disabled with "Máximo 1 no Blitz". Command and Conquer may be in it (allowed in Blitz).

**Marcos's deck "Rhinar CC"** (desktop, Pronto): hero Rhinar, Reckless Rampage. Weapon Romping Club. Equipment 4 (Scabskin Leathers, Fyendal's Spring Tunic, Nullrune Hood, Arcanite Skullcap). Deck 60 = 20 cards at 3 copies, Pack Hunt (Vermelho) among them. Inventory 15: Pack Hunt (Vermelho) 1, Sink Below (Vermelho) 3, Pummel (Azul) 3, Snatch (Vermelho) 2, Bone Head Barrier 2, Reckless Swing 2, Muscle Mutt (Vermelho) 2. Card pool 1 + 4 + 60 + 15 = 80 of 80. One problem: "Pack Hunt (Vermelho): 3 no deck e 1 no inventário, 4 no total. O Classic Constructed permite 3." He owns everything except 4 deck copies and 3 inventory copies (use these for "Faltam").

**Lucas's deck "Kayo CC"** (desktop, imported from Fabrary, Classic Constructed): hero Kayo, Armed and Dangerous. Weapon Mandible Claw ×2 (banned in Classic Constructed, allowed in Living Legend). Deck 60. Problems shown together: the hero line above, and "Mandible Claw está banida no Classic Constructed." After "Mudar para Living Legend": "Válido em Living Legend".

**Caio's deck "Rhinar Blitz"** (phone, Jogando, saved in 2025): hero Rhinar (young), 40 cards = 24 cards at 1 copy and 8 at 2. Under today's rule it is illegal: "8 cartas têm 2 cópias. Pelas regras atuais, o Blitz permite 1 de cada carta." Caio also deletes "Rhinar Blitz v2" (Ideia, 12 cards) by accident from the home page.

**Renata** opens Bia's shared deck link "Rhinar - Blitz" on her phone at the counter; the night is a Blitz Armory.

**Export samples** (Marcos's deck; the builder writes the whole list):
```
Para o grupo:
Rhinar CC · Rhinar, Reckless Rampage · Classic Constructed
Arma: 1x Romping Club
Equipamentos: 1x Scabskin Leathers, 1x Fyendal's Spring Tunic, 1x Nullrune Hood, 1x Arcanite Skullcap
Deck (60):
3x Pack Hunt (Vermelho)
...
Inventário (15):
1x Pack Hunt (Vermelho)
...

Para Fabrary, GEM ou Talishar:
Hero: Rhinar, Reckless Rampage
Weapons: 1x Romping Club
Equipment: 1x Scabskin Leathers, 1x Fyendal's Spring Tunic, 1x Nullrune Hood, 1x Arcanite Skullcap
Deck:
3x Pack Hunt (Red)
...
Inventory:
1x Pack Hunt (Red)
...
```

## Alternative A: a rules checklist

The editor carries a checklist of every rule of the format, each with a mark and its number. Tapping a failed line filters the cards to the ones causing it. The inventory is its own section under the deck.

1. **a1-editor-phone** (Bia): the checklist at the top, collapsed to one line on the phone ("2 problemas · ver") and drawn open: "Deck: 31 de 40 · faltam 9", "Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1", "Herói: Rhinar pode jogar Blitz ✓", "Cartas permitidas no Blitz ✓", "Card pool: 35 de 52 ✓". Card rows below; the Pack Hunt (Vermelho) row marked, its "+" disabled with "Máximo 1 no Blitz".
2. **a2-editor-inventory-desktop** (Marcos): checklist in the left column with "Card pool: 80 de 80" and the copy problem. The deck section, then a section "Inventário · 15 cartas · não entra no deck do jogo 1"; each row has "Mover para o inventário" or "Mover para o deck". "Faltam" at the top counts deck and inventory together: "Faltam 7 cartas (4 do deck, 3 do inventário)".
3. **a3-deck-menu-desktop** (Marcos): the deck page with the "⋯" menu open: "Duplicar deck", "Copiar lista", "Excluir deck"; and the "Copiar lista" sheet open next to it with the two choices "Para o grupo" / "Para Fabrary, GEM ou Talishar" (none selected) and an empty preview "Escolha para quem é a lista".
4. **a4-delete-phone** (Caio): from the home card trash, a confirm dialog: "Excluir Rhinar Blitz v2? Some o deck, as trocas de cartas e o histórico de prontidão. Não dá para desfazer." with "Excluir" and "Cancelar", plus a line "Quer só tirar da frente? Aposentar" as a link.
5. **a5-shared-legal-phone** (Renata): Bia's shared deck page: under the title, "Blitz · ainda não pode jogar" with the two problems listed under it in plain words, then the deck. A "Copiar lista" button (F20).

## Alternative B: problems on the card

No checklist. Each problem sits on the row of the card that causes it, and a bar at the bottom counts what is left. The inventory is a second count on each row.

1. **b1-editor-phone** (Bia): rows with art; the Pack Hunt (Vermelho) row shows a red line "2 cópias · o Blitz permite 1" and its "+" disabled. A fixed bar at the bottom: "31 de 40 · 1 problema ›"; drawn with its sheet open listing "Faltam 9 cartas no deck" and the Pack Hunt line with "Ir para a carta".
2. **b2-editor-inventory-desktop** (Marcos): each row has two steppers, "No deck" and "No inventário" (Pack Hunt (Vermelho): deck 3, inventário 1, red line "4 no total, o Classic Constructed permite 3"). A header line: "Deck 60 · Inventário 15 · Card pool 80 de 80". "Faltam" shows two numbers: "Faltam 4 no deck · 3 no inventário".
3. **b3-deck-actions-desktop** (Marcos): the deck page header with visible buttons "Copiar lista" (a split button whose menu lists "Para o grupo" and "Para Fabrary, GEM ou Talishar") and "Duplicar"; drawn after "Para Fabrary, GEM ou Talishar" with the toast "Lista copiada em inglês, com o inventário".
4. **b4-delete-phone** (Caio): the deck disappears from home and a toast stays until the next action: "Rhinar Blitz v2 foi para Excluídos recentemente · Desfazer". Under the decks, a row "Excluídos recentemente (1) · ficam 30 dias".
5. **b5-shared-legal-phone** (Renata): Bia's shared deck page with a block "Pode jogar?" and format chips (Blitz, Classic Constructed, Living Legend, Silver Age); Blitz chosen by Renata: "Ainda não: faltam 9 cartas e Pack Hunt (Vermelho) tem 2 cópias (o Blitz permite 1)." A "Copiar lista" button.

## Alternative C: the list as text

The editor is a dense text table (quantity, name and color, cost, type) that fits a whole deck on one screen; art is a toggle. Problems are a column of the table. The inventory is a tab next to the deck.

1. **c1-editor-phone** (Bia): a compact table, one card per line with a quantity stepper; a header strip "Blitz · 31 de 40 · 1 problema"; the Pack Hunt (Vermelho) line with the problem in a second line in red and "+" disabled. A toggle "Ver imagens".
2. **c2-editor-inventory-desktop** (Marcos): tabs "Deck (60)" and "Inventário (15)" over the table, a "Mover" action per line, the strip "Classic Constructed · Card pool 80 de 80 · 1 problema" with the Pack Hunt line. "Faltam" counts the deck only, with a switch "Incluir o inventário na lista de compras" (off).
3. **c3-export-desktop** (Marcos): an "Exportar" sheet with two tabs "Para o grupo" and "Para Fabrary, GEM ou Talishar", the text preview of the chosen tab (drawn on the English one, full list), "Copiar" and, under it, "Duplicar deck" as a separate row.
4. **c4-delete-phone** (Caio): the home card has no trash; its "⋯" offers "Aposentar" (reversible) and "Excluir..." which opens a confirm naming what is lost. Drawn with the "⋯" open.
5. **c5-shared-legal-phone** (Renata): Bia's shared deck page as a text list with a header "Blitz · faltam 9 · 1 problema" and the Pack Hunt (Vermelho) line marked in the list. A "Copiar lista" button.

## Shared screens

The two new-deck screens are alternatives to each other; the other three are drawn once and take the legality look of whichever alternative is picked.

1. **s1a-new-deck-hero-first-phone** (Bia): "Novo deck" with three starts: "Comprei um deck pronto" (journey 2, unchanged), "Tenho um link do Fabrary", "Começar do zero" (open). Hero search "rhinar" with two results, each with art, name and formats: "Rhinar · jovem · Blitz · Silver Age" and "Rhinar, Reckless Rampage · Classic Constructed · Living Legend". After picking young Rhinar, the format choice offers only Blitz and Silver Age, none selected, each with one line ("40 cartas, 1 cópia de cada" / "40 cartas, 2 cópias, só comuns e raras").
2. **s1b-new-deck-format-first-phone** (Bia): the same three starts; "Começar do zero" asks the format first as four cards with one line each ("Blitz: 40 cartas, herói jovem, 1 cópia de cada"); after Blitz, a grid of young heroes with art, searchable, the hero list above the tab bar.
3. **s2-retired-hero-desktop** (Lucas): "Kayo CC" deck page: both problems listed together in plain words, the button "Mudar para Living Legend" and one line "As cartas do deck não mudam, só o formato em que ele é conferido."
4. **s3-rule-changed-phone** (Caio): the home card for "Rhinar Blitz" with a line "Não pode mais jogar no Blitz · ver por quê", and the deck page opened from it: "Pelas regras atuais, o Blitz permite 1 cópia de cada carta. 8 cartas deste deck têm 2." with the 8 cards listed.
5. **s4-list-view-desktop** (Marcos): the deck page in the "Lista" view: a text list grouped Herói, Arma, Equipamentos, Deck (60), Inventário (15), each line "3x Pack Hunt (Vermelho) · custo 2 · Ação", fitting the deck on one screen.

## How to build

- One HTML file per screen at `.design/mockups/deck-building/<id>.html`, plus a PNG of each, plus `index-a.html`, `index-b.html`, `index-c.html`, `index-shared.html`.
- Copy the `:root` tokens and base classes verbatim from `.design/mockups/sharing/contact/shared-deck-a-phone.html` (dark theme, Hanken Grotesk, Newsreader, brass accent). Phone frame 390 px wide; desktop frame 1280 px wide. `<html lang="pt-BR">`.
- NO caption, label or note outside the frame. The file name is the only label.
- Card images from `https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/<CODE>.webp` only for codes verified in the catalog; otherwise the neutral placeholder tile.
- Nothing pre-selected that the persona did not choose. A screen that shows a state after taps says so in its own words (as the "Copiar lista" sheet does with "Escolha para quem é a lista").
- No placeholder text such as `<link>` or "...": write the real lines.
- Low-to-mid fidelity: structure, copy and numbers matter. Use the scenario numbers exactly and make the generator throw if one does not add up (Bia 31 deck and 35 pool; Marcos 60 + 15 + 1 + 4 = 80 and the 4 copies of Pack Hunt (Vermelho); Caio 24 + 8 × 2 = 40; Faltam 4 + 3 = 7). Touch targets at least 44 px.
