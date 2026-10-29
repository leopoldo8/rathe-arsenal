export interface ICollectorCodePrinting {
  readonly code: string;
  /** Art code of this printing; absent when it equals `code`, null when the printing has no art. */
  readonly image?: string | null;
  /** The editions this code exists in; absent when the catalog names none. */
  readonly editions?: readonly ('first' | 'unlimited' | 'alpha')[];
  /** The finishes this code exists in (`none` is the plain one); absent when it only exists plain. */
  readonly finishes?: readonly ('none' | 'rainbow' | 'cold' | 'gold')[];
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
