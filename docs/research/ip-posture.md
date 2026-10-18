---
title: "IP Posture — Rathe Arsenal vs Legend Story Studios (LSS)"
status: decided-pending-phase-2-activation
owner: Rodrigo
opened: 2026-04-19
last-updated: 2026-10-18
blocks: "Any Phase 2 monetization activation (ads, Patreon, donations, affiliate links). Any rebrand/commercialization pivot. Incorporating the project as a commercial entity."
supersedes: "Ad-hoc assumptions in docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md (non-commercial framing) and docs/ideation/2026-04-08-fab-library-manager-ideation.md (LSS copyright note). Those docs touch the topic tangentially; this file is now the single source of truth for the IP posture."
---

> **Purpose.** Rathe Arsenal is built entirely on top of IP owned by Legend Story Studios (LSS) — card images, hero names, card names, rules text, keywords, and worldbuilding terms (including "Rathe" itself). Before the project activates any monetization surface (ads, Patreon, affiliate links) or expands beyond closed beta, the IP posture must be explicit, defensible, and documented against LSS's actual written policy. This file is that documentation.
>
> **Scope.** This is a product/legal-posture document, not a legal opinion. The author is not a lawyer. When monetization activates or ambiguity arises, this document points to triggers that require a human re-read of the LSS policy and, in high-stakes cases, consultation with a qualified IP lawyer.
>
> **Rule.** When any of the triggers in the "Phase 2 activation checklist" below fires, re-read the LSS policy page (link and retrieval date below), update this file, and open a Phase 2 follow-up entry before shipping the monetization surface.

---

## Review — 2026-10-18

Triggered by the sharing design (`.design/sharing.md`): share links make pages with card images visible to people without an account.
The full policy page was retrieved verbatim on 2026-10-18 (a plain HTTPS request with a browser user agent returned it; the April 403 did not recur) and compared with the April search extract.

**Where the April posture was stricter than the policy.**
The policy has no audience-size condition anywhere.
"Card databases, singles websites, and singles marketplaces" are public by nature and are named as approved uses of card images, and Service Apps are approved without any limit on who can see them.
The April block on "any public-facing expansion beyond the ~47-person Pelotas FaB closed beta" was a self-imposed caution, not a policy requirement, and is removed.
The "1,000 MAU or 100 patrons" re-read trigger is likewise not grounded in the policy and is removed.
Public pages, share links, and user-to-user sell and want lists are permitted, provided the rules below hold.

**Where the April posture missed requirements the policy states.**
1. **Third Party Apps have their own disclaimer**, and Rathe Arsenal is a Service App ("card databases, life counter applications, and other similar services"). The live disclaimer is the Fan Fiction wording; the Third Party Apps wording is the one that applies.
2. **"© Legend Story Studios" is required in all cases where card images are used.** The April extract did not carry this sentence; no surface shows it today.
3. **Third Party Apps may not be created by a commercial entity.** Incorporating the project would remove the permission it currently relies on, so it is now a blocker in the frontmatter.
4. **FAB logos may not be used in Third Party Applications** - consistent with Rule 10, now explicit in the policy.

**Gaps to close:**
- [x] Replace the live disclaimer (footer, `/about`, anonymous auth screens, `README.md`, both locales) with the Third Party Apps wording in "Required Disclaimer" below. Done in PR #151.
- [x] Show "© Legend Story Studios" on every surface that shows card images, including generated share images. Done for every existing surface in PR #151 (the disclaimer ends with the line, and the full-screen scanner, which has no footer, shows it on its own); generated share images carry it per `.design/sharing.md` Key decision 1.

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

**Source.** `https://fabtcg.com/resources/terms-use-licensed-assets/` ("Terms of Use for Game and Studio Assets and IP"), retrieved verbatim on **2026-10-18**. The page states it "may be updated at any time without prior notice" and carries no version or date, so the retrieval date is the only version marker. The sections below are quoted exactly; sections that do not bear on Rathe Arsenal (art prints, cosplay, artist portfolios, card alts, store decoration) are omitted.

### Flesh and Blood Card Images (the sections Rathe Arsenal relies on)

> You are granted the non-exclusive and revocable permission to use Flesh and Blood card face images (referred to hereinafter as the “FAB Card Images”) for the following Approved Purposes:
>
> **Platforms and Services** – You may use the FAB Card Images for the creation of card databases, singles websites, and singles marketplaces. You may not monetize these platforms directly without express permission except through the sale of the Game (including the sale of single cards in the case of singles websites). You may indirectly monetize this content (for example, Patreon and ad-sense). Your permission to use the FAB Card Images in this manner is at the sole discretion of the Studio.
>
> **Content Creation** – You may use the FAB Card Images in the creation of Flesh and Blood related videos (ie. YouTube videos) and written content. You may indirectly monetize this content (such as ad-sense on YouTube videos and website traffic). You may not directly monetize this content where there is a transferral of ownership or sale of the underlying IP (ie. selling the rights to a video that contains said Assets to a third party). You may not use the FAB Card Images in a way that is derogatory or could unfairly damage the reputation of the Studio.
>
> In all cases where the FAB Card Images are used, you must provide the appropriate copyright disclaimer: “© Legend Story Studios”.

### Flesh and Blood Third Party Applications (what Rathe Arsenal is)

> You are granted the non-exclusive and revocable permission to create software and third party applications (collectively referred to hereinafter as “Third Party Apps”) for the following Approved Purposes:
>
> **Providing a Related Service** – You may create Third Party Apps that provide a service (“Service Apps”) that relates to the Game, and use assets to create said service in a way that is in compliance with the rest of this document. Examples of Service Apps include card databases, life counter applications, and other similar services. You may not directly monetize Service Apps (for example, selling it or selling subscriptions to it) without express written permission. You may indirectly monetize Service Apps (for example, Patreon and ad-sense).
>
> **APIs** – You may create APIs that transfer content related to the Game as long as said API is not directly monetized, and the usage of content related to the Game by the recipient of the content is compliant with the rest of this document.
>
> All Third Party Apps must include the following disclaimer; “[Your app name] is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios.”
>
> You may not create Third Party Apps if you are a commercial entity.
>
> **Warning** – The Studio reserves the right to revoke your permission to continue operating the Third Party Apps at any time, at the sole discretion of the Studio.

### Flesh and Blood Logos

> **Use in Art Prints, Cosplay, Fan Fiction, Fan Art, and Third Party Applications** – You may not use the FAB Logos in the production of Art Prints, Cosplay, Fan Fiction, Fan Art, and Third Party Applications.

### Passing Off (Assets)

> **Passing Off** – You may not use the Assets in any way that may result in mis-representation of the ownership of the Assets, or mis-identification of your company, media accounts, content, or marketing with the official Flesh and Blood trademark, the official Flesh and Blood media accounts, official Flesh and Blood content, or official Flesh and Blood marketing. You may not create the appearance, either implicit or explicit, of endorsements or affiliate relationship to the Game and the Studio without prior written approval.

### Fan Fiction (worldbuilding, including "Rathe")

> You are granted the non-exclusive, revocable permission to create Fan Fiction set within the Flesh and Blood universe and the land of Rathe, featuring the characters of Flesh and Blood. Unless otherwise permitted to do so in writing, you must provide the appropriate clarifying statement: “[Your entity name] is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.” You may not directly monetize this content and the Studio retains the IP rights to these Fan Fiction in all cases.

### Enforcement

> This page may be updated at any time without prior notice. Violators of these Terms will be notified of the violation with a few friendly warnings, except in the case of malicious and intentional noncompliance. Violations by any commercial entity or during the course of any commercial undertaking may be met with immediate legal action.

### Revocability

Every grant is "non-exclusive and revocable", and Platforms and Services adds that permission is "at the sole discretion of the Studio". LSS can withdraw any of the above at any time. The project must be able to remove LSS-derived assets on short notice.

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
| Displaying card images from `@flesh-and-blood/cards` dataset | **Allowed for non-commercial / indirect-monetized surfaces** | Permission is revocable — must support rapid takedown. "© Legend Story Studios" must accompany them. |
| Pages visible without an account (share links, public deck and list pages) | **Allowed** (Platforms and Services; Service Apps) | The policy sets no audience limit. Each such page carries the disclaimer and the copyright line itself, since it is not inside the authenticated shell. |
| Generated images that compose card faces (link previews, share images) | **Our reading: allowed** as part of the platform; not named in the policy | Must carry "© Legend Story Studios", only the project's own wordmark, nothing that reads as official; covered by the takedown switch like any other card-image surface. |
| User-to-user sell and want lists | **Allowed** ("singles marketplaces" are a named approved use) | The project takes no fee or commission on sales; doing so would be direct monetization. |
| Using "Rathe", hero names, card names, keywords in UI copy | **Allowed under Fan Fiction clause and Content Creation clause** | Required disclaimer must be present. |
| Using LSS logos, FaB official logo, set symbols as brand elements | **Not allowed** | The project must use its own wordmark/logo-mark. Already the case (UnifrakturCook "Rathe" wordmark + deckbox SVG are original assets). |

---

## Required Disclaimer — Exact Text and Placement

Verbatim text to surface in-product and in the repository (the Third Party Apps wording, followed by the card-image copyright line; changed 2026-10-18):

> Rathe Arsenal is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios. © Legend Story Studios

The text shipped on 2026-07-01 is the Fan Fiction wording ("... Characters and names may be protected by copyright.") and was replaced on 2026-10-18 (PR #151).

**Placement (required before Phase 2 monetization activates, recommended from v1 launch):**

1. **Site footer** — every page, small-but-readable body text, linkable to an `/about` or `/legal` page; pages outside the authenticated shell (share links) carry it themselves.
2. **`/about` page** — prominent section with the full disclaimer plus context ("Rathe Arsenal is a fan project...").
3. **Repository `README.md`** — top-of-file disclaimer block, above the technical setup instructions.
4. **App store listings** (if/when the project ships as a PWA/native shell) — in the description.
5. **Patreon page** (if/when created) — in the "About" section.

The disclaimer is a hard requirement of the LSS policy. It is not a best-effort nicety.

**Status (2026-07-01) — disclaimer surfaces are LIVE.** Shipped in `feat/pre-launch-hardening` (`.specs/features/pre-launch-hardening/`): placement #1 (site footer, in the authenticated app shell, linking to `/about`), #2 (the `/about` page with the full disclaimer + fan-project context), and #3 (`README.md` top-of-file block) are all live, plus the disclaimer on the anonymous auth screens. Text is localized (pt-BR / en-US) with the en-US string verbatim from this section. Placements #4 (app-store listing) and #5 (Patreon "About") remain deferred until those surfaces exist. The remaining Phase 2 activation-checklist items (screenshot evidence archive, takedown dry-run, legal-counsel read) still stand — this covers only the disclaimer-live requirement, not the full monetization gate. **Update (2026-10-18):** these surfaces now show the Third Party Apps wording ending in "© Legend Story Studios" (PR #151).

---

## Operational Rules

These rules are binding once Phase 2 monetization activates. Some apply immediately (disclaimer, no paywall, takedown-ready) regardless of monetization.

1. **No paywall, no premium tier.** Any feature-gating-by-payment is "direct monetization" and requires express LSS permission the project does not have.
2. **Ads stay indirect and non-intrusive.** AdSense / Ezoic standard placements. No video interstitials, no popups, no autoplay, no affiliate schemes that disguise as content.
3. **Patreon perks must not gate IP-dependent features.** Acceptable perks: badge/cosmetics, early access to *own* engineering changes (tokens, UI refreshes), public-roadmap voting, credits line in the site. **Not acceptable**: locking decks, card search, substitution engine output, deck history, or any surface that depends on the `@flesh-and-blood/cards` dataset or card imagery behind a patron-only tier.
4. **Disclaimer is unconditional.** It ships in the footer, `/about`, `README.md`, and Patreon page from the first monetization activation — ideally from v1 launch regardless of monetization.
5. **Takedown-ready architecture.** The card-image surface (`CardArt`, image-proxy, cached assets) must support removal of specific cards, sets, or the entire dataset within 48 hours of an LSS request. Image URLs should be resolvable via a single config switch that can point to local assets, a proxy, or nothing. If LSS sends a revocation notice, compliance is the default response — no arguing. **State on 2026-10-18:** no such switch exists; every card face is loaded directly from LSS's own public bucket (a constant in the engine catalog), so LSS controls removal at the source. Any copy the project stores - generated share images first - must be deletable on request, per card or all at once, without a deploy.
6. **No claim of partnership or endorsement.** Never describe the project as "official", "approved", "partnered", or "endorsed" unless an actual signed agreement exists. Language on the site, social media, and any ad copy must reflect the fan-project posture.
7. **Patreon tiers priced in BRL or USD, not in abstract "credits" tied to the product.** Anything resembling in-product currency or loot-box mechanics would re-open the direct-monetization question.
8. **Policy revocability is accepted.** If LSS changes the Fan Content Policy in a way that prohibits any currently-active surface, the project pulls that surface. No grandfathering expectations.
9. **No data resale.** Aggregated telemetry (Phase 1c's `outbound_click_event` table, readiness snapshots, Cúpula DT scrape results) is for internal product decisions only. Selling it, licensing it to a third party, or exposing it through a paid API crosses into direct monetization of LSS-adjacent data.
10. **Keep the v1 wordmark and logo-mark original.** The "Rathe" word (fan-fiction-clause covered) is used in a wordmark built from UnifrakturCook, paired with an original deckbox SVG. No LSS typography, no FaB logo, no set symbols.
11. **"© Legend Story Studios" wherever card images appear.** Every page, generated image, or export that shows a card face carries the line; the policy says "in all cases".
12. **No commercial entity.** Third Party Apps may not be created by a commercial entity, so the project stays a personal project; incorporating it requires a license first (Option B).

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

- [ ] **Re-retrieve the full LSS policy** and diff it against the last verbatim retrieval (2026-10-18, in "What the LSS Policy Actually Says"). Re-do this at activation time even though it was done on 2026-10-18 - the page changes without notice.
- [x] **Diff against the 2026-04-19 extract** - done 2026-10-18; findings in "Review — 2026-10-18".
- [~] **Disclaimer surfaces are live, with the Third Party Apps wording since PR #151** — ✅ footer (authenticated shell), ✅ `/about` page section, ✅ `README.md` header block, ✅ anonymous auth screens, all shipped 2026-07-01 in `feat/pre-launch-hardening`. Still pending: Patreon "About" section (if Patreon activates) and screenshot evidence archived in `docs/research/ip-posture-evidence/`.
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
5. **Rebrand or pivot discussion** — any serious consideration of dropping the "Rathe Arsenal" name, pivoting to multi-TCG, or commercializing the engine. This unlocks Option B or Option C and requires a fresh decision doc.
6. **Incorporation or jurisdiction change** — incorporating the project removes the Third Party Apps permission (Rule 12); moving primary operations or adding a co-owner in a different jurisdiction re-runs the legal-counsel step.
7. **New surface that shows card images outside the app** — exports, generated images, embeds, an API. Check it against Rules 5 and 11 before it ships.
8. **Card-image source change** — if the project stops using `@flesh-and-blood/cards` and switches to a different image source, the permission basis changes and this file must be updated.

---

## Open Questions / Known Ambiguities

1. **Affiliate links** — "indirect monetization" is named for Patreon and AdSense; affiliate commissions from licensed retailers are analogous but not explicitly covered. Practical read: low risk, consistent with the spirit of the clause, but worth the legal-counsel read before activation.
2. **Patreon physical rewards** — if Patreon tiers ever include physical goods (stickers, playmats, alt-art), those likely cross into merchandise territory and violate the Fan Art commercial-manufacturing prohibition. Keep Patreon perks digital-only by default.
3. **Open-source licensing** — the repository is currently private. If it goes public under a permissive license (MIT, Apache), third parties could fork and directly monetize — which is their problem, not the project's, but the README should make the fan-project posture explicit to reduce bad-faith forks.
4. **The "non-exclusive, revocable" clause is a material overhang** — at any point, LSS can pull permission. The product architecture (Rule #5) must treat this as a known operational risk, not a hypothetical one.

---

## Sources

- **LSS Fan Content Policy / Terms of Use for Game and Studio Assets and IP** — `https://fabtcg.com/resources/terms-use-licensed-assets/` (web-search extract on 2026-04-19; full verbatim retrieval on 2026-10-18 by plain HTTPS request with a browser user agent).
- **FaBrary on Patreon** — `https://www.patreon.com/fabrary` (retrieved 2026-04-19, 941 members, lowest visible tier BRL 20/month).
- **FaBrary ToS (already logged for Phase 1b)** — see `docs/research/phase-1b-compliance-log.md` Entry 1.
- **Related project decisions** — `docs/brainstorms/2026-04-08-fab-deck-readiness-flow-requirements.md` (non-commercial framing), `docs/ideation/2026-04-08-fab-library-manager-ideation.md` (LSS copyright note).
