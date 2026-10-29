import { IsString, Length } from 'class-validator';

export class RedeemCodeDto {
  @IsString()
  @Length(64, 64, { message: 'The token must be a 64-character hex string' })
  token!: string;
}
