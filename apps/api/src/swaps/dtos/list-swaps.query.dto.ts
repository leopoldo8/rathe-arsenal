import { IsIn, IsOptional } from 'class-validator';

export const SWAP_LIST_STATES = ['pending', 'approved', 'rejected', 'all'] as const;
export type TSwapListState = (typeof SWAP_LIST_STATES)[number];

export class ListSwapsQueryDto {
  @IsOptional()
  @IsIn(SWAP_LIST_STATES)
  state?: TSwapListState;
}
