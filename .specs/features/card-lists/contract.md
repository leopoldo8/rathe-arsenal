# Card lists with price suggestion - build contract (2026-10-19)

Source of truth for product decisions: `.design/sharing.md`, slices "Card list" and "Price suggestion" (read both in full, plus Key decisions 6 and 7). This file fixes the details the design left to the plan, so the API and web can be built in parallel. The API PR copies this file verbatim to `.specs/features/card-lists/contract.md`.

Out of scope here: sharing a list (`share_link` for lists, `/l/:token`, the shared list page, list preview images). That is the next slice ("Shared list"). Do not add a share button yet; the editor's bottom bar has "Copiar texto" only for now.

## Data model (one migration after `1778533599000-ShareLinks`: `1778533600000-CardLists.ts`)

`card_list`: as the design table, plus `priceMultiplier numeric(4,2) NULL` (sell lists get 7.00 at creation; want lists keep null). Index on `userId`.
Check constraints: `kind in ('want','sell')`; `totalPriceCents >= 0`; `priceMultiplier > 0 and <= 50`.

`card_list_line`: as the design table. Checks: `quantity between 1 and 20`; `condition in ('NM','LP','MP','HP','DMG')`; `priceCents >= 0`. Index on `listId`.
`printing` is a printing key built from the engine catalog's raw printing (`catalog.getRawCard(cardIdentifier).printings[]`, the same data `scripts/price-spike/lib/card-set.ts` reads): the collector code `identifier`, the `foiling` (absent means Standard) and the `edition` (absent means none). The app has no such key today, so define one stable string format in one helper (for example `WTR153.R.F`), document it in the contract copy, and use it everywhere (lines, printings route, price lookup). Two raw printings that produce the same key are one printing. `printingLabel` is built from the same fields, e.g. "WTR153 · Rainbow Foil · 1st" (card-data terms stay in English).
Want lines must keep `printing`, `condition`, `priceCents` null (enforced in the service; 400 `SELL_ONLY_FIELD` if sent on a want list).

`card_price` (shared, written only by the price job): `productId varchar(32)`, `subType varchar(32)`, `marketPriceCents int NULL`, `midPriceCents int NULL`, `fetchedAt timestamptz`; primary key `(productId, subType)`.
`card_price_group_sync`: `groupId int primary key`, `fetchedAt timestamptz` - one row per tcgcsv group (set) the job read, so the job never reads a group twice in one UTC day.

Account deletion (`scripts/delete-user.ts`, `purge-deleted-users.ts`, the in-app delete path): lists go by FK cascade; check those paths and add explicit deletes only if they delete rows by hand today.

## API (all authenticated, owner-only; another user's list or line is 404 `CARD_LIST_NOT_FOUND`)

```ts
type TListKind = 'want' | 'sell';
type TCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

interface ICardListSummary {
  id: number; kind: TListKind; name: string;
  lineCount: number;      // lines, sold included
  copyCount: number;      // sum of quantities, sold included
  soldCount: number;      // copies on sold lines
  totalPriceCents: number | null;
  previewImages: ICardImage[]; // first 3 lines' card images (same image shape the deck/library endpoints use)
  shared: boolean;        // always false until the Shared list slice
  updatedAt: string;
}

interface ICardListLine {
  id: number; cardIdentifier: string;
  name: string; pitch: 1 | 2 | 3 | null; type: string; imageUrl: ICardImage | null; // resolved from the catalog
  quantity: number;
  printing: string | null; printingLabel: string | null; // label as the app shows printings elsewhere (set code + finish)
  condition: TCondition | null;
  priceCents: number | null;   // BRL per copy
  sold: boolean;
  suggestion: IPriceSuggestion | null; // sell lists only; null on want lists, when multiplier is null, or no price row
}

interface IPriceSuggestion {
  cents: number;             // whole reais: Math.round(usdCents * multiplier / 100) * 100
  approximate: boolean;      // true when built from midPrice because marketPrice is null
  fetchedAt: string;         // the snapshot date shown as "mercado TCGplayer de <date>"
  printing: string;          // the printing priced: the line's own, or the default pick (design default 1)
}

interface ICardList {
  id: number; kind: TListKind; name: string; notes: string | null;
  totalPriceCents: number | null; priceMultiplier: number | null;
  lines: ICardListLine[];    // ordered by createdAt of the line, then id
  updatedAt: string;
}
```

| Route | Body | Response |
|---|---|---|
| `GET /api/lists` | | `200 ICardListSummary[]`, newest `updatedAt` first |
| `POST /api/lists` | `{ kind, name (1..80), fromDeckId? }` | `201 ICardList`. From a deck: want = the owner's not-owned cards (the same source as the deck's `missing` share link: readiness `breakdown.notOwned`, grouped by cardIdentifier, quantities summed); sell = every card of the deck with its quantity. 404 `DECK_NOT_FOUND` for a deck that is not theirs. |
| `GET /api/lists/:listId` | | `200 ICardList` |
| `PATCH /api/lists/:listId` | `{ name?, notes? (<= 1000, '' -> null), totalPriceCents? (null clears), priceMultiplier? (null clears) }` | `200 ICardList`; sell-only fields on a want list -> 400 `SELL_ONLY_FIELD` |
| `DELETE /api/lists/:listId` | | `204` |
| `POST /api/lists/:listId/lines` | `{ cardIdentifier, quantity, printing?, condition?, priceCents? }` | `201 ICardList` when a new line was created, `200 ICardList` when it merged into an existing line (want: same cardIdentifier; sell: same cardIdentifier + printing + condition, nulls equal) with quantities summed and capped at 20. Unknown card -> 400 `UNKNOWN_CARD`; printing not of that card -> 400 `UNKNOWN_PRINTING`. |
| `PATCH /api/lists/:listId/lines/:lineId` | `{ quantity?, printing?, condition?, priceCents?, sold? }` (nullable fields accept null) | `200 ICardList` |
| `DELETE /api/lists/:listId/lines/:lineId` | | `200 ICardList` |
| `POST /api/lists/:listId/apply-suggestions` | `{ lineIds?: number[] }` (absent = every available line with a suggestion and no price yet; changed on 2026-10-20 from every available line, so filling never erases a price the seller typed) | `200 ICardList`; writes each targeted line's `priceCents = suggestion.cents`; lines without a suggestion are left as they are |
| `GET /api/lists/:listId/printings/:cardIdentifier` | | `200 [{ printing, label, suggestion: IPriceSuggestion \| null }]` for the line editor's printing picker |

Every write returns the whole list so the web replaces its cache with one response. Every write bumps `card_list.updatedAt`. Rate limits: the global throttler is enough.
`suggestion` is computed on read from `card_price` and the list's multiplier; never stored. Prices already written stay until the seller applies again (design default 2).

## Delivery order (two PRs per side, the second never blocks the first)

1. **Lists PR** (API, then web): `card_list`, `card_list_line`, every route above except `apply-suggestions` and `printings`; `priceMultiplier` column exists and is set to 7.00 on sell lists, but `suggestion` is always null and the web shows no suggestion UI. The `printing` field on sell lines is still editable from a picker fed by the catalog (the web can call a `GET /api/catalog/cards/:cardIdentifier/printings`-style route if one exists; otherwise the API PR adds `GET /api/lists/:listId/printings/:cardIdentifier` returning `suggestion: null`).
2. **Prices PR** (API, then web): `card_price`, `card_price_group_sync`, the job, the script, `suggestion` filled, `apply-suggestions`, the printings route with suggestions; web adds the multiplier control, the suggestion under each sell line in the edit panel, "Usar sugestão" and "Usar sugestões em todas".

## Price job

- tcgcsv only, as `.specs/features/price-spike/result.md` describes (category 62, `/tcgplayer/62/groups`, `/tcgplayer/62/<groupId>/prices`, `last-updated.txt`). Identify the app with a descriptive `User-Agent` and space requests at least one second apart.
- Which groups: every group of category 62, from the group list (read at most once per UTC day). Changed on 2026-10-20 from "only sets that hold a printing of some card on a sell list": that left a card from a set nobody sold before without a suggestion for up to an hour. See the appendix.
- When: in process, a check every hour (add `@nestjs/schedule` or a plain interval started in `onApplicationBootstrap`, whichever fits the codebase; must be disabled in tests and when `PRICE_SYNC_ENABLED=false`). It reads a group only if `card_price_group_sync.fetchedAt` is missing or older than tcgcsv's `last-updated.txt` time, and never twice in the same UTC day. So any card already has a price when it is put on a sell list, and the user-facing request never calls tcgcsv.
- Enabled only when `PRICE_SYNC_ENABLED=true` (default off; tests and local runs never call tcgcsv). The owner's staging and production each set it.
- Also a script `pnpm prices:sync` (scripts/) that runs one pass by hand.
- Failure: log, keep the previous rows, retry on the next hourly check. No user-facing error.
- Printing to price key: `tcgplayer.productId` plus the sub type from the printing's edition (First / Unlimited) and foiling (Normal / Rainbow Foil / Cold Foil / Gold Foil), as the spike's mapping section says. Printings with no productId never get a suggestion.
- Default printing for a line with none (design default 1): the cheapest non-foil printing with a market price; if the card has no non-foil printing with a price, the cheapest printing of any finish. Mid price counts only when no printing has a market price, and then the suggestion is `approximate`.

## Web

Screens picked by the owner (do not redesign; build from these mockups, which are HTML you can read):
- Lists index and create dialog: alternative A, `.design/mockups/sharing/lists/lists-home-a-{desktop,phone}.html`.
- List editor: alternative B, `.design/mockups/sharing/lists/list-editor-b-{desktop,phone}.html`.

Rules from the owner's last reviews that the mockups predate, and that win over the mockups:
- No sentence that explains the system ("Depois de criada, a lista não acompanha mais o deck", "Preço sugerido em breve", etc.). Labels and one short hint at most.
- Sharing does not exist yet for lists, so drop every line promising it: the index subtitle "num link só para mandar no grupo", the empty state's "mande o link no grupo", the "Compartilhada"/"Privada" badges (show nothing until the Shared list slice).
- The editor's share section (sections 5 and 6 of the editor mockup) is NOT built now. The bottom bar shows totals and "Copiar texto" only.
- Wording: "cartas", never "cópias" or "linhas" in user-facing copy ("7 cartas", "15 cópias" becomes "15 cartas"; the index meta line uses card counts, e.g. "15 cartas · 1 vendida · atualizada hoje").
- Price source is TCGplayer only; there is no source picker. Changed on 2026-10-20 to the owner's pick (alternative B of `.design/mockups/sharing/pricing/`): the bottom bar carries "Cotação TCGPlayer x[7]" and "Preencher N cartas sem preço" (shown only when N > 0); each available card without a price shows its suggestion dashed in the price's place ("+ R$ 14,00 sugerido", one tap writes it); a typed price that differs shows "TCGPlayer R$ 14,00" with "usar"; a card without a suggestion notes "sem preço no TCGPlayer". The edit panel keeps "Sugestão R$ 14 · mercado TCGPlayer de 18/10" and "Usar sugestão". An empty "Tudo por" suggests the sum of the available priced cards (price × quantity).
- Navigation: a "Listas" item in the top bar and the phone bottom tab bar, between Biblioteca and Tutor, as the mockup shows. Routes: `/lists` (index) and `/lists/$listId` (editor), both under `_auth`.
- Adding a card: the catalog search the app already uses elsewhere (manual add-cards / deck editor); any card, owned or not.
- Copy as text: want `2x Name (Vermelho)` per line; sell `2x Name (Vermelho) · NM · R$ 6,00 cada` with blank fields left out; sold lines left out; sell list total appended as `Total: R$ 420,00` when set. Pitch naming as the shared page's "Copiar lista em texto" (reuse `withPitch`).
- Money: BRL, `R$ 6,00`, input accepts "6", "6,5", "6,50". Per-copy price shown as "R$ 6,00 cada".
- i18n in pt-BR and en-US, new `lists` namespace.
- Phone: the edit panel is a bottom sheet; the totals bar is fixed at the bottom above the tab bar.
- Disclaimer/copyright: the app's existing footer behaviour for authenticated pages; nothing new.

## Appendix: what the API PR settled (added when the contract was copied; the text above is verbatim)

### Printing key

One string per printing of a card: the collector code, then the edition code if the printing has an edition, then the foiling code if it is not Standard, joined by dots. Built in `apps/api/src/lists/printing-key.ts`, the only place that builds it.

| Part | Values |
|---|---|
| edition | `First` = `1E`, `Unlimited` = `UE`, `Alpha` = `AE` |
| foiling | `Rainbow` = `RF`, `Cold` = `CF`, `Gold` = `GF` (Standard adds nothing) |

Examples: `WTR153` (Standard, no edition), `WTR153.RF` (Rainbow Foil), `ARC123.1E.CF` (1st edition, Cold Foil).
`printingLabel` is the collector code, the foil name and the edition name, joined by ` · `: `WTR153 · Rainbow Foil · 1st`, `ARC123 · Cold Foil · 1st`, `WTR153`.
Raw printings of the catalog that produce the same key are one printing; when they disagree on the TCGplayer product id, the first one that has an id wins.
A printing is valid for a card when its key is one of the keys built from that card's raw printings.

### Error codes

`CARD_LIST_NOT_FOUND` (404, also for a line that is not in that list and for ids past the int4 range), `DECK_NOT_FOUND` (404), `SELL_ONLY_FIELD` (400), `UNKNOWN_CARD` (400), `UNKNOWN_PRINTING` (400). The body is `{ success: false, statusCode, error, code, timestamp }`; request validation failures are 400 without a `code`.

### Rules the contract left open

- A sell-only field sent on a want list with a value is `SELL_ONLY_FIELD`; sent as `null` it is accepted and changes nothing.
- An add never merges into a sold line: it creates a new line. When it merges into an existing line that has no price, the new price fills it; an existing price is kept.
- Editing a line (PATCH) never merges it with another line, even when printing and condition now match.
- Lines are ordered by `card_list_line.createdAt`, a column the design's table did not list.
- A sell list made from a deck takes the deck's card rows; a scratch deck's hero, which has no card row, is not included.
- `sold` can be set on any list.

### Price job (Prices PR)

- Groups: every group tcgcsv lists for category 62 (109 when the spike read them, about 17,000 price rows in all), read in groupId order, one second apart. A full pass is about 110 requests a day, against tcgcsv's ceiling of 10,000. The set-to-group mapping is gone: a price row is found by the printing's product id, whatever group it came from, so deck products (Blitz, Silver Age, Armory) are priced when tcgcsv carries them.
- A pass stops after 3 groups fail in a row and leaves the rest to the next hourly check, so an outage costs a few requests an hour instead of the whole list.
- One pass at a time across processes: a Postgres advisory lock (`pg_try_advisory_lock`) taken for the pass; a process that cannot take it (a deploy overlapping the old container, `prices:sync` by hand) skips the pass.
- A pass that read or failed a group logs `prices.sync.pass` with the counts; a pass with nothing to read logs nothing.
- Sub type: Normal, Rainbow Foil, Cold Foil, Gold Foil, prefixed `1st Edition ` or `Unlimited Edition ` by the edition. Alpha printings and unknown finishes have no sub type and never get a suggestion.
- The group list is read at most once per UTC day while the process runs (kept in memory; a restart reads it again). `last-updated.txt` is read only when some group was not read today.
- A suggestion is never below R$ 1,00 (a card worth a few cents would otherwise suggest R$ 0).
- `pnpm prices:sync` builds the API and runs one pass with the same rules. `PRICE_SYNC_ENABLED=true` turns on the hourly check.
- `apply-suggestions` on a want list changes nothing (it has no suggestions) and answers 200.
