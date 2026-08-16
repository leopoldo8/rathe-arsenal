# Deck Surfaces Design — Home, Deck Detail, New/Edit Deck

**Spec**: `.specs/features/product-redesign/spec.md` — stories "P1: Home — the armory" (HOME-01..07), "P1: Deck detail" (DECK-01..09), and EDIT-01..04 from "P2: New deck, edit deck and settings" (new deck and edit deck only — Settings belongs to another workstream).
**Handoff**: `.specs/features/product-redesign/design-handoff.md` — sections 3 (Home), 4 (Novo deck), 5 (Deck detail), 6 (Deck detail — edição), plus the Deckbox and Medallion component sections and Interactions & Behavior.
**Depends on**: `01-foundation.md` (approved — token names, type scale, nav-active rule) and `02-core-components.md` (medallion + deckbox — **does not exist yet**, treated as a black box per §1 below).
**Status**: Draft

---

## 0. How to read this document

This workstream reshapes three existing, working screens (`home.tsx`, `decks.$deckId.tsx`, `decks.new.tsx`) rather than building from nothing. Deck Management v2 already shipped status shelves, a tag filter, an inline metadata-edit header (name/status/tags), a composition-draft edit mode with cascade checking and localStorage draft persistence, and a legality badge. Every section below states explicitly what survives unchanged, what gets restyled only, and what gets rebuilt — silence on an existing behavior is not a decision, so nothing here is silent.

Two dependencies outside this workstream's control are named up front because they constrain what can actually ship:

1. **The medallion and deckbox don't exist yet.** §1 writes down the exact props this design assumes from them. If `02-core-components.md` lands with a different contract, every consumer below needs a matching edit.
2. **The Swap lifecycle (SWAP-01..12) ships in phase 7; Deck detail ships in phase 5.** DECK-05's "Trocas sugeridas" panel and DECK-02's "Ver trocas" action want data from the new persisted-`Swap` model, which does not exist when this phase lands. §5.5 designs against what phase 5 actually has (the existing `decisions` + `ISubstitutionMatch.tier` model) and flags the sequencing gap for the orchestrator rather than silently building against an API that isn't there yet.

---

## 1. Black-box contracts assumed from `02-core-components.md`

Since that design doesn't exist yet, every consumption site below is written against this exact assumed contract. If the real component differs, only these call sites need reconciling — nothing else in this doc depends on medallion/deckbox internals.

### Medallion

```ts
interface IReadinessMedallionProps {
  readonly pct: number;              // 0-100, drives the ring sweep
  readonly size: 38 | 90;            // 38 = deckbox face; 90 = deck-detail hero
  readonly heroArtUrl: string | null; // null → CardArt-style fallback, not a broken image
  readonly heroName: string;          // sublabel at size=90 only
}
```

Ring color: `>=100` → `--ra-status-ready` (`--ready`), `>=85` → `--ra-accent` (`--acc`), `<85` → `--ra-status-building` (`--building`) — CMP-02, inclusive boundaries per the spec's Edge Cases. The percentage is exposed to assistive tech as text (CMP-05); consumers here don't re-derive an aria-label.

### Deckbox

```ts
interface IDeckboxProps {
  readonly status: TDeckStatus;                 // drives idea (no cards scene) / retired (grayscale) filters
  readonly heroArtUrl: string | null;
  readonly deckName: string;
  readonly format: string;
  readonly medallionPct: number | null;          // null → medallion omitted, box still renders
  readonly representativeCards: readonly {        // ≤3, padded with silhouettes below 3 — mirrors today's DeckCard
    readonly imageUrl: { readonly small: string; readonly smallSources: readonly string[] } | null;
  }[];
  readonly onActivate: () => void;                // click / Enter / Space → navigate to deck detail
}
```

`ready` and `active` both render as a normal (non-`idea`, non-`retired`) box — D5's grouping is a Home read-side concern (§2.2), not a deckbox prop; the deckbox itself doesn't need a 5th visual state.

---

## 2. Home — the armory (HOME-01..07)

### 2.1 Composition tree

```
home.tsx (route)
├── loading   → HomeSkeleton (existing, restyled to new tokens only)
├── error     → existing inline error + retry (unchanged)
├── empty     → EducationalEmptyState (restyled — §2.7)
└── populated
    ├── ArmoryHeader (NEW — replaces PopulatedHomeHero)
    │   ├── H2 "Your armory" + status line ("2 de 6 decks prontos")
    │   ├── KpiStrip (NEW — 3-cell bordered strip)
    │   └── "+ New deck" CTA (Link to /decks/new, restyled)
    ├── FilterBar (NEW — wraps existing search-less filter + TagFilterChips)
    │   ├── search input (NEW — no existing equivalent on Home)
    │   └── TagFilterChips (EXISTING, restyled — pill visual only)
    ├── StatusGroups (RESHAPED from StatusShelves — §2.2)
    │   └── DeckboxTile (NEW wrapper around the black-box Deckbox, §1)
    └── AggregateCallout (EXISTING — §2.6, relocated)
```

### 2.2 Five statuses, four groups — the read/write split

**This is a read-side collapse only.** The database CHECK constraint, `TDeckStatus`, `STATUS_KEY_MAP`, and `StatusDropdown`'s 5-item list are untouched (D5). Home's grouping function changes from "one shelf per status" to "one group per display bucket":

```ts
type THomeGroup = 'active' | 'building' | 'idea' | 'retired'; // display buckets, not TDeckStatus

const GROUP_OF: Record<TDeckStatus, THomeGroup> = {
  ready: 'active',
  active: 'active',
  building: 'building',
  idea: 'idea',
  retired: 'retired',
};

const GROUP_ORDER: readonly THomeGroup[] = ['active', 'building', 'idea', 'retired'];
```

`GROUP_OF` replaces `STATUS_ORDER`'s role in `StatusShelves.tsx`; `filterByStatus` becomes `filterByGroup(decks, group) = decks.filter(d => GROUP_OF[d.status] === group)`. A group renders only when its filtered set is non-empty (HOME-04) — same "return null" pattern the existing shelves already use, no new logic needed there.

**Why this can't leak into a write path.** The `ready`↔`active` collapse must never let editing an unrelated field on a `ready` deck silently rewrite it to `active`. This constrains the edit screen (§4), not Home: the 4-segment status control's "Ativos" segment is a *display* affordance that must not compute a canonical value on `ready` decks. Concretely — clicking "Ativos" when the deck is already `ready` is a no-op (no PATCH fires), and the segment renders as selected for *either* `ready` or `active` without collapsing the underlying value. The literal five-value status is not orphaned by this: the deck-detail hero banner's status chip (handoff: `"Ativo ▾"`) is the existing `StatusDropdown` (§5.2), which still lists and sets all five values directly. `ready` stays reachable and settable through that surface even though the edit screen's segmented control only shows four labels.

**Home group header text.** `01-foundation.md` §3.3 explicitly defers `.ra-h2` / `--ra-text-h2`'s fate to "whichever phase implements Home's group headers" — that's this workstream. Resolution: group headers are **not** `.ra-h2` at all. The handoff specifies them as Hanken Grotesque 15px/700 (`--ra-font-ui` at `--ra-text-subtitle`), which is a body-family treatment, not the display-serif `.ra-h2` class. `StatusShelves` already renders a bare `<h2>` per group for the document outline (`aria-labelledby` wired to it) — keep that element (accessibility structure unaffected) but stop it from picking up the global `h2 { font-family: var(--ra-font-display); ... }` rule from `01-foundation.md` §3.3 by giving it its own CSS-module class that explicitly sets `font-family: var(--ra-font-ui); font-size: var(--ra-text-subtitle); font-weight: 700; text-transform: none;` — exactly the "component supplies its own class, global bare-tag cascade still applies to whatever it doesn't override" case `01-foundation.md` warns about. `.ra-h2`/`--ra-text-h2` stay otherwise undecided outside Home; no other consumer is this workstream's concern.

### 2.3 KPI strip

Handoff: 3 cells (Decks · Avg readiness `--acc` · Missing `--miss`), bordered `--line-strong`, radius `--ra-radius-md` (12px per §4.1), vertical dividers.

**Reuse, don't rebuild the math.** `PopulatedHomeHero`'s `computeAverageReadiness` already excludes retired decks from both the count and the average (R12a) — this scoping is preserved exactly, not "6 Decks" meaning all-decks-including-retired. The handoff's example ("6 Decks") is compatible with this only if the user's retired decks happen to be zero in that mock; document that the KPI strip's "Decks" cell counts **non-retired** tracked decks, same as today, even though a visible "Aposentados" group exists below it — the KPI strip and the group list answer different questions (how many decks are in active rotation vs. how many decks exist at all) and that's intentional, not a discrepancy to reconcile.

The "Missing" cell reuses `ITrackedDeckListResponse.totalCardsMissing` (already scoped correctly — sum of `notOwned` quantities across snapshots) exactly as `PopulatedHomeHero` consumes it today; no new derivation needed.

### 2.4 Filter bar

- **Search input**: genuinely new — nothing on Home filters by text today (Library has one; Home doesn't). Client-side substring match over `deck.name` / `deck.hero`, composed with the existing tag filter (AND between search and tags, OR within tags — same combination logic `applyTagFilter` already uses for multiple tags). No new query, no new endpoint: filters the already-loaded `trackedDecks` array, same as `TagFilterChips` does today.
- **Filter pills**: `TagFilterChips` is functionally complete (URL-synced via `tag` search param, `validateHomeSearch`, OR-logic) — this is a **visual restyle only**. New pill states use locally-scoped values per `01-foundation.md` §5.4's explicit grant (filter-pill active state gets its own `.12`/`.3` alpha pair, not `--ra-accent-soft-bg`/`-bd` which is reserved for nav) — define `--home-filter-pill-active-bg: rgba(208,168,76,.12)` and `--home-filter-pill-active-border: rgba(208,168,76,.3)` scoped to `FilterBar.module.css`, not promoted to `tokens.css`.

### 2.5 Status groups → deckbox grid

`StatusShelf`/`RetiredShelf` restructure around `GROUP_OF` (§2.2). Per-group grid becomes `repeat(4, 1fr)` gap 20px per the handoff (was an implicit grid before — the exact column count is new). Each tile wraps the black-box `Deckbox` (§1) plus the meta line below it (HOME-06):

```
completed  → "Completo · {owned}/{total}" in --ra-status-ready
incomplete → "{missing} faltando · {owned}/{total}" in --warn
no snapshot → "Rascunho · sem lista" in --dim-2 (--ra-fg-muted)
```

This is a straight restyle of `resolveReadinessTier`'s three states (today: high/mid/low tiers with 80/50 thresholds driving card border color) — HOME-06 doesn't specify numeric thresholds, only the three states (complete / incomplete / no-list), so the existing `effectivePercent === 100` (or `null` breakdown with nothing missing) / `missing > 0` / `latestSnapshot === null` branches map directly without touching `resolveReadinessTier`'s math.

**Preserve / reshape / drop table for everything `StatusShelves`/`DeckCard` ship today:**

| v2 behavior | Verdict | Notes |
|---|---|---|
| Retired shelf starts collapsed, `ra-shelf-retired-expanded` localStorage | **Preserve, adapted** | The handoff's 4 static groups have no collapse affordance drawn, but dropping collapse means Aposentados always renders open at full size — a regression for users who retire many decks. Keep the collapse/expand toggle on the Aposentados group specifically (it already carries a distinct always-last position and hint copy in the handoff), not on the other three groups. Flagged — confirm this addition is acceptable since the handoff doesn't draw it. |
| All-retired empty block under collapsed Retired shelf | **Preserve** | Still applies once Retired is the only non-empty group; composes cleanly with HOME-04 (empty groups omitted) since this only renders when Retired is the *sole* remaining group, which is a different condition from "this group is empty." |
| Untrack pin (top-right corner button) + 4.8s undo toast | **Preserve, restyled** | No deckbox-level affordance for this in the handoff's spec — keep it as an overlay control on `DeckboxTile` (outside the black-box `Deckbox` itself, per §1's `onActivate`-only contract), positioned over the deckbox's corner. |
| Per-card legality icon (✓/✗) in the meta row | **Preserve, exception-based** | Not on the deckbox face — that surface is already carrying hero art, the monogram, the deck name, the format and the 38px medallion, with no room for a 4th signal. Instead render it in the meta line beneath the box (the same line HOME-06's completed/incomplete/draft text occupies), and **only when the deck is illegal** — a green check on every tile is noise; a red flag on the rare illegal deck is exactly the glance power users scanning many decks need. Reuses `deck.legality.category === 'illegal'` (already on `ITrackedDeckListItem`), no new query. |
| Active-tag promotion into the visible 4-tag-chip slots | **Stays dropped** | No tag chips render on the new deckbox face at all (handoff: name + format + medallion only). This is a deliberate loss, not an oversight: tags remain reachable and do their filtering work through the header's filter chips (§2.4), which is where they're actually useful — a per-tile tag chip is redundant with a filter the user already has open. |
| `activeFilterTags` prop threading into `DeckCard` | **Drop with the above** | No longer needed once tag chips aren't rendered per-tile. |

### 2.6 AggregateCallout — no slot in the handoff

`AggregateCallout` ("R$ 312 completaria 4 de 6 decks…") has zero equivalent anywhere in the handoff's Home section — the KPI strip is fixed at 3 cells and nothing else in the layout resembles a shopping-completion banner. Recommendation: **preserve it, relocated below the status groups** (same position it occupies today, at the bottom of the populated page) rather than deleting a working, data-driven feature the handoff's designer simply never saw. Restyle only (surface/border/text tokens). Flagged for owner confirmation since this is this workstream inventing a slot the handoff doesn't draw, not following it.

### 2.7 Empty state (HOME-07 — invented, not in the handoff)

The handoff has no empty-Home screen; HOME-07 requires one regardless. **Invented here, kept minimal**: restyle the existing `EducationalEmptyState` (heading, lead, 3-step explainer, primary CTA to `/decks/new`, secondary "skip to Library" link, manual-add hint) to the new tokens/type scale — no new content, no new steps, no new copy beyond what already exists translated. The only structural change is dropping the numbered-step `01`/`02`/`03` digit styling if it now reads as the banned "roman numeral" motif's cousin — it isn't roman numerals and isn't diamond ornamentation, so it stays as plain Arabic numerals with no further change.

---

## 3. New deck (EDIT-01)

`decks.new.tsx` + `ImportFabraryCard` + `StartScratchCard` already implement the handoff's exact structure: two side-by-side cards (`1fr 1fr`, gap), Fabrary URL import on the left, hero+format scratch-start on the right, both cards already carrying the icon-square + heading + CTA layout the handoff describes. **This is a restyle-only surface** — icon squares get the handoff's tinted backgrounds (`rgba(208,168,76,.12)` gold square for Fabrary, `rgba(143,124,240,.12)` violet square for scratch — both new locally-scoped literals, no `tokens.css` addition since they're single-consumer decorative backgrounds), card radius moves to `--ra-radius-lg` (14px), CTA styling follows the new button tokens. No component-tree change, no new mutation, no new route.

---

## 4. Edit deck (EDIT-02..04) — a new screen, not the existing composition-edit mode

### 4.1 The split, stated once

Today, "Edit" on deck detail means exactly one thing: entering composition-draft mode (`?edit=1` on `/decks/$deckId`) to add/remove cards, change hero, change format via `usePutDeckMutation`, gated by cascade-legality checking. Metadata (name, status, tags) is *already* editable inline in the header at all times, in both view and edit mode, via `DeckNameInline`, `StatusDropdown`, and `TagChipRow` — no dedicated screen exists for it today.

The handoff's `design-handoff.md` §6 describes something that is neither of those: a dedicated `max-width:820px` panel with Name, Format, a 4-segment Status control, Tags, and **Notes** — no cards, no hero swap, no quantities anywhere in it. EDIT-02..04's acceptance criteria match this metadata-only screen exactly. Composition editing is not named in any requirement ID in this spec and is not drawn in any of the handoff's 11 screens.

**Resolution**: EDIT-02..04 is a **new screen** at a **new route**, `/decks/$deckId/edit` (file `decks.$deckId.edit.tsx`), distinct from the existing `?edit=1` search-param mechanism on `/decks/$deckId`. It absorbs what `DeckNameInline`/`StatusDropdown`/`TagChipRow` do inline today (those three become redundant in the header once this screen exists — see §5.2) plus the two genuinely new pieces (Notes, a bundled danger zone). Composition editing (cards/hero/quantities/cascade-check/draft-persistence) is **preserved entirely unchanged**, reachable through a different, explicitly-relabeled entry point since "Editar" is now claimed by this new screen — see the open item in §4.6.

### 4.2 Fields

| Field | Control | Mutation | Notes |
|---|---|---|---|
| Name | text input | `usePatchDeckMutation({ name })` | Reuses the mutation `DeckNameInline` already calls; the inline header control is retired once this exists (§5.2). |
| Format | `FormatDropdown` (existing component, reused as-is) | **New**: `format` added to `IPatchDeckBody` | See §4.3 — this is the one genuinely new backend surface this screen requires. |
| Status | 4-segment control (Ativo/Construindo/Ideia/Aposentado) | `usePatchDeckMutation({ status })` | Same mutation `StatusDropdown` already calls. See §2.2 for the collapse-must-not-write rule this control has to satisfy. |
| Tags | `TagChipRow` + `TagAutocompleteCombobox` (existing components, reused as-is) | `usePatchDeckMutation({ addTagIds, removeTagIds })` | No change from today's behavior, just relocated from the header into this panel. |
| Notes | textarea, 88px | **New** field end to end | Does not exist in `IPatchDeckBody`, `IPutDeckBody`, `IDeckDetailResponse`, or any deck DTO today. Requires a schema column + API field, not just a frontend change. Flagged — this is new backend scope this workstream did not previously carry. |

### 4.3 Format: PATCH, not PUT — and why that's not optional

`IPatchDeckBody` today has no `format` field; the only existing way to change format is `usePutDeckMutation`, which requires and replaces the **entire card list** in one transactional call. Routing this screen's format select through PUT would mean either (a) round-tripping every card in the deck through a metadata-only screen just to change one enum field, with any gap in that payload silently deleting cards, or (b) building a partial-PUT variant that doesn't exist. Neither is acceptable for a field that's conceptually pure metadata.

**Resolution**: add `format?: TSupportedFormat` to `IPatchDeckBody`, handled server-side as a metadata-only update with no composition side effects (the existing `usePatchDeckMutation`'s invalidation of `DECKS_QUERY_KEY` + `deckDetailQueryKey` + `TAGS_QUERY_KEY` already covers what changes downstream — home list format pill, detail header, no library impact since format doesn't gate ownership). This is new backend scope, small and self-contained (one field on an existing endpoint), and is the safer of the two options considered — the rejected alternative (route format through PUT) was rejected specifically because it turns a metadata edit into a data-loss hazard if the payload assembly on this new screen is ever incomplete.

### 4.4 Danger zone (EDIT-04)

- **"Aposentar deck"** — `usePatchDeckMutation({ status: 'retired' })`, the same mutation `StatusDropdown` already fires for this status value. No new endpoint.
- **"Excluir deck"** — `useUntrackDeckMutation()` (`DELETE /decks/:deckId`). The existing i18n string for this action already frames it correctly for this danger-zone context: *"Untrack '{{name}}'? This will remove the deck and all its readiness data"* — this is a genuine delete of tracking + snapshot data, not a soft hide, so "Excluir" is the accurate label and no semantic gap exists between the handoff's copy and today's endpoint behavior.
- **Confirmation** (EDIT-04's explicit requirement): today's only delete-confirmation pattern in the app is `delete-account-modal.tsx` (Settings) — a Radix `AlertDialog` with a checkbox-gated destructive submit. Deck deletion is lower-stakes than account deletion (no password re-entry needed), so reuse the `AlertDialog` + destructive-styled confirm button pattern without the password/checkbox gating — a single "type the deck name to confirm" or a plain "Delete / Cancel" `AlertDialog` is sufficient. Exact confirmation friction (typed name vs. plain confirm) is agent's discretion; default to a plain `AlertDialog` (no typed confirmation) since decks are recoverable via re-import and this isn't account-destroying.

### 4.5 Draft persistence on this screen

The composition-edit mode's draft machinery (`useCompositionDraft`, `readStoredDraft`, `DraftRestoreModal`, `useNavigationAwayGuard`, `DiscardChangesConfirm`, `SaveCascadeConfirmModal`) is scoped to **composition** state (cards/hero/format-as-part-of-composition) and stays exactly as-is on the existing `?edit=1` flow (§4.6) — none of it needs to move.

This new metadata screen does **not** get the same localStorage draft-and-restore treatment (no cross-session recovery for a typed name or a toggled status) — that machinery exists specifically because composition edits are large and slow to redo; a name/format/status/tags/notes edit is small and fast to redo. It **does** need a lighter nav-away guard so a stray click doesn't silently discard a typed name or notes paragraph: reuse `DiscardChangesConfirm` (already generic — takes `changeCount` and open/keep-editing/discard callbacks, no composition-specific coupling) wired to a simple local `isDirty` boolean (any field differs from the loaded deck), not the full `useNavigationAwayGuard` + `useCompositionDraft` pairing built for composition state.

### 4.6 Open item: relabeling the composition-edit entry point

Since "Editar" on the deck-detail hero banner now means "open the metadata screen" (DECK-01, matching the handoff literally), the existing composition-edit mode (`?edit=1`) needs a different, explicit entry point and label — it cannot also be called "Editar" without colliding with the new screen's meaning. **Default, so implementation isn't blocked**: place it as an action in the decklist section's header, next to the Por tipo/Por custo/Lista toggle (DECK-07), labeled "Editar cartas" / "Edit cards" — contextually closest to what it actually edits. Composition editing's own header UI (`DeckDetailHeader`'s Cancel/Save pair, cascade-check flow, `DraftRestoreModal`) is otherwise unchanged; only the trigger's location and label move. **Flagged for a quick owner confirmation** since neither the handoff nor the spec draws this entry point at all — but this is the kind of naming call that shouldn't block the rest of the phase.

---

## 5. Deck detail (DECK-01..09)

### 5.1 Layout reshape

Today: three-region shell (`DeckDetailLayout` — full-width header, 280px sticky sidebar, canvas), with the sidebar carrying hero block + legality + shopping panel + Fabrary link, and the canvas carrying `ReadinessHero` + a three-section breakdown (Exact / Swaps / Not owned, via `SectionDiamond` variants).

Handoff: single-column `max-width:1180px` stack — hero banner (bleeds full-width) → status strip → 3-card analysis row → 2-panel (falta comprar / trocas) row → decklist. No sidebar column.

**This is a real layout rebuild, not a restyle.** `DeckDetailLayout`'s header/sidebar/canvas slot API is retired for this route in favor of a single vertical stack component (`DeckDetailStack` or similar), composing five regions in order. Each region's *content* is heavily reused (§5.2–§5.6); the *shell* is new.

### 5.2 Hero banner (DECK-01)

- Hero art background + overlay gradient `linear-gradient(180deg,rgba(0,0,0,.15),rgba(11,12,15,.96))` — the `.96` endpoint has no existing `--ra-*` slot; define as a locally-scoped literal in the hero banner's module (not promoted to `tokens.css` — single consumer, decorative gradient stop, matches `01-foundation.md`'s pattern of leaving single-consumer literals local).
- Breadcrumb "← Decks" — reuses the existing `styles.breadcrumb` link pattern from `DeckDetailHeader`.
- Status chip (`"Ativo ▾"`) — **this is `StatusDropdown`, relocated into the banner, unchanged in behavior.** It's the surviving five-value status control referenced in §2.2 — `ready` stays directly settable here even though the edit screen's segmented control only shows four labels.
- "Editar" button (border `--acc`) — navigates to `/decks/$deckId/edit` (§4).
- "···" button — the existing overflow menu, minus Untrack (moved into the edit screen's danger zone, §4.4); if nothing else needs to live there, this button may have zero items and can be dropped — flagged as agent's discretion pending what else, if anything, lands in it.
- Eyebrow `12px uppercase #c6a678` ("CLASSIC CONSTRUCTED · LIGA LOCAL") — `#c6a678` has no existing slot; closest existing token is `--ra-accent-deep`-family but not an exact match. Define as a new locally-scoped literal (`--hero-eyebrow-ink: #c6a678`) rather than forcing a token-file addition for a single decorative eyebrow color, consistent with how `01-foundation.md` treats other single-consumer handoff literals.
- Deck title (Newsreader 34px) — reuses `DeckNameInline`'s *display* half only (the click-to-edit affordance is retired here since renaming now lives in the edit screen, §4.2) — renders as static text, not an inline-editable control, once the edit screen exists.
- Hero name (13px) — reuses `DeckDetailSidebar`'s hero-name resolution logic (`heroCard?.name ?? heroName ?? heroLegacy`), not the sidebar component itself.
- **90px medallion** (§1) in the bottom-right — replaces `ReadinessHero`'s `.ra-readiness-display` number-only treatment entirely for this banner slot.

### 5.3 Status strip (DECK-02, DECK-03)

Two states, both already computable from data the page already loads:

- **Incomplete**: `bg rgba(208,100,90,.08)` / `border rgba(208,100,90,.25)` — these are exactly `--ra-ready-low-bg` / `--ra-ready-low-border`'s new values per `01-foundation.md` §1.7 (handoff literals, already resolved by that phase) — **reuse those tokens directly, do not redefine locally.** Text derives from `countNotOwnedCards(breakdown)` (existing helper in `decks.$deckId.tsx`) for the missing-card count and slot count; "N swaps would make it playable" derives from the existing `decisions`/substitution-match data (§5.5's data source) filtered to pending. Actions: "Ver trocas" (§5.5's sequencing caveat applies), "Comprar tudo" (reuses whatever `ShoppingPanel`'s bulk-buy affordance already does, if one exists — confirm at implementation time), single Fabrary link (moved here from the sidebar, and per DECK-09 **removed** from wherever else it rendered — today's `ReadinessHero.hero__fabraryLink` and `DeckDetailSidebar`'s Fabrary block both need to go once this is the sole Fabrary link).
- **Complete**: `--ra-status-ready`-toned, no actions, static "Coleção completa" text.

### 5.4 Analysis row (DECK-04) — the three-value fix, under D7 gating

This is where today's concatenation lives and gets fixed:

**Current state** (`ReadinessHero.tsx:100-105`, i18n key `decks.rawFidelity` at `apps/web/src/i18n/locales/{pt-BR,en-US}/decks.ts:127`): `t('decks.rawFidelity', { raw, fidelity })` produces the single interpolated string `"Bruto {{raw}}% · Fidelidade {{fidelity}}%"` / `"Raw {{raw}}% · Fidelity {{fidelity}}%"` — one rendered `<div>`, two numbers baked into one string. This is exactly the pattern DECK-04 bans.

**Fix**: the new "Prontidão" analysis card renders `raw` and `fidelity` as two separate elements — two labeled bars (`--acc` for raw, `--ready` for fidelity, 5px height per the handoff) each with its own numeric label, not run through a shared interpolated string. `decks.rawFidelity` is retired; two new i18n keys (`decks.rawLabel`, `decks.fidelityLabel` or equivalent bar-caption strings) replace it. `pct` (the hero medallion's number) is visually and structurally separate already since it lives in the banner, not this card — satisfying "never concatenated" by construction once the raw/fidelity bars stop sharing a string.

**What each number means once D7 lands.** D7 (spec Owner Decisions) changes `computeEffectiveReadiness` so only *approved* substitutions count toward `effectivePercent`; a pending suggestion no longer inflates it. Per the coordinator, the swaps workstream's engine/API half now lands **before** this phase, not after — so by the time Home and Deck detail are built, gating is already live. This card renders all three numbers under that gated meaning:

- **`raw` (`rawPercent`)** — cards you literally own, in the deck's needed quantity, with zero substitutions counted, approved or not. D7 doesn't touch this number's formula (`exactCount / totalCards`, `packages/engine/src/readiness/compute.ts:256`) — it never counted substitutions to begin with.
- **`pct` (`effectivePercent`, the medallion's number)** — cards you own **plus** substitutions you've explicitly approved. A high-`score` pending suggestion (§5.5) does not move this number; only clicking Approve does. This is "what you can actually play tonight."
- **`fidelity` (`fidelityPercent`)** — a tier-weighted quality score (`computeFidelity`, `packages/engine/src/readiness/compute-fidelity.ts`) over the same population `effectivePercent` counts. Today `computeFidelity` iterates `breakdown.substituted` unconditionally; under D7 it inherits the gating **for free** if (and only if) the engine change partitions `breakdown.substituted` itself into approved-only, with pending matches moved to a separate bucket — both derived fields would then read from one already-gated breakdown rather than needing two independent gating fixes. This card's design assumes that partitioning; it is the swaps workstream's engine change to make, not this workstream's, and should be confirmed against the actual `computeEffectiveReadiness` diff before this card ships, not assumed from this description alone.

The card's third line, "✓ Legal em Classic Constructed", is `LegalityBadge`'s existing `legal`-category text — reuse the component directly rather than re-deriving legality display logic; its `incomplete`/`illegal` states (with the reasons popover) still apply here, this card just becomes their new home instead of the sidebar.

**Pitch distribution** and **cost curve** cards are new client-side aggregations, not new backend data — every `IBreakdownEntry` in `breakdown.exact`/`substituted`/`notOwned` already carries `pitch: 1|2|3|null` and `cost: number|null` (confirmed in `api/deck-detail.ts`). Both cards are `reduce()`s over the already-loaded breakdown, computed once per render, no new query.

### 5.5 Falta comprar + Trocas panels (DECK-05) — confidence already travels end to end

**Correction to an earlier draft of this section**: it previously assumed `confidence` was a swaps-workstream-only field that hadn't reached the client yet, and designed a provisional `tier`-based color stand-in. That assumption was wrong — verified by tracing the field through every layer:

- **Engine**: `packages/engine/src/substitution/types.ts:5-10` — `ISubstitutionMatch.score: number`, a 0..1 value. Tier floors (`packages/engine/src/substitution/constants.ts`) are 0.70 (tier 2) and 0.90 (tier 1), so `score` is already exactly the confidence value the handoff renders as "92% confiança."
- **Persistence**: the engine's match objects, `score` included, are persisted verbatim into the snapshot's `breakdown` JSONB at compute time (`apps/api/src/decks/decks.service.ts`) — no separate migration needed for this field to exist historically.
- **API DTO**: `apps/api/src/decks/dtos/tracked-deck-detail.response.dto.ts:53-57` — `ISubstitutionEntry.score: number`, read straight back off the persisted breakdown.
- **Web type**: `apps/web/src/api/deck-detail.ts` — `ISubstitutionMatch.score: number`, already present.
- **Already rendered today**: `apps/web/src/components/deck-detail/SubstitutionRow.tsx:142` computes `scorePercent = Math.round(match.score * 100)` and renders it as a visible `N%` label plus a fill-bar (`row__scoreLabel`, `row__scoreFill`, driven by a `--score` CSS var) — no layer drops it. The only thing missing today is color-banding: `SubstitutionRow.module.css` currently renders the score label/fill in one fixed color (its own comment notes "the tier diamond already carry the primary semantic" — score is decorative today, not band-colored).

**Design for DECK-05**, with no new plumbing required: the "Trocas sugeridas" preview card is a `SubstitutionRow`-derived compact card (outgoing name struck-through `#c9938f` + thumbnail `opacity .5` → incoming thumbnail gold-bordered + name, "Você tem ×N" line, ✓/✕ actions wired to the existing `onApproveSubstitute`/`onRejectSubstitute` handlers already passed into `DeckCanvas`), with the existing `match.score` value driving both the numeric label **and** a new color band applied directly: `scorePercent >= 90` → `--ra-status-ready`, `70–89` → `--ra-accent`, `< 70` → `--warn` — exactly the handoff's and SWAP-12's stated bands, applied to a value that's already in hand. This also already carries the `× N` copy-grouping AD-005/D6 requires (`count` prop on `SubstitutionRow`, already shipped).

"Ver trocas" still depends on the full Swaps screen existing, which is a separate concern from confidence data: it **conditionally renders** — only shown once a `/swaps` route exists — otherwise the panel's own cards are the only trocas surface on this page. This is a routing/screen-existence question, not a data-availability one, and stays a light flag rather than the "no plumbing exists" problem this section previously described.

"O que falta comprar" reuses `ShoppingPanel`/`ShoppingLine`'s existing data and controls (`onFetchVariants`, cooldown, variant-fetch progress) — restyled into the handoff's row format (pitch-color bar, name, meta, "falta ×N" in `--miss`, "Comprar" button), not rebuilt.

### 5.6 Decklist (DECK-06, DECK-07, DECK-08)

**Correction to what's reusable here**: `groupBySlot`/`resolveSlotGroup` in `DeckCanvas.tsx` group by `TSlotGroup` (`mainboard | hero | weapon | equipment | other`) — a single `mainboard` bucket. The handoff's "Por tipo" grouping wants four buckets — **Attack Actions, Defense Reactions, Non-attacks, and Hero·Weapon·Equipment** — where the first three are card-**type** distinctions *within* what `groupBySlot` currently calls one `mainboard` bucket. `resolveSlotGroup` peels off Hero/Weapon/Equipment correctly and stays useful for that split; a new grouping function over `entry.type` (not `entry.slot`) is needed for the Attack/Defense/Non-attack split within mainboard. Do not treat `groupBySlot` as already satisfying "by type" — it satisfies roughly a quarter of it.

Three view modes (DECK-07): Por tipo (above), Por custo (`entry.cost` bucketed 0/1/2/3/4+, new), Lista (flat, no grouping, new). All three operate on the same already-loaded `breakdown` — client-side regrouping on toggle, no refetch, matching the requirement directly.

**Card thumbnails (DECK-08)**: already correct today — `BreakdownSections.tsx`, `EditableCardRow.tsx`, and `DeckCanvas.tsx` all already render `CardArt`, not a gradient placeholder. This requirement is about *not regressing* during the visual rebuild, not building new — the risk is a naive reimplementation of the new 6-column grid reaching for a simpler inline `<img>`/gradient instead of reusing `CardArt`'s fallback-chain component. Explicitly carry `CardArt` (with its `sources` cycling and `missing` hatch overlay) into the new grid; the missing badge (`×N` bottom-right, `--miss` border) is `CardArt`'s existing `missing` prop plus a new corner-badge overlay for the count, which doesn't exist on `CardArt` today and is the one small addition needed here.

### 5.7 What's explicitly out of this design

Per `01-foundation.md`, everything else on this page — colors, type, spacing, radii, the nav shell — is already covered by the foundation phase and consumed here for free via token names, not re-specified.

---

## 6. Data model deltas

| Change | Type | Owner |
|---|---|---|
| `IPatchDeckBody.format?: TSupportedFormat` | New field on existing endpoint | This workstream (§4.3) |
| Deck `notes` field (schema column + `IPatchDeckBody.notes?`, `IDeckDetailResponse.notes`) | New field, new column | This workstream (§4.2) — flagged as new backend scope beyond a token-driven restyle |
| Pitch distribution / cost curve | Client-side derivation from existing `IBreakdownEntry[]` | No backend change (§5.4) |
| `THomeGroup` + `GROUP_OF` mapping | Frontend-only display grouping | This workstream (§2.2) — no schema/API change, D5 compliant |
| Swap `confidence` (numeric) | Not delivered by this workstream | SWAP workstream, phase 7 (§5.5) |
| `CardArt` missing-count corner badge | New optional prop on existing component | This workstream (§5.6) |

---

## 7. Error handling strategy

| Scenario | Handling | User impact |
|---|---|---|
| Format PATCH fails (new field) | Same pattern as existing `usePatchDeckMutation` error handling in `StatusDropdown` — optimistic revert + toast with retry | No different from today's status-change error UX |
| Notes PATCH fails | Same pattern; inline field-level error preferred over a toast since notes can be long — mirrors `DeckDetailHeader`'s `saveError` inline-adjacent-to-button pattern | Notes stay in the form, not lost |
| Deck deletion fails | `AlertDialog` stays open, inline error shown, matches `delete-account-modal.tsx`'s existing 4xx/5xx handling shape | User isn't silently returned to a deck that wasn't actually deleted |
| Swaps route doesn't exist yet (phase-order gap, §5.5) | "Ver trocas" simply doesn't render | No broken link, no 404 |
| Deckbox/medallion receive `heroArtUrl: null` | Both black-box contracts (§1) specify a non-broken fallback | No layout break, matches Edge Cases in spec.md |

---

## 8. Tech decisions (non-obvious calls, summarized)

| Decision | Choice | Rationale |
|---|---|---|
| 5→4 status collapse | Read-side only; write path (edit screen) keeps `ready` reachable and never auto-rewrites it to `active` | D5 explicitly forbids changing the status vocabulary or the edit screen's expressible values (EDIT-03) |
| Group headers on Home | Not `.ra-h2` — own class, `--ra-font-ui` + `--ra-text-subtitle` + 700, `text-transform: none` | Resolves the item `01-foundation.md` explicitly deferred to this phase; handoff specifies a body-family treatment, not the display serif |
| "Editar" on deck detail | Points at a new dedicated metadata screen (`/decks/$deckId/edit`), not the existing composition-edit mode | Matches the handoff's §6 screen and EDIT-02..04 literally; composition editing is unaddressed by any requirement ID and is preserved unchanged under a different, flagged entry point |
| Format editing mutation | New `format` field on `IPatchDeckBody` (PATCH), not routed through `usePutDeckMutation` (PUT) | PUT requires the full card list; any incomplete payload from a metadata-only screen would silently delete cards |
| Notes field | New backend scope (schema + DTO + API), not a frontend-only addition | No existing slot anywhere in the deck data model |
| Trocas sugeridas data source at phase 5 | Existing `decisions`/`ISubstitutionMatch.tier` model with a provisional tier→confidence-band mapping | The new `Swap.confidence` model ships in phase 7, after this phase; sequencing gap flagged for the orchestrator, not silently absorbed |
| Decklist "by type" grouping | New grouping function over `entry.type`, `groupBySlot`/`resolveSlotGroup` only covers the Hero/Weapon/Equipment split | `groupBySlot` collapses all mainboard cards into one bucket; the handoff wants three type-based sub-buckets within mainboard |
| AggregateCallout | Preserved, relocated below the status groups | No slot in the handoff, but deleting a working data-driven feature the handoff's designer never saw is a worse default than keeping it |
| Retired-shelf collapse | Preserved on the Aposentados group specifically | Handoff draws no collapse affordance, but always-expanded is a regression for heavy users; flagged for confirmation |
| Per-tile legality icon (Home) | Dropped | No room on the new deckbox face; legality is one click away on deck detail — flagged as a real (not free) loss |

---

## 9. i18n

Every new/changed string needs both `pt-BR` and `en-US` catalog entries, following `decks.ts`'s existing per-component comment-grouped, flat-key convention, verified by the existing catalog-parity test (`apps/web/src/i18n/__tests__/catalog-parity.spec.ts`) and the `TTranslationResources` compile-time check. Concretely, this phase:

- **Retires** `decks.rawFidelity` (the concatenation string, §5.4) and adds separate raw/fidelity bar-caption keys.
- **Adds**: Home KPI strip labels, search placeholder, group hint lines (4), empty-group states, new deck-detail analysis-card labels (pitch distribution, cost curve), status-strip copy (both states), falta-comprar/trocas panel labels, decklist view-toggle labels (3), edit-screen field labels + notes placeholder + danger-zone copy + delete confirmation copy.
- **Reuses unchanged**: `STATUS_KEY_MAP`'s five existing status labels, `LegalityBadge`'s existing legal/incomplete/illegal strings, `ShoppingLine`'s existing shopping copy, `TagChipRow`'s existing tag-management strings.

---

## 10. Requirement traceability

| ID | Covered by |
|---|---|
| HOME-01 | §2.3 |
| HOME-02 | §2.2, §2.5 |
| HOME-03 | §2.2 |
| HOME-04 | §2.2, §2.5 (all-retired interaction noted) |
| HOME-05 | §2.4 |
| HOME-06 | §2.5 |
| HOME-07 | §2.7 |
| DECK-01 | §5.2 |
| DECK-02 | §5.3 |
| DECK-03 | §5.3 |
| DECK-04 | §5.4 |
| DECK-05 | §5.5 (phase-order gap flagged) |
| DECK-06 | §5.6 |
| DECK-07 | §5.6 |
| DECK-08 | §5.6 |
| DECK-09 | §5.3 |
| EDIT-01 | §3 |
| EDIT-02 | §4.1, §4.2 |
| EDIT-03 | §2.2, §4.2 |
| EDIT-04 | §4.4 |

Not covered here: CMP (medallion internals), BOX (deckbox internals), LIB, SWAP (backend lifecycle + full Swaps screen), the Settings panel of "P2: New/Edit/Settings", AUTH — each is owned by a different workstream and consumed here only through the black-box contracts in §1 or the explicitly-flagged sequencing gap in §5.5.

---

## 11. Open items requiring confirmation before or during implementation

1. **Composition-edit entry point label/location** (§4.6) — default given (decklist-header "Editar cartas"), needs a quick owner confirmation since neither the handoff nor spec draws it.
2. **Per-tile legality icon removal on Home** (§2.5) — a real loss for users scanning many decks at once, not obviously acceptable; flagged rather than silently dropped.
3. **Retired-shelf collapse behavior** (§2.5) — this workstream's addition, not in the handoff; confirm it's wanted before implementing.
4. **AggregateCallout's continued existence** (§2.6) — same category as #3.
5. **Notes field backend scope** (§4.2, §6) — new column + DTO + API surface; confirm this is accepted as part of this workstream rather than deferred.
6. **Format-on-PATCH backend scope** (§4.3, §6) — smaller than #5 but still new backend work; confirm accepted.
7. **DECK/SWAP phase-order gap** (§5.5) — flagged for the orchestrator; this design proceeds with a provisional data source but does not resolve the sequencing question.
8. **Overflow ("···") button's fate on the hero banner** (§5.2) — may end up empty once Untrack moves to the danger zone; confirm whether anything else belongs there or it should be dropped.
9. **"Comprar tudo" bulk-buy action** (§5.3) — assumed to reuse existing `ShoppingPanel` bulk functionality; confirm that functionality exists in the form DECK-02 implies.
