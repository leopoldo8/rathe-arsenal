# Card alternatives implementation notes

## Deviations

Each is the conservative choice, logged, with the build kept going.

1. **C36, "every deck in the readiness suite".** The proof runs the test alone with `-t`, so a test that replays the inputs of the other tests would see none. The test replays a table of eight decks that cover every branch of the compute (all owned, tier 1 and tier 2 stand-ins, rejected and approved swaps, hero and weapon slots, a card missing from the catalog, a card split across slots), once without the protected input and once with an empty one. `readiness.spec.ts` was only appended to.
2. **Generic group score (plan says none).** `generic` scores a candidate with the tier 2 scorer on a copy of it that takes the missing card's classes and talents, with no floor. Its six gates are the Generic class, the same pitch, a shared type, the same equipment body slot and a power and a defense gap of at most 2. The score only orders cards inside the group.
3. **C4, "a zero-keyword-overlap candidate with power delta 2 is accepted".** That holds when the missing card has no keywords (score 0.70, exactly the floor). A missing card with keywords and zero overlap scores 0.55 at power delta 2 and is rejected, so the test uses a missing card without keywords and adds a case with keywords and delta 0 (score 0.85, accepted in `close`).
4. **C9, Silver Age rarity rows.** The real catalog has no card that is legal in Silver Age with a rarity outside Common, Rare and Basic, so a real card in that row is reported by the format rule first. The row uses a real Majestic card (`amethyst-amulet-blue`) and an extra test isolates the rarity rule on a copy of it whose format list was widened.
5. **C16, `q=sink`.** No card that only contains "sink" is legal for Katsu, so the test uses `dash-io`, for whom `aether-sink-yellow` is legal.
6. **Existing specs adapted to the new behaviour, assertions unchanged.** `substitution.service.spec.ts` asserted the exact argument list of `computeEffectiveReadiness` (now seven arguments); the four `DecksService` specs and the substitution spec gained a provider for `ReplacementsQueryService`; deck detail fixtures gained `replacements: []`.
7. **C64 and C34 recompute trigger.** `POST /api/collection/cards/batch` does not recompute deck readiness, so the e2e tests mark a card owned afterwards (the recompute path the check names). C64 owns three copies of the stand-in because the deck's other missing card is served first.
8. **Name of an original on the deck page.** The `replacements[]` fields are frozen (C59) and carry no card name, so the web derives "Emissary of Tides" from the identifier (`humanizeCardIdentifier`): apostrophes and commas in a name are lost. Needs the owner: adding an `originalName` field to the response would fix it and changes the approved Surface row.
9. **Module placement.** The reads and the close-as-removed update live in `ReplacementsQueryService` (leaf `ReplacementsCoreModule`), so `SubstitutionModule` and `DecksModule` import it without a cycle, the way `SwapsCoreModule` works for swap rows. No hop of the Flow changed.
10. **`-swaps.test.tsx`.** The check names a file that did not exist (the existing page test is `swaps.test.tsx`); a new small file with that name holds the proof.
11. **Throttle spec.** The throttle checks send 121 requests per route that end in 400, 404 or 409 (the guard counts them all), so no real picks are made.
12. **The 0.05 owned bonus** is pinned as the plan says; no real decks are reachable from here to calibrate it (open question 1 stays open).
