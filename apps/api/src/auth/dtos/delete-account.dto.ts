import { IsString, MinLength } from 'class-validator';

/**
 * Phase 1a Unit 2 (A8) — payload for `DELETE /api/auth/me`. The password is
 * re-entered as a destructive-action confirmation gate; we deliberately do
 * not enforce the sign-up `@MinLength(10)` rule here so legacy users with
 * older password policies can still delete their accounts.
 */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password!: string;
}
