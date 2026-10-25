import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

interface IQuantities {
  readonly quantity?: unknown;
  readonly inventoryQuantity?: unknown;
}

interface IDeckLine {
  readonly cardIdentifier?: unknown;
  readonly slot?: unknown;
}

/** A deck line holds at least one copy, in the deck or in the inventory (door 3's check). */
@ValidatorConstraint({ name: 'DeckLineHoldsACopy', async: false })
export class DeckLineHoldsACopy implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { quantity, inventoryQuantity } = args.object as IQuantities;
    const deckCopies = typeof quantity === 'number' ? quantity : 0;
    const inventoryCopies = typeof inventoryQuantity === 'number' ? inventoryQuantity : 0;
    return deckCopies + inventoryCopies > 0;
  }

  defaultMessage(): string {
    return 'a deck line must hold at least one copy, in the deck or in the inventory';
  }
}

/** One line per deck, card and slot: a second line for the same card and slot is refused, not merged. */
@ValidatorConstraint({ name: 'DeckLinesAreUnique', async: false })
export class DeckLinesAreUnique implements ValidatorConstraintInterface {
  validate(lines: unknown): boolean {
    if (!Array.isArray(lines)) return true;
    const seen = new Set<string>();
    for (const line of lines as readonly IDeckLine[]) {
      const key = `${String(line?.cardIdentifier)}::${String(line?.slot)}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  }

  defaultMessage(): string {
    return 'each card may appear once per slot';
  }
}
