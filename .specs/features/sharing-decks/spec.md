# Sharing decks - Spec

**Source of truth**: `.design/sharing.md` (confirmed 2026-10-18). This spec does not re-derive it: each requirement points at the state table rows of a slice there, and adds only what the code reading forced.
**Scope of this feature**: the first delivery in the design's order - [Shared deck](../../../.design/sharing.md#shared-deck), [Share attribution](../../../.design/sharing.md#share-attribution), [Share Preview](../../../.design/sharing.md#share-preview) for decks, and [Copy Deck](../../../.design/sharing.md#copy-deck).
Card lists, shared lists, list previews and price suggestion are a later feature.

## Requirements

### Shared deck (SD)

| ID | Requirement | Design row |
|---|---|---|
| SD-01 | Turning sharing on stores an unguessable token on the deck and returns its address; turning it on again while on returns the same address | "Owner turns sharing on", "... while it is already on" |
| SD-02 | Turning sharing off clears the token; turning it on again issues a new token, and the old address stays dead | "Owner turns sharing off", "... on again after turning it off" |
| SD-03 | Sharing needs a display name: without one the API refuses with `DISPLAY_NAME_REQUIRED` and the UI asks for it first; the name is editable in Settings | "Owner shares a deck for the first time without a display name"; default 1 |
| SD-04 | The owner sees whether a deck is shared, and its address, on the deck detail, in the sharing card of `share-control-b` | screen pick |
| SD-05 | Anyone with the address sees deck name, hero, format, sharer's display name and the full card list with names and images, the disclaimer and the copyright line; the page is `noindex` | "Anyone opens the deck address" |
| SD-06 | The missing view of the address (`/d/<token>?view=missing`) lists only the cards the owner does not own, counted as the owner's missing panel counts them (`notOwned`), with copy-as-text | "Anyone opens the missing view"; default 2 |
| SD-07 | The page always shows the deck as it is now | "The deck changed since the link was posted" |
| SD-08 | A turned-off, deleted, owner-deleted (including soft-deleted) or unknown address returns `404` `SHARE_LINK_UNAVAILABLE`, and the page reads "this link is no longer available" with no deck data | "Address turned off, deck deleted, owner deleted, or never existed" |
| SD-09 | The first HTML response for `/d/<token>` carries the deck's title, description and preview image in `og:*` tags, escaped, without running script; an unknown token gets the generic title and image | "Address pasted in WhatsApp" |
| SD-10 | An anonymous visitor who wants to compare or copy is offered sign-up or sign-in and comes back to the same address afterwards, including across the email-verification round trip | "Anonymous visitor wants to compare or copy" |

### Share attribution (SA)

| ID | Requirement | Design row |
|---|---|---|
| SA-01 | Turning a link on records `created` with the owner | "Owner turns a share link on" |
| SA-02 | The shared page loading its data records `opened`, with the visitor when logged in; the owner opening their own link records nothing | "A shared page loads its data", "The owner opens their own link" |
| SA-03 | The HTML route and the image route never record anything | "The preview crawler fetches ..." |
| SA-04 | Sign-up with a live `shareToken` stores the link's owner as `referredByUserId`, `referredVia = 'deck'`, and records `signed_up`; a dead or malformed token, or an email that already exists, records nothing and the response is unchanged | "Anonymous visitor signs up ...", "Sign-up from an address that died" |
| SA-05 | `pnpm share:report [--since YYYY-MM-DD] [--until YYYY-MM-DD]` prints distinct users who created links, opens, and sign-ups from links, by target kind | "Owner reviews the bet" |

### Share Preview for decks (SP)

| ID | Requirement | Design row |
|---|---|---|
| SP-01 | `GET /api/shared/decks/:token/image` returns a JPEG of 1200x630 under 600 KB in layout B "Leque": wordmark, deck name, hero, format, sharer, hero face and a fan of deck cards, "© Legend Story Studios", and the share address as text | "Deck address pasted"; image pick |
| SP-02 | The image reflects the current deck and sharer on the next request after any change | "The deck or list changed" |
| SP-03 | A dead or unknown token returns the site's generic image with no card data, `200` | "Address dead or unknown" |
| SP-04 | Generated images are stored, and a script deletes all stored images or those showing given cards, and blocks those cards from future images, without a deploy | "LSS asks for card art to be removed"; Key decision 1 |
| SP-05 | `?download=1` adds a download filename named after the deck; the share card offers the download only while sharing is on | "Owner downloads the image ..." |

### Copy Deck (CD)

| ID | Requirement | Design row |
|---|---|---|
| CD-01 | A logged-in visitor who is not the owner sees their raw exact coverage of the shared deck: owned copies of total, and percent | "Logged-in visitor opens a shared deck" |
| CD-02 | The sharer sees neither comparison nor copy on their own link | "The sharer opens their own shared deck" |
| CD-03 | Copying creates a new deck of the visitor's with the same cards, name, hero and format, status `idea`, no Fabrary origin, and opens it; copying twice creates two | "Visitor copies the deck", "... twice" |
| CD-04 | Copying a link turned off meanwhile creates nothing and returns `404` `SHARE_LINK_UNAVAILABLE` | "Link turned off between loading and copying" |

## Changes forced by the code (recorded back in the design)

- Error codes follow the repository's `UPPER_SNAKE` convention: `SHARE_LINK_UNAVAILABLE`, `DISPLAY_NAME_REQUIRED`.
- `GET /api/decks/:deckId` stays unchanged, so the share card reads the share state from a new `GET /api/decks/:deckId/share`.
- The catalog routes require authentication, so `GET /api/shared/decks/:token` returns cards enriched with name, pitch, type and image, as the deck detail breakdown does, instead of bare identifiers.
- Returning to the shared page after sign-in or sign-up is new work, not existing behaviour: sign-in always went to `/` and the auth layout dropped the location.
