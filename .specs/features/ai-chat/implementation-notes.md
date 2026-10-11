# AI chat - implementation notes

Autonomous run on 2026-10-11, owner away. Every call below that would normally wait for the owner is provisional.

## Provisional calls (owner to confirm)

1. **No review stop at the plan.** The owner said to plan and run everything autonomously; `plan.md` Assumptions carry `Confirmed? n` except the rules source, which the owner saw in session.
2. **Profile `standard`**, as card-recommendations.
3. **One builder, compaction accepted** although the estimate (161k) is over the 150k budget (`checks.md` Handoff).
4. **Local commits only.** Nothing is pushed, no PR is opened, no production migration runs, and no real user gets `chatAccess`.
5. **Screens not built.** The chat tab and the deck-page entry are status `design` (project `CLAUDE.md`, "UI changes"); this run produces mockups with alternatives for the owner to pick.

## Deviations

1. **Rules source fetched by the worker** (design Rules reference default 1 said the owner downloads it in a browser): `rules.fabtcg.com` answers plain HTTP and its MkDocs search index carries every section's full text (checked against the rendered `cr/01-game-concepts/` page on 2026-10-11). The worker refreshes it daily and replaces it only on a new hash. Owner saw this in session.
2. **Rules stored per numbered rule, not per section**: the glossary section is 50,024 characters and keyword sections reach 31k; one entry per rule paragraph keeps a tool result small.
3. **Spend kept in its own ledger (`chat_usage`)** beside the design's per-message tokens and cost: the design summed `chat_message` cost, which a conversation delete would cascade away (resetting the budget and the cost signal).
4. **Proposals stored with the finished answer**, not when the tool is called: a reclaimed turn would otherwise leave duplicates.
5. **No automatic retry of provider errors inside a turn**; the user retries the failed message.
6. **Client copy for the new error codes deferred** to the UI slices (AD-003 asks for a client entry per code; no client reads them yet).
7. **Applying a proposal enqueues a recommendation run** for its deck, extending card-recommendations' set of deck-list writers.
8. **Deferred foreign keys on the chat tables** (plan Landing door 12): deleting a user failed on two cascade paths meeting on one `chat_proposal` row; found by the e2e teardown, which deletes its users.
9. **Deck proposal rows are bounded at 80** (AC 57) while AC 42 bounds tool lists at 50: AC 57 is the specific rule for that field; `get_owned_copies` keeps 50.

## Needs owner

- ~~Pick a mockup for the chat screen and for the deck chat entry.~~ Picked 2026-10-11: chat B and deck entry 3, with no money amount on screen.
- Pick the assistant's name and mark from `.design/mockups/ai-chat/brand-1..3` (Escudeiro, Tutor, Astrolábio); the pick also goes into `buildSystemInstruction`.
- Before go-live: run the migration on production, set `GEMINI_API_KEY` on the worker service (already there for recommendations), run `chat:grant` for the owner and the three friends, and run `chat:probe` once to prove the live multi-turn function-calling shape.
