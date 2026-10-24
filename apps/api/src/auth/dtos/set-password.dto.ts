import { IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters' })
  password!: string;
}
