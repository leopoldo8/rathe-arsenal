import { NormalizedEmail } from './normalized-email.decorator';

export class ChangeEmailDto {
  @NormalizedEmail()
  email!: string;
}
