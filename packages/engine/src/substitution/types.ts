import { ICatalogCard } from '../catalog/types';

export interface ISubstitutionMatch {
  readonly substitute: ICatalogCard;
  readonly tier: 1;
  readonly score: number;
  readonly rationale: string;
}

export interface IPitchCurve {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
  readonly colorless: number;
}

export interface IPitchDelta {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
}

export interface IPitchTolerance {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
}
