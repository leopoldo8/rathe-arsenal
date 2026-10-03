import { IsIn } from 'class-validator';
import { SWAP_OUTCOMES, TSwapOutcome } from '../resolve-swap-transition';

export class SwapOutcomeDto {
  @IsIn(SWAP_OUTCOMES, {
    message: "outcome must be 'worked' or 'did_not_work'",
  })
  outcome!: TSwapOutcome;
}
