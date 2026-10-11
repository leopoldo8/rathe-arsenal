# Swaps into alternatives: implementation notes

## Deviations

1. **"Usar as N" for a single suggestion.** AC 6 names the button "Usar as N". With N = 1 the pt-BR reads "Usar a sugestão" (en-US "Use the suggestion"), because "Usar as 1" is not Portuguese. The onboarding reads "Usar a carta da coleção" for one. Copy only; reversible.
2. **The bulk route answers 409 when every suggestion is skipped.** AC 9 says 409 when the deck has no suggestion. When suggestions exist but none can be used (all past the copy limit, illegal or without a free copy), the route also answers `409 NOTHING_TO_REPLACE` and changes nothing, instead of a `201` with no rows. Conservative: one answer for "nothing was used". Proven by C40, added after verification round 1.
3. **"No free copy" is checked against the deck's copies.** AC 10's "no longer owned" is decided as: the owner's copies of the suggestion are not more than the copies the deck already holds, counting the copies earlier uses in the same request added. A fresh compute under the lock cannot offer an unowned card, so this only fires inside a batch (C17 proves it at its own layer).
4. **The status strip shows the shopping and Fabrary links while suggestions exist.** Before, a "solvable" deck hid them. Now a deck with suggestions can still have cards only buying covers, so the links show whenever cards are missing.
5. **The onboarding preview names the original card.** The old preview labelled the missing card with its slot (`original.slot`), a bug; the rewritten row shows `original.name`.
6. **Checks reworded during build** (marked in `checks.md`): C5 (the decks list carries no `fidelityPercent`), C12 (the example deck's N), C28 (`/` takes a signed-in owner to `/home`).
7. **`computeEffectiveReadiness` keeps `findSubstitution`'s exclusion input untouched.** Door 2 removes the approved and excluded sets from `computeEffectiveReadiness` only; `findSubstitution` and `findTierMatch` keep their optional exclusion parameter and its tests, since they are engine functions with their own callers and tests.
8. **Legacy 410 routes still point at `/api/swaps`.** `SWAPS_MIGRATION_PAYLOAD` moved to `apps/api/src/common/legacy-routes-gone.ts` unchanged, as the plan's Out of scope says; its text names routes that now answer 404.

## Observed, not caused by this change

- One full API e2e run had a single failure in `recommendations-read.e2e-spec.ts`; the next full run and three runs of the recommendations and replacements e2e files passed (106/106 each). The failing test name was not captured. This change does not touch the recommendations module.
