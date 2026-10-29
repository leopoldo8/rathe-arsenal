import { Matches } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class VerifyCodeDto {
  @NormalizedEmail()
  email!: string;

  @Matches(/^\d{6}$/, { message: 'The code must be six digits' })
  code!: string;
}
