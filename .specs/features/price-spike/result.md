# Price-source spike: result

Run on 2026-10-18.
Question and stop condition are in `plan.md`.

## Recommendation

Build on tcgcsv.com (a daily public mirror of TCGplayer prices), reading the `marketPrice` field, because it is the only source that is both technically readable and allowed by its own published rules.
tcgcsv does not carry TCGplayer's last sale price, only market, low, mid and high, so the feature should be worded "suggested from the market price" and not "from the last sale"; market price is TCGplayer's own average of recent sales.
The fallback for a card with no market price is the mid price, shown as a weaker suggestion, and Star City Games is ruled out because its terms forbid automated reading of prices.

What the owner must decide:

- (a) Whether the market price is an acceptable stand-in for "last sale" in the product and its wording.
- (b) Whether he accepts the grey area that tcgcsv republishes TCGplayer data while TCGplayer's own terms forbid scraping TCGplayer's websites; the alternative is TCGplayer's official API, which needs an approved key that is no longer handed out freely.
- (c) Which printing of a card a sell line is priced from (the catalog has several printings with very different prices, for example 0.06 and 0.30 for two printings of the same card).
- (d) Whether SCG is dropped from the first version, since it cannot be read.

## Card set

The three decks of the synergy spike (Jyrem's Azalea, Big Number Better, Kayo SAGE), loaded from `scripts/synergy-spike/out/decks/`.
Hero and mainboard give 82 distinct cards and 440 printings across rarities (Common 44, Rare 26, Majestic 7, Legendary 4, Fabled 1, by the card's first printing) and finishes (Normal, Rainbow Foil, Cold Foil, Gold Foil, and the 1st Edition and Unlimited variants).

## TCGPlayer

Last sale readable: no, not in a way the terms allow.

- The product page and the JSON that the page calls for its latest sales were not probed.
  TCGplayer's terms (below) forbid crawling or scraping any of its websites without express permission, and `robots.txt` asks for a 10 second delay, so probing stopped there, as the rules of engagement require.
  Whether a public latest-sales endpoint exists is therefore unverified.
- tcgcsv.com exposes `lowPrice`, `midPrice`, `highPrice`, `marketPrice` and `directLowPrice` per product and sub type.
  It has no last sold field, and its FAQ says so: "Can I look at individual listings or see sales for a specific product? Unfortunately no."
- Market price is the stand-in: TCGplayer describes it as using "the value at which a card has recently been selling as a key data point".
  It can be null when sales volume is very low.

How tcgcsv is laid out (all JSON, USD):

- `https://tcgcsv.com/tcgplayer/categories` lists categories; Flesh & Blood is category 62.
- `https://tcgcsv.com/tcgplayer/62/groups` lists 109 groups, one per set (for example group 24914 is Outbreak).
- `https://tcgcsv.com/tcgplayer/62/<groupId>/prices` lists price rows keyed by `productId` plus `subTypeName`.
  The sub types seen are Normal, Rainbow Foil, Cold Foil, 1st Edition (Normal, Rainbow Foil, Cold Foil) and Unlimited Edition (Normal, Rainbow Foil).
- `https://tcgcsv.com/last-updated.txt` holds the time of the last build (2026-10-17T20:05:21+0000 when read); files update once a day around 20:00 UTC.
- It does not publish SKU level data, so there is no price per condition.

Reading by the catalog's `productId`: works.
The catalog's `tcgplayer.productId` is the key of the price rows, and foils of one printing share the product id and differ by sub type, so a printing resolves to a row from `productId`, its edition (First or Unlimited) and its foiling.

Coverage of the card set (market price present for at least one printing of the card):

| Measure | Count |
| --- | --- |
| Distinct cards with a market price | 82 of 82 |
| Cards whose best printing is a non-foil | 78 |
| Cards that are foil-only on TCGplayer | 4 |
| Printings with a market price | 352 of 440 |
| Printings without a market price | 88 |

The 88 printings without a price split into 12 with no `productId` in the catalog, 41 whose product and sub type has no row in tcgcsv, and 35 whose row has a null market price.
By rarity of the first printing, every Common, Rare, Majestic, Legendary and Fabled card of the set had a price.
Of the whole feed, 14,790 of 17,336 rows have a market price.

Sample prices (market price is the field to build on; low and mid for comparison):

| Card | Printing | Sub type | Market USD | Low USD | Mid USD |
| --- | --- | --- | --- | --- | --- |
| Eye of Ophidia | ANQ002 Promos | Normal | 450.00 | 451.19 | 490.63 |
| Scowling Flesh Bag | DTD200 Dusk till Dawn | Cold Foil | 109.23 | 99.99 | 125.00 |
| Fallen Herald | IAR165 Usurp the Shadow Throne | Normal | 25.41 | 23.50 | 29.38 |
| Death Dealer | SAZ002 Azalea Silver Age Deck | Normal | 1.95 | 1.75 | 1.95 |
| Bare Fangs | HVY030 Heavy Hitters | Normal | 0.06 | 0.01 | 0.25 |
| Bare Fangs | AKO007 Armory Deck: Kayo | Normal | 0.30 | 10659.40 | 10659.40 |

The last row shows why market is the field to use and low or mid are not: one listing parked at 10659.40 USD makes both low and mid useless for that printing, while market stays at 0.30.

Cost per card: no money.
A group file covers a whole set, so the cost is one request per set per day (109 groups for the full game, about 110 requests with the group list), against tcgcsv's stated ceiling of 10,000 requests per day.
This spike made about 120 requests to tcgcsv (robots, home, FAQ, docs, categories, last-updated, groups and 109 price files), the price files spaced one second apart.

Terms and robots (retrieved 2026-10-18):

- TCGplayer Terms of Service, `https://help.tcgplayer.com/hc/en-us/articles/205004918-Terms-of-Service` (updated September 27, 2023): "You agree not to crawl, scrape or spider any of our websites without express permission from us. If you want access to our APIs, please visit our Developer Portal."
- Same page: "All of the content found on TCGplayer.com and websites under the TCGplayer.com domain, including graphics, text, buttons, logos, video, audio, downloadable files, pricing information and card databases, are the property of TCGplayer, Inc. and protected by United States and international copyright laws."
- `https://www.tcgplayer.com/robots.txt`: `User-agent: *`, `Crawl-Delay: 10`, `Allow: /`, with disallows for logins, deck and seller pages; `mpapi.tcgplayer.com` and `mp-search-api.tcgplayer.com` return 404 for `robots.txt`.
- tcgcsv `https://tcgcsv.com/robots.txt`: "User-agent: *" and "Allow: /".
- tcgcsv FAQ `https://tcgcsv.com/faq`: "How do I get permission to use TCGCSV? You don't. Permission is implicit." and "Can I scrape this website? ... go ahead! ... Please make sure to review the usage-guidelines".
- tcgcsv docs `https://tcgcsv.com/docs`, usage guidelines: "applications should plan on running a sync-script once every 24 hours", "Don't re-request data fresh from TCGCSV multiple times in a day.", "Don't make requests to TCGCSV directly from user-facing applications.", "Set a custom User-Agent header for all requests", "Include a time.sleep(100ms) in your update loop", and "Applications that make more than 10,000 requests in a 24 hour period may be banned."
- Verdict: tcgcsv allows automated reading under those guidelines, which a build must follow.
  TCGplayer's own sites forbid it, and nothing in tcgcsv's rules speaks for TCGplayer, so the tcgcsv route carries the grey area in decision (b).

## SCG (Star City Games)

Last sale readable: not determined, and not probed, because the terms forbid it.

- The page is behind Cloudflare (the `www` host answers a redirect served by Cloudflare), so with Firecrawl it should be costed like the Brazilian store: assume the `enhanced` proxy at 5 credits per page.
  Whether it throws a challenge to a plain request was not tested.
- Whether SCG lists Flesh and Blood singles was not checked, for the same reason.
- SCG is a retailer, so its price is expected to be its own sell price, not a last sale, but this was not verified.
- Cost per card with Firecrawl, estimated from the table in `docs/research/scraper-cost-scaling.md` and not measured: one page per card at 5 credits is 0.4 cents on the Standard plan (100,000 credits for 83 USD) and 1.6 cents on the Hobby plan (5,000 credits for 16 USD); a card that needs a search page and a product page is double that.
  The Free plan (1,000 credits) covers about 200 cards a month at 5 credits each.

Terms and robots (retrieved 2026-10-18):

- `https://help.starcitygames.com/terms-and-conditions` (shown as "Updated 8 months ago"): "Material, services, data, and information (including pricing information) from, on, or offered through the Site ... may not be scraped, extracted, downloaded, uploaded, sold, or offered for sale or use in any way (including for competitive purposes), without the prior written consent of Star City."
- Same page: "you agree not to use, or cause to be used, any computerized or other manual or automated program or mechanism, tool, or process, including any offline reader, site search/retrieval application, scraper, spider robot, to access, extract, download, scrape, data mine, display, transmit, or publish, any materials, data, or information (including pricing information) on any Star City Website (including the Site itself) for any purpose".
- `https://starcitygames.com/robots.txt`: for `User-agent: *` it disallows `/search/`, `/search.php` and `/search/advanced/` (the singles search a catalog read would use), and it lists many AI crawlers (`ClaudeBot`, `GPTBot`, `Scrapy` and others) with `Crawl-delay: 10`.
- Verdict: forbidden.
  This is the "terms forbid automated access" case, so probing stopped and no price was requested from SCG; Firecrawl would not change that, since the clause covers any automated tool.

## Stop condition

Met: all 82 cards of the card set have a market price from tcgcsv, and SCG is ruled out by its terms.

## What a build slice would need

Design level only, no production code.

Records:

- A price snapshot table keyed by `productId` plus `subTypeName`, with `marketPrice`, `midPrice` and `fetchedAt` (USD, nullable prices), filled from tcgcsv.
- A sell list gains a source (only TCGplayer is available) and a multiplier, and each line keeps the printing it is priced from; the suggested price is `marketPrice` times the multiplier, read as BRL.
- A fixed mapping from a printing's catalog fields to the price key: `tcgplayer.productId`, edition (First, Unlimited) and foiling (Rainbow, Cold, Gold).

When fetching happens:

- A server-side job, never the browser and never per user request, because tcgcsv forbids calls from user-facing applications and asks for one sync per day after `last-updated.txt` changes.
- On demand and limited to what matters: when a sell list line needs a price whose set (group) file has not been read in the last 24 hours, fetch that group's price file once and store every row; groups of sets nobody sells are never read.
  Superseded on 2026-10-20: the job reads every group once a day (`.specs/features/card-lists/contract.md`, Price job), so a card has a price before it is put on a list.
  The catalog does not carry the tcgcsv `groupId`, so the first slice needs a one-time mapping from set to group (the group list has the set name and abbreviation), or reads the group list once per day.

Caching:

- Keep the last snapshot per price key and serve the suggestion from it for a day, showing "market price of <date>" next to the number.
- A null market price falls back to mid price with a visible "approximate" mark; a missing row shows no suggestion and lets the user type a price.
- A failed fetch keeps the previous snapshot, and the job backs off instead of retrying, to stay inside the 10,000 requests per day ceiling.
- Prices are not stored per user: one shared snapshot serves every sell list.

Open question for the plan: 88 of 440 printings in this card set have no market price (12 with no product id, 41 with no row, 35 with a null price), so the line UI needs a clear state for "no suggestion" from the start.
