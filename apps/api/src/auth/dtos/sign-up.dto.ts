import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password!: string;

  // Whitelist validation drops undeclared fields, so this decorator is what lets the token through.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  shareToken?: string;
}
