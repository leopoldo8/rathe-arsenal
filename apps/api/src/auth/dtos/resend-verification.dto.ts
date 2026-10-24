import { NormalizedEmail } from './normalized-email.decorator';

export class ResendVerificationDto {
  @NormalizedEmail()
  email!: string;
}
