/** One purchasable version of a card at the store: a price and how many copies are in stock. */
export interface IOfferVersion {
  readonly priceCents: number;
  readonly quantity: number;
  readonly edition: string;
  readonly foil: boolean;
}

export interface IStoreOffer {
  readonly productUrl: string | null;
  readonly versions: readonly IOfferVersion[];
}

export interface IPricedCopies {
  readonly unitPriceCents: number | null;
  readonly lineCents: number;
  readonly availableCopies: number;
  readonly foilOnly: boolean;
  readonly promoOnly: boolean;
}

// Promo editions carry a code such as "PR24" on the store's pages.
const PROMO_EDITION = /^(pr|prm|promo)[-\s]?\d*$/i;

export function isPromoEdition(edition: string): boolean {
  return PROMO_EDITION.test(edition.trim());
}

/**
 * Prices `needed` copies from the cheapest stocked version up, so the line costs what the store would charge
 * and `availableCopies` is what it can supply (at most `needed`).
 */
export function priceCopies(needed: number, offer: IStoreOffer | undefined): IPricedCopies {
  const stocked = [...(offer?.versions ?? [])].filter((version) => version.quantity > 0).sort((a, b) => a.priceCents - b.priceCents);
  if (stocked.length === 0) return { unitPriceCents: null, lineCents: 0, availableCopies: 0, foilOnly: false, promoOnly: false };

  let remaining = needed;
  let lineCents = 0;
  let availableCopies = 0;
  for (const version of stocked) {
    if (remaining <= 0) break;
    const taken = Math.min(remaining, version.quantity);
    lineCents += taken * version.priceCents;
    availableCopies += taken;
    remaining -= taken;
  }
  return {
    unitPriceCents: stocked[0]!.priceCents,
    lineCents,
    availableCopies,
    foilOnly: stocked.every((version) => version.foil),
    promoOnly: stocked.every((version) => isPromoEdition(version.edition)),
  };
}
