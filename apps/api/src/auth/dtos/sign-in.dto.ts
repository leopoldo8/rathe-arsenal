import { IsNotEmpty, IsString } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class SignInDto {
  @NormalizedEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
