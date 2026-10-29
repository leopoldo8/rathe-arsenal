import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from './normalized-email.decorator';

export class RequestCodeDto {
  @NormalizedEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
