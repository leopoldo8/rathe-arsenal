export interface ICollectorCodePrinting {
  readonly code: string;
  /** Art code of this printing; absent when it equals `code`, null when the printing has no art. */
  readonly image?: string | null;
}

export interface ICollectorCodeCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly printings: readonly ICollectorCodePrinting[];
}

export interface ICollectorCodesResponse {
  readonly imageSmallBase: string;
  readonly cards: readonly ICollectorCodeCard[];
}
