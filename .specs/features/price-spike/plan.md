# Price-source spike

A throwaway probe, outside the product, that decides where the suggested sell price of a card can come from.
The design it serves is `.design/sharing.md`, slice "Price suggestion".

## Problem

Players in Brazil price the cards they sell at 4x to 8x (7x typical) the card's last sale price in US dollars on TCGPlayer or Star City Games, read directly as BRL with no exchange rate.
The planned feature picks a source and a multiplier per sell list and suggests, per line, last sale in USD times the multiplier.
Prices would be fetched only for cards on sell lists, on demand, and cached, never by a periodic crawl of a whole catalog (see `docs/research/scraper-cost-scaling.md`).
Nobody has checked whether either source can be read at all, in which field, or whether its terms allow it.

## Questions

1. TCGPlayer: can the last sale price be read by the `productId` the catalog already carries, from the product page, from a public JSON the page calls, or from tcgcsv.com?
   If not, is the market price an acceptable stand-in?
2. SCG: can the Flesh and Blood singles catalog be read, is it behind anti-bot protection, what would it cost per card with Firecrawl, and is its price a last sale or its own sell price?
3. Terms: what do each source's terms of service and robots.txt allow for automated reading of prices?

## Method

- Card set: every distinct card (hero and mainboard) of the three decks of the synergy spike (`scripts/synergy-spike/out/decks/`), resolved to its printings through the engine catalog.
- Read terms and robots.txt of a source before probing it. A source whose terms forbid automated access is not probed further, and that is recorded as the finding.
- Politeness: at most one request per second, an identifying User-Agent, no login, no CAPTCHA solving, no bypassing of protection, no paid service.
- Probe script: `pnpm price:coverage` downloads the tcgcsv Flesh and Blood price files once (cached under the gitignored `scripts/price-spike/out/`) and joins them to the card set. `pnpm price:test` runs the unit tests of the parsing and coverage logic.

## Stop condition

Every card of the card set has a price from at least one working, allowed source, or both sources are ruled out technically or by their terms.
