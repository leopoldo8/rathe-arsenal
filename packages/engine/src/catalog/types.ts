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
}

export interface ICatalogIndices {
  readonly byIdentifier: ReadonlyMap<string, ICatalogCard>;
  readonly byClassAndPitch: ReadonlyMap<string, readonly ICatalogCard[]>;
  readonly byTypeAndClass: ReadonlyMap<string, readonly ICatalogCard[]>;
}

export interface ICatalog {
  readonly cards: readonly ICatalogCard[];
  readonly indices: ICatalogIndices;
  getCard(identifier: string): ICatalogCard;
  getRawCard(identifier: string): unknown;
}
