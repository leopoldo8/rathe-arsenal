import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class StartDto {
  @NormalizedEmail()
  email!: string;

  // Accepted and not verified here: the start step only says which way in an address takes (AC 256).
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
