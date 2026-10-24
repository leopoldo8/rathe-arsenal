import { IsString, MinLength } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class SignInDto {
  @NormalizedEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
