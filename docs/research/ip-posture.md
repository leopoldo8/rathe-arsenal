---
title: "IP Posture — Rathe Arsenal vs Legend Story Studios (LSS)"
status: decided-pending-phase-2-activation
owner: Rodrigo
opened: 2026-04-19
last-updated: 2026-04-19
blocks: "Any Phase 2 monetization activation (ads, Patreon, donations, affiliate links). Any rebrand/commercialization pivot. Any public-facing expansion beyond the ~47-person Pelotas FaB closed beta."
supersedes: "Ad-hoc assumptions in docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md (non-commercial framing) and docs/ideation/2026-04-08-fab-library-manager-ideation.md (LSS copyright note). Those docs touch the topic tangentially; this file is now the single source of truth for the IP posture."
---

> **Purpose.** Rathe Arsenal is built entirely on top of IP owned by Legend Story Studios (LSS) — card images, hero names, card names, rules text, keywords, and worldbuilding terms (including "Rathe" itself). Before the project activates any monetization surface (ads, Patreon, affiliate links) or expands beyond closed beta, the IP posture must be explicit, defensible, and documented against LSS's actual written policy. This file is that documentation.
>
> **Scope.** This is a product/legal-posture document, not a legal opinion. The author is not a lawyer. When monetization activates or ambiguity arises, this document points to triggers that require a human re-read of the LSS policy and, in high-stakes cases, consultation with a qualified IP lawyer.
>
> **Rule.** When any of the triggers in the "Phase 2 activation checklist" below fires, re-read the LSS policy page (link and retrieval date below), update this file, and open a Phase 2 follow-up entry before shipping the monetization surface.

---

## Decision — Option A: Fan Project with Indirect Monetization

The project commits to **Option A** from the 2026-04-19 brainstorm thread:

- Perpetual fan-project posture. No direct sale, no paywall, no premium tier.
- Monetization — if and when activated in Phase 2 — is limited to **indirect** channels explicitly permitted by the LSS Fan Content Policy: **display ads (AdSense-style)** and **Patreon donations**.
- The product stays on the LSS-dependent ecosystem (Flesh and Blood cards, heroes, keywords, imagery). No rebrand, no pivot to a generic multi-TCG tool. If the project ever wants to charge for access, this decision is revisited end-to-end.

Options explicitly rejected on 2026-04-19:

- **Option B (seek formal LSS license):** deferred — not worth pursuing until the product has meaningful usage to propose as leverage. Not foreclosed for later, but not on the Phase 2 roadmap.
- **Option C (rebrand + multi-TCG pivot):** rejected — the product value prop is deeply FaB-specific (hero-to-deck substitution, Cúpula DT inventory, PT-BR card aliases). Rebranding as a generic deckbuilder would lose the value prop and the audience.

---

## What the LSS Policy Actually Says

**Source.** `https://fabtcg.com/resources/terms-use-licensed-assets/` ("Terms of Use for Game and Studio Assets and IP"). Direct `WebFetch` returns 403 against automated fetchers (same edge-layer block pattern observed against `fabrary.net` in the Phase 1b compliance log). Content below is quoted from Anthropic web-search result extracts retrieved on **2026-04-19**. Before activating monetization in Phase 2, the policy must be re-read end-to-end through a real browser session (Playwright MCP, same protocol used for Fabrary ToS retrieval in `phase-1b-compliance-log.md`) and the verbatim relevant sections pasted into an updated revision of this file. The retrieval-via-search-extract approach here is provisional, not authoritative.

**Relevant clauses (as retrieved 2026-04-19, pending full-policy verbatim re-retrieval):**

### Content Creation (general)

> "You may use the FAB Card Images in the creation of Flesh and Blood related videos (ie. YouTube videos) and written content. You may indirectly monetize this content (such as ad-sense on YouTube videos and website traffic)."

### Platforms and Services (the Rathe Arsenal case)

> "For platforms and services like card databases, singles websites, and singles marketplaces, you may not monetize these directly without express permission except through the sale of the game itself, but you may indirectly monetize this content through Patreon and ad-sense."

### Fan Fiction (worldbuilding, including "Rathe")

> "You are granted the non-exclusive, revocable permission to create Fan Fiction set within the Flesh and Blood universe and the land of Rathe, featuring the characters of Flesh and Blood. You may not directly monetize this content and the Studio retains the IP rights to these Fan Fiction in all cases."

### Required Disclaimer

> "[Your entity name] is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright."

### Revocability

The permission is "non-exclusive, revocable" in all sections. LSS can withdraw any of the above authorizations at any time. The project must be able to remove LSS-derived assets on short notice.

---

## Allowed vs Not Allowed — Operational Matrix

| Surface | Status under the LSS policy | Notes |
|---|---|---|
| Display ads (AdSense / Ezoic / direct) | **Allowed (indirect monetization)** | Keep them non-intrusive — no interstitials, popups, or autoplay video. |
| Patreon donations / membership | **Allowed (indirect monetization)** | Perks must not gate IP-dependent features (see "Patreon perks" rule below). |
| Affiliate links to licensed retailers (TCGPlayer, Cardmarket, Cúpula DT itself) | **Ambiguous — permissible as "indirect"** | Not explicitly named but aligned with the spirit of "indirect". Re-evaluate if/when activated. |
| Paid subscription / premium tier gating features | **Not allowed without express permission** | This is "direct monetization" — would require a formal LSS license. |
| Selling the product or source code | **Not allowed** | Direct transfer of value dependent on LSS IP. |
| White-label the product for a third party | **Not allowed** | Same reasoning. |
| Displaying card images from `@flesh-and-blood/cards` dataset | **Allowed for non-commercial / indirect-monetized surfaces** | Permission is revocable — must support rapid takedown. |
| Using "Rathe", hero names, card names, keywords in UI copy | **Allowed under Fan Fiction clause and Content Creation clause** | Required disclaimer must be present. |
| Using LSS logos, FaB official logo, set symbols as brand elements | **Not allowed** | The project must use its own wordmark/logo-mark. Already the case (UnifrakturCook "Rathe" wordmark + deckbox SVG are original assets). |

---

## Required Disclaimer — Exact Text and Placement

Verbatim text to surface in-product and in the repository:

> Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.

**Placement (required before Phase 2 monetization activates, recommended from v1 launch):**

1. **Site footer** — every page, small-but-readable body text, linkable to an `/about` or `/legal` page.
2. **`/about` page** — prominent section with the full disclaimer plus context ("Rathe Arsenal is a fan project...").
3. **Repository `README.md`** — top-of-file disclaimer block, above the technical setup instructions.
4. **App store listings** (if/when the project ships as a PWA/native shell) — in the description.
5. **Patreon page** (if/when created) — in the "About" section.

The disclaimer is a hard requirement of the LSS policy. It is not a best-effort nicety.

---

## Operational Rules

These rules are binding once Phase 2 monetization activates. Some apply immediately (disclaimer, no paywall, takedown-ready) regardless of monetization.

1. **No paywall, no premium tier.** Any feature-gating-by-payment is "direct monetization" and requires express LSS permission the project does not have.
2. **Ads stay indirect and non-intrusive.** AdSense / Ezoic standard placements. No video interstitials, no popups, no autoplay, no affiliate schemes that disguise as content.
3. **Patreon perks must not gate IP-dependent features.** Acceptable perks: badge/cosmetics, early access to *own* engineering changes (tokens, UI refreshes), public-roadmap voting, credits line in the site. **Not acceptable**: locking decks, card search, substitution engine output, deck history, or any surface that depends on the `@flesh-and-blood/cards` dataset or card imagery behind a patron-only tier.
4. **Disclaimer is unconditional.** It ships in the footer, `/about`, `README.md`, and Patreon page from the first monetization activation — ideally from v1 launch regardless of monetization.
5. **Takedown-ready architecture.** The card-image surface (`CardArt`, image-proxy, cached assets) must support removal of specific cards, sets, or the entire dataset within 48 hours of an LSS request. Image URLs should be resolvable via a single config switch that can point to local assets, a proxy, or nothing. If LSS sends a revocation notice, compliance is the default response — no arguing.
6. **No claim of partnership or endorsement.** Never describe the project as "official", "approved", "partnered", or "endorsed" unless an actual signed agreement exists. Language on the site, social media, and any ad copy must reflect the fan-project posture.
7. **Patreon tiers priced in BRL or USD, not in abstract "credits" tied to the product.** Anything resembling in-product currency or loot-box mechanics would re-open the direct-monetization question.
8. **Policy revocability is accepted.** If LSS changes the Fan Content Policy in a way that prohibits any currently-active surface, the project pulls that surface. No grandfathering expectations.
9. **No data resale.** Aggregated telemetry (Phase 1c's `outbound_click_event` table, readiness snapshots, Cúpula DT scrape results) is for internal product decisions only. Selling it, licensing it to a third party, or exposing it through a paid API crosses into direct monetization of LSS-adjacent data.
10. **Keep the v1 wordmark and logo-mark original.** The "Rathe" word (fan-fiction-clause covered) is used in a wordmark built from UnifrakturCook, paired with an original deckbox SVG. No LSS typography, no FaB logo, no set symbols.

---

## Precedent — How the Ecosystem Operates Under the Same Policy

**Fabrary** (deckbuilder + card search, closest peer):

- Public Patreon with **941 members** as of 2026-04-19 (verified).
- Lowest visible tier: BRL 20/month. Multiple tiers likely exist.
- No public "ledger" of hosting costs vs donations. The LSS policy does not require one; "indirect monetization" via Patreon is permitted regardless of volume.
- No paywall on deck builder features. Patreon perks appear cosmetic / early-access / gratitude-oriented.
- Disclaimer present in site footer.

**The Pitch Zone:**

- Reported to have a Patreon-gated deck builder. This is closer to "tier-gated feature" than pure indirect monetization, and sits in the ambiguous zone the project commits to **avoid** (Rule #3 above). Cited here only as a data point, not as a model to follow.

**Implication for Rathe Arsenal:**

Fabrary's operating mode is the intended reference model. 941 patrons × BRL 20 (conservative estimate) = >BRL 18k/month, which plausibly exceeds hosting costs by an order of magnitude. LSS tolerates this because the policy **explicitly permits** Patreon and AdSense — the surplus-over-hosting distinction is irrelevant to the policy text. Rathe Arsenal can operate under the same principle without a public financial ledger or surplus-justification disclosure.

---

## Phase 2 Activation Checklist — What Must Happen Before Monetization Ships

Rathe Arsenal does not activate any monetization surface until all of the following are true. This checklist **is** the Phase 2 follow-up item for the monetization question — when `phase-2-followups.md` is created, copy this section verbatim into it and mark this file as the upstream source.

- [ ] **Re-retrieve the full LSS policy** through a real-browser session (Playwright MCP protocol, same as Phase 1b compliance log). Paste verbatim Content Creation, Platforms and Services, Fan Fiction, and Disclaimer sections into a new revision of this file. Update the `last-updated` frontmatter.
- [ ] **Diff the re-retrieved policy against the 2026-04-19 extract in this file.** Flag any clause change affecting direct/indirect monetization, card image usage, or disclaimer requirements. If the diff is material, re-run this entire decision before proceeding.
- [ ] **Disclaimer surfaces are live** — footer on every route, `/about` page section, `README.md` header block, Patreon "About" section (if Patreon activates). Screenshot evidence archived in `docs/research/ip-posture-evidence/`.
- [ ] **Takedown path is exercised at least once** — add a dry-run admin command that removes a chosen card image from the rendered surface within 5 minutes, end-to-end, before Phase 2 ships. This proves Rule #5 is real, not aspirational.
- [ ] **Patreon tier design is reviewed against Rule #3** — written rationale for each tier's perks, confirming none gate IP-dependent features. File: `docs/research/patreon-tier-design.md` (create when Patreon activates).
- [ ] **Ad placement plan is reviewed against Rule #2** — wireframes or screenshots of each ad slot, no interstitial/popup/autoplay. File: `docs/research/ad-placement-plan.md` (create when ads activate).
- [ ] **Legal counsel read** — before flipping any monetization switch, at least one consultation with an IP lawyer familiar with gaming/TCG IP in the relevant jurisdiction (Brazil for the entity, US for LSS). This is cheap insurance and catches issues this document cannot. Budget ~1-2 hours of billable time.
- [ ] **LSS courtesy notification (optional but recommended)** — a polite email to LSS before public launch with a Patreon/ads surface, describing the project and confirming the posture. Not a license request, not a permission ask; just transparency. Silence is not approval but creates a good-faith record.

---

## Triggers That Force a Re-Read of This Document

Whenever any of the following becomes true, re-read this file, re-retrieve the LSS policy, and update accordingly. Do not ship past the trigger without the re-read.

1. **Monetization activation** — first time ads, Patreon, or affiliate links go live (this is the "Phase 2 activation" above).
2. **Paywall consideration** — any product discussion that mentions gating features behind payment. Re-read Rule #1 and Section "Allowed vs Not Allowed"; if the team still wants to proceed, the decision escalates to Option B (seek LSS license).
3. **LSS policy change** — any observable change to `https://fabtcg.com/resources/terms-use-licensed-assets/`. Set a manual recurring check (quarterly) until an automated watcher exists.
4. **LSS contact** — any direct communication from LSS (cease-and-desist, partnership invitation, policy clarification, informal Discord DM). Log the communication verbatim under `docs/research/lss-communications/` and re-read this file before responding.
5. **Audience scale-up** — project exceeds 1,000 MAU or 100 paying patrons. At that scale the visibility-to-LSS changes; it is worth re-confirming posture.
6. **Rebrand or pivot discussion** — any serious consideration of dropping the "Rathe Arsenal" name, pivoting to multi-TCG, or commercializing the engine. This unlocks Option B or Option C and requires a fresh decision doc.
7. **Jurisdiction change** — if the project incorporates, moves primary operations, or adds a co-owner in a different jurisdiction, re-run the legal-counsel step.
8. **Card-image source change** — if the project stops using `@flesh-and-blood/cards` and switches to a different image source, the permission basis changes and this file must be updated.

---

## Open Questions / Known Ambiguities

1. **Affiliate links** — "indirect monetization" is named for Patreon and AdSense; affiliate commissions from licensed retailers are analogous but not explicitly covered. Practical read: low risk, consistent with the spirit of the clause, but worth the legal-counsel read before activation.
2. **Patreon physical rewards** — if Patreon tiers ever include physical goods (stickers, playmats, alt-art), those likely cross into merchandise territory and violate the Fan Art commercial-manufacturing prohibition. Keep Patreon perks digital-only by default.
3. **Open-source licensing** — the repository is currently private. If it goes public under a permissive license (MIT, Apache), third parties could fork and directly monetize — which is their problem, not the project's, but the README should make the fan-project posture explicit to reduce bad-faith forks.
4. **The "non-exclusive, revocable" clause is a material overhang** — at any point, LSS can pull permission. The product architecture (Rule #5) must treat this as a known operational risk, not a hypothetical one.

---

## Sources

- **LSS Fan Content Policy / Terms of Use for Game and Studio Assets and IP** — `https://fabtcg.com/resources/terms-use-licensed-assets/` (retrieved via web-search extract on 2026-04-19; direct `WebFetch` returns 403; full verbatim retrieval pending Phase 2 activation).
- **FaBrary on Patreon** — `https://www.patreon.com/fabrary` (retrieved 2026-04-19, 941 members, lowest visible tier BRL 20/month).
- **FaBrary ToS (already logged for Phase 1b)** — see `docs/research/phase-1b-compliance-log.md` Entry 1.
- **Related project decisions** — `docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md` (non-commercial framing), `docs/ideation/2026-04-08-fab-library-manager-ideation.md` (LSS copyright note).
