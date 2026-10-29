# Copy, language and accessibility: one vocabulary, every card told apart, game words explained

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-23. Persona round 1 done (`.design/mockups/copy-and-access/panel-round-1.md`); the combined design drawn as round 2 (`index-r2.html`). The game facts in the explanations were checked by the owner on 2026-10-23.
> Implementation waits for the one spec that covers every journey of the 2026-10-21 audit (owner, 2026-10-21). This document is journey 7's input to that spec.

## Situation

- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`), journey 7 of 7: the words, the language and the accessibility of every screen.
- Findings answered: F08, F11, F19, F26, F27, F52. Already answered elsewhere: F14 (`.design/close-the-deck.md`), F44 (`.design/collection-in.md`), F51 (`.design/deck-building.md`).
- Parked here by the other journeys: the unknown words (card pool, inventário, jovem, Aposentar; journey 3 panel round 1); "O que mais falta para ficar pronto?", which uses "falta" for the deck's state (journey 6).
- Personas: P1 Bia (beginner), P2 Caio (casual), P5 Lucas (returning). P6 Dona Marta (a parent) is out of this journey and of the combined spec: no parent opens the app (owner, 2026-10-23, confirming journey 4).

## Problem

Read from the code on 2026-10-23 (`apps/web/src` is `web`).

- **Two cards with the same name are told apart by color alone** (F08): the missing panel shows a 4 px bar marked `aria-hidden` and the plain name (`web/components/deck-detail/MissingPanel.tsx:133-135`); shopping rows show no pitch at all, although the API sends it and the web type drops it (`web/api/shopping-line.ts:64-66`); decklist, editor, library and shared tiles show the plain name (`CardGalleryCell.tsx:86`, `EditableCardRow.tsx:126`, `LibraryGrid.tsx:208`, `SharedGallery.tsx:52`). Aria-labels repeat the plain name ("Comprar {{name}} na loja", `deckDetail.ts:49`), and "Já tenho" carries no card name at all (`MarkOwnedButton.tsx:42`). A helper that writes "Name (Vermelho)" exists and is used by the WhatsApp text and the lists (`web/components/deck-detail/recommendations/card-naming.ts:19-22`, `lists/LineTile.tsx`). The pitch words are defined three times and the number-to-word map is copied in four files.
- **Alternative reasons contradict themselves** (F11): the sentence always says "Mesmo pitch ({{pitch}})" with the original card's pitch (`web/i18n/locales/pt-BR/reasons.ts:19`, `packages/engine/src/substitution/rationale.ts:34,62`), then the sheet appends "O pitch é diferente" on the other-pitch group; a Generic original gets "mesma classe (Generic)" and "fora da classe da original" together; a classed original gets "nenhuma das duas tem classe", which is false (`format-reasons.ts:39`). The class wording cannot be fixed in the client: the rationale detail carries no original classes (`web/api/deck-detail.ts:67-74`).
- **Section headings follow three rules** (F19): the deck page shows English values of pt-BR keys ("Attack Actions", `deckDetail.ts:59-62`); the library shows the catalog's raw type uppercased ("ATTACK ACTION", `LibraryGrid.tsx:56-64,263-266`); the shared page shows Portuguese ("Ações", `sharing.ts:108-114`). Each also groups differently.
- **"troca" outside a deck reads as trading cards** (F26): "quais trocas resolvem o resto" (`home.ts:4`), "o que dá para trocar" (`home.ts:13`), "quais trocas resolvem o que falta" (`auth.ts:4`), "antes de calcularmos as trocas" (`onboarding.ts:33-34`). Inside a deck or a proposal ("Proposta de troca", "Desfazer a troca de {{name}}") the word means a swap and the context says so.
- **Two `<main>` landmarks** (F27): the shell's (`web/components/shell/AppShell.tsx:48`) and the deck page's canvas (`DeckDetailLayout.tsx:47`); the same on `/library-csv-sources` (`routes/_auth/library-csv-sources.tsx:51,110`). A test asserts the canvas is a `<main>` (`DeckDetailLayout.spec.tsx:64-68`).
- **Game words are never explained** (F52): no glossary, help or info component exists; Radix Tooltip and Popover are already dependencies and used once each (`CardRowLegalityWarning.tsx:56-83`, `LegalityReasonsPopover.tsx:59-97`); three places use the native `title=` tooltip, which a keyboard or a phone cannot open (`ShoppingLine.tsx:250`, `MissingStoreSummary.tsx:58`, `LibraryStatsBar.tsx:91`). "Pitch" appears about 14 times, "Aposentar" 13, "Curva de custo", "power", "defense", "keyword", "livre", "jovem" a few times each; format names are hard-coded labels (`FormatDropdown.tsx:17-20`) and abbreviated "CC" in one badge (`LegalityBadge.tsx:28`). "0 livre" comes out singular because pt-BR plural rules put 0 in "one".
- Checks that exist and those that do not: key parity between pt-BR and en-US (`web/i18n/__tests__/catalog-parity.spec.ts`), a few banned literals in named files, a WCAG contrast test on token pairs (`styles/__tests__/contrast.spec.ts`). No test scans locale values for forbidden words or dashes; no lint rule against hard-coded strings; no axe or other automated accessibility scan anywhere in `apps/web`.
- Dashes: no en dashes; em dashes in three pt-BR values (`decks.ts:256`, `lists.ts:103,134` "R$ —"), in many en-US values, and in the automatic deck name `${hero} — ${format}` (`apps/api/src/decks/decks.service.ts:664`).
- No pt-BR string genders the user today (checked in the web locales and the e-mail templates); journey 1 added one candidate ("Você continua conectada") and replaced it with a neutral line.

## Clear slices (no design pick needed)

| State | What should happen |
|---|---|
| A card name in any row, tile, list or label where the same name can appear with another pitch | The name carries the pitch as a word, "Pack Hunt (Vermelho)", in the visible text and in every aria-label ("Comprar Pack Hunt (Vermelho) na loja", "Já tenho Pack Hunt (Vermelho)"); the color mark stays as a second cue; one helper and one set of pitch words, the map in one place |
| A card with no pitch (equipment, weapon, hero) | The name alone |
| An alternative's reason | States the real relation: "mesmo pitch (vermelho)" or "pitch diferente: azul em vez de vermelho"; "mesma classe (Brute)", "carta genérica" when the candidate is Generic, never a class claim the two cards do not share; the API sends the original's classes so the client can say it |
| Section headings of a card list, on every page | Portuguese, from i18n keys, one grouping rule shared by the deck page, the library and the shared page; card names and card text stay in English |
| "troca" or "trocar" | Allowed inside a deck or a proposal (a swap); outside a deck (home, sign-in, onboarding, the pitch) the app says "substituir": "quais cartas da sua coleção podem substituir as que faltam" |
| The deck page and the CSV sources page | One `<main>`, the shell's; the deck canvas becomes a region with a label |
| "0 livre" | "nenhuma livre" for zero, plural forms for the rest |
| A count of copies ("Faltam 5 cartas" on a shared missing page, against "falta 1" on each card) | Says "cópias" when it counts copies: "Faltam 5 cópias" (journey 3's wording) |
| The automatic deck name | "Rhinar - Blitz" with a plain hyphen (journey 3 already drew it), and the em dashes in pt-BR values rewritten |
| A native `title=` tooltip | Replaced by the "?" and its sheet when it explains a word of the table, or by visible text |
| Copy that refers to the player | Never gendered; written with no adjective about the player ("A conta fica aberta neste celular") |
| Locale check in CI | A test over every pt-BR value fails on an em or en dash, on "troca" in the home, auth and onboarding namespaces, and on the English words that leaked ("Manual entries", "Attack Actions") |
| Accessibility scan in CI | An automated scan (axe) on the main pages in the existing Playwright run (home, deck page, shopping list, library, shared deck, sign-in), failing on serious and critical issues |

## Copy rules gathered from journeys 1 to 6 (one place for the combined spec)

1. "Faltam" means copies the player does not own; the deck's size has its own wording ("31 de 40 cartas no deck · coloque mais 9") (journey 3).
2. A "problema" is a rule problem; the size is never counted as one (journey 3).
3. Every red line says what to do, with the arithmetic done (journey 3).
4. Dates of rule changes come only from the curated rule-change entries (journey 3).
5. "as substituições", never "as trocas de cartas", for a deck's replacements (journey 3); "troca" only inside a deck (this journey).
6. Card names in English with the pitch as a word (journeys 2 to 6).
7. Say the result, never "Você tocou em ..." (journey 1).
8. Every screen that waits for an e-mail shows the address and "Errei o e-mail" (journey 1).
9. No gender for the player (journey 1).
10. No em or en dashes, no raw codes, nothing pre-selected that the player did not choose (all journeys).
11. "O que mais falta para ficar pronto?" becomes "O que ainda impede este deck de ficar pronto?" (rule 1; journey 6's tile).

## Designed slices (persona round 1, 2026-10-23)

Screens: `.design/mockups/copy-and-access/index-r2.html` (the combined design); round 1's alternatives are `index-a.html`, `index-b.html`, `index-c.html`. Panel: `panel-round-1.md`.

### A "?" after a game word (Bia, Caio, Lucas)

Screens: `r2-pitch-sheet-phone`; the stage menu as `b2-stage-retire-phone`.

| State | What the player sees |
|---|---|
| A word from the explanations table on a screen | at its first appearance on that screen, a "?" in a circle right after it (20 px drawn, 44 px to tap), read by a screen reader as "O que é {{word}}?"; later appearances on the same screen carry none |
| The "?" tapped, or Enter or Space on it | a bottom sheet on the phone (a popover anchored to the word on a computer): the word as title, its sentence, and, when the player's own data gives one, a line about it ("No seu deck: 14 vermelhas, 9 amarelas, 8 azuis."; "Seu deck Rhinar Blitz v2 continua salvo com as 12 cartas."; "Este deck do Pedro é de Classic Constructed."); "Ver todos os termos" and "Fechar"; Escape or a tap outside closes it and focus returns to the "?" |
| A word inside a menu option ("Aposentado" in the stage menu) | the "?" sits after the option's text and is its own target, so tapping it never picks the option |
| A word inside an explanation | no "?" inside the sheet; "Ver todos os termos" covers it |
| No line from the player's data | the sentence alone |

### The glossary page (everyone)

Screen: `r2-glossary-phone`.

| State | What the player sees |
|---|---|
| "Ver todos os termos", the menu's "Termos do jogo", or the shared pages' foot "O que querem dizer estas palavras?" | the page "Termos do jogo" with "O que querem dizer as palavras do jogo.", a search field "Procurar uma palavra", every word of the table in alphabetical order with its sentence, and a way back to where the player came from ("Voltar para a lista do Pedro") |
| Signed out | the page is public, like the shared pages, with the LSS notice at the foot |
| A search with no match | "Nenhuma palavra com \"{{query}}\". Veja a lista completa abaixo." (not drawn) |
| Opened from a "?" | scrolled to that word (not drawn) |

### States specified but not drawn

- The popover on a computer; a search with no match; the glossary opened scrolled to a word.
- The "?" on the card types of the deck list ("Ação", "Reação de ataque") and on "Alternativas".


## The explanations (game facts checked by the owner, 2026-10-23)

One or two sentences each, the words a beginner would use, rewritten after persona round 1 (the pitch sentence no longer leans on "recurso"; Classic Constructed says what "herói adulto" is; the stages, card types, cost, format and foil were added). Written from the official format pages read on 2026-10-22 (journey 3) and the card data; the owner checked the game facts on 2026-10-23.

| Word | Explanation |
|---|---|
| Formato | O conjunto de regras de um tipo de torneio: que heróis valem, quantas cartas o deck tem e quantas cópias de cada carta. |
| Classic Constructed | Formato de torneio com o herói adulto (a versão que não é jovem), deck de pelo menos 60 cartas, até 80 contando o inventário, a arma e os equipamentos, e até 3 cópias de cada carta. |
| Living Legend | Formato com o tamanho de deck do Classic Constructed e uma lista própria de heróis e cartas permitidos, que inclui alguns que não valem mais no Classic Constructed. Algumas cartas valem só 1 cópia. |
| Blitz | Formato rápido com herói jovem, deck de exatamente 40 cartas e 1 cópia de cada carta. |
| Silver Age | Formato com herói jovem, deck de exatamente 40 cartas, até 2 cópias de cada e só cartas que já saíram como comum ou rara. |
| Herói jovem | Versão do herói para Blitz e Silver Age, com decks de 40 cartas. |
| Herói adulto | A versão do herói que não é jovem. Joga Classic Constructed e Living Legend. |
| Custo | Quanto você paga para jogar a carta. Você paga descartando outras cartas da mão, pelo pitch delas. |
| Pitch | O número de 1 a 3 da carta, mostrado também pela cor: vermelha vale 1, amarela 2, azul 3. Para pagar o custo de uma carta, você descarta outras da mão, e cada uma paga o número do seu pitch. |
| Vermelho, Amarelo, Azul | A cor do pitch. Uma Pack Hunt vermelha e uma azul são cartas diferentes, cada uma com seu limite de cópias: na hora de comprar, a cor tem que ser a da lista. |
| Curva de custo | Quantas cartas do deck custam 0, 1, 2, 3 ou mais. Mostra se o deck está pesado ou leve. |
| Poder, defesa | Poder é o dano que um ataque causa. Defesa é quanto a carta bloqueia quando você defende com ela. |
| Ação | Carta que você joga na sua vez, gastando a sua ação. Muitas ações são ataques. |
| Reação de ataque | Carta que você joga durante o seu próprio ataque para deixá-lo mais forte. |
| Reação de defesa | Carta que você joga quando está se defendendo, para bloquear mais. |
| Instantâneo | Carta que dá para jogar a qualquer momento, até na vez do outro jogador. |
| Arma | Começa em jogo e ataca sem ser uma carta da mão; a maioria pede que você pague um custo para atacar. |
| Equipamento | Peças que o herói veste (cabeça, peito, braços, pernas). Começam em jogo e ajudam a defender ou dão efeitos. |
| Cartas que você leva (card pool) | O deck, o inventário, a arma e os equipamentos; o herói não conta. |
| Inventário | Cartas que você leva ao torneio além do deck. Entre um jogo e outro da mesma partida, dá para trocar cartas do deck por elas. |
| Lendária | Carta que só pode ter 1 cópia no deck, em qualquer formato. |
| Banida | Carta que não pode entrar no deck naquele formato. |
| Restrita | No Living Legend, carta que só pode ter 1 cópia no deck. |
| Foil | Versão brilhante da mesma carta. No jogo vale igual; muda o preço. |
| Livre (cópias) | Cópias que você tem além das que já estão neste deck. |
| Alternativas | Cartas que podem entrar no lugar de uma que falta, parecidas no custo, no pitch e no que fazem. |
| Ideia | Etapa de um deck que você ainda está pensando, sem a lista fechada. |
| Montando | Etapa de um deck que você está montando e juntando as cartas. |
| Pronto | Etapa de um deck com a lista fechada, que você considera pronto para jogar. |
| Jogando | Etapa de um deck que você está usando nos torneios agora. |
| Aposentado | Etapa de um deck que você não usa mais. Ele fica no grupo Aposentados, salvo com as cartas, e volta a ser usado quando você quiser. |

"Aposentado" names a deck's stage only; a hero outside a format is never called "aposentado" (journey 3 says where it is allowed instead).

## Notes for the combined spec (from reading the code, 2026-10-23)

- i18next 26 with react-i18next 17, 22 namespace files per locale under one `translation` namespace (`web/i18n/locales/pt-BR/index.ts:24-47`); en-US is typed against pt-BR, so a new key fails the build until both have it.
- Fixing F27 changes an existing test's assertion (`DeckDetailLayout.spec.tsx:64-68`); the test states the old shape, not a requirement.
- The rationale fix touches the engine's English fallback (`packages/engine/src/substitution/rationale.ts:62`) and the alternatives API payload.
- No data model change. The explanations live in a new i18n namespace (one key per word, pt-BR and en-US), the glossary is a new public route, and the lines about the player's own data are built on the client from what each page already loaded.
