import { IsString, ValidateIf } from 'class-validator';

export class UpdateContactDto {
  // `null` clears the number; an absent field must still fail, so IsOptional is not used.
  @ValidateIf((dto: UpdateContactDto) => dto.whatsappNumber !== null)
  @IsString()
  whatsappNumber!: string | null;
}
