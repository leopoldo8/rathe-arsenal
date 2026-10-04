# Card scanner - implementation notes

## Deviations

- **DEV-01 - `GET /api/catalog/collector-codes` response shape.** The approved `Surface` row listed one object per code with a full image URL. Before any code, measurement showed 1.6 MB uncompressed with no compression middleware; the shape became grouped by card with `imageSmallBase` once and art codes only where they differ (about 520 KB). Updated in the plan and flagged to the owner.
- **DEV-02 - `tesseract.js` 7 instead of 5.** Door 1 named `^5`; v7 is current and re-ran the spike set with the same 29/38. Recorded as Landing door 5 rather than rewriting door 1.
- **DEV-03 - all 15 core files ship.** C59 requires every `tesseract-core*` file in the build; the browser only ever loads one of the six `*.wasm.js` builds. About 40 MB of `apps/web/dist/ocr/` is never downloaded. Trimming the copy to `*.wasm.js` needs C59 amended.
- **DEV-04 - Confirm also lives on the bar.** The plan put confirmation in the review list; AC 30 also wants a confirm control on the empty-tray bar, so the bar carries "Add to library" next to "Review". Committing without opening the list is possible because every card already had its own notice.
- **DEV-05 - re-arm rule.** AC 13 and AC 19 changed before the build from "until a recognition returns no code or a different code" to "until 3 consecutive recognitions have not read it": a single variant missing a held card would otherwise count it twice. Intent unchanged.
- **DEV-06 - add-cards tabs on phones.** A fourth tab overflowed the pill at 375 px in pt-BR (392 px of content in 325 px). Under 640 px the tabs are a 2x2 grid.
- **DEV-07 - test infrastructure outside the feature.** `apps/web/vitest.config.ts` now runs on half the cores: one worker per core drove the load average to 88 on 18 cores and the existing swaps 50-row test hit 28 s against a 15 s timeout (1.4 s alone). The swaps test also looks up its checkboxes once; assertions unchanged.
- **DEV-08 - E2E apps listen on 127.0.0.1.** Supertest's per-request ephemeral server mixed IPv4 and IPv6 client addresses, which split throttler buckets (C58 flaked) and reset connections under concurrency (C49).

## Open, for the owner

- Real-device recognition rate is unmeasured (plan open question 1). The only figures are 33/38 right and 0 wrong on clean official images.
- A commit whose response is lost and is retried adds the cards twice (plan open question 2).
- The visual-regression baseline for `add-cards` still passes with the fourth tab because the suite allows a 1% pixel difference; consider refreshing baselines.
