import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SWAP_REJECTION_REASONS, TSwapRejectionReason } from '../resolve-swap-transition';

export class RejectSwapDto {
  @IsOptional()
  @IsIn(SWAP_REJECTION_REASONS, {
    message: 'reason must be one of the defined rejection reasons',
  })
  reason?: TSwapRejectionReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
