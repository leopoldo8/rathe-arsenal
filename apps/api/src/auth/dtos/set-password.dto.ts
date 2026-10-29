import { IsString, Matches, MinLength } from 'class-validator';

export class SetPasswordDto {
  /** The six digits e-mailed by `POST /api/users/me/password-code`. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code must be six digits' })
  code!: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password!: string;
}
