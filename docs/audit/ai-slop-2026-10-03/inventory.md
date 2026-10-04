# AI-slop audit — 2026-10-03

Scope: every web surface after the product redesign (PRs #110–#114), looking for two kinds of problem the owner kept finding on staging:

- **Copy** that reads like a literal translation, engine jargon shown to players, robotic or hedged phrasing, filler, invented flavour text, and the same concept named several ways.
- **UI** that is technically complete but over-built: nested bordered boxes, heavy controls repeated per row, everything coloured or bold at once, badges that carry no meaning, the same fact shown twice.

Method: read every pt-BR locale file (`apps/web/src/i18n/locales/pt-BR/*.ts`), traced which keys are reachable, and captured every screen with headless Playwright (dark and light, 1440px and 390px) against the local stack with the fixture user.
Screenshots are machine-local and not committed.

Severity: **P1** wrong or misleading information, or English leaking into the pt-BR UI. **P2** reads as machine-written or noisy enough that a player notices. **P3** polish.

## Cross-cutting findings

### X1 — English text from the engine shown raw in the pt-BR UI (P1)

- Legality reasons are English sentences built in `packages/engine/src/legality/compute.ts` (`Deck has 42 mainboard cards but Classic Constructed requires at least 60.`, `Hero "…" is not legal in …`). The web renders them verbatim in `LegalityReasonsPopover` and in the illegal chip label (`decks.illegalWithReason`).
- Swap rationale lines are English sentences built in `packages/engine/src/substitution/rationale.ts` (`Same pitch (red), same Generic class, same power, same defense, shared no keywords.`). They are **persisted** in `swap_suggestion.rationale`, so a fix must keep a fallback for existing rows, or backfill them.
- Fix shape: the engine returns a code plus parameters; the web formats it through i18n; old rows without a code fall back to the stored text. One PR spanning engine, api and web.

### X2 — One concept, several names (P2)

| Concept | Names in use | Proposed |
|---|---|---|
| A deck | deck (home, deckDetail, deckEdit, swaps), baralho (decks.ts, settings, csvSources) | owner decision (Q1) |
| A card | carta (decks, deckDetail, swaps), card (home, library, csvSources), both on one screen in Sources | owner decision (Q2) |
| Having a deck in the app | rastrear, acompanhar, "remover acompanhamento", "remover rastreamento" | a deck is just *your deck*: "Importar", "Adicionar", "Excluir deck" (deckEdit already says "Excluir deck") |
| A suggested replacement | troca (swaps, deckDetail), substituição (decks, onboarding) | troca |
| Declining it | Recusar (swaps, deckDetail), Rejeitar (decks, onboarding, `resolvedRejected`) | Recusar |
| Danger section | Zona de perigo (settings), Zona de risco (deckEdit) | one of them |
| Mainboard slot | Mainboard (`decks.slotMainboard`), Maindeck (`swaps.slot.mainboard`), raw `mainboard` (deck detail missing list, edit mode) | hide where it carries no information; one word elsewhere |

### X3 — Locale formatting bugs (P1)

- `CsvSourceRow.tsx:61` calls `formatRelativeTime` without `t`, so Sources shows "over a week ago".
- `DeckAnalysisRow.tsx:36` formats `64.3%` with a decimal point; pt-BR needs a comma (use `Intl.NumberFormat`).
- `csvSources.sourcesCountLine_*`: "1 fonte · 1 ativas" — `activeCount` is not pluralised.
- `library.uniqueEyebrow`: "39 ÚNICA" — singular.
- Library pitch pills read "R 43 · Y 20 · B 23": letter abbreviations of English colour names.
- `variantQueue.updatedAndFailed` uses "atualizado(s) · falha(s)" instead of real plurals.

### X4 — Copy that promises features that do not exist (P1)

- `home.step1Body`: "escolha um deck meta que indexamos" — Discover was never built.
- `home.step3Body`: "Compre os cards faltando com um clique."
- `decks.trySubstitutionEditor`: "Experimente o editor de substituição" — check whether any editor exists.
- `auth.termsNote`: "você aceita os termos" — no terms page is linked.

### X5 — Invented flavour text (P2)

Auth screens carry a fake proverb ("Um guerreiro prepara a lâmina…" — "Provérbio de Rathe"), and taglines like "O corvo já voou.", "O selo não pôde ser definido.", "Perdeu a chave? Forjaremos outra.", "Uma nova chave, uma nova campanha.", "Escolha com cuidado — seu arsenal aguarda.".
Also "Bem-vindo, Herói.", "Algo se rompeu.", "As substituições são honestas", "Você está completamente jogável!".
The brand is *arcane* through type and restraint, not through invented lore in every subtitle.

### X6 — Dead code holding bad copy (P3, cleanup)

`components/TestDeckResult.tsx` has no importer. It is the only importer of `path-c-result.tsx`, which is the only importer of `breakdown-list.tsx`, which is the only importer of `substitution-row.tsx` and `mark-owned-button.tsx`.
Their keys ("APROXIMAÇÃO", "Acompanhar versão proximal", "Eu possuo isso", "Curva de pitch quebrada…") never render.
Delete the subtree, its tests and its keys in both locales before any copy pass, then rerun the unused-key scan with exact `ns.key` matching.

### X7 — Screen-reader labels for skeletons (P3)

`common.loading*` and `home.loading*` give each skeleton block a label such as "Carregando rótulo" or "Carregando título da estante". A screen reader hears a list of meaningless "loading label" items. One `aria-busy` region with a single "Carregando" is enough.

## Per-screen findings

### Home (`/`)

- P1 — "2 de 3 decks prontos para jogar" counts the two Kayo decks, which are **illegal** in their format (young hero in Classic Constructed). `countCompleteDecks` ignores legality. Either "ready" means complete *and* legal, or the line should say "completos".
- P2 — The red "×" illegal marker after "Completo · 66/66" reads as a close button. Use a word ("Fora do formato") or a warning glyph with a label.
- P2 — `home.legalityNotLegalLabel` = "Não legal": in pt-BR this reads as "not cool".
- P2 — `home.untrack*` = "Remover rastreamento": the trash pin deletes the deck (with undo toast). Say "Excluir deck".
- P3 — The KPI box shows "15 FALTANDO" in red with no noun (15 what?).
- P3 — Group header hint repeats the name ("Construindo — Em montagem, ainda ajustando").

### Deck detail — view (`/decks/:id`)

- P1 — "Prontidão" panel shows "Bruta 64.3%" and "Fidelidade 68.6%" plus a caption explaining fidelity. Two engine metrics with jargon names, decimals, next to a medallion that already says 64%. Owner decision (Q4).
- P2 — Status strip: "Faltam 15 cartas em 6 slots — 1 troca deixa mais perto (mas 13 seguem sem solução)." Engine arithmetic in prose; "slots" is jargon.
- P2 — Missing list repeats a raw `mainboard` under every card name: no information, English, lowercase.
- P2 — Back link says "← Baralhos" but returns to "Seu arsenal" (nav says "Início").
- P2 — The tag "liga local" appears twice: in the eyebrow and as a chip right below it.
- P2 — The medallion repeats the hero name, truncated ("RHINAR, RECK…"), right under the hero name in full.
- P2 — The tag chip is a tall pill (~50px) next to a tiny "+ adicionar tag" (same bug on the edit page).
- P2 — Decklist group names in English ("Attack Actions", "Non-attacks", "Hero · Weapon · Equipment") with a trailing "42×". Owner decision (Q3).
- P3 — Suggested swaps panel nests a bordered box inside the bordered panel.
- P3 — Three analysis panels with tracked uppercase eyebrows read as a dashboard template.
- P3 — `decks.markOwned` = "Marcar como possuída" (possessed, as in demonic): "Já tenho".

### Deck detail — composition edit (`?edit=1`, pre-redesign layout)

- P2 — "COMPRAS" heading over an empty bordered box.
- P2 — Format shown in monospace inside a pill.
- P3 — Full-bleed 24px gutter while every other screen uses the 1180px container.
- P3 — Steppers use a hyphen "-" instead of a minus sign.

### Deck overflow menu (⋯)

- P1 — `decks.untrack` = "Remover acompanhamento" and `untrackFailedToast` (owner's example): this deletes the deck. Say "Excluir deck", and match the edit page's confirm.

### Swaps (`/swaps`)

- P1 — Rationale line in English (X1).
- P2 — Every row shouts: a large green serif "100%" with "confiança" above and "Tier 1" below, a red strikethrough on the original, a brass arrow chip, a brass "× 3" chip, and the count repeated in both buttons ("Aprovar (× 3)", "Recusar (× 3)").
- P2 — "Tier" is engine jargon (filter chip and every row).
- P2 — "× 3" chip next to "Você tem 3 cópias": two counts, unclear which is needed and which is owned.
- P2 — Row meta "Action · Vermelha": English card type.
- P2 — Reject panel hint: "é o que ensina a engine a sugerir melhor" ("engine" jargon); `tabHintRejected` has the same word.
- P3 — `noResultsHeading` = "Sem correspondências" (calque of "No matches").

### Library (`/library`)

- P1 — Eyebrow "39 ÚNICA · 95 CÓPIAS" above the title **and** the same two numbers in the stats bar below it.
- P1 — Stats bar shows "R$ 0,00" with "Sem dados de preço": a price of zero when there is no price.
- P2 — Group headings come from catalog data in English (ATTACK ACTION, DEFENSE REACTION, EQUIPMENT, HERO, WEAPON). Same decision as Q3.
- P2 — Card size slider shows "MÉDIO 120px".
- P2 — `matchingLabel` = "Correspondendo:" (calque of "Matching:").
- P3 — Every card sits in its own bordered tile plus a count chip.
- P3 — `estimatedPricesTooltip` mentions "o scraper".

### Sources (`/library/csv-sources`)

- P1 — "over a week ago" (X3), "1 ativas" (X3).
- P2 — "39 cards" and "95 cartas somadas" on the same screen.
- P2 — Eyebrow "GERENCIAMENTO DE IMPORTAÇÕES"; subtitle uses "snapshot" and "contribuição".
- P2 — "→ Ver biblioteca" button duplicates the back link above it.
- P2 — Floating info callout "ⓘ Duplicatas entre fontes são somadas, não sobrescritas." in its own bordered box.
- P2 — Violet "MANUAL" badge next to "Entradas manuais" says the same thing twice (violet is the "idea" status colour).
- P2 — Button "Upload CSV" (English); empty state "popular sua biblioteca" (calque of "populate").
- P2 — Delete confirm asks the user to type the English word "DELETE".
- P2 — Explainer example card "Raio Sob Pressão" is an invented translated card name; FaB card names are English.

### Add cards (`/add-cards/*`)

- P2 — Subtitle filler: "Três caminhos — escolha o que serve ao momento." (and `library.emptyBody`, same idea).
- P3 — Search sits in a bordered box with an uppercase tracked label.

### New deck (`/decks/new`)

- P2 — Icon-in-a-tinted-square cards (gold link icon, violet pencil): the template the brand file lists as an anti-reference.
- P2 — "Cole uma URL do Fabrary — rastrearemos e faremos análise de prontidão." and button "Acompanhar deck".
- P3 — `fabraryUrlHelp` is a long hedge about public links.

### Edit deck (`/decks/:id/edit`)

- P3 — "Zona de risco" vs Settings' "Zona de perigo".
- P3 — Same oversized tag chip as deck detail.

### Settings

- P1 — `deleteAccountWarning`: "Excluir sua conta a marca para remoção permanente…" is ungrammatical.
- P2 — Every section is labelled three times: eyebrow, heading, field label ("APARÊNCIA / Tema / Tema de cores"; "IDIOMA / Idioma da interface / Idioma"; "PERFIL / Seu perfil / Endereço de e-mail").
- P3 — "Redigite sua senha", "Endereço de e-mail".

### Auth (sign-in, sign-up, forgot, reset, verify, check-your-email)

- P2 — Flavour text (X5).
- P2 — "Sem conta? Criar uma", "Já tem uma?", "Continuar para integração →" ("integração" for onboarding is a calque).
- P2 — `termsNote` (X4).

### Onboarding

- P2 — `wizardAriaLabel` "Assistente de integração"; "Pular por agora" (calque of "skip for now"); "Parece ótimo!" (calque of "Looks great!"); "Você está completamente jogável!".
- P2 — Step 2 heading "Agora, sua coleção" over a body about confirming the deck.
- P2 — "propomos uma troca pontuada por tier com uma justificativa": jargon.
- Not captured: the fixture user is redirected away; verify after the copy pass with a fresh user.

### Shell, 404, about, toasts

- P2 — `errorFallbackHeading` "Algo se rompeu." (calque of "Something broke").
- P2 — `themeServerSyncError` "Salvo localmente — não chegou ao servidor. Tente novamente ao mudar." is hard to parse.
- P3 — `about.backLink` "Voltar para a home"; "não-oficial" should be "não oficial".
- P3 — `variantQueue.couldNotReachStore` "alcançar a loja" (calque of "reach").

## Owner decisions

- **Q1** deck or baralho. Recommendation: deck.
- **Q2** carta or card. Recommendation: carta.
- **Q3** card-type names (deck detail groups, library groups, swap row meta): English as printed on the card, or pt-BR. Recommendation: pt-BR.
- **Q4** the "Bruta / Fidelidade" bars on deck detail: keep, rename, or remove.

## Delivery batches

1. Remove the dead `TestDeckResult` subtree and its keys (X6). No owner input needed.
2. Copy pass, pt-BR and en-US, after Q1–Q3: X2, X3, X4, X5 and every per-screen copy item.
3. Engine reasons as codes (X1).
4. UI de-noise per screen: swaps row, library header and stats, sources page, deck detail (analysis row, strip, missing list, tag chip, medallion), new deck cards, settings sections, home illegal marker and ready count.

## Status (2026-10-03)

Owner decisions: Q1 "deck"; Q2 "carta"; Q3 game terms stay in English, because Flesh and Blood has no pt-BR edition (card types, Hero, Weapon, Equipment, Mainboard, pitch, keywords, power, defense); Q4 remove the Bruta/Fidelidade meters.

| Batch | PR | Covers |
|---|---|---|
| Dead code | #115 | X6 |
| Copy pass, pt-BR and en-US | #116 | X2, X3 (except the decimal point, removed with the meters), X4, X5, per-screen copy |
| Engine reasons as codes | #117 | X1 |
| Deck detail and home | #118 | Home, deck detail view and edit mode, overflow menu |
| Swaps, library, sources, new deck, settings | #119 | Those screens |

### Deviations

- Q4 was approved as "remove the meters and keep one short line". The line moved into the status strip ("Com ela, o deck chega a 69%."), and the readiness card was removed instead of kept with only that line: without the meters it was empty for complete decks and repeated the medallion and the strip. The legality badge moved next to the format in the banner.
- Following Q3, the slot labels in the card search ("Hero", "Weapon", "Equipment") and on swap rows are in English too, not only the decklist groups.
- Edit mode shows the shopping block only when a store has prices; otherwise it rendered an empty box.

### Not done

- X7 (screen-reader labels on skeleton blocks).
- Onboarding was not captured on screen, because the fixture user is redirected away from it. Its copy was rewritten but has not been checked visually.
- Swap rows still show the English card type ("Action · Vermelha"), which follows Q3, and keep the brass arrow chip.
