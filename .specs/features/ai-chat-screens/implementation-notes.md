# AI chat screens - implementation notes

## Deviations

1. **C26 example corrected before its proof first ran.** The check said a deck proposal of 3 `emissary-of-tides-red` shows 2 owned; the test owns 4 copies (3 shown owned) so the swap's free copies (4 minus 2 in the deck) are also exercised. The check text now carries the test's concrete values.
2. **Chat ids are encoded into API paths** (`conversationPath`, commit `0fb7f45`), found by an automated security review: the conversation id comes from the URL, and an unencoded `..%2F` segment reached other API routes with the user's token.
3. **`/chat` added to the authenticated shell prefixes in `__root.tsx`**, found by the phone Playwright run: without it the chat page rendered with no top bar and no tab bar. `Flow` hop 2 records it.
4. **The conversation list button has an accessible name** (`chat.conversationsAria`), found by the same run: on phones the visible label is hidden and the button was an unnamed icon.
5. **A `Nova` link inside the conversation list**, as `chat-b` shows on phones, where the header has no room for it. Not in a check.
6. **The limit banner offers `Tentar de novo` when the last turn failed on the budget and usage shows room again**, so a conversation does not stay locked after the monthly reset. The composer still stays disabled while the banner shows (AC 23). Not in a check.
7. **Two test-side fixes, no assertion changed:** the literal detector of C43 matched `=>` and `a > b` as JSX text (now only text after a closing tag counts; checked against a sample with a real literal), and C37 awaits the empty-recommendations notice, since the rail now renders before the recommendations read resolves.

8. **Verification round 1 (FAIL) corrected two approved checks against the binding mockups.** C29 and AC 35 promised `Troca aplicada.` with `Abrir deck` on an applied swap; `chat-b` draws `Troca feita no deck.` with `Desfazer`, and undo by revert already exists (AD-009). The card now follows the mockup, the API exposes `cardReplacementId` and `replacementStatus` (C48), and `Desfazer` reverts (C49). AC 3 asked for the mark in the top navigation, which `brand-2-desktop` draws as text only; AC 3 now says so. Owner to confirm both corrections.
9. **Round 1 also tightened proofs without loosening any:** HTTP proofs for C1, C45 and C46; C12's fixture is out of order so dropping the sort fails; `?deck=` parsing moved to `-chat-search.ts` with its own test and a Playwright run through the router (C10); arrangement checks C50 and C51; marks, bar, pitch, title, banner position and the list's `Nova` now asserted. The deck tile's start button carries the Tutor mark (brand-2), and the phone header no longer shows a brand tile the mockup does not draw.

10. **Verification round 2 (FAIL, 6 gaps) closed:** the bound deck chip moves to its own band under the title on phones (`chat-b-phone` frame 8) and stays on the title's line on desktop (C50, C51); an applied swap reads its replacement status, with `A troca saiu do deck.` for `removed` as provisional copy no mockup draws (C52, owner to confirm); refused undo and dismiss are proven (C53); the limit banner's retry is proven (C54); the bar fill and the bubble's right edge are asserted.

## Local environment (not code)

- The local dev database `rathe_arsenal` had a five-value `CHK_card_replacement_picked_from_valid` (TypeORM `synchronize` does not rewrite an existing CHECK), so `suggestions-flow.spec.ts` failed on `pickedFrom: suggested`. The constraint was dropped and re-added with the entity's eight values; production runs migrations and is unaffected.

## Needs owner

- Nothing blocks the merge. Visual regression snapshots were not added for the chat screens; the screenshots taken for self-validation live outside the repo.
