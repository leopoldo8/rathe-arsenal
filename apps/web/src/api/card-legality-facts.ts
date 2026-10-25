export interface ICardLegalityOverride {
  readonly format: string;
  readonly heroes: readonly string[];
}

/**
 * The legality facts of a card beyond its legal formats, legal heroes and bans, which the API
 * sends so the browser can run the engine's rules itself. Missing means the API did not send it.
 */
export interface ICardLegalityExtraFacts {
  readonly restrictedFormats?: readonly string[];
  readonly legalOverrides?: readonly ICardLegalityOverride[];
  readonly specializations?: readonly string[];
  readonly legendary?: boolean;
}
