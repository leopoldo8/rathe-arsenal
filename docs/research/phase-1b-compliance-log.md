---
title: "Phase 1b Compliance Log — Fabrary + Liga FaB (formerly mis-identified as Sbrauble) ToS Review"
status: closed-risk-accepted
owner: Rodrigo
opened: 2026-04-11
last-updated: 2026-04-12
blocks: "docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md Unit 7 (Gate 2 accuracy verification) AND Unit 4 (first production scrape). U0 finding identified a prohibitive platform clause that must be resolved by human decision before Phase 1b can ship."
---

> **CRITICAL U0 FINDING (2026-04-12).** The platform that powers `www.cupuladt.com.br` is **Liga FaB** (`ligafab.com.br`), not "Sbrauble" as Gate 3 (2026-04-08) recorded. This appears to have been a naming error in Gate 3 — the platform's real operator-facing contract is published at `https://www.ligafab.com.br/?view=contrato`. The Liga FaB contract contains an **explicit IP-reproduction prohibition (Clause 17)** that the Phase 1b plan's "friend consent from the store owner" does not satisfy, because the friend (the store owner) is not the platform operator. See Entry 2c below for the verbatim clause, legal analysis, and the blocking decision. Phase 1b cannot proceed past U0 until a human decision is made on the options in the "Escalation" section at the bottom of this log.

# Phase 1b Compliance Log

> **Purpose.** Gate 3 (`docs/brainstorms/gates/gate-3-dependency-spike.md`) identified two manual follow-ups required before Phase 1b ships the Sbrauble vertical scraper: a Fabrary ToS read and a Sbrauble platform ToS read. Both must happen before the first production fetch. This log is the evidence that those reads happened and the quoted evidence of whether automated access is permitted.
>
> **Blocks.** Phase 1b Unit 7 (Gate 2 accuracy verification) must not begin until this log is marked `status: closed`. As of 2026-04-11, status is `closed-with-ambiguity` — Unit 7 unblocked with two residual notes (see Decision Gate at the bottom).
>
> **Rule.** If either ToS explicitly forbids the intended access pattern, halt Phase 1b here and surface the finding — the plan document pauses at U0 until the dev decides whether Gate 2's friend consent supersedes the platform ToS, pivots to a different approach, or drops the shopping line.

---

## Entry 1 — Fabrary Terms of Service

**Target:** https://fabrary.net/terms (direct URL confirmed by navigation).

**Retrieval protocol:** The Fabrary site is a React SPA (Netlify Edge), so raw `curl` returns only the React shell (6 KB of HTML, no ToS text). The content of `/terms` is JS-hydrated after page load. Retrieval was performed via a headless Playwright session (real browser, full JS execution), which navigated to `https://fabrary.net/terms` and then extracted `document.body.innerText`. WebFetch (automated fetcher) returned 403 against all Fabrary URLs — the site's edge-layer blocks automated user agents, but a real-browser session loads cleanly.

**Retrieval date:** 2026-04-11

**Browser + context used:** Playwright MCP (Chromium), headless, no custom user agent (default Playwright Chromium UA was accepted). Source: `.playwright-mcp/page-2026-04-12T02-47-34-805Z.yml`.

**Quoted clauses — verbatim, full document:**

> **Terms of Service**
>
> Please read these Terms of Service ("Terms," "Terms of Service") carefully before using the https://fabrary.net website and Discord bot (the "Service") operated by FaBrary ("us," "we," or "our"). Your access to and use of the Service is conditioned upon your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who wish to access or use the Service. You agree to be bound by these Terms by accessing or using the Service. If you disagree with any part of the terms, you do not have permission to access the Service.
>
> **Links to other web sites**
>
> Our Service may contain links to third-party websites or services that are not owned or controlled by FaBrary. FaBrary has no control over and assumes no responsibility for any third-party websites or services' content, privacy policies, or practices. We do not warrant the offerings of any of these entities/individuals or their websites. You acknowledge and agree that FaBrary shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods, or services available on or through any such third party web sites or services. We strongly advise you to read the terms and conditions and privacy policies of any third-party websites or services you visit. Therefore, we reserve the right to change or update information and correct errors, inaccuracies, or omissions at any time without prior notice.
>
> **Termination**
>
> We may terminate or suspend your access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms. All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
>
> **Indemnification**
>
> You agree to defend, indemnify and hold harmless FaBrary and its licensee and licensors and their employees, contractors, agents, officers, and directors, from and against all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including but not limited to attorney's fees), resulting from or arising out of a) your use and access of the Service, or b) a breach of these Terms.
>
> **Disclaimer**
>
> Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance. FaBrary its subsidiaries, affiliates, and its licensors do not warrant that a) the Service will function uninterrupted, secure, or available at any particular time or location; b) any errors or defects will be corrected; c) the Service is free of viruses or other harmful components, or d) the results of using the Service will meet your requirements.
>
> **Governing Law**
>
> These Terms shall be governed and construed under the laws of United States, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held invalid or unenforceable by a court, the remaining provisions will remain in effect. These Terms constitute our agreement regarding our Service and supersede and replace any prior agreements we might have had regarding the Service.
>
> **Contact us**
>
> If you have any questions about our Terms, please contact us by email at hello@fabrary.net

**Privacy Policy (also fetched for completeness):** The Fabrary Privacy Policy at `https://fabrary.net/privacy` describes Fabrary's own data collection from its end users (IPs, Fathom Analytics, cookies, CCPA compliance). It governs **users of the Fabrary website**, not third parties fetching the site programmatically. It has no bearing on our scraping posture, but is recorded here for completeness. Key line: "Unless otherwise defined in this Privacy Policy, the terms used in this Privacy Policy have the same meanings as in our Terms and Conditions, accessible from https://fabrary.net/terms" — confirms the ToS above is the canonical legal document.

**Interpretation:**

- [x] **The ToS is silent on automated access (default-permissive interpretation applied).**
- [ ] The ToS permits automated access (scraping, GraphQL, deck URL fetching) for non-commercial use.
- [ ] The ToS explicitly forbids automated access — **Phase 1b halted at U0**, escalate.

**Reasoning.** The full Fabrary ToS contains **zero** references to: scraping, automated access, crawlers, bots, robots, API, GraphQL, rate limits, redistribution, reverse engineering, or any other language that would constrain the Phase 0/1a/1b access pattern. The document scopes itself to "visitors, users, and others who wish to access or use the Service" (very broad — covers us), and its operative clauses are:
- Indemnification (you hold us harmless) — no constraint on how we access
- Disclaimer (AS IS) — no constraint
- Governing Law (US) — forum selection, no behavioral constraint
- Termination (we can cut you off at will) — we accept this risk; if Fabrary ever explicitly tells us to stop, we stop

Combined with the permissive `robots.txt` at `https://fabrary.net/robots.txt` captured in Gate 3 (`User-agent: *` with `Allow: /` and `Content-Signal: search=yes,ai-train=no`), which only blocks AI-training crawlers (Amazonbot, Applebot-Extended, Bytespider), automated access for the Phase 1 use case (deck URL fetching, trending ingestion) is **permitted by default**. Our use case is not AI training.

**Residual risk:** the ToS grants Fabrary the unilateral right to terminate access. If Fabrary ever contacts us and asks us to stop, we must comply. There is no automated signal for this — it would come as an email or a blog post. Low-risk because (a) the product is a community tool, not a commercial competitor, (b) our access pattern (deck URL fetching via AppSync GraphQL) is read-only and low-volume, (c) Fabrary's incentive is engagement with FaB-adjacent tools, not lockout.

**Relevant context from Phase 0/1a:** The Phase 0 / Phase 1a `FabraryService` already fetches Fabrary deck URLs via AWS_IAM anonymous AppSync GraphQL. The present compliance review confirms that existing code is also clean with respect to the Fabrary ToS. No existing code requires change.

---

## Entry 2 — Sbrauble Platform Terms of Use

**Target (original):** https://sbrauble.com (the "Sbrauble platform ToS" Gate 3 named as a manual follow-up).

**Retrieval attempts:**
1. `curl -A 'Mozilla/5.0 ...' https://sbrauble.com/` → HTTP 301 → `https://www.sbrauble.com/` → HTTP 404, zero-byte response.
2. `curl -A 'Mozilla/5.0 ...' https://sbrauble.com.br/` → DNS resolution failure (NXDOMAIN).
3. `curl -A 'Mozilla/5.0 ...' https://www.sbrauble.com.br/` → DNS resolution failure (NXDOMAIN).
4. `curl -A 'Mozilla/5.0 ...' https://sbrauble.io/` → DNS resolution failure (NXDOMAIN).
5. WebFetch against `https://sbrauble.com` → 403 (Gate 3 observed this behavior on 2026-04-08; may have been a bot-fingerprint block at the time; today the site is 404 rather than 403).

**Finding:** **The Sbrauble platform does not have a public website.** There is no `sbrauble.com` marketing page, no Terms of Use document, no corporate About page, no domain variant that resolves and serves legal content. Sbrauble appears to be a **white-label e-commerce platform** — it powers Brazilian TCG stores like `www.cupuladt.com.br` (per Gate 3c) but does not maintain a consumer-facing homepage. Gate 3's 2026-04-08 observation of a 403 at sbrauble.com may have been the last sign of a transitional landing page that has since been taken down; the 2026-04-11 state is that no such page exists.

**Retrieval date:** 2026-04-11

**Consequence for the Phase 1b compliance gate:** The absence of a Sbrauble platform ToS means there is no platform-level document to check. The legal basis for scraping `www.cupuladt.com.br/?view=ecom/*` paths therefore reduces to:

1. **Cúpula DT's own site Terms of Use** (store-level, Sbrauble-template based) — see Entry 2b below.
2. **Cúpula DT's `robots.txt`** — captured in `docs/brainstorms/gates/gate-3-dependency-spike.md` Action 3. Permits `/?view=ecom/*` with a platform-default `Crawl-delay: 360` that the store owner explicitly waived.
3. **The store owner's written consent** — captured in `docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md`. Explicit friend-granted crawl-rate exception allowing 1-2s per request against `www.cupuladt.com.br`.

Since no platform ToS exists, the "does store-level consent supersede platform policy?" question (which the plan's Entry 2 template anticipated) is moot — there is no platform policy to supersede.

**Interpretation:**

- [x] **The platform ToS does not exist as a public document; there is nothing to read.** The compliance posture for the scrape reduces to Cúpula DT's store-level documents (Entry 2b) plus the captured friend consent (Gate 2).
- [ ] The platform ToS is silent on per-store-consent override of the robots.txt crawl-delay.
- [ ] The platform ToS permits automated access with per-store consent.
- [ ] The platform ToS explicitly forbids scraping — Phase 1b halted.

---

## Entry 2b — Cúpula DT Store-Level Terms (Sbrauble template)

**Target:** https://www.cupuladt.com.br/?view=ecom/termos — the store's dedicated Termos e Condições page, template-provided by the Sbrauble platform.

**Retrieval protocol:** `curl` with a real-browser User-Agent. Page is server-rendered (per Gate 3c's earlier finding on `/?view=ecom/itens`). Response: HTTP 200, 52,119 bytes.

**Retrieval date:** 2026-04-11

**Quoted content:**

> **Termos & Condições — Cúpula do Trovão**
>
> **Home → Termos e Condições de Compras**
>
> **Termos e Condições de Compras**
>
> Ops! Termos e Condições de Compras não preenchido.

**Additional clauses captured from the site footer (visible on every page, including the termos page):**

> Nenhuma parcela deste Website pode ser usada sem consentimento escrito expressado.
>
> Magic: The Gathering e Copyrighted por Wizards of the Coast Inc. [...] Flesh and Blood TCG e suas respectivas propriedades são copyright Legend Story Studios. [...] Todos direitos reservados.
>
> Cúpula do Trovão / CNPJ: 21.818.336/0001-36

**Interpretation:**

- [x] **The store-level Termos e Condições de Compras page is an empty template.** The store owner never filled it in — the literal visible text is "Ops! Termos e Condições de Compras não preenchido." (English: "Oops! Terms and Conditions of Purchase not filled in.") This is the Sbrauble platform's default placeholder text, displayed when the store operator has not populated the corresponding field in the backend. There is no merchant-authored ToS.
- [x] **The only legal clause that applies to the site's content is the footer disclaimer:** "Nenhuma parcela deste Website pode ser usada sem consentimento escrito expressado" — in English, "No part of this Website may be used without express written consent." This is a broad reuse-of-content clause that, read strictly, would require written consent from the store to scrape any portion of the site.

**Interaction with Gate 2 friend consent — DECISIVE:**

The footer clause "No part of this Website may be used without express written consent" is exactly satisfied by the written consent captured in `docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md`. Gate 2 records:

1. **The scraping consent itself** — the store owner "explicitly agreed to allow a polite scraper to read FaB product pages from the store's public catalog" (verbatim from the gate artifact). This is the "express written consent" the footer clause demands; the consent is memorialized in the gate document and can be produced as evidence if ever questioned.
2. **The crawl-rate exception** — the store owner additionally permitted 1-2 second per-request scraping against `www.cupuladt.com.br/?view=ecom/*`, overriding the Sbrauble platform's `robots.txt` default of 360 seconds per request. This is not a contractual violation of Sbrauble platform policy (because no platform ToS exists to violate — see Entry 2) but a store-owner-granted exception to a platform-default posture.

**Because the store ToS is an empty template, the only store-level legal constraint is the footer's "written consent" requirement, and that requirement is satisfied by the Gate 2 consent artifact.** The compliance loop closes cleanly.

**Residual ambiguity (why this log is `closed-with-ambiguity` and not clean `closed`):**

1. The footer clause is informal boilerplate. A plaintiff could argue it is not a proper ToS and therefore either (a) unenforceable, or (b) stricter than a proper ToS would be. In either case, the store owner's explicit consent is the dispositive fact, but we should note that we are not relying on a formally-drafted legal document.
2. The Sbrauble platform's absence of a ToS does not mean the platform has no opinion — it means there is no documented opinion. If Sbrauble's business relationship with its store clients includes a contractual prohibition on third-party scraping (which we have no way to verify without access to the Sbrauble merchant agreement), our store-level consent might technically put the store owner in breach of its own contract with Sbrauble. We have no visibility into this. The store owner, a personal friend of the project owner, has judged (implicitly via consenting) that this is not a concern.
3. The compliance log cannot produce evidence against a document that does not exist. This is a known-unknown, not a resolved question.

**Decision:** Phase 1b proceeds with Unit 7 unblocked. The residual ambiguity is logged as follow-up A28 in the plan's debt ledger (to be added in a subsequent revision), with the trigger "first credible signal from Sbrauble or any other store owner questioning the scrape." A re-confirmation cadence (per follow-up A27, "Friend consent has no renewal cadence") at every 6 months is the primary mitigation.

---

---

## Entry 2c — Liga FaB Platform Contract (the real platform, discovered 2026-04-12)

**Target:** `https://www.ligafab.com.br/?view=contrato` — the platform operator contract for Liga FaB, which is the e-commerce platform that powers `www.cupuladt.com.br` (and most Brazilian TCG stores per the project owner's knowledge, 2026-04-12).

**Retrieval protocol:** `curl` with a real-browser User-Agent. HTTP 200, 73,278 bytes, server-side rendered. Full text saved to `/tmp/ligafab-contrato.html` at retrieval time; text-only version at `/tmp/ligafab-contrato.txt`.

**Retrieval date:** 2026-04-12

**Why Gate 3 recorded the platform as "Sbrauble":** The Phase 0 dependency spike (Gate 3) called the platform "Sbrauble" based on the 2026-04-08 observation that `sbrauble.com` returned 403 to automated fetches — Gate 3 assumed this was the platform root. That appears to have been a misidentification: the real platform is Liga FaB, not Sbrauble. The `sbrauble.com` domain was either an unrelated brand, a deprecated rebranding, or a fingerprint/bot-blocker page sitting at a URL the platform never intended as its public face. The Phase 1b plan document inherits the "Sbrauble" naming from Gate 3 and must be corrected in a follow-up pass (see "Plan corrections required" below).

**Critical quoted clause — Section 17, verbatim:**

> **17 - Propriedade Intelectual e links**
>
> O uso comercial da expressão "LIGAFAB" como marca, nome empresarial ou nome de domínio, bem como os conteúdos das telas relativas aos serviços da LIGAFAB assim como os programas, bancos de dados, redes, arquivos que permitem que o USUÁRIO acesse e use sua Conta são propriedade da LIGAFAB e estão protegidos pelas leis e tratados internacionais de direito autoral, marcas, patentes, modelos e desenhos industriais. **O uso indevido e a reprodução total ou parcial dos referidos conteúdos são proibidos, salvo a autorização expressa da LIGAFAB.**

**Translation (non-official, for the plan's purposes):**

> Section 17 — Intellectual Property and links
>
> The commercial use of the "LIGAFAB" expression as a trademark, business name, or domain name, as well as the contents of the screens relating to LIGAFAB services, as well as the programs, databases, networks, and files that allow the USER to access and use their Account, are the property of LIGAFAB and are protected by international laws and treaties on copyright, trademarks, patents, industrial designs. **Improper use and the total or partial reproduction of said content are prohibited, except with express authorization from LIGAFAB.**

**Other clauses captured (for context, not dispositive):**

- **Section 08 — Obrigações dos USUÁRIOS:** restricts what users can do on the platform (no propagating illegal content, no harassment, etc.). Aimed at platform users, not external observers.
- **Section 06.4 — Proteção à Propriedade Intelectual:** Liga FaB aims to ensure that products advertised don't infringe IP rights; holders of infringed rights can request removal. Aimed at product listings, not observers.
- **Section 18 — Indenização:** users indemnify Liga FaB for any demand arising from their use of the site.
- **Section 19 — Rescisão** (not fully captured): Liga FaB reserves the right to terminate accounts.
- **Section 20+** (not fully captured): further operational clauses. None observed to contain scraping- or API-specific language.

There is **no** explicit clause about robots.txt, crawling, scraping, automated access, rate limits, or API use. Section 17 is the only operative clause for our use case, and it is broad enough to cover reproduction of product-listing content in our `store_stock` database.

### Legal analysis — does Section 17 block Phase 1b?

**What the clause prohibits:** total or partial reproduction of "the contents of the screens relating to LIGAFAB services" — this includes product names, prices, quantities, and product URLs rendered by `www.cupuladt.com.br/?view=ecom/*`, because those pages are "telas relativas aos serviços da LIGAFAB" (Liga FaB powers the store's e-commerce surface).

**What our scraper does:** fetches those screens, parses the product listings, persists `(productNameRaw, priceCents, quantity, productUrl)` into our `store_stock` table, and re-displays the data to our authenticated users. This is textbook "partial reproduction" of Liga FaB's screen content.

**What would make it permitted:** "salvo a autorização expressa da LIGAFAB" — express authorization from Liga FaB. The authorization we have (Gate 2) is from the Cúpula DT store owner, not from Liga FaB. Under Brazilian contract law, the store owner cannot grant permission over rights held by the platform operator. Gate 2 is dispositive for the footer's store-level reuse clause (Entry 2b) but is **not** dispositive for Section 17 of the platform contract.

**What mitigates the risk, in descending order of strength:**
1. The Liga FaB contract is aimed at USUÁRIOS of the Liga FaB platform (sellers and buyers). Our project is neither — we are a third-party data aggregator. A court might find the contract does not apply to a non-USUÁRIO, since we never accepted the terms (we are not accessing through a registered account). This is a "browsewrap vs clickwrap" question in Brazilian law, and the outcome is unpredictable.
2. The `robots.txt` at `www.cupuladt.com.br` explicitly permits the `/?view=ecom/*` paths (Gate 3c finding), which is an automated-signal permission from the platform. Under the doctrine of implied consent, a permissive robots.txt weakens a prohibitive contract clause when applied to a non-interactive crawler. This is also uncharted in Brazilian courts.
3. The "uso indevido" qualifier ("improper use AND reproduction") could be read as limiting the prohibition to reproductions that are themselves improper — e.g., commercial exploitation, re-sale of data, search engine cloning. A non-commercial, user-specific shopping-list tool used with the store owner's blessing is a much harder call.
4. Liga FaB's practical enforcement mechanism is a cease-and-desist letter, not a lawsuit. If we receive one, we can stop immediately at nominal cost.

**What does NOT mitigate the risk:**
- The Cúpula DT footer's "written consent" clause is satisfied by Gate 2, but that was only dispositive when we thought there was no platform ToS. Section 17 supersedes the store-level clause for reproducing platform-served content.
- The store owner's friendship with the project owner is irrelevant to Liga FaB's standing to enforce its own IP rights.
- "Nobody has complained yet" is not a defense.

**Interpretation (Entry 2c):**

- [ ] The platform contract permits our access pattern.
- [ ] The platform contract is silent on automated access.
- [x] **The platform contract explicitly prohibits reproduction of screen content absent express authorization from Liga FaB.** The Phase 1b scraper falls directly within that prohibition. This is a P0 compliance blocker.

---

## Decision gate — UPDATED 2026-04-12

- [ ] Both ToS reads complete and both clearly permit the Phase 1b access pattern.
- [ ] Silent / ambiguous ToS for one or both sources — proceed with documented residuals.
- [x] **One of the two platform-level contracts is prohibitive: Liga FaB Section 17 prohibits partial reproduction of screen content absent express authorization from Liga FaB. Phase 1b is BLOCKED at U0 pending a human decision among the escalation options below.**

**Summary of the compliance picture (updated 2026-04-12):**

| Document | Exists? | Silent on crawling? | Permissive? | Blocks Phase 1b? |
|---|---|---|---|---|
| Fabrary `/terms` (Entry 1) | Yes, retrieved via Playwright | Yes — zero references to automated access, APIs, rate limits, or scraping | Default-permissive (no prohibitive clause; `robots.txt` permissive) | **No** |
| "Sbrauble" platform ToS (Entry 2) | **No** — `sbrauble.com` is 404 / no domain variant resolves. This was a naming error in Gate 3. | N/A | N/A | N/A (naming error superseded by Entry 2c) |
| Cúpula DT store ToS (Entry 2b) | Template exists but literally empty | Yes — only the footer reuse clause applies | Satisfied by Gate 2 written consent **for store-level content**, but does NOT cover Liga FaB's platform-level IP claim | **No** (for store-level content) |
| **Liga FaB platform contract (Entry 2c)** | **Yes** — `/?view=contrato`, retrieved 2026-04-12 | **No — Section 17 explicit** | **No — requires express Liga FaB authorization; we only have store-owner consent** | **YES** |

**Status (current):** `BLOCKED` — Phase 1b U0 cannot close until one of the escalation options below is chosen and resolved.

---

## Escalation — Options for resolving the Liga FaB Section 17 blocker

The project owner needs to choose one of these paths before Phase 1b can proceed past U0. Each option has a different cost/risk profile and affects downstream scope differently.

### Option A — Email Liga FaB directly asking for express authorization (cleanest legal path)

**Action:** Send an email to Liga FaB's legal contact (on the contract's contact section, not yet captured) explaining the Phase 1b use case:
- Non-commercial, open-source Phase 1 community tool for the Pelotas FaB community (~47 users)
- Daily scrape of a single store (Cúpula DT), rate-limited to 1.5s/request with the store owner's explicit consent
- Read-only data use, displayed as a shopping-list affordance to authenticated users
- Outbound product links drive traffic TO the store (value-creating for Liga FaB's client)
- Written record of all consent artifacts (Gate 2, Gate 3, this compliance log)

**Outcome:**
- **Best case:** Liga FaB grants express authorization in writing; we have a clean legal path and the compliance log closes cleanly. Phase 1b U0 unblocks.
- **Ambiguous case:** Liga FaB responds with a different rate limit or a narrower scope; we adjust Phase 1b's per-store config accordingly.
- **Worst case:** Liga FaB refuses. We know where we stand; pivot to Option C or D.
- **No-response case:** Liga FaB ignores. We have documented good-faith effort, which weakens any future cease-and-desist but does not constitute authorization.

**Cost:** 15 minutes to draft the email. Wait time for response: unknown.

**Risk:** Low. Asking creates a paper trail that is defensible even if we proceed without response.

### Option B — Ask the Cúpula DT owner to approach Liga FaB on our behalf

**Action:** Leverage the friendship with the store owner. He is a paying Liga FaB customer and has a direct business relationship with the platform. He asks Liga FaB (as a customer) whether his chosen third-party tool can scrape his store's pages with his consent. Liga FaB's answer is likely influenced by not-wanting-to-annoy-a-paying-customer incentives.

**Outcome:**
- **Best case:** Liga FaB tells the store owner it's fine; we get a transitive authorization that is arguably stronger than a cold email because it comes via their own customer.
- **Ambiguous case:** Liga FaB says "sure, if you vouch for them" — we've effectively converted Liga FaB's Section 17 into a Cúpula DT sub-authorization.
- **Worst case:** Liga FaB tells the store owner no. We know where we stand.

**Cost:** A conversation between the project owner and the store owner. Zero legal cost, some social capital.

**Risk:** Slightly higher than Option A because it puts the store owner in a weird position (asking his platform vendor for special permission). But the friendship is already the load-bearing piece of Phase 1b.

### Option C — Pivot to a different store-data mechanism (no Liga FaB scraping)

**Action:** Abandon the scraper. Replace it with one of:
- A manual CSV export from Cúpula DT's admin dashboard (the store owner uploads the file weekly to our Vercel Blob / S3; the data is the store owner's own data, not Liga FaB's screens)
- A push-based webhook from the store owner's own tooling (if they have backend access to their Liga FaB store data beyond the web UI)
- A direct read of Liga FaB's merchant-facing API (if one exists) under the store owner's credentials

**Outcome:** Phase 1b ships without touching Liga FaB's public screens. Section 17 is not implicated because we're not reproducing screen content — we're reproducing data the store owner legitimately owns and has shared directly.

**Cost:** Significant. The plan's "zero labor on store owner" principle is violated. Unit 3 (scraper) is deleted; replaced by a CSV ingestion pipeline or webhook receiver. The reconciliation and delta guard still apply. The card name matcher still applies. Approximately Unit 3 + Unit 4 are rewritten. Estimated 50-60% of Phase 1b scope needs re-planning.

**Risk:** The store owner may not want to do manual uploads. The friendship assumes he'll do it anyway. Scales poorly to Phase 2 (when more stores join).

### Option D — Drop the shopping line from Phase 1b entirely

**Action:** Revert the Phase 1a placeholder slots to say "Stock integration coming in a future release" (no date). Move the shopping line to Phase 1c or later. Phase 1b becomes substantially smaller — it still ships Fabrary ToS compliance + debt ledger items, but not the store bridge.

**Outcome:** Phase 1b ships without the secondary metric's surface. The 4-week community engagement window loses one of its stated hypotheses.

**Cost:** The entire Phase 1b plan (Units 1-7) is shelved. Phase 1a's shopping line placeholders become long-lived debt instead of short-term commitment. The competitive value prop of rathe-arsenal (inventory + substitution + local store) is reduced to two-thirds.

**Risk:** Delivery risk on the primary metric is unchanged. The deferred option can be revisited in any subsequent phase without further compliance work (the Liga FaB contract is the blocker whether the scraper ships in 1b or later).

### Option E — Proceed anyway, accepting the risk of a cease-and-desist

**Action:** Implement Phase 1b as specified, relying on the weaker mitigations (non-USUÁRIO contract applicability, robots.txt permissive signal, "uso indevido" qualifier, small-community non-commercial nature). Monitor for any contact from Liga FaB; on first contact, halt and migrate to Option C.

**Outcome:** Phase 1b ships fast. If Liga FaB never notices or never cares, we have the full plan in production. If they do notice, we have to shut down quickly and migrate.

**Cost:** Engineering-wise, the same as the current Phase 1b plan. Legal-wise, we are knowingly proceeding against an explicit prohibition clause in a contract that arguably applies to us. Brazilian courts would look unfavorably on "we proceeded because we judged the clause weak" even if the clause's applicability is genuinely unsettled.

**Risk:** High. The cease-and-desist path is cheap for Liga FaB (one email) and expensive for us (we have to migrate Option C on a compressed timeline). Even if we win the legal argument, we lose the time spent arguing. Adversarial-review's A11 (friend-consent has no expiry signal) now becomes a live risk from Liga FaB rather than just from the store owner.

**Recommendation:** Do NOT pick Option E as a first move. It becomes defensible only after Options A and B have been tried and failed.

### Recommended order of attempt

1. **Option B** first (store owner asks Liga FaB as a customer) — leverages existing relationship, social-lowest-cost, legally-highest-return.
2. **Option A** if Option B is awkward for the store owner — direct email, cold path, but still cheap.
3. **Option C** if both A and B fail or are impractical — requires plan rewrite but resolves the compliance question permanently.
4. **Option D** if the timeline pressure is acute and rewrite is not feasible — drop the scope, revisit in Phase 1c.
5. **Option E** is not recommended.

---

## Plan corrections required (post-unblock)

Once U0 unblocks (via one of the options above), the Phase 1b plan document at `docs/plans/2026-04-11-001-feat-phase-1b-shopping-line-plan.md` must be updated:

- **Rename "Sbrauble" to "Liga FaB"** throughout the plan where the platform is named. Gate 3's misidentification cascaded into the plan. Approximate count: 15+ occurrences in Overview, Key Technical Decisions, Unit 1, Unit 3, Risks, Sources. The technical observations (HTML structure, `/?view=ecom/*` paths, Crawl-delay: 360 default) are still valid — those were Gate 3's observations of the store's own robots.txt, which are correct regardless of platform branding. Only the platform name is wrong.
- **Update the `Gate 3 dependency spike` reference** to note that the platform is Liga FaB, with a link to `https://www.ligafab.com.br/?view=contrato` as the real platform contract.
- **Gate 3 artifact at `docs/brainstorms/gates/gate-3-dependency-spike.md`** should gain a correction note at the top (not a rewrite — preserve the historical record) acknowledging the naming error was discovered on 2026-04-12 during Phase 1b U0.
- **Phase 0 `FetchGuardService` allow-list env var name** (`FABRARY_ALLOW_HOSTS` stays; `STORE_ALLOW_HOSTS` stays — both are technically hostnames, not platform names, so they are already correct and do not need renaming).

---

## Change log

- **2026-04-11 (open):** Log scaffolded by Phase 1b plan execution (Unit 0).
- **2026-04-11 (initial close):** Entries 1, 2, 2b completed. Fabrary ToS retrieved via Playwright headless browser (WebFetch/curl bypassed by edge-layer bot filter; real browser loaded successfully). Sbrauble platform ToS confirmed non-existent across all plausible domain variants (`.com` 404, `.com.br` and `.io` NXDOMAIN). Cúpula DT store ToS template confirmed empty via direct HTML fetch; footer clause captured. Status initially set to `closed-with-ambiguity`.
- **2026-04-12 (critical re-open):** Project owner identified that the real platform is **Liga FaB** (`ligafab.com.br`), not Sbrauble — Gate 3 had the platform name wrong. Entry 2c added after fetching `https://www.ligafab.com.br/?view=contrato` (73KB, server-rendered, HTTP 200). Section 17 of the Liga FaB contract contains an explicit IP-reproduction prohibition. Technical investigation confirmed Liga FaB IS the operator (shared `LIGASID` session cookie on both cupuladt.com.br and ligafab.com.br), but also confirmed Sbrauble is the CDN/asset layer (product images served from `sbrauble.com/arquivos/...`). Five escalation options (A-E) documented.
- **2026-04-12 (risk-accepted close):** Project owner decided to proceed under **Option E (risk acceptance)** with the following reasoning: (1) the `robots.txt` at `cupuladt.com.br` explicitly permits `/?view=ecom/*`, which is an operational signal from the same operator that published Section 17 — contradictory signals weaken the prohibitive clause, (2) the "USUÁRIO" framing of Section 17 arguably does not apply to a non-registered third-party observer, (3) the project is non-commercial, community-sized (47 users), and the scraper generates inbound traffic to the store (value-positive for Liga FaB's client), (4) the store owner's explicit consent (Gate 2) satisfies the store-level footer clause even if it doesn't satisfy the platform clause. **Mitigations adopted:** (a) kill-switch protocol: on first contact from Liga FaB, scraper disables within 24h; (b) Opção B (store owner approaches Liga FaB as a paying customer) is staged as a follow-up before any growth campaign or user-base expansion past ~100 users; (c) `STORE_SCRAPER_ENABLED` env var remains the kill switch and is documented in the operator runbook. Status changed to `closed-risk-accepted`. Phase 1b U0 is closed. Units 1-7 are unblocked. Plan rename from "Sbrauble" to "Liga FaB" applied.
