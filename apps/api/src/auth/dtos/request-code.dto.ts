import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class RequestCodeDto {
  @NormalizedEmail()
  email!: string;

  // Accepted until the Turnstile check lands (AC 256); not read yet.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
