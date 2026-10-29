# Sell and trade: spare copies, selling them, buying from a list, and trading with a friend

> Plan from this document. Each slice below carries its own shape - copy it, do not re-derive it.
> Status: approved by the owner, 2026-10-22 (the two open questions answered the same day). Implementation waits for the combined spec. Direction approved by the owner after persona round 1; screens are the round-3 mockups in `.design/mockups/sell-and-trade/index-r3.html`.
> Implementation waits for the one spec that covers every journey of the 2026-10-21 audit (owner, 2026-10-21). This document is journey 5's input to that spec.

## Situation

- Origin: the persona QA audit of 2026-10-21 (`docs/audit/personas-2026-10-21/`), journey 5 of 7: selling the copies a player does not need, buying from someone's list, trading with a friend.
- How the design was reached: three structural alternatives (lists starting from spare copies, "à venda" in the collection, a "Sobrando" page) reviewed per part by five simulated personas (`.design/mockups/sell-and-trade/panel-round-1.md`), a combined design re-run by the same personas (`panel-round-2.md`), and the fixes drawn as round 3. Simulation built from research, not user evidence.
- Decided by the owner in this session: what counts as spare is the player's choice, asked once; decks marked "Ideia" or "Aposentado" hold no copies; marking a line sold asks whether to take the copies out of the collection; trade is in, as a WhatsApp text from a friend's "Procuro" list, never a stored proposal, and it starts only there (2026-10-22); a deck holds foil copies before regular ones (2026-10-22).
- Related: journey 2 (`.design/collection-in.md`) gives each copy an optional version, which sell lines inherit; journey 4 (`.design/close-the-deck.md`) designed "Oferecer" on a deck's `missing` page, which this journey reuses for want lists and aligns on the same spare count.

## Problem

- A sell list starts only from a whole deck or from nothing (F45). The trader's real starting point is the binder: copies beyond what the decks use. The app does not compute that anywhere a seller can see; only the Tutor computes owned minus all decks' use (`apps/api/src/chat/chat-tools.service.ts:184-187`, `:334-337`, SQL at `:348-359`), and it counts retired decks and sums every deck.
- A sell line can list more copies than the collection holds with no word about it; the sheet shows "na coleção: 0" and adds the line anyway (F45, `apps/api/src/lists/list-lines.service.ts:36-78`).
- The WhatsApp sell message has no version, no total and no payment or pickup line (F46, `apps/web/src/components/lists/listShareModel.ts:11-21`, `listsModel.ts:138-149`); the list's notes field ("Onde retira, como paga") never reaches the message. "Cotação TCGPlayer × 7" is not explained, and the multiplier redisplays "5,5" as "5.5" (F55, `apps/web/src/components/lists/ListPricing.tsx:40-41`).
- A sharer with no saved WhatsApp number shares a page nobody can answer, with no warning (F56). The audit's premise that the switch is off by default is wrong: `share_link.showsContact` defaults to true (`apps/api/src/database/entities/share-link.entity.ts:48`); the gap is only the missing number.
- A buyer on a sell list sees which cards fill their decks but has no way to say which they want; a friend on a want list sees raw owned counts, not what they can spare, and no way to offer.
- Marking a line sold never touches the collection (`.design/sharing.md` Key decision 6), so a sold card keeps counting for readiness.
- Saving a friend's shared deck copies the friend's substitutions as if they were the list (F48, `apps/api/src/sharing/shared-deck-copy.service.ts:23-59`); the original survives only in the friend's `card_replacement` rows.

## Success

- Worked if, 30 days after the release to the Pelotas group:
  - at least 5 sell lists are created from spare copies;
  - at least 5 buy messages ("Quero estas") and 5 trade offers are sent from shared lists by people other than the owner;
  - at least half of the lines marked sold answer "Tirar da coleção";
  - no sell message is sent with a line whose finish the seller left unanswered without "foil não conferido" on it (checked by a test, not by the log).
- Going wrong: spare pages opened and abandoned before "Vender" (the count is not trusted), or the rule question answered and changed again within a week.
- Review: 30 days after the release - Rodrigo, from [Measuring it](#measuring-it).

## Boundary

In: a spare count per card under the player's own rule, a "Sobrando" page with filters and per-version rows, a sell draft with the message on the same screen, finish questions before sending, the seller's own closing line, the store price as a reference, partial sale with an optional collection removal, a buyer selection with a message preview, a trade offer from a friend's want list, the save choice for a friend's deck with substitutions, the contact warning, and the multiplier fixes.

Out: a stored proposal, reservations, payments, accept or reject screens (in-site negotiation stays out, `.design/sharing.md`).
Out: a store's own stock (Renata): importing a store spreadsheet and lowering stock on sale; parked.
Out: a sideboard or inventory that holds copies (Marcos): decks have no such slot today (`deck_card.slot` is mainboard, equipment, weapon, hero); journey 3.
Out: fetching LigaFAB prices: its `robots.txt` asks every crawler to wait 360 seconds between requests and its card page answers a script with a Cloudflare challenge (checked 2026-10-21); the seller gets a link to check by hand.
Out (owner, 2026-10-22): offering spare copies for trade from the "Sobrando" page. No list kind holds "tenho para troca" (`card_list.kind` is `want | sell`, and `share_link` intent and `referredVia` follow it), so trade starts only from a friend's want list.
Out: recording the sale price and the buyer; a per-deck "este deck fica montado" mark.

Unchanged: readiness and AD-012 (each deck is still measured against the whole collection; the spare count is a separate read); lists stay independent of decks; a want list line still merges by card; the 20-copy cap per line.

Superseded: `.design/sharing.md` "Out: selling that changes the collection" and Key decision 6's "selling a line never changes `collection_card`" (a sale now offers to take the copies out); Key decision 7's "raw exact coverage" for visitors of want lists and of a deck's `missing` page (they now see "Você tem N · M sobrando", journey 4's group page included).

## Prior art

- Deckbox pairs trade lists with wish lists - we take the visitor-side match only: a friend's want list shows what the visitor can spare, and the offer is a text.
- WhatsApp buy-and-sell groups post "VENDO", one card per line with version, condition and price, then "aceito PIX" and the pickup - we take that shape and let the seller write the last line once.
- Journey 4's "Oferecer" on a deck's `missing` page - the same button, message builder and event, now with the spare count and an optional "Em troca procuro".

## Shape

Spare copies are a read, computed on request from the collection and the player's decks under the player's rule, never stored; selling, offering and the visitor views all call the same function.
A sell list made from spare copies is an ordinary sell list whose lines carry the copies' versions; the message is built from the lines, the finish answers and the seller's closing line.
A sale may take copies out of the collection; that is the only write this journey makes outside lists.

The doors are the sell line's version fields (they become journey 2's four optional fields instead of today's printing key) and the user's spare rule (a stored choice every spare read depends on).

## Key decisions

1. **Spare is the player's rule, asked only when it changes the count.** "Você passa cartas de um deck para outro?": "Sim, entre decks do mesmo formato" (held per card = the largest use within each format, summed across formats) / "Sim, entre quaisquer decks" (the largest use of any deck) / "Não, cada deck tem as próprias cartas" (the sum of every deck's use). Nothing pre-selected; each option shows its result for the player's collection. Asked only when two decks that hold copies use the same card; otherwise every option gives the same count and nothing is asked. Stored on the account; changeable from "Por que sobra?" and the settings.
2. **Only decks marked "Montando", "Pronto" or "Jogando" hold copies.** "Ideia" and "Aposentado" hold none; the "Sobrando" page names an Ideia deck whose cards it counts as spare and offers "Marcar <deck> como Montando".
3. **Spare is the same number everywhere.** The "Sobrando" page, the trade view of a want list, journey 4's group page and the Tutor all read it from one function; a visitor sees "Você tem N · M sobrando".
4. **A version the app does not know is never posted as known.** Before sending, each line with no finish of a card that exists in foil asks "Sem foil / Foil / Não sei", nothing selected, with "Sim, todas sem foil" as a shortcut; "Não sei" posts "foil não conferido". A line whose version is not fully known shows "preço aproximado" on the seller's screen.
5. **The closing line is the seller's own.** Empty the first time with a grey example; afterwards the seller's last line, in full, editable, with no "da última vez" label. Never prefilled from anything else.
6. **The price reference says what it is.** "Sugerido: TCGplayer em dólar × 7. O 7 cobre o dólar e o custo de trazer a carta; mude se você cobra diferente."; next to rows with no version or a regular version, "A Cúpula DT vende a versão mais barata por R$ X" from `store_stock`; never next to a foil or a named costly printing. "Ver na LigaFAB" on the seller's screens only, never on a public page.
7. **A sale asks how many, then about the collection.** "Quantas você vendeu?" for a line of more than one copy; then "Tirar da sua coleção também?" with "Sim, tirar N da coleção" / "Não, só marcar como vendida" (Escolha "Não" se essas cópias não estavam no app.). Removal takes the same version first, then a copy with no version; when the card sits in more than one import, the sheet asks which, as "Remover 1 de" does.
8. **Buying and offering show the message before WhatsApp opens**, editable, with "Enviar no WhatsApp" and "Copiar texto"; nothing is pre-selected; a trade shows the approximate value of each side on screen and never in the message.
9. **Saving a friend's deck with substitutions asks which list**: "A lista antes das trocas de <sharer>" / "Como <sharer> montou", none selected.
10. **A deck holds the foil copies first.** When the player owns a regular and a foil of a card a deck uses, the copies in the deck are the foil ones, so what shows as spare is the regular copies first (owner, 2026-10-22). A player who keeps foils as collection pieces never sees them offered for sale by default.

## Work

| Slice | Delivers | Status |
|---|---|---|
| [Spare copies](#spare-copies) | One spare count per card under the player's rule, the rule question, "Por que sobra?" | open - 2 defaults taken |
| [Selling spare copies](#selling-spare-copies) | The "Sobrando" page, the sell draft with its message, the finish questions and the closing line | open - 2 defaults taken |
| [Marking sold](#marking-sold) | Partial sale and the optional collection removal | open - 1 default taken |
| [Buying and trading from a shared list](#buying-and-trading-from-a-shared-list) | "Quero estas" on a sell list, "Oferecer" on a want list, both with a message preview | clear |
| [Saving a friend's deck](#saving-a-friends-deck) | The original list or the friend's version | clear |
| [List and sharing fixes](#list-and-sharing-fixes) | Contact warning, multiplier comma, over-owned note, "Nova lista" starts | clear |
| [Measuring it](#measuring-it) | The counts the review needs | clear |

Order: Spare copies first (every other slice reads it), then the sell line's version fields (the door), then the rest.

### Spare copies

**Delivers** the spare count. Screens: `r3-library-banner-phone`, `r3-spare-rule-phone`, `r3-why-spare-phone`.

| State | What should happen |
|---|---|
| The player has no two holding decks that share a card | No question; spare = owned minus the one deck's use (or owned, with no holding deck) |
| Two holding decks share a card and no rule is stored | The question appears before any spare number, on the "Sobrando" page or on a friend's want list, each option with its count ("Sobram 20 / 24 / 19 cópias"), "Continuar" disabled until one is picked |
| A rule is stored | Counts use it; the "Sobrando" page shows "Sua regra: ... · Mudar" |
| The collection banner, before a rule is needed | "Você tem cópias sobrando · Ver" with no number until the count is settled |
| "Por que sobra?" on a card | A short table: "Você tem N"; one row per format (or per deck, or one row, by rule) with the deck that sets the number; "Sobra M"; Ideia and Aposentado decks named as not counting; the rule with "Mudar" |
| A deck changes status, a card or the collection changes | The next read reflects it (nothing stored) |
| The Tutor computes spare | The same function and rule; retired and Ideia decks stop counting there too |

Decided by the owner (2026-10-22): when the player owns a regular and a foil of the same card, the deck holds the foil first, so the regular copies show as spare first; a player who wants to sell the foil picks its row, since each version has its own row. Default taken: among foil finishes, the deck holds Cold before Rainbow (the costlier finish stays in the deck). Default taken: a player with no stored rule who never meets the condition is never asked.

### Selling spare copies

**Delivers** the "Sobrando" page and the sell draft. Screens: `r3-spare-page-empty-phone`, `r3-spare-page-phone`, `r3-sell-draft-phone`, `r3-sell-draft-answered-phone`, `r3-message-phone`, `r3-lists-new-phone`.

| State | What should happen |
|---|---|
| The player opens "Sobrando" | "Sobrando · N cópias", the rule line, the Ideia notice when it applies, "Ordenar: maior preço / nome", "Mostrar: todas / acima de R$ 5 / acima de R$ 20"; one row per version with a stepper from 0 to its spare, the suggestion, the store reference where it applies, "Ver na LigaFAB" and "Por que sobra?"; every stepper at 0, bar "Escolha o que vender" |
| The player chooses quantities | The bar reads "N cópias · R$ X" with "Vender" |
| "Vender" | The draft: an editable list name ("Vendo - <date>"), the lines with editable prices, the finish questions (Key decision 4), "preço aproximado" where it applies, the price helper once, the closing line field, "Incluir o total" (on), the live message preview, "Enviar no WhatsApp" and "Copiar texto", and "Ao enviar, a lista <name> fica salva em Listas, com o link." |
| "Enviar" or "Copiar" | A sell list is created with the lines, versions and prices, shared with a link; the closing line is saved on the account; WhatsApp opens with the text, or the text is copied |
| A row's card has no Cúpula DT price (not sold there, or no price yet) | No store reference on that row |
| The message | "VENDO", one line per sell line: `Nx <Name> (<Pitch>)` then, when known, ` · <printing set name>`, ` · <finish>` or ` · sem foil`, ` · <condition>`, then ` · R$ X cada` (or ` · R$ X` for one copy); at most 30 lines, then "e mais N cartas no link" as today (`MESSAGE_MAX_LINES`); `Total: R$ X (N cartas)` when on, counting every line, shown or not; a blank line; the closing line; the link |

The final message for Duda's scenario is in `.design/mockups/sell-and-trade/BRIEF-round-2.md` and the round-3 builder report (it equals `r3-message-phone`). Defaults taken: a separate account field for the sell closing line (journey 4's `shareClosingLine` stays for asks); the LigaFAB link format is checked by hand before building, since a script cannot open the site.

### Marking sold

**Delivers** partial sale and the collection question. Screen: `r3-sold-phone`.

| State | What should happen |
|---|---|
| A line has a visible "Vendida" button | Always, on the owner's list |
| "Vendida" on a line of 1 copy | Straight to the collection question |
| "Vendida" on a line of N copies | "Quantas você vendeu?" 1 to N, then the collection question |
| Fewer than N sold | The line splits: the sold copies become a sold line, the rest stays available |
| The removal would leave a holding deck short (a line from "De um deck" or "Do zero") | The question says so: "O Kayo CC vai ficar faltando 2." instead of "ficam N, as que o Kayo CC usa" |
| "Sim, tirar N da coleção" | The copies leave the collection (Key decision 7); "Desfazer" restores them |
| "Não, só marcar como vendida" | The collection is unchanged |
| The card sits in more than one import | The sheet asks which, inside the screen on a phone |
| The collection holds fewer copies than sold | It removes what it holds and says how many |

Default taken: a sold line can be unmarked as today; unmarking after a removal offers to put the copies back.

### Buying and trading from a shared list

**Delivers** a buyer selection on sell lists and a trade offer on want lists. Screens: `r3-buyer-phone`, `r3-buyer-message-phone`, `r3-trade-visitor-phone`, `r3-offer-message-phone`, `r3-share-contact-phone`.

| State | What should happen |
|---|---|
| A logged-in visitor opens a sell list | "<sharer> vende estas cartas", the summary of lines that fill their decks, rows with version, price and deck hint ("Falta 1 no seu Rhinar CC"), a stepper per row, nothing selected |
| The visitor chooses | Bar "Quero estas · R$ X" with "Ver mensagem" |
| "Ver mensagem" | "Oi <sharer>, vi sua lista no Rathe Arsenal. Quero: <lines with version and price>. Total R$ X.", editable, "Enviar no WhatsApp" (to the sharer's number when shown) and "Copiar texto" |
| A logged-in visitor opens a want list | "Cartas que <sharer> procura"; the summary "Você tem sobrando N cópias de M cartas que <sharer> procura."; rows with "Você tem N · M sobrando" and the reason when none is spare ("o seu Rhinar SA usa as 2"); a stepper on rows with spare; the cards the visitor lacks collapsed into one line |
| The visitor chooses copies | The value line "Valor aproximado, pelo preço sugerido: você oferece R$ X · você procura R$ Y" when "Incluir minha lista" is on; the switch is off until tapped |
| "Ver mensagem" | "Oi <sharer>, vi sua lista no Rathe Arsenal. Tenho sobrando para você: <lines with what is known of the visitor's copies>. Em troca procuro: <the visitor's list lines>. Minha lista: <link>" (the last two parts only with the switch on), editable, the two buttons; back link "‹ Lista de <sharer>" |
| The sharer shows no number | The text is copied, with "Texto copiado. Cole no grupo onde você viu a lista." |
| The visitor is the owner | No selection, no offer |
| Anonymous visitor | As today: sign up or sign in, then back to the same address |
| Sharing a list with no number saved | "Sem seu WhatsApp, quem abrir o link não tem como falar com você."; "Salvar e mostrar" with "Seu número aparece para quem abrir o link."; "Compartilhar sem contato" below |

### Saving a friend's deck

**Delivers** the choice of list. Screen: `r3-saved-deck-phone`.

| State | What should happen |
|---|---|
| A shared deck has active substitutions | Each replaced row reads "<card> · no lugar de <original>" |
| "Salvar nos meus decks" on such a deck | "Qual lista você quer salvar?": "A lista antes das trocas de <sharer> (com <original>)" / "Como <sharer> montou (com <replacement>)", none selected, "Salvar" disabled until one is picked |
| The original is chosen | The copy holds the original cards, rebuilt from the sharer's active `card_replacement` rows and their quantities |
| No substitutions | No question, as today |

### List and sharing fixes

| State | What should happen |
|---|---|
| The multiplier is shown | With the locale's decimal comma ("5,5"); the error text matches what the field accepts (F55) |
| A sell line lists more copies than the collection holds | "Você tem N na coleção" in grey; allowed |
| "Nova lista" with kind "Vendo" | First "Vender o que sobra na sua coleção" (opens "Sobrando"), then "De um deck", then "Do zero" ("Para cartas que não estão no app") |

### Measuring it

| State | What should happen |
|---|---|
| A sell list is created from "Sobrando" | `share_event` or a log line records the origin `spare` |
| "Quero estas" is sent or copied | `share_event` `buy`, with the link and the visitor |
| An offer is sent or copied from a want list | `share_event` `offer` (journey 4's kind), with the link's intent |
| A line is marked sold | A log line with the collection answer |
| The rule is set or changed | A log line with the rule and whether it was the first answer |
| `pnpm share:report` | Also prints `buy` and `offer` counts by list kind |

## States specified but not drawn

The rule question on a friend's want list; journey 4's group page (`.design/close-the-deck.md`, Group ask) with "Você tem N · M sobrando" and the rule question when needed; the "Desfazer" after a removal; the import picker on a sale; the toast when the sharer shows no number; "Você tem N na coleção" on a hand-made line; the copied-text hint; the first-time empty closing line with its grey example. They follow the drawn screens' components and copy rules.

## Changed by a later journey

- Journey 3 (`.design/deck-building.md`, owner 2026-10-22): a deck's inventory copies are held by the deck like its starting-deck copies, so they are not spare; "Por que sobra?" names them ("Rhinar CC usa 3 no deck e 1 no inventário"). Blitz allows 1 copy of each card since 9 March 2026, not 2; any example here that counts a Blitz deck's use follows the current rule. The rows above are kept as approved; this note takes precedence in the combined spec.

## Notes for the combined spec (from reading the code, 2026-10-21)

- `card_list_line.printing` is one key, `collectorCode[.edition][.foiling]` (`apps/api/src/lists/printing-key.ts:31-57`); a line with "sem foil" and no printing cannot be stored in it. Align the sell line with journey 2's four optional fields (printing code, edition, finish, condition) and migrate existing keys; the merge rule (`apps/api/src/lists/line-math.ts:36-46`) then compares the four fields.
- `share_event.kind` allows `created`, `opened`, `signed_up` (`apps/api/src/database/entities/share-event.entity.ts:17`); journey 4 adds `offer` and `quote_sent`, this journey adds `buy`. One constraint change for both.
- The Tutor's `deckUsage` SQL does not exclude retired decks (`apps/api/src/chat/chat-tools.service.ts:348-359`); one-deck "free" calculations exist at `apps/api/src/chat/chat.service.ts:279`, `apps/api/src/replacements/build-replacement-views.ts:24-26`, `apps/api/src/replacements/plan-suggested-uses.ts:64-69`. The spare function replaces the first; the others are per-deck and stay.
- `VisitorDecksMissingService.missingByCard` sums each deck's missing count (`apps/api/src/sharing/visitor-decks-missing.service.ts:17-47`); the sell list's "Falta N no seu <deck>" names one deck, so it needs the per-deck breakdown, not the sum.
- `card_replacement` keeps the original card, slot and quantity for each pick (`apps/api/src/database/entities/card-replacement.entity.ts`); the shared deck view and the copy endpoint read the sharer's `active` rows to mark and rebuild the original. With journey 4's pick quantity a replacement may cover only some copies.
- The store price reference reads the same `MIN(store_stock.priceCents)` over in-stock rows that the collection value uses (`apps/api/src/collection/library/library.service.ts:68-127`); it is per card, not per printing, which is why it is never shown next to a foil.
- The price suggestion's error text says "entre 1 e 50" while the parser and DTO accept 0.01 and up (`apps/web/src/i18n/locales/pt-BR/lists.ts:142`, `apps/api/src/lists/dtos/list-requests.dto.ts:65`).
- The new user columns (spare rule, sell closing line) are varchar with check constraints, like `referredVia`.
