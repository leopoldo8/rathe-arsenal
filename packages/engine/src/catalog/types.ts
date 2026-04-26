import {
  Class,
  Hero,
  Keyword,
  Talent,
  Type,
} from '@flesh-and-blood/types';

export { Class, Hero, Keyword, Talent, Type };

export interface ICatalogCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly classes: readonly Class[];
  readonly talents: readonly Talent[];
  readonly types: readonly Type[];
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly cost: number | null;
  readonly keywords: readonly Keyword[];
  readonly subtypes: readonly string[];
  readonly legalHeroes: readonly string[];
  /**
   * Set identifiers (short codes) this card belongs to. Sourced from
   * `@flesh-and-blood/types` `Card.setIdentifiers` field (e.g. `["WTR"]`,
   * `["WTR", "CRU"]`). Used for set-filter functionality (R30) and as a
   * disambiguation hint for the CSV parser (U3).
   */
  readonly sets: readonly string[];
  /**
   * Public URLs for the card face image (WebP), in two sizes. Derived
   * from `@flesh-and-blood/cards` `defaultImage` field (a printing code
   * like "SKA019") against the LSS public S3 bucket
   * (`legendstory-production-s3-public`). `null` when the source record
   * has no image code.
   *
   * `small` / `large` carry the primary candidate URL — equivalent to
   * `sources[0]` — and exist for callers that don't need the fallback
   * machinery (lightbox tile, link previews). `sources` is the ordered
   * list of candidates: the bare `defaultImage` first, then `-RF`/`-CF`/
   * `-GF` foiling suffixes derived from `printings[]`. Some sets (Armory
   * Decks, judge promos, FAB special editions) only publish the foiled
   * face on LSS S3, so a single-URL approach surfaces the SVG fallback
   * even when LSS does serve the artwork.
   *
   * Sourcing from LSS infrastructure directly (rather than a third-party
   * CDN like Fabrary) keeps the IP posture defensible under the Option A
   * fan-project policy documented in `docs/research/ip-posture.md`: we
   * consume the endpoint the rightsholder chose to expose, not a mirror.
   *
   * The frontend treats each entry in `sources` as best-effort: on HTTP
   * 403/404 or network error it advances to the next candidate, and only
   * after exhausting the list does it fall back to the stylized
   * <CardArt> SVG placeholder.
   */
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly {
          readonly small: string;
          readonly large: string;
        }[];
      }
    | null;
}

export interface ICatalogIndices {
  readonly byIdentifier: ReadonlyMap<string, ICatalogCard>;
  readonly byClassAndPitch: ReadonlyMap<string, readonly ICatalogCard[]>;
  readonly byTypeAndClass: ReadonlyMap<string, readonly ICatalogCard[]>;
  /**
   * Case-insensitive name index. Keys are `name.toLowerCase()`; values are
   * all cards sharing that lowercased name (different pitch variants and/or
   * editions produce multiple entries under one name).
   *
   * Built once at factory time. Intended for O(1) card lookup by name in the
   * CSV parser (U3) — disambiguated via the optional `set` column.
   */
  readonly byName: ReadonlyMap<string, readonly ICatalogCard[]>;
}

export interface ICatalog {
  readonly cards: readonly ICatalogCard[];
  readonly indices: ICatalogIndices;
  getCard(identifier: string): ICatalogCard;
  getRawCard(identifier: string): unknown;
}
