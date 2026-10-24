import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class SignUpDto {
  @NormalizedEmail()
  email!: string;

  // Optional: an account made with no password signs in with an e-mailed code (door 14).
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password?: string;

  // Whitelist validation drops undeclared fields, so this decorator is what lets the token through.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shareToken?: string;

  // Not length-limited here: a path over 200 characters is stored as null, and sign-up still succeeds (door 14).
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
