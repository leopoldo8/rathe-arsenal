import { IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(64, 64, { message: 'Reset token must be a 64-character hex string' })
  token!: string;

  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  newPassword!: string;
}
