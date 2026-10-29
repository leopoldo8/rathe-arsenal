import { promises as fs } from 'fs';
import { join } from 'path';

export const PRODUCT_KINDS = ['armory', 'blitz', 'silver_age'] as const;
export type TProductKind = (typeof PRODUCT_KINDS)[number];

export const FORMAT_BY_KIND: Readonly<Record<TProductKind, string>> = {
  armory: 'Classic Constructed',
  blitz: 'Blitz',
  silver_age: 'Silver Age',
};

export interface IProductCard {
  readonly cardIdentifier: string;
  readonly printingCode: string;
  readonly quantity: number;
}

/** One ready-made deck as the official list gives it (door 8): the file is the whole record. */
export interface IProductFile {
  readonly key: string;
  readonly name: string;
  readonly kind: TProductKind;
  readonly format: string;
  /** The hero's card identifier; the hero is also one of `cards`. */
  readonly hero: string;
  readonly cards: readonly IProductCard[];
}

export const PRODUCTS_DIR = Symbol('PRODUCTS_DIR');

/** Where the files sit in the source tree, also when the command runs from `dist`. */
export function productsSourceDir(): string {
  return join(__dirname, '..', '..', 'src', 'products', 'data');
}

export function isProductFile(value: unknown): value is IProductFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as Partial<IProductFile>;
  return (
    typeof file.key === 'string' &&
    typeof file.name === 'string' &&
    typeof file.format === 'string' &&
    typeof file.hero === 'string' &&
    PRODUCT_KINDS.includes(file.kind as TProductKind) &&
    Array.isArray(file.cards) &&
    file.cards.every(
      (card: Partial<IProductCard>) =>
        typeof card.cardIdentifier === 'string' &&
        typeof card.printingCode === 'string' &&
        Number.isInteger(card.quantity) &&
        (card.quantity as number) >= 1,
    )
  );
}

/** The stored files, read each time so a removed file stops being offered at once. */
export async function readProductFiles(directory: string): Promise<IProductFile[]> {
  const names = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const files: IProductFile[] = [];
  for (const name of names) {
    const parsed: unknown = JSON.parse(await fs.readFile(join(directory, name), 'utf-8'));
    if (isProductFile(parsed)) files.push(parsed);
  }
  return files;
}

export function totalCards(file: IProductFile): number {
  return file.cards.reduce((sum, card) => sum + card.quantity, 0);
}
