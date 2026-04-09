import { ITrackedDeckDetailSnapshot } from '../../decks/dtos/tracked-deck-detail.response.dto';

export interface IMarkOwnedResponse {
  readonly cardIdentifier: string;
  readonly newQuantity: number;
  readonly snapshot: ITrackedDeckDetailSnapshot;
}
