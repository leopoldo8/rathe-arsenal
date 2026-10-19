import { TDeckShareIntent } from '../../database/entities/share-link.entity';

export interface ILinkState {
  intent: TDeckShareIntent;
  url: string;
  token: string;
  showContact: boolean;
}

export interface IDeckShareState {
  deck: ILinkState | null;
  missing: ILinkState | null;
}
