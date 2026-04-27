# Visual Regression Baselines — Procedure

## Scope (U8 launch decision)

16 dark-desktop baselines at 1440x900. One per primary surface. Light theme,
mobile viewports, and multi-state captures are explicitly out of scope at launch
(E3 decision). They can be added post-launch when the cost of maintaining the
baseline set is justified by usage patterns.

Surfaces covered:

| # | Surface | URL | Auth |
|---|---------|-----|------|
| 1 | sign-in | `/sign-in` | no |
| 2 | sign-up | `/sign-up` | no |
| 3 | forgot-password | `/forgot-password` | no |
| 4 | reset-password | `/reset-password` | no |
| 5 | check-your-email | `/check-your-email` | no |
| 6 | onboarding | `/onboarding` | yes |
| 7 | home | `/home` | yes |
| 8 | deck-detail | `/decks/:id` (first deck) | yes |
| 9 | library | `/library` | yes |
| 10 | library-csv-sources | `/library-csv-sources` | yes |
| 11 | reviews | `/reviews` | yes |
| 12 | settings | `/settings` | yes |
| 13 | add-cards | `/add-cards` | yes |
| 14 | add-cards-manual | `/add-cards/manual` | yes |
| 15 | add-cards-csv | `/add-cards/csv` | yes |
| 16 | add-cards-fabrary | `/add-cards/fabrary` | yes |

## Prerequisites

Before running the visual suite locally:

1. Dev server running: `pnpm dev` (api on :3000, web on :5173)
2. A fixture user exists with at least one tracked deck and one CSV source.
   See `docs/dev-fixtures.md` for seed instructions.
3. Env vars set:
   ```sh
   export FIXTURE_EMAIL=<your-test-user@example.com>
   export FIXTURE_PASS=<password>
   ```

## Running the suite

```sh
# First run (or after --update-snapshots): capture baselines
pnpm --filter @rathe-arsenal/web test:visual

# Subsequent runs: diff against baselines (zero-diff is the pass condition)
pnpm --filter @rathe-arsenal/web test:visual
```

## Updating baselines (intentional redesign)

When a visual change is intentional (design update, new component, refactor):

1. Verify the change looks correct by running the suite and reviewing the diff
   report in `playwright-report/`.
2. Update baselines with:
   ```sh
   pnpm --filter @rathe-arsenal/web test:visual:update
   ```
3. Commit the updated snapshots:
   ```sh
   git add apps/web/tests/visual/__snapshots__/
   git commit -m "chore(web): update visual regression baselines — <reason>"
   ```
4. Include in the PR description which surfaces changed and why.

## Tolerance

A 1% max pixel diff ratio (`maxDiffPixelRatio: 0.01`) is configured to tolerate
sub-pixel antialiasing differences between Chromium versions on different
machines. Failures above this threshold are genuine regressions and must be
either fixed or baseline-updated with justification.

## Adding new baselines

When a new surface is added to the product:

1. Add the surface to `ANON_SURFACES` or `AUTH_SURFACES` in
   `apps/web/tests/visual/all-surfaces.spec.ts`.
2. Run `pnpm --filter @rathe-arsenal/web test:visual:update` to capture the
   initial baseline.
3. Commit the new snapshot with the surface implementation.

## CI integration

The visual suite is not gated in CI at launch (see E3 decision). It runs
locally as a self-validation tool. The owner decides when to elevate it to a
CI gate (likely after the surface set stabilises post-launch). The suite
is architected to run in CI without changes — add a `webServer` config to
`apps/web/playwright.config.ts` when CI integration is desired.
